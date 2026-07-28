// ============================================================================
// design-experiment-protocol
// ----------------------------------------------------------------------------
// Turns a proposed protocol (from the ProtocolBuilder UI) into a persisted
// experiment in `phase=draft` with a versioned protocol row. Validates that
// the primary outcome is either manually observable (simulator_daily_observations)
// or bound to admitted patient data (labs/InBody/FibroScan/CIE via witness ctx).
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATEGORIES = ["food", "sleep", "movement", "stress", "timing", "recovery"];

interface ProtocolPayload {
  user_id: string;
  source_card_id?: string | null;
  hypothesis_question: string;
  perturbation_category: string;
  lever: string;
  rationale: string;
  intervention: Record<string, unknown>;
  primary_outcome: {
    source: "manual" | "lab" | "inbody" | "fibroscan" | "cie";
    name: string;
    unit?: string;
    direction: "increase" | "decrease" | "stabilize";
    cadence: "daily" | "per_session" | "weekly";
  };
  secondary_outcomes?: Array<Record<string, unknown>>;
  hold_stable?: string[];
  allowed_cointerventions?: string[];
  run_in_days: number;
  intervention_days: number;
  washout_days?: number | null;
  crossover?: Record<string, unknown> | null;
  min_observations_per_phase?: number;
  min_adherence_pct?: number;
  stop_criteria?: string[];
  contraindications?: string[];
  clinician_review_required?: boolean;
  expected_direction?: string;
  horizon_days?: number;
  predicted_deltas?: Array<Record<string, unknown>>;
  source_cluster_ids?: string[];
  source_terrain_render_id?: string | null;
}

function validate(p: ProtocolPayload): string[] {
  const missing: string[] = [];
  if (!p.user_id) missing.push("user_id");
  if (!p.hypothesis_question || p.hypothesis_question.length < 8) missing.push("hypothesis_question");
  if (!CATEGORIES.includes(p.perturbation_category)) missing.push("perturbation_category");
  if (!p.lever) missing.push("lever");
  if (!p.rationale) missing.push("rationale");
  if (!p.primary_outcome?.name) missing.push("primary_outcome.name");
  if (!p.primary_outcome?.direction) missing.push("primary_outcome.direction");
  if (!p.primary_outcome?.cadence) missing.push("primary_outcome.cadence");
  if (!p.primary_outcome?.source) missing.push("primary_outcome.source");
  if (!p.run_in_days || p.run_in_days < 3) missing.push("run_in_days≥3");
  if (!p.intervention_days || p.intervention_days < 5) missing.push("intervention_days≥5");
  return missing;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const p = (await req.json()) as ProtocolPayload;
    const missing = validate(p);
    if (missing.length) {
      return new Response(JSON.stringify({ error: "missing_fields", missing }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Insert experiment (phase = draft).
    const { data: expInsert, error: expErr } = await supabase
      .from("simulator_experiments")
      .insert({
        user_id: p.user_id,
        source_card_id: p.source_card_id ?? null,
        lever: p.lever,
        rationale: p.rationale,
        predicted_deltas: p.predicted_deltas ?? [],
        horizon_days: p.horizon_days ?? (p.run_in_days + p.intervention_days),
        source_cluster_ids: p.source_cluster_ids ?? [],
        source_terrain_render_id: p.source_terrain_render_id ?? null,
        status: "active",
        phase: "draft",
        phase_started_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (expErr) throw expErr;

    const { data: protoInsert, error: protoErr } = await supabase
      .from("simulator_experiment_protocols")
      .insert({
        experiment_id: (expInsert as any).id,
        user_id: p.user_id,
        protocol_version: 1,
        hypothesis_question: p.hypothesis_question,
        perturbation_category: p.perturbation_category,
        intervention: p.intervention || {},
        primary_outcome: p.primary_outcome,
        secondary_outcomes: p.secondary_outcomes ?? [],
        hold_stable: p.hold_stable ?? [],
        allowed_cointerventions: p.allowed_cointerventions ?? [],
        run_in_days: p.run_in_days,
        intervention_days: p.intervention_days,
        washout_days: p.washout_days ?? null,
        crossover: p.crossover ?? null,
        min_observations_per_phase: p.min_observations_per_phase ?? 5,
        min_adherence_pct: p.min_adherence_pct ?? 0.7,
        stop_criteria: p.stop_criteria ?? [],
        contraindications: p.contraindications ?? [],
        clinician_review_required: p.clinician_review_required ?? false,
        expected_direction: p.expected_direction ?? p.primary_outcome.direction,
        admission_verdict: "ADMIT",
        admission_reasons: { source: "design-experiment-protocol" },
      })
      .select()
      .single();
    if (protoErr) throw protoErr;

    // Link the source card to this experiment (if any).
    if (p.source_card_id) {
      await supabase
        .from("simulator_what_if_cards")
        .update({ committed_experiment_id: (expInsert as any).id })
        .eq("id", p.source_card_id);
    }

    return new Response(
      JSON.stringify({ experiment: expInsert, protocol: protoInsert }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("design-experiment-protocol error:", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});