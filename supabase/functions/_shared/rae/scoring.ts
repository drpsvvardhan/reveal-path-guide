// ============================================================================
// supabase/functions/_shared/rae/scoring.ts
// ----------------------------------------------------------------------------
// Composite identity scoring + state routing decision. Mirrors plan §4.2.
//
// Rules (locked):
//   - Identity score uses signals 1–6 only (lexical, unit, value, method,
//     ref_range, panel). Signal 7 (longitudinal) is the coherence gate
//     and is NOT in the identity score.
//   - Abstain → contributes_to_denominator = false: weight removed from
//     denominator; signal score does not zero out the result.
//   - Fail → contributes_to_denominator = true: weight stays in
//     denominator; score contribution is 0.
//   - Partial → contributes_to_denominator = true: weight stays in
//     denominator; score contribution is partial × weight.
//   - Pass → contributes_to_denominator = true: weight stays in
//     denominator; score contribution is score × weight (typically 1×).
//   - Signal 7 fail forces needs_review regardless of identity score.
//   - Calibration policy "calibration_all_routes_to_review" forces every
//     would-be auto_admitted into needs_review.
//
// PURE module. No I/O. No imports outside ./types.ts.
// ============================================================================

import {
  COHERENCE_SIGNAL_ID,
  IDENTITY_SIGNAL_IDS,
  SIGNAL_IDS,
  type AdmissionState,
  type CalibrationPolicy,
  type SignalBand,
  type SignalResult,
} from "./types.ts";

export interface IdentityScoreResult {
  /** Composite weighted score over signals 1–6, in [0,1]. NaN if denominator = 0. */
  identity_score: number;
  /** Sum of weights actually included (abstaining signals excluded). */
  denominator: number;
  /** Sum of (score × weight) for included signals. */
  numerator: number;
  /** Signal_ids whose weight was excluded due to abstention. */
  abstained_signal_ids: string[];
}

/**
 * Compute the abstention-aware identity score over signals 1–6 only.
 * Signal 7 (longitudinal) is ignored by this function — see decideState.
 */
export function computeIdentityScore(signals: SignalResult[]): IdentityScoreResult {
  let numerator = 0;
  let denominator = 0;
  const abstained: string[] = [];

  for (const s of signals) {
    if (!IDENTITY_SIGNAL_IDS.includes(s.signal_id)) continue;

    if (s.band === "abstain" || s.contributes_to_denominator === false) {
      abstained.push(s.signal_id);
      continue;
    }

    denominator += s.weight;
    if (s.band === "fail") {
      // numerator += 0
    } else {
      numerator += s.score * s.weight;
    }
  }

  const identity_score = denominator > 0 ? numerator / denominator : Number.NaN;
  return {
    identity_score,
    denominator,
    numerator,
    abstained_signal_ids: abstained,
  };
}

/** Extract the signal-7 (longitudinal) band, defaulting to "abstain" if missing. */
export function coherenceBand(signals: SignalResult[]): SignalBand {
  const c = signals.find((s) => s.signal_id === COHERENCE_SIGNAL_ID);
  return c ? c.band : "abstain";
}

export interface DecideStateInput {
  signals: SignalResult[];
  threshold_admission: number;
  threshold_rejection_floor: number;
  policy: CalibrationPolicy;
}

export interface DecideStateOutput {
  state: Extract<AdmissionState, "auto_admitted" | "needs_review" | "rejected">;
  identity: IdentityScoreResult;
  coherence: SignalBand;
  /** Why this state was chosen — one of a small enumerated set. */
  routing_reason:
    | "auto_admit_above_threshold"
    | "rejected_below_floor"
    | "review_between_floor_and_threshold"
    | "review_coherence_fail"
    | "review_calibration_policy"
    | "review_no_evidence";
}

/**
 * Decide the initial engine-emitted admission state for a fresh CAW.
 * Engine never emits human_confirmed (state-machine forbids it).
 */
export function decideState(input: DecideStateInput): DecideStateOutput {
  const identity = computeIdentityScore(input.signals);
  const coherence = coherenceBand(input.signals);

  // Hard gate: signal 7 fail forces needs_review.
  if (coherence === "fail") {
    return {
      state: "needs_review",
      identity,
      coherence,
      routing_reason: "review_coherence_fail",
    };
  }

  // No evidence at all → review (guard against div-by-zero from full abstention).
  if (!isFinite(identity.identity_score) || identity.denominator <= 0) {
    return {
      state: "needs_review",
      identity,
      coherence,
      routing_reason: "review_no_evidence",
    };
  }

  // Below the rejection floor → engine emits rejected.
  if (identity.identity_score < input.threshold_rejection_floor) {
    return {
      state: "rejected",
      identity,
      coherence,
      routing_reason: "rejected_below_floor",
    };
  }

  // Above admission threshold → would auto_admit, subject to calibration policy.
  if (identity.identity_score >= input.threshold_admission) {
    if (input.policy === "calibration_all_routes_to_review") {
      return {
        state: "needs_review",
        identity,
        coherence,
        routing_reason: "review_calibration_policy",
      };
    }
    return {
      state: "auto_admitted",
      identity,
      coherence,
      routing_reason: "auto_admit_above_threshold",
    };
  }

  // Between floor and threshold → review.
  return {
    state: "needs_review",
    identity,
    coherence,
    routing_reason: "review_between_floor_and_threshold",
  };
}

/**
 * Validate that a signal_results array contains exactly the seven signals,
 * each appearing exactly once, in the canonical SIGNAL_IDS order. Returns
 * null when valid, or an error string when not.
 */
export function validateSignalResultsShape(signals: SignalResult[]): string | null {
  if (signals.length !== SIGNAL_IDS.length) {
    return `signal_results must have length ${SIGNAL_IDS.length}, got ${signals.length}`;
  }
  for (let i = 0; i < SIGNAL_IDS.length; i++) {
    if (signals[i].signal_id !== SIGNAL_IDS[i]) {
      return `signal_results[${i}].signal_id must be "${SIGNAL_IDS[i]}", got "${signals[i].signal_id}"`;
    }
  }
  return null;
}
