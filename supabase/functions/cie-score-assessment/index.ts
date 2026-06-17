import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { type WitnessObject } from "../_shared/witness.ts";
import {
  witnessifyCieAssessment,
  type CieAssessmentInput,
  type CieResponseInput,
  type CieDomainScoreInput,
  type CieGateScoreInput,
} from "../_shared/witnessify_impl.ts";
import { loadRegistryFromSupabase } from "../witnessify-observations/supabaseRegistry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEFAULT_REGISTRY_SEED_VERSION = "p1a_initial";
const WITNESS_INSERT_BATCH_SIZE = 100;

// ── Scoring maps (default: negative polarity — "yes" = symptom present = 0) ──
const SCORE_MAPS: Record<string, Record<string, number>> = {
  frequency: { never: 100, rarely: 75, sometimes: 50, often: 25, always: 0 },
  yesno: { no: 100, yes: 0 },
  severity: { none: 100, mild: 75, moderate: 50, severe: 25, extreme: 0 },
  effectiveness: { excellent: 100, good: 75, fair: 50, poor: 25, none: 0 },
  comparison: { much_better: 100, better: 75, same: 50, worse: 25, much_worse: 0 },
  chronotype: { morning: 75, afternoon: 50, evening: 50 },
  activity: { strength: 75, cardio: 75, mixed: 100, none: 25 },
};

// ── Positive-polarity questions: "yes"/"always" = healthy behavior = 100 ──
// These questions ask about protective/healthy behaviors, so the score is REVERSED.
const POSITIVE_POLARITY: Set<string> = new Set([
  // H22 — Light & Movement
  "H22Q1", "H22Q2",  // outdoor light, exercise 150min
  "H22D1", "H22D2", "H22D3", "H22D5", "H22D7", "H22D8",  // morning light, blue light blocking, strength, tracking, breaks, outdoor
  // H23 — Nutrition Identity
  "H23Q2", "H23Q3",  // consistent eating, 5 veg servings
  "H23D1", "H23D2", "H23D5", "H23D6", "H23D7", "H23D8", "H23D9", "H23D10",  // IF, tracking, cooking, protein, sugar limit, elimination, fermented, organic
  // I24 — Hydration
  "I24Q1", "I24D1", "I24D5", "I24D8",  // water, electrolytes, supplements, limit caffeine
  // J25 — Social Connection
  "J25Q1", "J25Q3",  // social connections, community
  // E13 — Sleep/Circadian
  "E13D9", "E13D10",  // consistent wake time, morning sunlight
  // E14 — Mood
  "E14D5", "E14D10",  // therapy, meditation
  // E15 — Cognitive
  "E15D10",  // brain supplements
  // F16 — Musculoskeletal
  "F16D8",  // strength training
  // F17 — Skin/Connective
  "F17D9",  // collagen supplements
  // F18 — Bone
  "F18D2", "F18D3", "F18D10",  // calcium/VitD, weight-bearing exercise, protein for bone
  // G19 — Thyroid
  "G19D10",  // iodine/selenium supplements
  // G20 — Reproductive
  "G20D10",  // hormone supplements
  // G21 — Insulin-Cortisol
  "G21D8",  // time-restricted eating
  // D12 — Liver-Gut Loop
  "D12D8",  // digestive enzyme supplements
]);

// ── Neutral-polarity questions: diagnostic awareness — score 50 regardless ──
// "Have you been tested for X?" doesn't indicate health status
const NEUTRAL_POLARITY: Set<string> = new Set([
  "A1D8", "A2D6", "A2D8", "B4D8", "B5D5", "B5D6", "B6D5", "B6D9",
  "C8D2", "C8D7", "C9D6", "D10D5", "D11D2", "D11D5", "D11D9",
  "D12D5", "D12D10", "E13D5", "E15D5", "F16D5", "F16D9", "F17D8",
  "F18D1", "G19D2", "G19D5", "G19D7", "G20D1", "G20D5", "G20D9",
  "G21D1", "G21D5", "G21D7", "H22D9", "I24D7",
]);

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
  const match = questionId.match(/\d+$/);
  return match ? parseInt(match[0]) - 1 : 0;
}

function scoreRaw(questionId: string, questionType: string, rawResponse: string): number {
  // Neutral questions always score 50 — diagnostic awareness, not health status
  if (NEUTRAL_POLARITY.has(questionId)) return 50;

  const map = SCORE_MAPS[questionType] || SCORE_MAPS.frequency;
  const baseScore = map[rawResponse.toLowerCase()] ?? 50;

  // Positive-polarity questions: reverse the score (yes=100, no=0, always=100, never=0)
  if (POSITIVE_POLARITY.has(questionId)) {
    // For effectiveness/comparison/chronotype/activity, polarity is already correct
    if (questionType === "effectiveness" || questionType === "comparison" ||
        questionType === "chronotype" || questionType === "activity") {
      return baseScore;
    }
    return 100 - baseScore;
  }

  return baseScore;
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
        const sorted = [...data.layer1].sort((a, b) => questionIndex(a.question_id, 1) - questionIndex(b.question_id, 1));
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
        const sorted = [...data.layer2].sort((a, b) => questionIndex(a.question_id, 2) - questionIndex(b.question_id, 2));
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

    let witnessSummary: Awaited<ReturnType<typeof witnessifyCompletedCieAssessment>> | null = null;
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

interface CompletedAssessmentRow {
  id: string;
  user_id: string;
  status: string;
  full_completed_at: string | null;
  layer1_completed_at: string | null;
  created_at: string;
}

async function witnessifyCompletedCieAssessment(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  assessment: CompletedAssessmentRow
): Promise<{
  produced: number;
  upserted: number;
  registry_misses: number;
  validation_failures: number;
  soft_warnings: number;
}> {
  const input = await buildCieAssessmentInputForWitnesses(supabase, assessment);
  const { accessor } = await loadRegistryFromSupabase(supabase, DEFAULT_REGISTRY_SEED_VERSION);
  const result = witnessifyCieAssessment(input, accessor, {
    onRegistryMiss: "skip_with_warning",
    throwOnCatastrophic: true,
  });

  const upserted = await upsertWitnessesBatched(supabase, result.witnesses);

  return {
    produced: result.witnesses.length,
    upserted,
    registry_misses: result.registry_misses.length,
    validation_failures: result.validation_failures.length,
    soft_warnings: result.soft_warnings.length,
  };
}

async function buildCieAssessmentInputForWitnesses(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  assessment: CompletedAssessmentRow
): Promise<CieAssessmentInput> {
  const assessmentId = assessment.id;
  const [respRes, domRes, gateRes] = await Promise.all([
    supabase
      .from("cie_responses")
      .select("id, assessment_id, question_id, domain_id, layer, question_type, raw_response, score")
      .eq("assessment_id", assessmentId),
    supabase
      .from("cie_domain_scores")
      .select("id, assessment_id, domain_id, axis, layer1_score, layer2_score, final_score, triggered_layer2")
      .eq("assessment_id", assessmentId),
    supabase
      .from("cie_gate_scores")
      .select("id, assessment_id, gate_id, gate_name, score, traffic_light, contributing_domains")
      .eq("assessment_id", assessmentId),
  ]);

  if (respRes.error) throw new Error(`cie_responses read: ${respRes.error.message}`);
  if (domRes.error) throw new Error(`cie_domain_scores read: ${domRes.error.message}`);
  if (gateRes.error) throw new Error(`cie_gate_scores read: ${gateRes.error.message}`);

  const bioTs = assessment.full_completed_at ?? assessment.layer1_completed_at ?? assessment.created_at;
  const questionIdsByDomain = new Map<string, string[]>();
  for (const r of respRes.data ?? []) {
    const list = questionIdsByDomain.get(r.domain_id) ?? [];
    list.push(r.question_id);
    questionIdsByDomain.set(r.domain_id, list);
  }

  const responseInputs: CieResponseInput[] = (respRes.data ?? []).map((r: any) => ({
    question_id: r.question_id,
    response_value: r.raw_response,
    response_unit: null,
    source_row_id: r.id,
    testimony: buildCieResponseWitnessTestimony(r, bioTs),
  }));

  const domainInputs: CieDomainScoreInput[] = (domRes.data ?? []).map((d: any) => ({
    domain_id: d.domain_id,
    score_value: Number(d.final_score),
    score_unit: "score_0_100",
    source_row_id: d.id,
    testimony: buildCieDomainWitnessTestimony(d, bioTs),
    contributing_question_ids: questionIdsByDomain.get(d.domain_id) ?? [],
  }));

  const gateInputs: CieGateScoreInput[] = (gateRes.data ?? []).map((g: any) => ({
    gate_id: g.gate_id,
    score_value: Number(g.score),
    score_unit: "score_0_100",
    source_row_id: g.id,
    testimony: buildCieGateWitnessTestimony(g, bioTs),
    contributing_domain_ids: g.contributing_domains ?? [],
  }));

  return {
    user_id: assessment.user_id,
    assessment_id: assessmentId,
    biological_timestamp: bioTs,
    source_table: "cie_assessments",
    assessment_row_id: assessmentId,
    responses: responseInputs,
    domain_scores: domainInputs,
    gate_scores: gateInputs,
  };
}

async function upsertWitnessesBatched(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  witnesses: WitnessObject[]
): Promise<number> {
  const byDepth = [0, 1, 2].flatMap((depth) => witnesses.filter((w) => w.compression_depth === depth));
  let upserted = 0;

  for (let i = 0; i < byDepth.length; i += WITNESS_INSERT_BATCH_SIZE) {
    const batch = byDepth.slice(i, i + WITNESS_INSERT_BATCH_SIZE).map((w) => ({
      witness_id: w.witness_id,
      user_id: w.user_id,
      derived_from_packet_id: w.derived_from_packet_id,
      source_table: w.source_table,
      source_row_id: w.source_row_id,
      ancestry_witness_ids: w.ancestry_witness_ids,
      source_window: w.source_window,
      signal: w.signal,
      domain_of_access: w.domain_of_access,
      epistemic_role: w.epistemic_role,
      reliability_class: w.reliability_class,
      compression_depth: w.compression_depth,
      observed_value: w.observed_value,
      observed_unit: w.observed_unit,
      testimony: w.testimony,
      limitations: w.limitations,
      confidence_value: w.confidence_value,
      confidence_basis: w.confidence_basis,
      biological_timestamp: w.biological_timestamp,
      validity_window_seconds: w.validity_window_seconds,
      conflict_candidates: w.conflict_candidates,
      transformation_version: w.transformation_version,
      registry_seed_version: w.registry_seed_version,
    }));

    const { data, error } = await supabase
      .from("witness_objects")
      .upsert(batch, { onConflict: "user_id,source_table,source_row_id,registry_seed_version" })
      .select("witness_id");

    if (error) throw new Error(`witness_objects upsert: ${error.message}`);
    upserted += (data ?? []).length;
  }

  return upserted;
}

function buildCieResponseWitnessTestimony(r: any, bioTs: string): string {
  const layerLabel = r.layer === 1 ? "Layer 1" : "Layer 2 deep-dive";
  return `Patient self-reported '${r.raw_response}' to CIE ${r.question_id} (domain ${r.domain_id}, ${layerLabel}, question_type=${r.question_type}) during intake on ${bioTs.slice(0, 10)}. Derived response score: ${r.score}.`;
}

function buildCieDomainWitnessTestimony(d: any, bioTs: string): string {
  const l2Part = d.triggered_layer2
    ? ` Layer-2 deep-dive was triggered; layer2 score ${d.layer2_score}.`
    : " Layer-2 was not triggered.";
  return `CIE Domain ${d.domain_id} (axis ${d.axis}) final score ${d.final_score} on ${bioTs.slice(0, 10)}. Layer-1 score ${d.layer1_score}.${l2Part}`;
}

function buildCieGateWitnessTestimony(g: any, bioTs: string): string {
  const contrib = (g.contributing_domains ?? []).join(", ");
  return `CIE Gate ${g.gate_id} (${g.gate_name}) score ${g.score} on ${bioTs.slice(0, 10)}, traffic-light ${g.traffic_light}, aggregating domains [${contrib}].`;
}
