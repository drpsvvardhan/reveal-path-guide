// Deterministic n=1 comparator for edge functions.
// Mirrors src/lib/ppe/comparator.ts. Kept as a separate copy because
// Deno edge functions can't import from src/.

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
  phase_a: DailyObservation["phase"];
  phase_b: DailyObservation["phase"];
  observations: DailyObservation[];
  desired_direction: Direction;
  min_observations_per_phase: number;
  min_adherence_pct: number;
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

function directionConsistency(bVals: number[], medianA: number, dir: Direction): number {
  if (bVals.length === 0) return 0;
  let hits = 0;
  for (const v of bVals) {
    if (dir === "increase" && v > medianA) hits++;
    else if (dir === "decrease" && v < medianA) hits++;
    else if (dir === "stabilize" && Math.abs(v - medianA) / (Math.abs(medianA) || 1) < 0.05) hits++;
  }
  return hits / bVals.length;
}

function overlapRatio(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 1;
  const aMin = Math.min(...a), aMax = Math.max(...a);
  const bMin = Math.min(...b), bMax = Math.max(...b);
  const inter = Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));
  const union = Math.max(1e-9, Math.max(aMax, bMax) - Math.min(aMin, bMin));
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
  const missingness_pct = (missingA + missingB) / (2 * input.min_observations_per_phase);

  const bConfoundedDays = b.filter((o) => confounderCount(o) > 0).length;
  const confounder_burden = bLogged > 0 ? bConfoundedDays / bLogged : 0;

  const reasons: string[] = [];
  let result: ComparisonResult;

  if (input.stopped_for_safety) {
    result = "STOPPED_FOR_SAFETY";
    reasons.push("Experiment was stopped for safety before comparison could complete.");
  } else if (n_a < input.min_observations_per_phase || n_b < input.min_observations_per_phase) {
    result = "NOT_INTERPRETABLE";
    reasons.push(`Not enough observations (${n_a} run-in, ${n_b} intervention; need ≥ ${input.min_observations_per_phase} each).`);
  } else if (adherence_pct < input.min_adherence_pct) {
    result = "NOT_INTERPRETABLE";
    reasons.push(`Adherence ${(adherence_pct * 100).toFixed(0)}% below target ${(input.min_adherence_pct * 100).toFixed(0)}%.`);
  } else if (confounder_burden >= 0.3) {
    result = "NOT_INTERPRETABLE";
    reasons.push(`Confounders present on ${(confounder_burden * 100).toFixed(0)}% of intervention days.`);
  } else {
    const consistency = direction_consistency_pct ?? 0;
    const overlap = overlap_ratio ?? 1;
    const desiredMet =
      (input.desired_direction === "increase" && (abs_change ?? 0) > 0) ||
      (input.desired_direction === "decrease" && (abs_change ?? 0) < 0) ||
      (input.desired_direction === "stabilize" && Math.abs(abs_change ?? 0) / (Math.abs(median_a ?? 1) || 1) < 0.05);

    if (desiredMet && consistency >= 0.7 && overlap < 0.5) {
      result = "SIGNAL_DETECTED";
      reasons.push(`Median shifted in the predicted direction with ${(consistency * 100).toFixed(0)}% consistency and low overlap.`);
    } else if (desiredMet && consistency >= 0.5) {
      result = "POSSIBLE_SIGNAL";
      reasons.push(`Movement in the predicted direction, but overlap between phases is ${(overlap * 100).toFixed(0)}%.`);
    } else {
      result = "NO_DETECTABLE_SIGNAL";
      reasons.push(`No reliable shift in predicted direction (consistency ${(consistency * 100).toFixed(0)}%, overlap ${(overlap * 100).toFixed(0)}%).`);
    }
  }

  const human_summary =
    result === "SIGNAL_DETECTED" ? "A reproducible shift showed up in your data for this cycle. This is one cycle — a second cycle would tell us whether it holds." :
    result === "POSSIBLE_SIGNAL" ? "Something moved in the direction we predicted, but not clearly enough to call it. Worth another cycle before we trust it." :
    result === "NO_DETECTABLE_SIGNAL" ? "In this cycle, we did not see a reliable shift. That is a real finding — not every lever will move your biology." :
    result === "NOT_INTERPRETABLE" ? `This cycle cannot be interpreted cleanly. ${reasons[0] ?? ""} We should run it again with these fixed before drawing conclusions.` :
    "The experiment was stopped early for safety. No conclusion drawn.";

  return {
    n_a, n_b, median_a, median_b, abs_change, pct_change,
    direction_consistency_pct, overlap_ratio, adherence_pct,
    missingness_pct, confounder_burden, result, reasons, human_summary,
  };
}