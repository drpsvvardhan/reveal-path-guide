// ─── Experiment Admission (EAE) v0.1 ───
//
// Gates Biological Simulator "what-if" experiments between LLM generation and
// the patient. An experiment is a causal edge the patient TESTS:
//     lever (intervention) → predicted_deltas (effect on real biomarkers)
//
// This is AAE's shape, tuned for experiments. Unlike a PRESCRIPTION (which must
// be strongly admitted), an experiment is ALLOWED to be exploratory — that is
// its value. So EAE does NOT block on weak evidence. It blocks only on the two
// things that are never acceptable, and it LABELS confidence so the patient sees
// honest calibration instead of uniform certainty.
//
// THREE GATES (Option B):
//   1. Biomarker binding — every predicted_delta must reference a biomarker that
//      is ACTUALLY in this patient's data. Fabricated biomarkers → BLOCK.
//   2. Safety / contraindication — the lever is checked against contraindication
//      rules. A hit → BLOCK (routed to clinician, never shown raw to patient).
//   3. Evidence labeling — the experiment is labeled ADMIT vs ADMIT_WITH_REVIEW
//      by how well-supported it is, so the patient sees calibrated confidence.
//
// Blocked experiments are withheld from the patient and surfaced clinician-only.

export type ExperimentVerdict = "ADMIT" | "ADMIT_WITH_REVIEW" | "BLOCK";

export interface PredictedDelta {
  biomarker: string;
  direction: "increase" | "decrease" | "stabilize";
  magnitude?: string;
  unit?: string;
  coordinate?: string;
  confidence?: number;
  rationale?: string;
}

export interface ExperimentCard {
  lever: string;
  rationale: string;
  predicted_deltas: PredictedDelta[];
  horizon_days: number;
  confidence: number;
}

export interface ExperimentAdmission {
  verdict: ExperimentVerdict;
  reasons: string[];
  // gate-by-gate detail for the clinician ledger
  binding_ok: boolean;
  unbound_biomarkers: string[];     // predicted deltas not found in patient data
  safety_ok: boolean;
  safety_flags: string[];           // which contraindication rules fired
  evidence_label: "well_supported" | "exploratory" | "speculative";
  patient_safe: boolean;            // false → never shown to patient
}

// ── Contraindication rules (v0.1, conservative, extensible) ──
// Each rule: if the lever matches a pattern AND the patient has a flag, it fires.
// patientFlags is a set of simple condition tokens resolved upstream from the
// patient's data (e.g. "cardiac_risk", "low_hrv", "ed_history", "ckd",
// "pregnancy", "underweight"). EAE does not compute these — it consumes them.
interface ContraRule {
  id: string;
  leverMatches: RegExp;
  requiresFlag: string;
  reason: string;
}

const CONTRA_RULES: ContraRule[] = [
  { id: "fasting_ed", leverMatches: /\b(fast|time.?restricted|skip\s+\w+\s+meal|eating window|caloric restriction|restrict)\b/i, requiresFlag: "ed_history", reason: "Time-restricted / caloric-restriction experiment is contraindicated with a disordered-eating history." },
  { id: "fasting_underweight", leverMatches: /\b(fast|time.?restricted|eating window|caloric restriction|restrict)\b/i, requiresFlag: "underweight", reason: "Restriction experiment is contraindicated when underweight." },
  { id: "intense_exercise_cardiac", leverMatches: /\b(HIIT|high.?intensity|sprint|max(imal)?\s+effort|heavy\s+lift|intense)\b/i, requiresFlag: "cardiac_risk", reason: "High-intensity exercise experiment requires cardiac clearance." },
  { id: "exercise_low_hrv", leverMatches: /\b(HIIT|high.?intensity|overreach|train.*twice|double\s+session)\b/i, requiresFlag: "low_hrv", reason: "High-load training experiment is contraindicated on a low-HRV / poor-recovery terrain." },
  { id: "supplement_ckd", leverMatches: /\b(creatine|high.?protein|protein\s+loading|\d+\s*g\s+protein)\b/i, requiresFlag: "ckd", reason: "High-protein / creatine experiment requires renal review in chronic kidney disease." },
  { id: "any_restriction_pregnancy", leverMatches: /\b(fast|restrict|eliminat|cut\s+out|caloric)\b/i, requiresFlag: "pregnancy", reason: "Dietary-restriction experiments are contraindicated in pregnancy." },
];

// Gate 1 — biomarker binding.
function checkBinding(card: ExperimentCard, patientBiomarkers: Set<string>): { ok: boolean; unbound: string[] } {
  const unbound: string[] = [];
  for (const d of card.predicted_deltas || []) {
    // normalize loosely: lowercase, strip spaces/underscores
    const norm = d.biomarker.toLowerCase().replace(/[\s_]+/g, "");
    const found = [...patientBiomarkers].some((b) => {
      const bn = b.toLowerCase().replace(/[\s_]+/g, "");
      return bn === norm || bn.includes(norm) || norm.includes(bn);
    });
    if (!found) unbound.push(d.biomarker);
  }
  return { ok: unbound.length === 0, unbound };
}

// Gate 2 — safety / contraindication.
function checkSafety(card: ExperimentCard, patientFlags: Set<string>): { ok: boolean; flags: string[] } {
  const flags: string[] = [];
  for (const rule of CONTRA_RULES) {
    if (rule.leverMatches.test(card.lever) && patientFlags.has(rule.requiresFlag)) {
      flags.push(rule.reason);
    }
  }
  return { ok: flags.length === 0, flags };
}

// Gate 3 — evidence label (does not block; calibrates).
function labelEvidence(card: ExperimentCard): ExperimentAdmission["evidence_label"] {
  const c = typeof card.confidence === "number" ? card.confidence : 0;
  if (c >= 0.6) return "well_supported";
  if (c >= 0.4) return "exploratory";
  return "speculative";
}

export function admitExperiment(
  card: ExperimentCard,
  patientBiomarkers: Set<string>,
  patientFlags: Set<string>,
): ExperimentAdmission {
  const binding = checkBinding(card, patientBiomarkers);
  const safety = checkSafety(card, patientFlags);
  const evidence_label = labelEvidence(card);
  const reasons: string[] = [];

  let verdict: ExperimentVerdict;
  let patient_safe: boolean;

  if (!safety.ok) {
    // Safety is non-negotiable — contraindicated experiments never reach a patient.
    verdict = "BLOCK";
    patient_safe = false;
    reasons.push(...safety.flags);
  } else if (!binding.ok) {
    // Fabricated/unbound biomarkers → block (prediction not grounded in patient data).
    verdict = "BLOCK";
    patient_safe = false;
    reasons.push(`Predicted change references biomarker(s) not in patient data: ${binding.unbound.join(", ")}.`);
  } else if (evidence_label === "speculative") {
    // Exploration is allowed, but a speculative experiment is shown with review framing.
    verdict = "ADMIT_WITH_REVIEW";
    patient_safe = true;
    reasons.push("Experiment is exploratory/low-confidence — admitted with review framing.");
  } else {
    verdict = "ADMIT";
    patient_safe = true;
    reasons.push(`Bound to patient biomarkers; ${evidence_label}.`);
  }

  return {
    verdict,
    reasons,
    binding_ok: binding.ok,
    unbound_biomarkers: binding.unbound,
    safety_ok: safety.ok,
    safety_flags: safety.flags,
    evidence_label,
    patient_safe,
  };
}

// Batch admit + ledger (mirrors AAE's emptiness ledger).
export interface ExperimentLedger {
  total: number;
  admitted: number;
  blocked: number;
  blocked_unsafe: number;
  blocked_unbound: number;
  emptiness_ratio: number;
}

export function admitExperiments(
  cards: ExperimentCard[],
  patientBiomarkers: Set<string>,
  patientFlags: Set<string>,
): { results: ExperimentAdmission[]; ledger: ExperimentLedger } {
  const results = cards.map((c) => admitExperiment(c, patientBiomarkers, patientFlags));
  const blocked = results.filter((r) => r.verdict === "BLOCK");
  return {
    results,
    ledger: {
      total: results.length,
      admitted: results.filter((r) => r.verdict !== "BLOCK").length,
      blocked: blocked.length,
      blocked_unsafe: blocked.filter((r) => !r.safety_ok).length,
      blocked_unbound: blocked.filter((r) => r.safety_ok && !r.binding_ok).length,
      emptiness_ratio: results.length === 0 ? 0 : blocked.length / results.length,
    },
  };
}
