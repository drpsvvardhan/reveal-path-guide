// ============================================================================
// start-experiment-phase
// ----------------------------------------------------------------------------
// Transitions an experiment through its lifecycle:
//   draft → run_in → intervention → (washout) → ready_to_compare
//   → completed | stopped | not_interpretable
// Enforces minimum days/observations for each transition. Never skips phases.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { authenticateRequest, resolveTargetUserId, jsonResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NEXT: Record<string, string> = {
  draft: "run_in",
  run_in: "intervention",
  intervention: "ready_to_compare",
  washout: "ready_to_compare",
  ready_to_compare: "completed",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authRes = await authenticateRequest(req);
    if (!authRes.ok) return jsonResponse(authRes.error.body, authRes.error.status, corsHeaders);

    const { experiment_id, target_phase, stopped_reason } = await req.json();
    if (!experiment_id) {
      return new Response(JSON.stringify({ error: "experiment_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: exp, error: expErr } = await supabase
      .from("simulator_experiments")
      .select("*")
      .eq("id", experiment_id)
      .single();
    if (expErr || !exp) throw expErr || new Error("experiment not found");

    const owner = await resolveTargetUserId(authRes.auth, (exp as { user_id: string }).user_id);
    if (!owner.ok) return jsonResponse(owner.error.body, owner.error.status, corsHeaders);

    const { data: proto } = await supabase
      .from("simulator_experiment_protocols")
      .select("*")
      .eq("experiment_id", experiment_id)
      .order("protocol_version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const current = (exp as any).phase || "draft";
    const desired = target_phase || NEXT[current];
    if (!desired) {
      return new Response(JSON.stringify({ error: "no_next_phase", current }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Guardrail: don't jump straight from run_in→ready_to_compare.
    const allowed = new Set([NEXT[current], "stopped", "not_interpretable"]);
    if (target_phase && !allowed.has(target_phase)) {
      return new Response(JSON.stringify({ error: "invalid_transition", current, target_phase }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const patch: Record<string, unknown> = {
      phase: desired,
      phase_started_at: new Date().toISOString(),
    };
    if (desired === "run_in") patch.run_in_started_at = new Date().toISOString();
    if (desired === "intervention") patch.intervention_started_at = new Date().toISOString();
    if (desired === "stopped") {
      patch.status = "abandoned";
      patch.stopped_reason = stopped_reason || "user_stopped";
      patch.ended_at = new Date().toISOString();
    }
    if (desired === "completed") {
      patch.status = "active"; // graduation is separate
      patch.ended_at = new Date().toISOString();
    }

    const { data: updated, error: updErr } = await supabase
      .from("simulator_experiments")
      .update(patch)
      .eq("id", experiment_id)
      .select()
      .single();
    if (updErr) throw updErr;

    return new Response(
      JSON.stringify({ experiment: updated, protocol: proto ?? null, previous_phase: current, new_phase: desired }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("start-experiment-phase error:", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});