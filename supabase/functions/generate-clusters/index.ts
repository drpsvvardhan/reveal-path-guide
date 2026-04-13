// supabase/functions/generate-clusters/index.ts
//
// Triangulation orchestrator: generator → critic → reconciler → validator → INSERT.

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY is not configured. Add it to edge function secrets."
      );
    }

    const { patient_id } = await req.json();
    if (!patient_id) {
      return new Response(
        JSON.stringify({ error: "patient_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Load patient context
    const context = await loadPatientContext(
      SUPABASE_URL,
      SERVICE_ROLE_KEY,
      patient_id
    );
    const contextJson = JSON.stringify(context, null, 2);

    // Generation run id
    const generationRunId = crypto.randomUUID();

    // ── Pass 1 — Generator ──────────────────────────────────────────────
    console.log(
      `[generate-clusters] Pass 1 (generator) starting for patient ${patient_id}`
    );
    const generatorPrompt = generatorSystemPrompt(FRAMEWORK_V2);
    const generatorUser = `PATIENT CONTEXT:\n\n${contextJson}\n\nProduce the cluster set following the framework and the four reasoning principles.`;
    const generatorRaw = await callClaude(
      ANTHROPIC_API_KEY,
      GENERATOR_MODEL,
      generatorPrompt,
      generatorUser
    );
    let generatorOutput: any;
    try {
      generatorOutput = JSON.parse(generatorRaw);
    } catch (e) {
      throw new Error(
        `Generator returned invalid JSON: ${(e as Error).message}\nRaw: ${generatorRaw.slice(0, 500)}`
      );
    }
    console.log(
      `[generate-clusters] Pass 1 complete: ${generatorOutput.clusters?.length ?? 0} candidate clusters`
    );

    // ── Pass 2 — Critic ─────────────────────────────────────────────────
    console.log(`[generate-clusters] Pass 2 (critic) starting`);
    const criticPrompt = criticSystemPrompt(FRAMEWORK_V2);
    const criticUser = `PATIENT CONTEXT:\n\n${contextJson}\n\nGENERATOR OUTPUT:\n\n${JSON.stringify(generatorOutput, null, 2)}\n\nCritique the cluster set against Framework v2.`;
    const criticRaw = await callClaude(
      ANTHROPIC_API_KEY,
      CRITIC_MODEL,
      criticPrompt,
      criticUser
    );
    let criticOutput: any;
    try {
      criticOutput = JSON.parse(criticRaw);
    } catch (e) {
      throw new Error(
        `Critic returned invalid JSON: ${(e as Error).message}\nRaw: ${criticRaw.slice(0, 500)}`
      );
    }
    console.log(
      `[generate-clusters] Pass 2 complete: ${criticOutput.critiques?.length ?? 0} critiques, ${criticOutput.missing_clusters?.length ?? 0} missing clusters`
    );

    // ── Pass 3 — Reconciler ─────────────────────────────────────────────
    console.log(`[generate-clusters] Pass 3 (reconciler) starting`);
    const reconcilerPrompt = reconcilerSystemPrompt(FRAMEWORK_V2);
    const reconcilerUser = `PATIENT CONTEXT:\n\n${contextJson}\n\nGENERATOR OUTPUT:\n\n${JSON.stringify(generatorOutput, null, 2)}\n\nCRITIC CRITIQUE:\n\n${JSON.stringify(criticOutput, null, 2)}\n\nProduce the final repaired cluster set.`;
    const reconcilerRaw = await callClaude(
      ANTHROPIC_API_KEY,
      RECONCILER_MODEL,
      reconcilerPrompt,
      reconcilerUser
    );
    let reconcilerOutput: any;
    try {
      reconcilerOutput = JSON.parse(reconcilerRaw);
    } catch (e) {
      throw new Error(
        `Reconciler returned invalid JSON: ${(e as Error).message}\nRaw: ${reconcilerRaw.slice(0, 500)}`
      );
    }
    console.log(
      `[generate-clusters] Pass 3 complete: ${reconcilerOutput.clusters?.length ?? 0} reconciled clusters`
    );

    // ── Validate and compute confidence ─────────────────────────────────
    const writePayloads = validateReconcilerOutput(
      reconcilerOutput,
      patient_id,
      generationRunId
    );

    const accepted = writePayloads.filter((p) => !p.validation.rejected);
    const rejected = writePayloads.filter((p) => p.validation.rejected);

    console.log(
      `[generate-clusters] Validation: ${accepted.length} accepted, ${rejected.length} rejected`
    );

    // ── Supersede previous active clusters ──────────────────────────────
    const { error: supersedeErr } = await sb
      .from("clusters")
      .update({ status: "superseded" })
      .eq("patient_id", patient_id)
      .eq("status", "active");
    if (supersedeErr) {
      throw new Error(
        `Failed to supersede previous clusters: ${supersedeErr.message}`
      );
    }

    // ── Insert accepted clusters + evidence ─────────────────────────────
    const insertedClusters: any[] = [];
    for (const payload of accepted) {
      const { data: insertedCluster, error: clusterErr } = await sb
        .from("clusters")
        .insert(payload.cluster_row)
        .select("id")
        .single();
      if (clusterErr || !insertedCluster) {
        throw new Error(`Cluster INSERT failed: ${clusterErr?.message}`);
      }
      const clusterId = insertedCluster.id;
      const evidenceRows = payload.evidence_rows.map((r) => ({
        ...r,
        cluster_id: clusterId,
      }));
      if (evidenceRows.length > 0) {
        const { error: evidenceErr } = await sb
          .from("cluster_evidence")
          .insert(evidenceRows);
        if (evidenceErr) {
          throw new Error(
            `cluster_evidence INSERT failed: ${evidenceErr.message}`
          );
        }
      }
      insertedClusters.push({
        id: clusterId,
        cluster_kind: payload.cluster_row.cluster_kind,
        confidence_tier: payload.cluster_row.confidence_tier,
        confidence_score: payload.cluster_row.confidence_score,
      });
    }

    console.log(
      `[generate-clusters] Done. Inserted ${insertedClusters.length} clusters for patient ${patient_id}`
    );

    return new Response(
      JSON.stringify({
        ok: true,
        generation_run_id: generationRunId,
        inserted_clusters: insertedClusters,
        rejected_clusters: rejected.map((r) => ({
          kind: r.cluster_row.cluster_kind,
          reasons: r.validation.rejection_reasons,
        })),
        critic_summary: criticOutput?.overall_assessment ?? null,
        reconciliation_notes:
          reconcilerOutput?.reconciliation_notes ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(`[generate-clusters] Error: ${(e as Error).message}`);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
