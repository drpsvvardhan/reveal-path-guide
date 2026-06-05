// supabase/functions/generate-clusters/index.ts
//
// Triangulation orchestrator: generator → critic → reconciler → validator → INSERT.
// Uses EdgeRuntime.waitUntil() to run the 3-pass pipeline in the background
// and return a 202 immediately, preventing timeout on the HTTP connection.

// Using built-in Deno.serve (no remote std import) — std@0.168.0 was returning 500 from the bundler.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { FRAMEWORK_V2 } from "../_shared/framework_v2.ts";
import {
  generatorSystemPrompt,
  criticSystemPrompt,
  reconcilerSystemPrompt,
} from "../_shared/clusterPrompts.ts";
import { loadPatientContext, compressContextForCritique } from "../_shared/contextLoader.ts";
import { validateReconcilerOutput } from "./validator.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Using Lovable AI Gateway with strong reasoning models
const GENERATOR_MODEL = "google/gemini-2.5-pro";
const CRITIC_MODEL = "google/gemini-2.5-flash";
const RECONCILER_MODEL = "google/gemini-2.5-pro";

function stripJsonFences(text: string): string {
  return text
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}

async function callLLM(
  apiKey: string,
  model: string,
  system: string,
  user: string,
  maxRetries = 3
): Promise<string> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
      }),
    });

    if (response.status === 429 && attempt < maxRetries) {
      const waitMs = 10_000 * (attempt + 1);
      console.log(`[generate-clusters] Rate limited (429). Waiting ${waitMs / 1000}s before retry ${attempt + 1}/${maxRetries}`);
      await response.text();
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI Gateway error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("AI Gateway returned no content");
    }
    return stripJsonFences(content);
  }
  throw new Error("Max retries exceeded for AI Gateway call");
}

async function runTriangulationPipeline(patientId: string) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const context = await loadPatientContext(SUPABASE_URL, SERVICE_ROLE_KEY, patientId);
    // context.patient_id is the canonical profiles.id (FK target for clusters table)
    const canonicalPatientId = context.patient_id;
    const contextJson = JSON.stringify(context, null, 2);
    const contextCompressed = compressContextForCritique(context);
    const generationRunId = crypto.randomUUID();

    // ── Pass 1 — Generator ──────────────────────────────────────────────
    console.log(`[generate-clusters] Pass 1 (generator) starting for patient ${patientId}`);
    const generatorRaw = await callLLM(
      LOVABLE_API_KEY, GENERATOR_MODEL,
      generatorSystemPrompt(FRAMEWORK_V2),
      `PATIENT CONTEXT:\n\n${contextJson}\n\nProduce the cluster set following the framework and the four reasoning principles. Respond with valid JSON only, no markdown fences.`
    );
    let generatorOutput: any;
    try { generatorOutput = JSON.parse(generatorRaw); }
    catch (e) { throw new Error(`Generator invalid JSON: ${(e as Error).message}\n${generatorRaw.slice(0, 500)}`); }
    console.log(`[generate-clusters] Pass 1 complete: ${generatorOutput.clusters?.length ?? 0} candidates`);

    // ── Pass 2 — Critic (compressed context) ────────────────────────────
    console.log(`[generate-clusters] Pass 2 (critic) starting`);
    const criticRaw = await callLLM(
      LOVABLE_API_KEY, CRITIC_MODEL,
      criticSystemPrompt(FRAMEWORK_V2),
      `PATIENT CONTEXT (compressed terrain summary — use this to verify that evidence ids referenced by the generator actually exist and that the values match):\n\n${contextCompressed}\n\nGENERATOR OUTPUT:\n\n${JSON.stringify(generatorOutput, null, 2)}\n\nCritique the cluster set against Framework v2. Respond with valid JSON only, no markdown fences.`
    );
    let criticOutput: any;
    try { criticOutput = JSON.parse(criticRaw); }
    catch (e) { throw new Error(`Critic invalid JSON: ${(e as Error).message}\n${criticRaw.slice(0, 500)}`); }
    console.log(`[generate-clusters] Pass 2 complete: ${criticOutput.critiques?.length ?? 0} critiques`);

    // ── Pass 3 — Reconciler (compressed context) ────────────────────────
    console.log(`[generate-clusters] Pass 3 (reconciler) starting`);
    const reconcilerRaw = await callLLM(
      LOVABLE_API_KEY, RECONCILER_MODEL,
      reconcilerSystemPrompt(FRAMEWORK_V2),
      `PATIENT CONTEXT (compressed terrain summary — use this to verify that evidence ids referenced by the generator and critic actually exist):\n\n${contextCompressed}\n\nGENERATOR OUTPUT:\n\n${JSON.stringify(generatorOutput, null, 2)}\n\nCRITIC CRITIQUE:\n\n${JSON.stringify(criticOutput, null, 2)}\n\nProduce the final repaired cluster set. Respond with valid JSON only, no markdown fences.`
    );
    let reconcilerOutput: any;
    try { reconcilerOutput = JSON.parse(reconcilerRaw); }
    catch (e) { throw new Error(`Reconciler invalid JSON: ${(e as Error).message}\n${reconcilerRaw.slice(0, 500)}`); }
    console.log(`[generate-clusters] Pass 3 complete: ${reconcilerOutput.clusters?.length ?? 0} reconciled`);

    // ── Validate and compute confidence ─────────────────────────────────
    const writePayloads = validateReconcilerOutput(reconcilerOutput, canonicalPatientId, generationRunId);
    const accepted = writePayloads.filter((p) => !p.validation.rejected);
    const rejected = writePayloads.filter((p) => p.validation.rejected);
    console.log(`[generate-clusters] Validation: ${accepted.length} accepted, ${rejected.length} rejected`);

    // ── Supersede previous active clusters ──────────────────────────────
    await sb.from("clusters").update({ status: "superseded" }).eq("patient_id", canonicalPatientId).eq("status", "active");

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured.");
    }

    const { authenticateRequest, resolveTargetUserId } = await import("../_shared/auth.ts");
    const authResult = await authenticateRequest(req);
    if (!authResult.ok) {
      return new Response(JSON.stringify(authResult.error.body), {
        status: authResult.error.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { patient_id } = await req.json();
    if (!patient_id) {
      return new Response(JSON.stringify({ error: "patient_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // patient_id here is actually a user_id (matches loadPatientContext contract).
    const resolved = await resolveTargetUserId(authResult.auth, patient_id);
    if (!resolved.ok) {
      return new Response(JSON.stringify(resolved.error.body), {
        status: resolved.error.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
