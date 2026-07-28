// ============================================================================
// Precision Perturbation Engine v2 — deterministic n=1 comparator
// ----------------------------------------------------------------------------
// PURE FUNCTIONS. No I/O, no LLM. This is the sole decision-maker for whether
// an experiment produced a signal. LLMs may narrate the result but must never
// alter it.
// ============================================================================

export type ComparisonResult =
  | "SIGNAL_DETECTED"
  | "POSSIBLE_SIGNAL"
  | "NO_DETECTABLE_SIGNAL"
  | "NOT_INTERPRETABLE"
  | "STOPPED_FOR_SAFETY";

export type Direction = "increase" | "decrease" | "stabilize";

export interface DailyObservation {
  phase: "run_in" | "intervention" | "washout" | "crossover_a" | "crossover_b";
  intervention_performed: boolean | null;
  primary_value: number | null;
  confounders?: Record<string, unknown> | null;
}

export interface ComparatorInput {
  phase_a: DailyObservation["phase"]; // typically run_in
  phase_b: DailyObservation["phase"]; // typically intervention
  observations: DailyObservation[];
  desired_direction: Direction;
  min_observations_per_phase: number;
  min_adherence_pct: number; // 0..1
  stopped_for_safety?: boolean;
}

export interface ComparatorOutput {
  n_a: number;
  n_b: number;
  median_a: number | null;
  median_b: number | null;
  abs_change: number | null;
  pct_change: number | null;
  direction_consistency_pct: number | null;
  overlap_ratio: number | null;
  adherence_pct: number;
  missingness_pct: number;
  confounder_burden: number;
  result: ComparisonResult;
  reasons: string[];
  human_summary: string;
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Fraction of paired positions (min(nA,nB)) where B-side value moves in the
// desired direction versus phase A's median.
function directionConsistency(
  bVals: number[],
  medianA: number,
  dir: Direction,
): number {
  if (bVals.length === 0) return 0;
  let hits = 0;
  for (const v of bVals) {
    if (dir === "increase" && v > medianA) hits++;
    else if (dir === "decrease" && v < medianA) hits++;
    else if (dir === "stabilize" && Math.abs(v - medianA) / (Math.abs(medianA) || 1) < 0.05) hits++;
  }
  return hits / bVals.length;
}

// Ratio of the intersection of [min,max] ranges to the union — a rough
// distribution-overlap proxy that does not require SciPy.
function overlapRatio(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 1;
  const aMin = Math.min(...a), aMax = Math.max(...a);
  const bMin = Math.min(...b), bMax = Math.max(...b);
  const interLo = Math.max(aMin, bMin);
  const interHi = Math.min(aMax, bMax);
  const inter = Math.max(0, interHi - interLo);
  const unionLo = Math.min(aMin, bMin);
  const unionHi = Math.max(aMax, bMax);
  const union = Math.max(1e-9, unionHi - unionLo);
  return inter / union;
}

function confounderCount(o: DailyObservation): number {
  const c = o.confounders || {};
  const keys = ["illness", "travel", "alcohol", "unusual_stress", "diet_deviation", "med_change"];
  let n = 0;
  for (const k of keys) if ((c as any)[k]) n++;
  return n;
}

export function comparePhases(input: ComparatorInput): ComparatorOutput {
  const a = input.observations.filter((o) => o.phase === input.phase_a);
  const b = input.observations.filter((o) => o.phase === input.phase_b);
  const aVals = a.map((o) => o.primary_value).filter((v): v is number => typeof v === "number" && !isNaN(v));
  const bVals = b.map((o) => o.primary_value).filter((v): v is number => typeof v === "number" && !isNaN(v));

  const n_a = aVals.length;
  const n_b = bVals.length;
  const median_a = median(aVals);
  const median_b = median(bVals);
  const abs_change = median_a != null && median_b != null ? median_b - median_a : null;
  const pct_change =
    median_a != null && median_b != null && median_a !== 0
      ? (median_b - median_a) / Math.abs(median_a)
      : null;

  const direction_consistency_pct =
    median_a != null ? directionConsistency(bVals, median_a, input.desired_direction) : null;
  const overlap_ratio = overlapRatio(aVals, bVals);

  const bPerformed = b.filter((o) => o.intervention_performed === true).length;
  const bLogged = b.length;
  const adherence_pct = bLogged > 0 ? bPerformed / bLogged : 0;

  const missingA = Math.max(0, input.min_observations_per_phase - n_a);
  const missingB = Math.max(0, input.min_observations_per_phase - n_b);
  const missingness_pct =
    (missingA + missingB) / (2 * input.min_observations_per_phase);

  const bConfoundedDays = b.filter((o) => confounderCount(o) > 0).length;
  const confounder_burden = bLogged > 0 ? bConfoundedDays / bLogged : 0;

  const reasons: string[] = [];
  let result: ComparisonResult;

  if (input.stopped_for_safety) {
    result = "STOPPED_FOR_SAFETY";
    reasons.push("Experiment was stopped for safety before comparison could complete.");
  } else if (
    n_a < input.min_observations_per_phase ||
    n_b < input.min_observations_per_phase
  ) {
    result = "NOT_INTERPRETABLE";
    reasons.push(
      `Not enough observations (${n_a} run-in, ${n_b} intervention; need ≥ ${input.min_observations_per_phase} each).`,
    );
  } else if (adherence_pct < input.min_adherence_pct) {
    result = "NOT_INTERPRETABLE";
    reasons.push(
      `Adherence ${(adherence_pct * 100).toFixed(0)}% below target ${(input.min_adherence_pct * 100).toFixed(0)}%.`,
    );
  } else if (confounder_burden >= 0.3) {
    result = "NOT_INTERPRETABLE";
    reasons.push(
      `Confounders present on ${(confounder_burden * 100).toFixed(0)}% of intervention days.`,
    );
  } else {
    const consistency = direction_consistency_pct ?? 0;
    const overlap = overlap_ratio ?? 1;
    const desiredMet =
      (input.desired_direction === "increase" && (abs_change ?? 0) > 0) ||
      (input.desired_direction === "decrease" && (abs_change ?? 0) < 0) ||
      (input.desired_direction === "stabilize" && Math.abs(abs_change ?? 0) / (Math.abs(median_a ?? 1) || 1) < 0.05);

    if (desiredMet && consistency >= 0.7 && overlap < 0.5) {
      result = "SIGNAL_DETECTED";
      reasons.push(
        `Median shifted in the predicted direction with ${(consistency * 100).toFixed(0)}% of intervention days consistent and low distribution overlap (${(overlap * 100).toFixed(0)}%).`,
      );
    } else if (desiredMet && consistency >= 0.5) {
      result = "POSSIBLE_SIGNAL";
      reasons.push(
        `Movement in the predicted direction, but with meaningful overlap (${(overlap * 100).toFixed(0)}%) between phases.`,
      );
    } else {
      result = "NO_DETECTABLE_SIGNAL";
      reasons.push(
        `No reliable shift in the predicted direction (consistency ${(consistency * 100).toFixed(0)}%, overlap ${(overlap * 100).toFixed(0)}%).`,
      );
    }
  }

  const human_summary = buildSummary({
    result,
    median_a,
    median_b,
    pct_change,
    adherence_pct,
    confounder_burden,
    reasons,
  });

  return {
    n_a,
    n_b,
    median_a,
    median_b,
    abs_change,
    pct_change,
    direction_consistency_pct,
    overlap_ratio,
    adherence_pct,
    missingness_pct,
    confounder_burden,
    result,
    reasons,
    human_summary,
  };
}

function buildSummary(x: {
  result: ComparisonResult;
  median_a: number | null;
  median_b: number | null;
  pct_change: number | null;
  adherence_pct: number;
  confounder_burden: number;
  reasons: string[];
}): string {
  switch (x.result) {
    case "SIGNAL_DETECTED":
      return `A reproducible shift showed up in your data for this cycle. This is one cycle — a second cycle would tell us whether it holds.`;
    case "POSSIBLE_SIGNAL":
      return `Something moved in the direction we predicted, but not clearly enough to call it. Worth another cycle before we trust it.`;
    case "NO_DETECTABLE_SIGNAL":
      return `In this cycle, we did not see a reliable shift. That is a real finding — not every lever will move your biology.`;
    case "NOT_INTERPRETABLE":
      return `This cycle cannot be interpreted cleanly. ${x.reasons[0] ?? ""} We should run it again with these fixed before drawing conclusions.`;
    case "STOPPED_FOR_SAFETY":
      return `The experiment was stopped early for safety. No conclusion drawn.`;
  }
}