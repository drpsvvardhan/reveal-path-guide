import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── Scoring maps ──
const SCORE_MAPS: Record<string, Record<string, number>> = {
  frequency: { never: 100, rarely: 75, sometimes: 50, often: 25, always: 0 },
  yesno: { no: 100, yes: 0 },
  severity: { none: 100, mild: 75, moderate: 50, severe: 25, extreme: 0 },
  effectiveness: { excellent: 100, good: 75, fair: 50, poor: 25, none: 0 },
  comparison: { much_better: 100, better: 75, same: 50, worse: 25, much_worse: 0 },
  chronotype: { morning: 75, afternoon: 50, evening: 50 },
  activity: { strength: 75, cardio: 75, mixed: 100, none: 25 },
};

const L1_WEIGHTS = [0.40, 0.35, 0.25];
const L2_WEIGHTS = [0.15, 0.13, 0.12, 0.11, 0.10, 0.10, 0.08, 0.08, 0.07, 0.06];

// ── Gate definitions ──
const GATES: Record<string, { name: string; domains: string[] }> = {
  OFFI: { name: "Organ/Fat Flux Index", domains: ["A1", "A3", "D12", "H23"] },
  FPIS: { name: "Fuel Processing & Insulin Sensitivity", domains: ["A1", "A2", "G21", "H23"] },
  BCS: { name: "Barrier & Colonization Status", domains: ["A3", "B6", "D10", "D11", "D12", "F17"] },
  BRI: { name: "Brain-Resilience Index", domains: ["C7", "C9", "E13", "E14", "G19", "G20", "G21", "H22", "J25"] },
  TIS: { name: "Tissue Integrity Score", domains: ["B4", "B6", "D10", "F16", "F17", "I24"] },
  CLI: { name: "Cellular Longevity Index", domains: ["B5", "C8", "E15", "F16", "I24"] },
  HPI: { name: "Health Potential Index", domains: ["C7", "C8", "E13", "E15", "F18", "G19", "G20", "H22"] },
  GRIP: { name: "Global Risk Integration Profile", domains: ["A2", "B4", "B5", "C9", "F18"] },
  SCAR: { name: "SCAR Memory Gate", domains: ["D11", "E14", "J25"] },
};

// Domain axis mapping
const DOMAIN_AXIS: Record<string, string> = {
  A1: "A - Metabolic", A2: "A - Metabolic", A3: "A - Metabolic",
  B4: "B - Cardiovascular", B5: "B - Cardiovascular", B6: "B - Cardiovascular",
  C7: "C - Neuroendocrine", C8: "C - Neuroendocrine", C9: "C - Neuroendocrine",
  D10: "D - Gut-Immune", D11: "D - Gut-Immune", D12: "D - Gut-Immune",
  E13: "E - Neuropsychological", E14: "E - Neuropsychological", E15: "E - Neuropsychological",
  F16: "F - Structural", F17: "F - Structural", F18: "F - Structural",
  G19: "G - Hormonal", G20: "G - Hormonal", G21: "G - Hormonal",
  H22: "H - Lifestyle", H23: "H - Lifestyle",
  I24: "I - Functional",
  J25: "J - Social",
};

// Question ordering per domain for weight assignment
function questionIndex(questionId: string, layer: number): number {
  // L1: e.g. A1Q1 -> 0, A1Q2 -> 1, A1Q3 -> 2
  // L2: e.g. A1D1 -> 0, A1D2 -> 1, ... A1D10 -> 9
  const match = questionId.match(/\d+$/);
  return match ? parseInt(match[0]) - 1 : 0;
}

function scoreRaw(questionType: string, rawResponse: string): number {
  const map = SCORE_MAPS[questionType] || SCORE_MAPS.frequency;
  return map[rawResponse.toLowerCase()] ?? 50;
}

function trafficLight(score: number): string {
  if (score >= 80) return "GREEN";
  if (score >= 60) return "YELLOW";
  if (score >= 40) return "ORANGE";
  return "RED";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { assessment_id } = await req.json();
    if (!assessment_id) {
      return new Response(JSON.stringify({ error: "assessment_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        // Sort by question index and apply weights
        const sorted = [...data.layer1].sort((a, b) => questionIndex(a.question_id, 1) - questionIndex(b.question_id, 1));
        layer1Score = 0;
        for (let i = 0; i < sorted.length && i < L1_WEIGHTS.length; i++) {
          layer1Score += sorted[i].score * L1_WEIGHTS[i];
        }

        // Check trigger: domain score < 60 OR any question score < 40
        triggeredLayer2 = layer1Score < 60 || sorted.some((r) => r.score < 40);
      }

      if (data?.layer2?.length) {
        const sorted = [...data.layer2].sort((a, b) => questionIndex(a.question_id, 2) - questionIndex(b.question_id, 2));
        layer2Score = 0;
        for (let i = 0; i < sorted.length && i < L2_WEIGHTS.length; i++) {
          layer2Score += sorted[i].score * L2_WEIGHTS[i];
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

    return new Response(JSON.stringify({
      success: true,
      assessment_id,
      domains_scored: domainRows.length,
      gates_scored: gateRows.length,
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
