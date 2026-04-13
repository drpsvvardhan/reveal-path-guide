// supabase/functions/generate-clusters/index.ts
//
// Triangulation orchestrator: generator → critic → reconciler → validator → INSERT.
// Uses EdgeRuntime.waitUntil() to run the 3-pass pipeline in the background
// and return a 202 immediately, preventing timeout on the HTTP connection.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { FRAMEWORK_V2 } from "../_shared/framework_v2.ts";
import {
  generatorSystemPrompt,
  criticSystemPrompt,
  reconcilerSystemPrompt,
} from "../_shared/clusterPrompts.ts";
import { loadPatientContext } from "./contextLoader.ts";
import { validateReconcilerOutput } from "./validator.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GENERATOR_MODEL = "claude-sonnet-4-20250514";
const CRITIC_MODEL = "claude-sonnet-4-20250514";
const RECONCILER_MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 8000;

function stripJsonFences(text: string): string {
  return text
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}

async function callClaude(
  apiKey: string,
  model: string,
  system: string,
  user: string
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((b: any) => b.type === "text");
  if (!textBlock) {
    throw new Error("Claude returned no text content");
  }
  return stripJsonFences(textBlock.text);
}

async function runTriangulationPipeline(patientId: string) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const context = await loadPatientContext(SUPABASE_URL, SERVICE_ROLE_KEY, patientId);
    const contextJson = JSON.stringify(context, null, 2);
    const generationRunId = crypto.randomUUID();

    // ── Pass 1 — Generator ──────────────────────────────────────────────
    console.log(`[generate-clusters] Pass 1 (generator) starting for patient ${patientId}`);
    const generatorRaw = await callClaude(
      ANTHROPIC_API_KEY, GENERATOR_MODEL,
      generatorSystemPrompt(FRAMEWORK_V2),
      `PATIENT CONTEXT:\n\n${contextJson}\n\nProduce the cluster set following the framework and the four reasoning principles.`
    );
    let generatorOutput: any;
    try { generatorOutput = JSON.parse(generatorRaw); }
    catch (e) { throw new Error(`Generator invalid JSON: ${(e as Error).message}\n${generatorRaw.slice(0, 500)}`); }
    console.log(`[generate-clusters] Pass 1 complete: ${generatorOutput.clusters?.length ?? 0} candidates`);

    // ── Pass 2 — Critic ─────────────────────────────────────────────────
    console.log(`[generate-clusters] Pass 2 (critic) starting`);
    const criticRaw = await callClaude(
      ANTHROPIC_API_KEY, CRITIC_MODEL,
      criticSystemPrompt(FRAMEWORK_V2),
      `PATIENT CONTEXT:\n\n${contextJson}\n\nGENERATOR OUTPUT:\n\n${JSON.stringify(generatorOutput, null, 2)}\n\nCritique the cluster set against Framework v2.`
    );
    let criticOutput: any;
    try { criticOutput = JSON.parse(criticRaw); }
    catch (e) { throw new Error(`Critic invalid JSON: ${(e as Error).message}\n${criticRaw.slice(0, 500)}`); }
    console.log(`[generate-clusters] Pass 2 complete: ${criticOutput.critiques?.length ?? 0} critiques`);

    // ── Pass 3 — Reconciler ─────────────────────────────────────────────
    console.log(`[generate-clusters] Pass 3 (reconciler) starting`);
    const reconcilerRaw = await callClaude(
      ANTHROPIC_API_KEY, RECONCILER_MODEL,
      reconcilerSystemPrompt(FRAMEWORK_V2),
      `PATIENT CONTEXT:\n\n${contextJson}\n\nGENERATOR OUTPUT:\n\n${JSON.stringify(generatorOutput, null, 2)}\n\nCRITIC CRITIQUE:\n\n${JSON.stringify(criticOutput, null, 2)}\n\nProduce the final repaired cluster set.`
    );
    let reconcilerOutput: any;
    try { reconcilerOutput = JSON.parse(reconcilerRaw); }
    catch (e) { throw new Error(`Reconciler invalid JSON: ${(e as Error).message}\n${reconcilerRaw.slice(0, 500)}`); }
    console.log(`[generate-clusters] Pass 3 complete: ${reconcilerOutput.clusters?.length ?? 0} reconciled`);

    // ── Validate and compute confidence ─────────────────────────────────
    const writePayloads = validateReconcilerOutput(reconcilerOutput, patientId, generationRunId);
    const accepted = writePayloads.filter((p) => !p.validation.rejected);
    const rejected = writePayloads.filter((p) => p.validation.rejected);
    console.log(`[generate-clusters] Validation: ${accepted.length} accepted, ${rejected.length} rejected`);

    // ── Supersede previous active clusters ──────────────────────────────
    await sb.from("clusters").update({ status: "superseded" }).eq("patient_id", patientId).eq("status", "active");

    // ── Insert accepted clusters + evidence ─────────────────────────────
    for (const payload of accepted) {
      const { data: ins, error: clusterErr } = await sb
        .from("clusters").insert(payload.cluster_row).select("id").single();
      if (clusterErr || !ins) { console.error(`Cluster INSERT failed: ${clusterErr?.message}`); continue; }
      const evidenceRows = payload.evidence_rows.map((r) => ({ ...r, cluster_id: ins.id }));
      if (evidenceRows.length > 0) {
        const { error: evErr } = await sb.from("cluster_evidence").insert(evidenceRows);
        if (evErr) console.error(`Evidence INSERT failed: ${evErr.message}`);
      }
    }

    console.log(`[generate-clusters] ✅ Done. Inserted ${accepted.length} clusters, rejected ${rejected.length} for patient ${patientId}`);
    if (rejected.length > 0) {
      console.log(`[generate-clusters] Rejected: ${JSON.stringify(rejected.map(r => ({ kind: r.cluster_row.cluster_kind, reasons: r.validation.rejection_reasons })))}`);
    }
  } catch (e) {
    console.error(`[generate-clusters] ❌ Pipeline failed: ${(e as Error).message}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured.");
    }

    const { patient_id } = await req.json();
    if (!patient_id) {
      return new Response(JSON.stringify({ error: "patient_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fire the pipeline in the background so the HTTP response returns immediately
    EdgeRuntime.waitUntil(runTriangulationPipeline(patient_id));

    return new Response(
      JSON.stringify({ ok: true, status: "processing", patient_id }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
