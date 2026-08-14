// ============================================================================
// supabase/functions/_shared/cieScoring.ts
// ----------------------------------------------------------------------------
// The single source of CIE scoring semantics: response vocabularies,
// question polarity, layer weights, gate definitions, and the axis map.
// Extracted from cie-score-assessment so the factory-CIE importer and the
// scorer can never drift apart.
// ============================================================================

// ── Scoring maps (default: negative polarity — "yes" = symptom present = 0) ──
export const SCORE_MAPS: Record<string, Record<string, number>> = {
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
export const POSITIVE_POLARITY: Set<string> = new Set([
  // H22 — Light & Movement
  "H22Q1", "H22Q2",
  "H22D1", "H22D2", "H22D3", "H22D5", "H22D7", "H22D8",
  // H23 — Nutrition Identity
  "H23Q2", "H23Q3",
  "H23D1", "H23D2", "H23D5", "H23D6", "H23D7", "H23D8", "H23D9", "H23D10",
  // I24 — Hydration
  "I24Q1", "I24D1", "I24D5", "I24D8",
  // J25 — Social Connection
  "J25Q1", "J25Q3",
  // E13 — Sleep/Circadian
  "E13D9", "E13D10",
  // E14 — Mood
  "E14D5", "E14D10",
  // E15 — Cognitive
  "E15D10",
  // F16 — Musculoskeletal
  "F16D8",
  // F17 — Skin/Connective
  "F17D9",
  // F18 — Bone
  "F18D2", "F18D3", "F18D10",
  // G19 — Thyroid
  "G19D10",
  // G20 — Reproductive
  "G20D10",
  // G21 — Insulin-Cortisol
  "G21D8",
  // D12 — Liver-Gut Loop
  "D12D8",
]);

// ── Neutral-polarity questions: diagnostic awareness — score 50 regardless ──
export const NEUTRAL_POLARITY: Set<string> = new Set([
  "A1D8", "A2D6", "A2D8", "B4D8", "B5D5", "B5D6", "B6D5", "B6D9",
  "C8D2", "C8D7", "C9D6", "D10D5", "D11D2", "D11D5", "D11D9",
  "D12D5", "D12D10", "E13D5", "E15D5", "F16D5", "F16D9", "F17D8",
  "F18D1", "G19D2", "G19D5", "G19D7", "G20D1", "G20D5", "G20D9",
  "G21D1", "G21D5", "G21D7", "H22D9", "I24D7",
]);

export const L1_WEIGHTS = [0.40, 0.35, 0.25];
export const L2_WEIGHTS = [0.15, 0.13, 0.12, 0.11, 0.10, 0.10, 0.08, 0.08, 0.07, 0.06];

// ── Gate definitions ──
export const GATES: Record<string, { name: string; domains: string[] }> = {
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
export const DOMAIN_AXIS: Record<string, string> = {
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

/** Ordering index of a question id within its layer ("A1Q2" → 1). */
export function questionIndex(questionId: string): number {
  const match = questionId.match(/\d+$/);
  return match ? parseInt(match[0]) - 1 : 0;
}

export function scoreRaw(questionId: string, questionType: string, rawResponse: string): number {
  // Neutral questions always score 50 — diagnostic awareness, not health status
  if (NEUTRAL_POLARITY.has(questionId)) return 50;

  const map = SCORE_MAPS[questionType] || SCORE_MAPS.frequency;
  const baseScore = map[rawResponse.toLowerCase()] ?? 50;

  // Positive-polarity questions: reverse the score (yes=100, no=0, always=100, never=0)
  if (POSITIVE_POLARITY.has(questionId)) {
    if (questionType === "effectiveness" || questionType === "comparison" ||
        questionType === "chronotype" || questionType === "activity") {
      return baseScore;
    }
    return 100 - baseScore;
  }

  return baseScore;
}

export function trafficLight(score: number): string {
  if (score >= 80) return "GREEN";
  if (score >= 60) return "YELLOW";
  if (score >= 40) return "ORANGE";
  return "RED";
}
