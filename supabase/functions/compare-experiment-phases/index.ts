// Deterministic comparison of one server-assigned cycle of self-reported data.
// The arithmetic is unchanged; the database commits the result and lifecycle
// together and permits only one comparison per cycle.
import { comparePhases, type DailyObservation, type Direction } from "../_shared/ppe/comparator.ts";
import { authenticateRequest, resolveTargetUserId, jsonResponse } from "../_shared/auth.ts";
import { sha256Hex } from "../_shared/autonomy/protocolContent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405, corsHeaders);
  try {
    const authRes = await authenticateRequest(req);
    if (!authRes.ok) return jsonResponse(authRes.error.body, authRes.error.status, corsHeaders);
    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object" || typeof payload.experiment_id !== "string") {
      return jsonResponse({ error: "experiment_id_required" }, 400, corsHeaders);
    }
    const { experiment_id } = payload;
    if ((payload.phase_a && payload.phase_a !== "run_in") ||
        (payload.phase_b && payload.phase_b !== "intervention")) {
      return jsonResponse({ error: "invalid_phase_pair" }, 400, corsHeaders);
    }
    const supabase = authRes.auth.serviceClient;
    const { data: exp, error: expErr } = await supabase.from("simulator_experiments")
      .select("*").eq("id", experiment_id).maybeSingle();
    if (expErr) throw expErr;
    if (!exp) return jsonResponse({ error: "experiment_not_found" }, 404, corsHeaders);
    const owner = await resolveTargetUserId(authRes.auth, exp.user_id);
    if (!owner.ok) return jsonResponse(owner.error.body, owner.error.status, corsHeaders);
    if (owner.isViewAs) return jsonResponse({ error: "account_holder_required" }, 403, corsHeaders);
    const cycle = exp.cycle_index;
    const prior = await supabase.from("simulator_experiment_comparisons").select("*")
      .eq("experiment_id", experiment_id).eq("user_id", owner.targetUserId)
      .eq("cycle_index", cycle).maybeSingle();
    if (prior.error) throw prior.error;
    if (prior.data) return jsonResponse({ comparison: prior.data, next_phase: exp.phase, replayed: true }, 200, corsHeaders);
    if (!["intervention", "ready_to_compare"].includes(exp.phase)) {
      return jsonResponse({ error: "invalid_phase", message: "This plan must reach its intervention phase before comparison." }, 409, corsHeaders);
    }
    const [protoRes, obsRes] = await Promise.all([
      supabase.from("simulator_experiment_protocols").select("*").eq("experiment_id", experiment_id)
        .eq("user_id", owner.targetUserId).order("protocol_version", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("simulator_daily_observations")
        .select("id,phase,intervention_performed,primary_value,confounders,observed_on,user_id,cycle_index")
        .eq("experiment_id", experiment_id).eq("user_id", owner.targetUserId).eq("cycle_index", cycle)
        .order("observed_on", { ascending: true }),
    ]);
    if (protoRes.error) throw protoRes.error;
    if (obsRes.error) throw obsRes.error;
    if (!protoRes.data) return jsonResponse({ error: "protocol_required" }, 409, corsHeaders);
    const proto = protoRes.data;
    const observations = obsRes.data ?? [];
    const result = comparePhases({
      phase_a: "run_in", phase_b: "intervention", observations: observations as DailyObservation[],
      desired_direction: (proto.primary_outcome?.direction ?? "decrease") as Direction,
      min_observations_per_phase: Math.max(5, proto.min_observations_per_phase ?? 5),
      min_adherence_pct: Math.max(0.7, proto.min_adherence_pct ?? 0.7),
      stopped_for_safety: exp.stopped_reason?.startsWith("safety") ?? false,
    });
    const observationFingerprint = `sha256:${await sha256Hex(JSON.stringify({
      cycle, protocol_id: proto.id, protocol_version: proto.protocol_version, observations,
    }))}`;
    const committed = await supabase.rpc("simulator_complete_comparison", {
      p_user_id: owner.targetUserId, p_experiment_id: experiment_id, p_cycle_index: cycle,
      p_experiment_snapshot: exp,
      p_comparison: { ...result, observation_fingerprint: observationFingerprint },
    });
    if (committed.error) return jsonResponse({
      error: "comparison_not_saved", message: "This plan changed while comparing. Reload and try again.",
    }, 409, corsHeaders);
    return jsonResponse(committed.data, 200, corsHeaders);
  } catch (e) {
    console.error("compare-experiment-phases error:", e);
    return jsonResponse({ error: "comparison_failed", message: "The comparison could not be completed. Please retry." }, 500, corsHeaders);
  }
});
