import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  SCORE_MAPS,
  POSITIVE_POLARITY,
  NEUTRAL_POLARITY,
  L1_WEIGHTS,
  L2_WEIGHTS,
  GATES,
  DOMAIN_AXIS,
  questionIndex,
  scoreRaw,
  trafficLight,
} from "../_shared/cieScoring.ts";
import {
  witnessifyCompletedCieAssessment,
  type CieWitnessSummary,
} from "../_shared/cieWitnessify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { authenticateRequest, resolveTargetUserId, resolveUserIdFromAssessmentId } = await import("../_shared/auth.ts");
    const authResult = await authenticateRequest(req);
    if (!authResult.ok) {
      return new Response(JSON.stringify(authResult.error.body), {
        status: authResult.error.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { assessment_id } = await req.json();
    if (!assessment_id) {
      return new Response(JSON.stringify({ error: "assessment_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ownerUserId = await resolveUserIdFromAssessmentId(authResult.auth.serviceClient, assessment_id);
    if (!ownerUserId) {
      return new Response(JSON.stringify({ error: "Assessment not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const resolved = await resolveTargetUserId(authResult.auth, ownerUserId);
    if (!resolved.ok) {
      return new Response(JSON.stringify(resolved.error.body), {
        status: resolved.error.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch assessment
    const { data: assessment, error: aErr } = await supabase
      .from("cie_assessments")
      .select("*")
      .eq("id", assessment_id)
      .single();

    if (aErr || !assessment) {
      return new Response(JSON.stringify({ error: "Assessment not found", details: aErr?.message }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all responses
    const { data: responses, error: rErr } = await supabase
      .from("cie_responses")
      .select("*")
      .eq("assessment_id", assessment_id);

    if (rErr) {
      return new Response(JSON.stringify({ error: "Failed to fetch responses", details: rErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!responses || responses.length === 0) {
      return new Response(JSON.stringify({ error: "No responses found for this assessment" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group responses by domain and layer
    const byDomain: Record<string, { layer1: typeof responses; layer2: typeof responses }> = {};
    for (const r of responses) {
      if (!byDomain[r.domain_id]) byDomain[r.domain_id] = { layer1: [], layer2: [] };
      if (r.layer === 1) byDomain[r.domain_id].layer1.push(r);
      else byDomain[r.domain_id].layer2.push(r);
    }

    // Compute domain scores
    const domainRows: Array<Record<string, unknown>> = [];
    const domainScoreMap: Record<string, number> = {};

    for (const domainId of Object.keys(DOMAIN_AXIS)) {
      const data = byDomain[domainId];
      let layer1Score = 50; // default
      let layer2Score: number | null = null;
      let triggeredLayer2 = false;

      if (data?.layer1?.length) {
        const sorted = [...data.layer1].sort((a, b) => questionIndex(a.question_id) - questionIndex(b.question_id));
        layer1Score = 0;
        for (let i = 0; i < sorted.length && i < L1_WEIGHTS.length; i++) {
          // Re-score with polarity awareness (don't trust stored score)
          const correctedScore = scoreRaw(sorted[i].question_id, sorted[i].question_type, sorted[i].raw_response);
          layer1Score += correctedScore * L1_WEIGHTS[i];
        }

        // Check trigger: domain score < 60 OR any question score < 40
        triggeredLayer2 = layer1Score < 60 || sorted.some((r) =>
          scoreRaw(r.question_id, r.question_type, r.raw_response) < 40
        );
      }

      if (data?.layer2?.length) {
        const sorted = [...data.layer2].sort((a, b) => questionIndex(a.question_id) - questionIndex(b.question_id));
        layer2Score = 0;
        for (let i = 0; i < sorted.length && i < L2_WEIGHTS.length; i++) {
          const correctedScore = scoreRaw(sorted[i].question_id, sorted[i].question_type, sorted[i].raw_response);
          layer2Score += correctedScore * L2_WEIGHTS[i];
        }
      }

      const finalScore = layer2Score !== null
        ? layer2Score * 0.60 + layer1Score * 0.40
        : layer1Score;

      const rounded = Math.round(finalScore * 10) / 10;
      domainScoreMap[domainId] = rounded;

      domainRows.push({
        assessment_id,
        user_id: assessment.user_id,
        domain_id: domainId,
        axis: DOMAIN_AXIS[domainId],
        layer1_score: Math.round(layer1Score * 10) / 10,
        layer2_score: layer2Score !== null ? Math.round(layer2Score * 10) / 10 : null,
        final_score: rounded,
        triggered_layer2: triggeredLayer2,
      });
    }

    // Compute gate scores
    const gateRows: Array<Record<string, unknown>> = [];
    for (const [gateId, gate] of Object.entries(GATES)) {
      const scores = gate.domains.map((d) => domainScoreMap[d] ?? 50);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const rounded = Math.round(avg * 10) / 10;

      gateRows.push({
        assessment_id,
        user_id: assessment.user_id,
        gate_id: gateId,
        gate_name: gate.name,
        score: rounded,
        traffic_light: trafficLight(rounded),
        contributing_domains: gate.domains,
      });
    }

    // Upsert domain scores
    const { error: dsErr } = await supabase
      .from("cie_domain_scores")
      .upsert(domainRows, { onConflict: "assessment_id,domain_id" });

    if (dsErr) {
      return new Response(JSON.stringify({ error: "Failed to upsert domain scores", details: dsErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert gate scores
    const { error: gsErr } = await supabase
      .from("cie_gate_scores")
      .upsert(gateRows, { onConflict: "assessment_id,gate_id" });

    if (gsErr) {
      return new Response(JSON.stringify({ error: "Failed to upsert gate scores", details: gsErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let witnessSummary: CieWitnessSummary | null = null;
    let witnessError: string | null = null;

    const { data: completedAssessment } = await supabase
      .from("cie_assessments")
      .select("id, user_id, status, full_completed_at, layer1_completed_at, created_at")
      .eq("id", assessment_id)
      .maybeSingle();

    if (completedAssessment?.status === "complete") {
      try {
        witnessSummary = await witnessifyCompletedCieAssessment(supabase, completedAssessment);
      } catch (err) {
        witnessError = err instanceof Error ? err.message : String(err);
        console.error("CIE witness indexing failed:", witnessError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      assessment_id,
      domains_scored: domainRows.length,
      gates_scored: gateRows.length,
      cie_witnesses: witnessSummary,
      witness_error: witnessError,
      domain_scores: Object.fromEntries(domainRows.map((r) => [r.domain_id, r.final_score])),
      gate_scores: Object.fromEntries(gateRows.map((r) => [r.gate_id, { score: r.score, traffic_light: r.traffic_light }])),
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error", details: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
