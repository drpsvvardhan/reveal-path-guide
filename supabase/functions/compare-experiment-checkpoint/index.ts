// ============================================================================
// compare-experiment-checkpoint
// ----------------------------------------------------------------------------
// Compares the predicted_deltas of an experiment against the most recent lab
// observations the patient has on file. Writes a verdict on the checkpoint and
// inserts a learning row, advancing the loop's "Compare → Learn" arc.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { authenticateRequest, resolveTargetUserId, jsonResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PredictedDelta {
  biomarker: string;
  direction: "increase" | "decrease" | "stabilize";
  magnitude?: string;
  unit?: string;
  coordinate?: string;
  confidence?: number;
}

interface MeasuredDelta {
  biomarker: string;
  baseline_value: number | null;
  baseline_at: string | null;
  followup_value: number | null;
  followup_at: string | null;
  observed_direction: "increase" | "decrease" | "stabilize" | "unknown";
  matches_prediction: boolean | null;
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[\s\-\/]+/g, "_");
}

function classifyDirection(baseline: number, followup: number, unit?: string): "increase" | "decrease" | "stabilize" {
  if (baseline === 0) {
    if (followup > 0) return "increase";
    if (followup < 0) return "decrease";
    return "stabilize";
  }
  const pct = (followup - baseline) / Math.abs(baseline);
  if (Math.abs(pct) < 0.03) return "stabilize"; // <3% noise band
  return pct > 0 ? "increase" : "decrease";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authRes = await authenticateRequest(req);
    if (!authRes.ok) return jsonResponse(authRes.error.body, authRes.error.status, corsHeaders);

    const { checkpoint_id } = await req.json();
    if (!checkpoint_id) {
      return new Response(JSON.stringify({ error: "checkpoint_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: chk, error: chkErr } = await supabase
      .from("simulator_checkpoints")
      .select("*")
      .eq("id", checkpoint_id)
      .single();
    if (chkErr || !chk) throw chkErr || new Error("Checkpoint not found");

    const { data: exp, error: expErr } = await supabase
      .from("simulator_experiments")
      .select("*")
      .eq("id", chk.experiment_id)
      .single();
    if (expErr || !exp) throw expErr || new Error("Experiment not found");

    const owner = await resolveTargetUserId(authRes.auth, (exp as { user_id: string }).user_id);
    if (!owner.ok) return jsonResponse(owner.error.body, owner.error.status, corsHeaders);

    const predicted: PredictedDelta[] = Array.isArray(exp.predicted_deltas)
      ? exp.predicted_deltas as any
      : [];

    // Pull every lab observation for this user — we'll filter in-process by
    // normalized biomarker name and by date around the experiment window.
    const { data: obsRows } = await supabase
      .from("patient_lab_observations")
      .select("biomarker_name, value, unit, collection_date")
      .eq("user_id", exp.user_id)
      .order("collection_date", { ascending: true });
    const obs = (obsRows ?? []) as Array<{
      biomarker_name: string; value: number | null; unit: string | null; collection_date: string;
    }>;

    const startedAt = new Date(exp.started_at).getTime();

    const measured: MeasuredDelta[] = predicted.map((p) => {
      const target = normalize(p.biomarker);
      const matching = obs.filter((o) => normalize(o.biomarker_name) === target && o.value != null);
      const baseline = [...matching].reverse().find((o) => new Date(o.collection_date).getTime() <= startedAt)
        ?? matching[0];
      const followup = [...matching].reverse().find((o) => new Date(o.collection_date).getTime() > startedAt);
      if (!baseline || !followup) {
        return {
          biomarker: p.biomarker,
          baseline_value: baseline?.value ?? null,
          baseline_at: baseline?.collection_date ?? null,
          followup_value: followup?.value ?? null,
          followup_at: followup?.collection_date ?? null,
          observed_direction: "unknown",
          matches_prediction: null,
        };
      }
      const observed = classifyDirection(baseline.value!, followup.value!, p.unit);
      return {
        biomarker: p.biomarker,
        baseline_value: baseline.value,
        baseline_at: baseline.collection_date,
        followup_value: followup.value,
        followup_at: followup.collection_date,
        observed_direction: observed,
        matches_prediction: observed === p.direction,
      };
    });

    const resolvable = measured.filter((m) => m.matches_prediction !== null);
    const matched = resolvable.filter((m) => m.matches_prediction === true).length;
    const total = resolvable.length;

    let verdict: "confirmed" | "partial" | "refuted" | "inconclusive";
    let summary: string;
    if (total === 0) {
      verdict = "inconclusive";
      summary = "We could not find new lab values to compare against the prediction yet. Upload a fresh panel covering the predicted biomarkers and re-run the comparison.";
    } else if (matched === total) {
      verdict = "confirmed";
      summary = `Your biology moved in the direction we predicted for all ${total} marker${total === 1 ? "" : "s"} we could see. The model of how your body responds to this lever held up.`;
    } else if (matched === 0) {
      verdict = "refuted";
      summary = `Your biology did not move in the direction we predicted on any of the ${total} marker${total === 1 ? "" : "s"} we could see. That is informative — it tells us this lever does not behave in you the way it does on average.`;
    } else {
      verdict = "partial";
      summary = `${matched} of ${total} predicted shifts showed up in your labs. Mixed signal — worth holding loosely while we see another cycle.`;
    }

    const { error: updErr } = await supabase
      .from("simulator_checkpoints")
      .update({
        status: "completed",
        measured_deltas: measured as any,
        verdict,
        verdict_summary: summary,
        completed_at: new Date().toISOString(),
      })
      .eq("id", checkpoint_id);
    if (updErr) throw updErr;

    const { data: learning, error: lrnErr } = await supabase
      .from("simulator_learnings")
      .insert({
        user_id: exp.user_id,
        experiment_id: exp.id,
        checkpoint_id: chk.id,
        kind: verdict,
        headline:
          verdict === "confirmed"
            ? `Your body responded as predicted to: ${exp.lever}`
            : verdict === "refuted"
              ? `Your body did not respond to ${exp.lever} the way the average literature suggests`
              : verdict === "partial"
                ? `Mixed response to ${exp.lever} — your biology is doing something specific`
                : `Not enough new lab data yet to compare against ${exp.lever}`,
        body: summary,
        confidence: verdict === "confirmed" || verdict === "refuted" ? 0.7 : 0.4,
        graduated: false,
      })
      .select()
      .single();
    if (lrnErr) console.warn("learning insert error:", lrnErr);

    return new Response(JSON.stringify({
      checkpoint_id, verdict, summary, measured, learning,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("compare-experiment-checkpoint error:", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});