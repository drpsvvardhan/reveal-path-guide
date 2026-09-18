// ============================================================================
// compare-experiment-phases
// ----------------------------------------------------------------------------
// Deterministic n=1 comparator. Reads daily observations for an experiment,
// compares run_in vs intervention (or a specified pair) using pure rules in
// _shared/ppe/comparator.ts, persists a comparison row, transitions the
// experiment phase, and creates a provisional learning row.
//
// NO LLM in the decision. LLM narration is optional and additive.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { comparePhases, type DailyObservation, type Direction } from "../_shared/ppe/comparator.ts";
import { authenticateRequest, resolveTargetUserId, jsonResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authRes = await authenticateRequest(req);
    if (!authRes.ok) return jsonResponse(authRes.error.body, authRes.error.status, corsHeaders);

    const { experiment_id, phase_a = "run_in", phase_b = "intervention" } = await req.json();
    if (!experiment_id) {
      return new Response(JSON.stringify({ error: "experiment_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: exp } = await supabase
      .from("simulator_experiments").select("*").eq("id", experiment_id).maybeSingle();
    if (!exp) throw new Error("experiment not found");

    const owner = await resolveTargetUserId(authRes.auth, (exp as { user_id: string }).user_id);
    if (!owner.ok) return jsonResponse(owner.error.body, owner.error.status, corsHeaders);
    const ownerId = (exp as { user_id: string }).user_id;

    const [{ data: proto }, { data: obs }] = await Promise.all([
      supabase.from("simulator_experiment_protocols").select("*").eq("experiment_id", experiment_id).eq("user_id", ownerId).order("protocol_version", { ascending: false }).limit(1).maybeSingle(),
      // Defence in depth: only the plan owner's own entries are ever compared,
      // even if a row were somehow attached to this plan by someone else.
      supabase
        .from("simulator_daily_observations")
        .select("phase,intervention_performed,primary_value,confounders,observed_on,user_id")
        .eq("experiment_id", experiment_id)
        .eq("user_id", ownerId)
        .order("observed_on", { ascending: true }),
    ]);
    if (!proto) throw new Error("protocol not found");

    // Cycle identity: the exact entries this comparison was computed from. Two
    // comparisons over the same entries are ONE cycle, however often the
    // endpoint is called. This changes no comparator arithmetic.
    const fingerprintSource = JSON.stringify(
      ((obs || []) as Record<string, unknown>[]).map((o) => [
        o.observed_on, o.phase, o.primary_value, o.intervention_performed,
      ]),
    );
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprintSource));
    const observationFingerprint = `sha256:${Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0")).join("")}`;

    const { data: priorCmp } = await supabase
      .from("simulator_experiment_comparisons")
      .select("*")
      .eq("experiment_id", experiment_id)
      .eq("user_id", ownerId)
      .eq("phase_a", phase_a)
      .eq("phase_b", phase_b)
      .eq("observation_fingerprint", observationFingerprint)
      .maybeSingle();
    if (priorCmp) {
      // Same entries, same answer. No duplicate comparison, no duplicate
      // learning, and therefore no way to manufacture a second cycle.
      return new Response(
        JSON.stringify({ comparison: priorCmp, next_phase: (exp as any).phase, replayed: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const direction: Direction = (proto as any).primary_outcome?.direction || "decrease";
    const stopped_for_safety = (exp as any).stopped_reason?.startsWith?.("safety") ?? false;

    const result = comparePhases({
      phase_a,
      phase_b,
      observations: (obs || []) as DailyObservation[],
      desired_direction: direction,
      min_observations_per_phase: (proto as any).min_observations_per_phase,
      min_adherence_pct: (proto as any).min_adherence_pct,
      stopped_for_safety,
    });

    const { data: cmpRow, error: cmpErr } = await supabase
      .from("simulator_experiment_comparisons")
      .insert({
        experiment_id,
        user_id: (exp as any).user_id,
        phase_a, phase_b,
        n_a: result.n_a, n_b: result.n_b,
        median_a: result.median_a, median_b: result.median_b,
        abs_change: result.abs_change, pct_change: result.pct_change,
        direction_consistency_pct: result.direction_consistency_pct,
        overlap_ratio: result.overlap_ratio,
        adherence_pct: result.adherence_pct,
        missingness_pct: result.missingness_pct,
        confounder_burden: result.confounder_burden,
        result: result.result,
        reasons: result.reasons,
        human_summary: result.human_summary,
        observation_fingerprint: observationFingerprint,
      })
      .select()
      .single();
    if (cmpErr) throw cmpErr;

    // Transition phase.
    const nextPhase = result.result === "STOPPED_FOR_SAFETY"
      ? "stopped"
      : result.result === "NOT_INTERPRETABLE"
        ? "not_interpretable"
        : "completed";
    await supabase
      .from("simulator_experiments")
      .update({ phase: nextPhase, ended_at: new Date().toISOString() })
      .eq("id", experiment_id);

    // Provisional learning — never graduated on a single cycle.
    if (result.result === "SIGNAL_DETECTED" || result.result === "POSSIBLE_SIGNAL" || result.result === "NO_DETECTABLE_SIGNAL") {
      await supabase.from("simulator_learnings").insert({
        user_id: ownerId,
        comparison_id: (cmpRow as any).id,
        observation_fingerprint: observationFingerprint,
        experiment_id,
        kind: "n1_cycle_result",
        headline: `${(exp as any).lever} → ${result.result.replace(/_/g, " ").toLowerCase()}`,
        body: result.human_summary,
        confidence:
          result.result === "SIGNAL_DETECTED" ? 0.65 :
          result.result === "POSSIBLE_SIGNAL" ? 0.4 : 0.3,
        evidence_witness_ids: [],
        graduated: false,
        learning_status: "provisional",
        cycle_count: 1,
      });
    }

    return new Response(
      JSON.stringify({ comparison: cmpRow, next_phase: nextPhase }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("compare-experiment-phases error:", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});