// Using built-in Deno.serve (no remote std import) — std@0.168.0 was returning 500 from the bundler.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  FRAMEWORK_V2,
  TIER_VOCABULARY_LICENSES,
  TIER_VOCABULARY_LICENSES_CLINICIAN,
  FORBIDDEN_VOCABULARY_GLOBAL,
  FORBIDDEN_VOCABULARY_CLINICIAN,
  parseProseAndCitations,
  validateProseAgainstClustersWithAudience,
  stripClusterMarkers,
  buildRetryFeedbackWithSections,
} from "../_shared/framework_v2.ts";
import type { ClusterTier, VocabularyViolation } from "../_shared/framework_v2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// AXES REFERENCE (CIE v2.2)
// ============================================================================

const CIE_AXES = [
  { id: "A", name: "Metabolic", domains: ["A1", "A2", "A3"] },
  { id: "B", name: "Vascular", domains: ["B4", "B5", "B6"] },
  { id: "C", name: "Neuroendocrine", domains: ["C7", "C8", "C9"] },
  { id: "D", name: "Gut-Immune", domains: ["D10", "D11", "D12"] },
  { id: "E", name: "Neuropsychological", domains: ["E13", "E14", "E15"] },
  { id: "F", name: "Structural", domains: ["F16", "F17", "F18"] },
  { id: "G", name: "Hormonal", domains: ["G19", "G20", "G21"] },
  { id: "H", name: "Lifestyle", domains: ["H22", "H23"] },
  { id: "I", name: "Functional", domains: ["I24"] },
  { id: "J", name: "Social", domains: ["J25"] },
];

// The 5 primary CIE axes that must appear in axis_breakdown
const PRIMARY_AXES = ["A", "B", "C", "D", "E"];
const PRIMARY_AXIS_NAMES = new Set(
  CIE_AXES.filter(a => PRIMARY_AXES.includes(a.id)).map(a => a.name.toLowerCase())
);

// ============================================================================
// INBODY TERRAIN MAP
// ============================================================================

const INBODY_TERRAIN_MAP: Record<string, {
  coordinates: string[];
  gates: string[];
  interpretation: string;
  healthy_range?: { low: number; high: number };
  direction: string;
  units?: string;
  note?: string;
}> = {
  phase_angle_whole_body: { coordinates: ["I", "Σ"], gates: ["TIS", "CLI"], interpretation: "Cellular membrane integrity and accumulated cellular stress", healthy_range: { low: 5.5, high: 7.5 }, direction: "higher_is_better", units: "°" },
  visceral_fat_area: { coordinates: ["E"], gates: ["OFFI", "FPIS"], interpretation: "Central adiposity and metabolic load", healthy_range: { low: 0, high: 100 }, direction: "lower_is_better", units: "cm²" },
  skeletal_muscle_mass: { coordinates: ["R", "Σ"], gates: ["CLI", "HPI"], interpretation: "Muscle mass and sarcopenia reserve", direction: "higher_is_better", units: "lb" },
  ecw_tbw_ratio: { coordinates: ["I", "V"], gates: ["TIS", "BCS"], interpretation: "Fluid balance and inflammation tone", healthy_range: { low: 0.360, high: 0.390 }, direction: "lower_is_better_within_range" },
  basal_metabolic_rate: { coordinates: ["E"], gates: ["FPIS", "HPI"], interpretation: "Metabolic baseline capacity", direction: "higher_is_better_within_range", units: "kcal" },
  body_fat_percent: { coordinates: ["E", "I"], gates: ["OFFI", "FPIS"], interpretation: "Proportion of total weight stored as fat", healthy_range: { low: 18, high: 28 }, direction: "lower_is_better_within_range", units: "%", note: "Range varies by sex" },
  fat_free_mass: { coordinates: ["E", "R"], gates: ["CLI", "HPI"], interpretation: "Total non-fat mass — structural and metabolic scaffold", direction: "higher_is_better", units: "lb" },
  dry_lean_mass: { coordinates: ["Σ", "R"], gates: ["CLI", "HPI"], interpretation: "Protein and mineral matrix independent of hydration", direction: "higher_is_better", units: "lb" },
  body_fat_mass: { coordinates: ["E"], gates: ["OFFI", "FPIS"], interpretation: "Absolute fat mass driving metabolic trajectory", direction: "lower_is_better", units: "lb" },
  segmental_lean_right_arm: { coordinates: ["R", "Σ"], gates: ["CLI", "GRIP"], interpretation: "Right arm lean mass", direction: "higher_is_better", units: "lb" },
  segmental_lean_left_arm: { coordinates: ["R", "Σ"], gates: ["CLI", "GRIP"], interpretation: "Left arm lean mass", direction: "higher_is_better", units: "lb" },
  segmental_lean_trunk: { coordinates: ["E", "R"], gates: ["CLI", "HPI"], interpretation: "Trunk lean mass — core structural support", direction: "higher_is_better", units: "lb" },
  segmental_lean_right_leg: { coordinates: ["R", "Σ"], gates: ["CLI", "HPI"], interpretation: "Right leg lean mass — ambulatory capacity", direction: "higher_is_better", units: "lb" },
  segmental_lean_left_leg: { coordinates: ["R", "Σ"], gates: ["CLI", "HPI"], interpretation: "Left leg lean mass — ambulatory capacity", direction: "higher_is_better", units: "lb" },
  segmental_ecw_tbw_right_arm: { coordinates: ["I", "V"], gates: ["TIS", "BCS"], interpretation: "Right arm fluid balance", healthy_range: { low: 0.36, high: 0.39 }, direction: "lower_is_better_within_range" },
  segmental_ecw_tbw_left_arm: { coordinates: ["I", "V"], gates: ["TIS", "BCS"], interpretation: "Left arm fluid balance", healthy_range: { low: 0.36, high: 0.39 }, direction: "lower_is_better_within_range" },
  segmental_ecw_tbw_trunk: { coordinates: ["I", "V"], gates: ["TIS", "BCS"], interpretation: "Trunk fluid balance — systemic inflammation marker", healthy_range: { low: 0.36, high: 0.39 }, direction: "lower_is_better_within_range" },
  segmental_ecw_tbw_right_leg: { coordinates: ["I", "V"], gates: ["TIS", "BCS"], interpretation: "Right leg fluid balance", healthy_range: { low: 0.36, high: 0.39 }, direction: "lower_is_better_within_range" },
  segmental_ecw_tbw_left_leg: { coordinates: ["I", "V"], gates: ["TIS", "BCS"], interpretation: "Left leg fluid balance", healthy_range: { low: 0.36, high: 0.39 }, direction: "lower_is_better_within_range" },
  segmental_phase_angle_asymmetry: { coordinates: ["V", "Σ"], gates: ["GRIP", "CLI"], interpretation: "Localized cellular compromise and autonomic asymmetry", direction: "lower_is_better" },
};

const INBODY_NAME_LOOKUP: Record<string, string> = {
  "whole body phase angle": "phase_angle_whole_body",
  "phase angle": "phase_angle_whole_body",
  "visceral fat area": "visceral_fat_area",
  "vfa": "visceral_fat_area",
  "skeletal muscle mass": "skeletal_muscle_mass",
  "smm": "skeletal_muscle_mass",
  "ecw/tbw": "ecw_tbw_ratio",
  "basal metabolic rate": "basal_metabolic_rate",
  "bmr": "basal_metabolic_rate",
  "pbf": "body_fat_percent",
  "percent body fat": "body_fat_percent",
  "fat free mass": "fat_free_mass",
  "dry lean mass": "dry_lean_mass",
  "body fat mass": "body_fat_mass",
  "right arm lean mass": "segmental_lean_right_arm",
  "left arm lean mass": "segmental_lean_left_arm",
  "trunk lean mass": "segmental_lean_trunk",
  "right leg lean mass": "segmental_lean_right_leg",
  "left leg lean mass": "segmental_lean_left_leg",
};

function resolveInBodyMapping(canonicalName: string): typeof INBODY_TERRAIN_MAP[string] | null {
  if (INBODY_TERRAIN_MAP[canonicalName]) return INBODY_TERRAIN_MAP[canonicalName];
  const key = INBODY_NAME_LOOKUP[canonicalName.toLowerCase()];
  if (key && INBODY_TERRAIN_MAP[key]) return INBODY_TERRAIN_MAP[key];
  return null;
}

// ============================================================================
// SYSTEM PROMPT — Framework v2 with cluster sourcing + dual audience
// ============================================================================

function buildTerrainSystemPrompt(clusters: any[]): string {
  // Build patient tier vocabulary reference
  const patientTierVocabLines: string[] = [];
  for (const [tier, license] of Object.entries(TIER_VOCABULARY_LICENSES)) {
    patientTierVocabLines.push(`- ${tier} tier: Allowed verbs: ${license.allowed_verbs.join(', ')}. Forbidden verbs: ${license.forbidden_verbs.join(', ')}.${license.required_hedging ? ` Required hedging: ${license.required_hedging.join(', ')}.` : ''}`);
  }

  // Build clinician tier vocabulary reference
  const clinicianTierVocabLines: string[] = [];
  for (const [tier, license] of Object.entries(TIER_VOCABULARY_LICENSES_CLINICIAN)) {
    clinicianTierVocabLines.push(`- ${tier} tier: Allowed verbs: ${license.allowed_verbs.join(', ')}. Forbidden verbs: ${license.forbidden_verbs.join(', ')}.${license.required_hedging ? ` Required hedging: ${license.required_hedging.join(', ')}.` : ''}`);
  }

  const patientForbiddenList = FORBIDDEN_VOCABULARY_GLOBAL.map(p => `"${p}"`).join(', ');
  const clinicianForbiddenList = FORBIDDEN_VOCABULARY_CLINICIAN.map(p => `"${p}"`).join(', ');

  return `You are the terrain rendering layer of Vizzhy. Your job is to produce a patient portrait and a clinician summary from this patient's current data layers.

${FRAMEWORK_V2}

## Cluster sourcing rules apply to BOTH sections

Every sentence you write — in patient_portrait AND in clinician_summary — must cite its source cluster via a {cluster:<cluster_id>} marker at the end of the sentence, or {cluster:none} for general framing. The markers will be stripped from the final output before it is displayed to either audience. Do not omit the markers.

## Active clusters for this patient

${clusters.length > 0 ? JSON.stringify(clusters.map(c => ({
  id: c.id,
  claim: c.claim,
  cluster_kind: c.cluster_kind,
  confidence_tier: c.confidence_tier,
  confidence_score: c.confidence_score,
  coherence_signals: c.coherence_signals,
  missing_evidence: c.missing_evidence,
  tensions_held: c.tensions_held,
})), null, 2) : '(no clusters available — use CIE and lab data directly)'}

## Audience-specific vocabulary

patient_portrait uses the patient-facing tier vocabulary licenses:

${patientTierVocabLines.join('\n')}

clinician_summary uses the clinician-facing tier vocabulary licenses:

${clinicianTierVocabLines.join('\n')}

The two audiences have different appropriate registers. The patient voice uses soft hedging like "softly suggests" and "pattern is starting to form". The clinician voice uses formal clinical hedging like "evidence base is insufficient for definitive determination" and "workup indicated". Both voices hold the same epistemic distinctions (a tentative-tier finding is hedged in both voices) but the language is different because the audiences are different.

patient_portrait global forbidden vocabulary: ${patientForbiddenList}

clinician_summary global forbidden vocabulary: ${clinicianForbiddenList}

Note that clinical prediction language ("elevated cardiovascular risk", "indicated workup") is acceptable in clinician_summary when a cluster's tier licenses it — a robust tier can state risk directly, a tentative tier must hedge. The tier vocabulary check enforces this; you do not need to self-censor beyond the tier license rules.

## Output format

Return strict JSON with this exact structure:
{
  "patient_portrait": {
    "what_you_already_know": "string (the section 1 paragraph)",
    "working_harder_than_you_realize": "string (the section 2 paragraph)",
    "where_to_start": "string (the section 3 paragraph including the single action)",
    "the_one_action": "string (just the single action, extracted, max 15 words)"
  },
  "clinician_summary": {
    "terrain_overview": "string (block 1)",
    "axis_breakdown": [
      { "axis": "A - Metabolic", "interpretation": "string", "status": "attention|coherent|monitor" }
    ],
    "perception_gaps": [
      { "domain": "string", "patient_score": 0, "gate": "string", "gate_traffic_light": "string", "summary": "string" }
    ],
    "suggested_questions": ["string"]
  }
}

The axis_breakdown array must have exactly 5 entries, one for each primary CIE axis: A - Metabolic, B - Vascular, C - Neuroendocrine, D - Gut-Immune, E - Neuropsychological. Do not add extra axes. Do not produce fewer than 5.

Each prose field in patient_portrait can contain multiple sentences. Every sentence in both patient_portrait and clinician_summary prose fields must end with a {cluster:...} marker. suggested_questions do NOT get markers.

Return only valid JSON. No preamble. No markdown code fences.`;
}

// ============================================================================
// HELPERS
// ============================================================================

function computeInputHash(inputs: any): string {
  const canonical = JSON.stringify(inputs, Object.keys(inputs).sort());
  let hash = 5381;
  for (let i = 0; i < canonical.length; i++) {
    hash = ((hash << 5) + hash + canonical.charCodeAt(i)) & 0x7fffffff;
  }
  return hash.toString(36);
}

function extractJsonFromText(text: string): any {
  try { return JSON.parse(text); } catch { /* continue */ }
  const fenceMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]); } catch { /* continue */ }
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); } catch { /* continue */ }
  }
  throw new Error("Could not extract valid JSON from LLM output");
}

/**
 * Normalize axis_breakdown to exactly 5 primary CIE axes.
 * - Keeps only axes matching the 5 primary CIE axes (A-E).
 * - Pads missing axes with a "no finding" entry.
 * - No ghost rows.
 */
function normalizeAxisBreakdown(obj: any): void {
  if (!obj?.clinician_summary?.axis_breakdown || !Array.isArray(obj.clinician_summary.axis_breakdown)) {
    return;
  }

  const existing: any[] = obj.clinician_summary.axis_breakdown;
  const primaryAxes = CIE_AXES.filter(a => PRIMARY_AXES.includes(a.id));
  const result: any[] = [];

  for (const ax of primaryAxes) {
    const label = `${ax.id} - ${ax.name}`;
    // Find a match by axis id letter, axis name, or full label
    const match = existing.find((e: any) => {
      const eAxis = (e.axis || "").toLowerCase();
      return eAxis === label.toLowerCase()
        || eAxis === ax.name.toLowerCase()
        || eAxis.startsWith(ax.id.toLowerCase() + " ")
        || eAxis.startsWith(ax.id.toLowerCase() + "-")
        || eAxis === ax.id.toLowerCase();
    });

    if (match) {
      result.push({ ...match, axis: label });
    } else {
      result.push({
        axis: label,
        interpretation: "No findings mapped to this axis from the current data layers.",
        status: "monitor",
      });
    }
  }

  obj.clinician_summary.axis_breakdown = result;
}

function validateTerrainRender(obj: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!obj.patient_portrait || typeof obj.patient_portrait !== "object") {
    errors.push("Missing patient_portrait object");
  } else {
    for (const key of ["what_you_already_know", "working_harder_than_you_realize", "where_to_start", "the_one_action"]) {
      if (typeof obj.patient_portrait[key] !== "string" || obj.patient_portrait[key].length < 10) {
        errors.push(`patient_portrait.${key} missing or too short`);
      }
    }
  }

  if (!obj.clinician_summary || typeof obj.clinician_summary !== "object") {
    errors.push("Missing clinician_summary object");
  } else {
    if (typeof obj.clinician_summary.terrain_overview !== "string" || obj.clinician_summary.terrain_overview.length < 50) {
      errors.push("clinician_summary.terrain_overview missing or too short");
    }
    // Normalize to exactly 5 primary axes
    normalizeAxisBreakdown(obj);
    if (!Array.isArray(obj.clinician_summary.axis_breakdown) || obj.clinician_summary.axis_breakdown.length !== 5) {
      errors.push("clinician_summary.axis_breakdown must have exactly 5 axes (A-E)");
    }
    if (!Array.isArray(obj.clinician_summary.perception_gaps)) {
      errors.push("clinician_summary.perception_gaps must be an array");
    }
    if (!Array.isArray(obj.clinician_summary.suggested_questions) || obj.clinician_summary.suggested_questions.length < 3) {
      errors.push("clinician_summary.suggested_questions must have at least 3 questions");
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// INPUT COMPOSITION
// ============================================================================

function composeUserMessage(
  profile: any,
  domainScores: any[],
  gateScores: any[],
  responses: any[],
  labObs: any[]
): string {
  const sections: string[] = [];

  const hasLabs = labObs.length > 0;
  const inbodyObs = labObs.filter((o: any) => o.source === "InBody" || resolveInBodyMapping(o.canonical_name));
  const standardObs = labObs.filter((o: any) => o.source !== "InBody" && !resolveInBodyMapping(o.canonical_name));
  const hasInBody = inbodyObs.length > 0;

  sections.push("DATA LAYERS PRESENT FOR THIS PATIENT:");
  sections.push(`- CIE assessment: yes (${domainScores.length} domain scores, ${gateScores.length} gate scores, ${responses.length} responses)`);
  sections.push(`- Labs: ${standardObs.length > 0 ? `yes (${standardObs.length} observations)` : "no"}`);
  sections.push(`- Body composition (InBody): ${hasInBody ? `yes (${inbodyObs.length} measurements)` : "no"}`);
  sections.push("- EMR/records: no");
  sections.push("- Medications: no");
  sections.push("- Sensors: no");
  sections.push("- Food log: no");

  sections.push("\nPATIENT IDENTITY:");
  sections.push(`Name: ${profile.first_name || "Unknown"}, Age: ${profile.age || "?"}, Sex: ${profile.sex || "?"}`);

  sections.push("\nGATE SCORES (9 gates):");
  for (const g of gateScores) {
    sections.push(`  ${g.gate_id} (${g.gate_name}): ${Math.round(g.score)}/100 [${g.traffic_light}] — contributing domains: ${(g.contributing_domains || []).join(", ")}`);
  }

  sections.push("\nDOMAIN SCORES BY AXIS (25 domains):");
  for (const axis of CIE_AXES) {
    const axisDomains = domainScores.filter(d => axis.domains.includes(d.domain_id));
    if (axisDomains.length > 0) {
      sections.push(`  AXIS ${axis.id} — ${axis.name}:`);
      for (const d of axisDomains) {
        const l2 = d.triggered_layer2 ? ` (deep dive: ${Math.round(d.layer2_score)})` : "";
        sections.push(`    ${d.domain_id}: ${Math.round(d.final_score)}/100${l2}`);
      }
    }
  }

  const sorted = [...domainScores].sort((a, b) => a.final_score - b.final_score);
  sections.push("\nLOWEST 5 DOMAINS:");
  for (const d of sorted.slice(0, 5)) {
    sections.push(`  ${d.domain_id}: ${Math.round(d.final_score)}`);
  }
  sections.push("\nHIGHEST 5 DOMAINS:");
  for (const d of sorted.slice(-5).reverse()) {
    sections.push(`  ${d.domain_id}: ${Math.round(d.final_score)}`);
  }

  const gaps: string[] = [];
  for (const d of domainScores) {
    if (d.final_score >= 70) {
      const contributingGates = gateScores.filter(g =>
        (g.contributing_domains || []).includes(d.domain_id) && g.traffic_light !== "GREEN"
      );
      if (contributingGates.length > 0) {
        for (const g of contributingGates) {
          gaps.push(`${d.domain_id} scored ${Math.round(d.final_score)} but gate ${g.gate_id} (${g.gate_name}) is ${g.traffic_light} at ${Math.round(g.score)}`);
        }
      }
    }
  }
  if (gaps.length > 0) {
    sections.push("\nPERCEPTION GAPS (domain scored high but contributing gate is not GREEN):");
    for (const g of gaps.slice(0, 10)) sections.push(`  - ${g}`);
  }

  if (responses.length > 0) {
    const lowResponses = responses.filter(r => r.score <= 25);
    if (lowResponses.length > 0) {
      sections.push("\nLOW-SCORING INDIVIDUAL RESPONSES (score ≤ 25):");
      for (const r of lowResponses.slice(0, 15)) {
        sections.push(`  ${r.question_id} (${r.domain_id}): "${r.raw_response}" → score ${r.score}`);
      }
    }
  }

  if (hasInBody) {
    sections.push(`\nINBODY BODY COMPOSITION ANALYSIS (${inbodyObs.length} measurements):`);
    sections.push("Each measurement below includes its terrain state vector mapping {E, I, V, R, Σ}, contributing CIE gates, and clinical interpretation.");
    for (const o of inbodyObs) {
      const mapping = resolveInBodyMapping(o.canonical_name);
      const flag = o.flag ? ` [${o.flag}]` : "";
      const ref = o.ref_low != null && o.ref_high != null ? ` (ref: ${o.ref_low}-${o.ref_high})` : "";
      let line = `  ${o.collection_date} | ${o.canonical_name}: ${o.value} ${o.unit}${flag}${ref}`;
      if (mapping) {
        line += `\n    → State vector: {${mapping.coordinates.join(", ")}} | Gates: ${mapping.gates.join(", ")}`;
        line += `\n    → ${mapping.interpretation}`;
        if (mapping.healthy_range) {
          line += `\n    → Healthy range: ${mapping.healthy_range.low}–${mapping.healthy_range.high} (${mapping.direction})`;
        }
      }
      sections.push(line);
    }
  }

  if (standardObs.length > 0) {
    sections.push(`\nLAB OBSERVATIONS (${standardObs.length} biomarkers from last 6 months):`);
    for (const o of standardObs.slice(0, 30)) {
      const flag = o.flag ? ` [${o.flag}]` : "";
      const ref = o.ref_low != null && o.ref_high != null ? ` (ref: ${o.ref_low}-${o.ref_high})` : "";
      sections.push(`  ${o.collection_date} | ${o.canonical_name}: ${o.value} ${o.unit}${flag}${ref}`);
    }
  } else if (!hasInBody) {
    sections.push("\nLAB OBSERVATIONS: (none on file)");
  }

  sections.push("\nProduce the rendering following every operational move in Part 4 of the framework. Use the voice-shift rules from Part 3 depending on which data layers are present. When InBody body composition data is present, reference specific measurements by name and number. Never use any vocabulary from Part 5. Return strict JSON in the schema defined above. No preamble. No markdown code fences.");
  return sections.join("\n");
}

// ============================================================================
// LLM CALL
// ============================================================================

async function callAnthropicForJson(
  userMessage: string,
  systemPrompt: string,
  feedbackMessage?: string
): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

  const messages: any[] = [{ role: "user", content: userMessage }];
  if (feedbackMessage) {
    messages.push({ role: "assistant", content: "{ /* previous attempt */ }" });
    messages.push({ role: "user", content: feedbackMessage });
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
}

// ============================================================================
// VOICE VALIDATION HELPERS
// ============================================================================

function extractPatientPortraitProse(parsed: any): string {
  const fields = ["what_you_already_know", "working_harder_than_you_realize", "where_to_start", "the_one_action"];
  return fields
    .map(f => parsed.patient_portrait?.[f] || "")
    .filter(s => s.length > 0)
    .join("\n\n");
}

function extractClinicianSummaryProse(parsed: any): string {
  const parts: string[] = [];
  if (parsed.clinician_summary?.terrain_overview) {
    parts.push(parsed.clinician_summary.terrain_overview);
  }
  if (Array.isArray(parsed.clinician_summary?.axis_breakdown)) {
    for (const axis of parsed.clinician_summary.axis_breakdown) {
      if (axis.interpretation) parts.push(axis.interpretation);
    }
  }
  if (Array.isArray(parsed.clinician_summary?.perception_gaps)) {
    for (const gap of parsed.clinician_summary.perception_gaps) {
      if (gap.summary) parts.push(gap.summary);
    }
  }
  // suggested_questions are not prose — skip them
  return parts.join("\n\n");
}

function stripMarkersFromPortrait(parsed: any): void {
  const fields = ["what_you_already_know", "working_harder_than_you_realize", "where_to_start", "the_one_action"];
  for (const f of fields) {
    if (typeof parsed.patient_portrait?.[f] === "string") {
      parsed.patient_portrait[f] = stripClusterMarkers(parsed.patient_portrait[f]);
    }
  }
}

function stripMarkersFromClinicianSummary(parsed: any): void {
  if (typeof parsed.clinician_summary?.terrain_overview === "string") {
    parsed.clinician_summary.terrain_overview = stripClusterMarkers(parsed.clinician_summary.terrain_overview);
  }
  if (Array.isArray(parsed.clinician_summary?.axis_breakdown)) {
    for (const axis of parsed.clinician_summary.axis_breakdown) {
      if (typeof axis.interpretation === "string") {
        axis.interpretation = stripClusterMarkers(axis.interpretation);
      }
    }
  }
  if (Array.isArray(parsed.clinician_summary?.perception_gaps)) {
    for (const gap of parsed.clinician_summary.perception_gaps) {
      if (typeof gap.summary === "string") {
        gap.summary = stripClusterMarkers(gap.summary);
      }
    }
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, assessment_id } = await req.json();
    if (!user_id) throw new Error("user_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Fetch profile (need id for cluster fetch)
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, first_name, age, sex")
      .eq("user_id", user_id)
      .single();
    if (profileErr || !profile) throw new Error("Could not load profile");

    // 2. Fetch assessment
    let assessmentFilter = supabase
      .from("cie_assessments")
      .select("id, version, status")
      .eq("user_id", user_id)
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(1);

    if (assessment_id) {
      assessmentFilter = supabase
        .from("cie_assessments")
        .select("id, version, status")
        .eq("id", assessment_id)
        .limit(1);
    }

    const { data: assessments } = await assessmentFilter;
    const assessment = assessments?.[0];
    if (!assessment) {
      return new Response(JSON.stringify({ success: false, error: "No completed assessment found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Fetch domain scores, gate scores, responses, lab obs, AND clusters in parallel
    const [domainRes, gateRes, responseRes, labRes, clusterRes] = await Promise.all([
      supabase.from("cie_domain_scores").select("*").eq("assessment_id", assessment.id),
      supabase.from("cie_gate_scores").select("*").eq("assessment_id", assessment.id),
      supabase.from("cie_responses").select("question_id, domain_id, raw_response, score").eq("assessment_id", assessment.id),
      supabase.from("patient_lab_observations").select("*").eq("user_id", user_id)
        .gte("collection_date", new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10))
        .order("collection_date", { ascending: false })
        .limit(50),
      supabase.from("clusters").select("*").eq("patient_id", profile.id).eq("status", "active")
        .order("confidence_score", { ascending: false }),
    ]);

    const domainScores = domainRes.data || [];
    const gateScores = gateRes.data || [];
    const responses = responseRes.data || [];
    const labObs = labRes.data || [];
    const clusters = clusterRes.data || [];

    // 4. Build cluster tier map for voice validation
    const clusterTierMap = new Map<string, ClusterTier>();
    for (const c of clusters) {
      clusterTierMap.set(c.id, c.confidence_tier as ClusterTier);
    }

    // 5. Compute input hash and check for existing render
    const inputData = {
      profile: { first_name: profile.first_name, age: profile.age, sex: profile.sex },
      assessment_id: assessment.id,
      domain_scores: domainScores.map(d => ({ id: d.domain_id, score: d.final_score })),
      gate_scores: gateScores.map(g => ({ id: g.gate_id, score: g.score, tl: g.traffic_light })),
      lab_count: labObs.length,
      cluster_count: clusters.length,
    };
    const inputHash = computeInputHash(inputData);

    // Check for cached render
    const { data: existingRenders } = await supabase
      .from("terrain_renders")
      .select("id, version, status, patient_portrait, clinician_summary")
      .eq("user_id", user_id)
      .eq("generation_input_hash", inputHash)
      .eq("status", "active")
      .limit(1);

    if (existingRenders && existingRenders.length > 0) {
      const cached = existingRenders[0];
      return new Response(JSON.stringify({
        success: true,
        cached: true,
        id: cached.id,
        version: cached.version,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Build system prompt with cluster context and LLM input
    const systemPrompt = buildTerrainSystemPrompt(clusters);
    const userMessage = composeUserMessage(profile, domainScores, gateScores, responses, labObs);
    const startTime = Date.now();

    // 7. Generation loop with dual-audience voice validation
    const MAX_VOICE_RETRIES = 3;
    let parsed: any = null;
    let lastStructuralError: string | undefined;
    let lastViolations: VocabularyViolation[] = [];
    let feedbackMessage: string | undefined;
    let voiceValidationStatus: string | null = null;

    for (let attempt = 0; attempt < MAX_VOICE_RETRIES; attempt++) {
      try {
        const rawOutput = await callAnthropicForJson(userMessage, systemPrompt, feedbackMessage);
        parsed = extractJsonFromText(rawOutput);

        // Structural validation first
        const structValidation = validateTerrainRender(parsed);
        if (!structValidation.valid) {
          lastStructuralError = structValidation.errors.join("; ");
          feedbackMessage = `Your previous output had structural validation errors:\n\n${lastStructuralError}\n\nProduce a corrected JSON object. Output only JSON.`;
          parsed = null;
          console.log(`Attempt ${attempt + 1} structural validation failed: ${lastStructuralError}`);
          continue;
        }

        // Dual-audience voice validation
        if (clusters.length > 0) {
          const portraitProse = extractPatientPortraitProse(parsed);
          const clinicianProse = extractClinicianSummaryProse(parsed);

          const { sentenceToClusterMap: patientMap } = parseProseAndCitations(portraitProse);
          const { sentenceToClusterMap: clinicianMap } = parseProseAndCitations(clinicianProse);

          const patientResult = validateProseAgainstClustersWithAudience(portraitProse, clusterTierMap, patientMap, 'patient');
          const clinicianResult = validateProseAgainstClustersWithAudience(clinicianProse, clusterTierMap, clinicianMap, 'clinician');

          if (patientResult.valid && clinicianResult.valid) {
            stripMarkersFromPortrait(parsed);
            stripMarkersFromClinicianSummary(parsed);
            voiceValidationStatus = "passed";
            lastViolations = [];
            break;
          }

          // One or both sides failed — build combined feedback
          const combinedViolations: VocabularyViolation[] = [
            ...patientResult.violations.map(v => ({ ...v, section: 'patient_portrait' })),
            ...clinicianResult.violations.map(v => ({ ...v, section: 'clinician_summary' })),
          ];
          lastViolations = combinedViolations;
          feedbackMessage = buildRetryFeedbackWithSections(combinedViolations);
          console.log(`Attempt ${attempt + 1} voice validation failed: ${patientResult.violations.length} patient + ${clinicianResult.violations.length} clinician violations`);
          // Keep parsed for potential final write
        } else {
          // No clusters — skip voice validation but still strip cluster markers
          // that the LLM may have produced in response to the system prompt's
          // citation instructions.
          stripMarkersFromPortrait(parsed);
          stripMarkersFromClinicianSummary(parsed);
          voiceValidationStatus = "passed";
          break;
        }
      } catch (e) {
        lastStructuralError = e instanceof Error ? e.message : String(e);
        feedbackMessage = `Your previous output had errors:\n\n${lastStructuralError}\n\nProduce a corrected JSON object. Output only JSON.`;
        parsed = null;
        console.error(`Attempt ${attempt + 1} error:`, lastStructuralError);
      }
    }

    const generationMs = Date.now() - startTime;

    // If we exhausted retries with voice violations but have a structurally valid parse
    if (parsed && !voiceValidationStatus && lastViolations.length > 0) {
      stripMarkersFromPortrait(parsed);
      stripMarkersFromClinicianSummary(parsed);
      voiceValidationStatus = "failed_with_warnings";
    }

    // 8. Get next version
    const { data: versionData } = await supabase.rpc("next_terrain_render_version", { p_user_id: user_id });
    const nextVersion = versionData || 1;

    if (!parsed) {
      await supabase.from("terrain_renders").insert({
        user_id,
        assessment_id: assessment.id,
        version: nextVersion,
        status: "failed",
        error_message: lastStructuralError || "Generation failed after all retries",
        generated_at: new Date().toISOString(),
      });

      return new Response(JSON.stringify({ success: false, error: lastStructuralError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 9. Insert active row with voice validation fields
    const { data: insertedRow, error: insertErr } = await supabase
      .from("terrain_renders")
      .insert({
        user_id,
        assessment_id: assessment.id,
        version: nextVersion,
        status: "active",
        patient_portrait: parsed.patient_portrait,
        clinician_summary: parsed.clinician_summary,
        generation_input_hash: inputHash,
        generated_at: new Date().toISOString(),
        voice_validation_status: voiceValidationStatus,
        voice_validation_warnings: lastViolations.length > 0 ? lastViolations : null,
      })
      .select("id, version")
      .single();

    if (insertErr) throw new Error(`Failed to persist render: ${insertErr.message}`);

    return new Response(JSON.stringify({
      success: true,
      cached: false,
      id: insertedRow.id,
      version: insertedRow.version,
      generation_ms: generationMs,
      voice_validation_status: voiceValidationStatus,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("generate-terrain-render error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
