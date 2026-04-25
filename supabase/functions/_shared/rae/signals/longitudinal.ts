// ============================================================================
// rae/signals/longitudinal.ts — Signal 7: longitudinal coherence (gate).
// Pure. Imports only from ../types.ts.
// ============================================================================
import type { LongitudinalEvidence, SignalResult } from "../types.ts";

export interface PriorObservation {
  witness_id: string;
  value: number;
  observed_at: string; // ISO timestamp
}

export interface LongitudinalInput {
  current_value: number | null;
  current_observed_at: string | null;
  prior_observations: PriorObservation[];
  /** Maximum allowed absolute delta vs. nearest prior, in canonical units. */
  delta_ceiling: number | null;
  /** Stable identifier for the dynamics rule applied. */
  dynamics_rule_id: string | null;
  /** Minimum prior count required to evaluate. Default 1. */
  min_history?: number;
  weight: number;
}

function nearestPrior(
  priors: PriorObservation[],
  ts: string,
): PriorObservation | null {
  if (!priors.length) return null;
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return priors[priors.length - 1];
  let best: PriorObservation | null = null;
  let bestDelta = Infinity;
  for (const p of priors) {
    const pt = Date.parse(p.observed_at);
    if (Number.isNaN(pt)) continue;
    const d = Math.abs(t - pt);
    if (d < bestDelta) {
      bestDelta = d;
      best = p;
    }
  }
  return best;
}

export function evaluateLongitudinal(
  input: LongitudinalInput,
): SignalResult {
  const minHistory = input.min_history ?? 1;
  const priors = input.prior_observations ?? [];

  if (
    input.current_value === null ||
    input.current_observed_at === null ||
    priors.length < minHistory ||
    input.delta_ceiling === null
  ) {
    const evidence: LongitudinalEvidence = {
      signal_id: "longitudinal",
      prior_witness_ids: priors.map((p) => p.witness_id),
      dynamics_rule_id: input.dynamics_rule_id,
      delta_observed: null,
      delta_ceiling: input.delta_ceiling,
      result: "insufficient_history",
    };
    return {
      signal_id: "longitudinal",
      band: "abstain",
      score: 0,
      weight: input.weight,
      contributes_to_denominator: false,
      evidence,
      notes: ["insufficient longitudinal history; abstaining"],
    };
  }

  const nearest = nearestPrior(priors, input.current_observed_at);
  if (!nearest) {
    const evidence: LongitudinalEvidence = {
      signal_id: "longitudinal",
      prior_witness_ids: priors.map((p) => p.witness_id),
      dynamics_rule_id: input.dynamics_rule_id,
      delta_observed: null,
      delta_ceiling: input.delta_ceiling,
      result: "insufficient_history",
    };
    return {
      signal_id: "longitudinal",
      band: "abstain",
      score: 0,
      weight: input.weight,
      contributes_to_denominator: false,
      evidence,
      notes: ["no datable prior observations; abstaining"],
    };
  }

  const delta = Math.abs(input.current_value - nearest.value);
  const coherent = delta <= input.delta_ceiling;

  const evidence: LongitudinalEvidence = {
    signal_id: "longitudinal",
    prior_witness_ids: priors.map((p) => p.witness_id),
    dynamics_rule_id: input.dynamics_rule_id,
    delta_observed: delta,
    delta_ceiling: input.delta_ceiling,
    result: coherent ? "coherent" : "incoherent",
  };

  return {
    signal_id: "longitudinal",
    band: coherent ? "pass" : "fail",
    score: coherent ? 1 : 0,
    weight: input.weight,
    contributes_to_denominator: true,
    evidence,
    notes: coherent
      ? []
      : [`delta ${delta} exceeds ceiling ${input.delta_ceiling}`],
  };
}