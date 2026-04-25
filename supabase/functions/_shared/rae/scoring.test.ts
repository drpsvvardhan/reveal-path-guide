// ============================================================================
// supabase/functions/_shared/rae/scoring.test.ts
// ----------------------------------------------------------------------------
// Tests for RAE scoring + state routing. Mirrors plan §4.2 + §7.2.
// ============================================================================

import { assert, assertEquals, assertAlmostEquals } from "jsr:@std/assert@1.0.0";
import {
  COHERENCE_SIGNAL_ID,
  IDENTITY_SIGNAL_IDS,
  SIGNAL_IDS,
  type SignalBand,
  type SignalId,
  type SignalResult,
} from "./types.ts";
import {
  computeIdentityScore,
  decideState,
  validateSignalResultsShape,
} from "./scoring.ts";

const EVIDENCE_BY_SIGNAL: Record<SignalId, SignalResult["evidence"]> = {
  lexical: { signal_id: "lexical", matched_name: "x", match_type: "exact" },
  unit: { signal_id: "unit", received_unit: "mg/dL", canonical_unit: "mg/dL" },
  value: {
    signal_id: "value",
    received_value: 0,
    unit_normalized_value: 0,
    plausibility_band: { low: 0, high: 1 },
    position: "inside",
  },
  method: { signal_id: "method", received_method: "x", matched_assay: "x" },
  ref_range: {
    signal_id: "ref_range",
    received_low: 0,
    received_high: 1,
    canonical_range: { low: 0, high: 1 },
    conflict: false,
  },
  panel: { signal_id: "panel", co_observation_ids: [], matched_panel: null },
  longitudinal: {
    signal_id: "longitudinal",
    prior_witness_ids: [],
    dynamics_rule_id: null,
    delta_observed: null,
    delta_ceiling: null,
    result: "insufficient_history",
  },
};

function sig(
  signal_id: SignalId,
  band: SignalBand,
  score: number,
  weight = 1,
  contributes = band !== "abstain",
): SignalResult {
  return {
    signal_id,
    band,
    score,
    weight,
    contributes_to_denominator: contributes,
    evidence: EVIDENCE_BY_SIGNAL[signal_id],
    notes: [],
  };
}

/** Build a full 7-signal array; defaults all six identity signals to pass(1). */
function fullSignals(overrides: Partial<Record<SignalId, SignalResult>> = {}): SignalResult[] {
  return SIGNAL_IDS.map((id) => {
    if (overrides[id]) return overrides[id]!;
    if (id === "longitudinal") return sig("longitudinal", "pass", 1);
    return sig(id, "pass", 1);
  });
}

// ---------------------------------------------------------------------------
// computeIdentityScore — abstention-aware denominator.
// ---------------------------------------------------------------------------
Deno.test("scoring: all-pass identity score = 1.0", () => {
  const r = computeIdentityScore(fullSignals());
  assertAlmostEquals(r.identity_score, 1.0, 1e-9);
  assertEquals(r.denominator, 6);
  assertEquals(r.abstained_signal_ids, []);
});

Deno.test("scoring: abstain removes weight from denominator (does not zero score)", () => {
  // Five passes (weight 1), one abstain (weight 1) → 5/5 = 1.0, not 5/6.
  const r = computeIdentityScore(
    fullSignals({ method: sig("method", "abstain", 0, 1, false) }),
  );
  assertAlmostEquals(r.identity_score, 1.0, 1e-9);
  assertEquals(r.denominator, 5);
  assertEquals(r.abstained_signal_ids, ["method"]);
});

Deno.test("scoring: fail contributes zero to numerator but keeps weight in denominator", () => {
  // Five passes (weight 1), one fail (weight 1) → 5/6.
  const r = computeIdentityScore(
    fullSignals({ method: sig("method", "fail", 0, 1, true) }),
  );
  assertAlmostEquals(r.identity_score, 5 / 6, 1e-9);
  assertEquals(r.denominator, 6);
});

Deno.test("scoring: partial contributes (score × weight) to numerator", () => {
  // Five passes (weight 1) + one partial(0.5, weight 1) → 5.5/6.
  const r = computeIdentityScore(
    fullSignals({ method: sig("method", "partial", 0.5, 1, true) }),
  );
  assertAlmostEquals(r.identity_score, 5.5 / 6, 1e-9);
});

Deno.test("scoring: longitudinal (signal 7) is excluded from identity score", () => {
  // Make signal 7 fail; identity score should still be 1.0.
  const r = computeIdentityScore(
    fullSignals({ longitudinal: sig("longitudinal", "fail", 0, 1, true) }),
  );
  assertAlmostEquals(r.identity_score, 1.0, 1e-9);
  assertEquals(r.denominator, 6);
});

Deno.test("scoring: full abstention yields NaN identity score (denominator 0)", () => {
  const allAbstain = SIGNAL_IDS.map((id) => sig(id, "abstain", 0, 1, false));
  const r = computeIdentityScore(allAbstain);
  assert(Number.isNaN(r.identity_score));
  assertEquals(r.denominator, 0);
});

// ---------------------------------------------------------------------------
// decideState — routing.
// ---------------------------------------------------------------------------
Deno.test("scoring: high score + coherence pass → auto_admitted under default policy", () => {
  const out = decideState({
    signals: fullSignals(),
    threshold_admission: 0.75,
    threshold_rejection_floor: 0.4,
    policy: "default",
  });
  assertEquals(out.state, "auto_admitted");
  assertEquals(out.routing_reason, "auto_admit_above_threshold");
});

Deno.test("scoring: signal 7 fail forces needs_review even with identity_score = 1.0", () => {
  const out = decideState({
    signals: fullSignals({ longitudinal: sig("longitudinal", "fail", 0, 1, true) }),
    threshold_admission: 0.75,
    threshold_rejection_floor: 0.4,
    policy: "default",
  });
  assertEquals(out.state, "needs_review");
  assertEquals(out.routing_reason, "review_coherence_fail");
});

Deno.test("scoring: calibration policy forces auto_admit-worthy claims into needs_review", () => {
  const out = decideState({
    signals: fullSignals(),
    threshold_admission: 0.75,
    threshold_rejection_floor: 0.4,
    policy: "calibration_all_routes_to_review",
  });
  assertEquals(out.state, "needs_review");
  assertEquals(out.routing_reason, "review_calibration_policy");
});

Deno.test("scoring: identity score below rejection floor → rejected", () => {
  // All six identity signals fail → identity_score = 0.
  const allFail = SIGNAL_IDS.map((id) =>
    id === "longitudinal" ? sig(id, "pass", 1) : sig(id, "fail", 0, 1, true)
  );
  const out = decideState({
    signals: allFail,
    threshold_admission: 0.75,
    threshold_rejection_floor: 0.4,
    policy: "default",
  });
  assertEquals(out.state, "rejected");
  assertEquals(out.routing_reason, "rejected_below_floor");
});

Deno.test("scoring: identity score between floor and threshold → needs_review", () => {
  // Three pass + three fail → 0.5; floor 0.4, admit 0.75.
  const mixed = SIGNAL_IDS.map((id, i) => {
    if (id === "longitudinal") return sig(id, "pass", 1);
    return i < 3 ? sig(id, "pass", 1) : sig(id, "fail", 0, 1, true);
  });
  const out = decideState({
    signals: mixed,
    threshold_admission: 0.75,
    threshold_rejection_floor: 0.4,
    policy: "default",
  });
  assertEquals(out.state, "needs_review");
  assertEquals(out.routing_reason, "review_between_floor_and_threshold");
});

Deno.test("scoring: full abstention → needs_review with review_no_evidence", () => {
  const allAbstain = SIGNAL_IDS.map((id) => sig(id, "abstain", 0, 1, false));
  const out = decideState({
    signals: allAbstain,
    threshold_admission: 0.75,
    threshold_rejection_floor: 0.4,
    policy: "default",
  });
  assertEquals(out.state, "needs_review");
  assertEquals(out.routing_reason, "review_no_evidence");
});

Deno.test("scoring: decideState never emits human_confirmed (engine-only)", () => {
  // Sweep many policy/threshold combos; assert state ∈ {auto_admitted, needs_review, rejected}.
  const cases = [
    fullSignals(),
    fullSignals({ longitudinal: sig("longitudinal", "fail", 0, 1, true) }),
    SIGNAL_IDS.map((id) => sig(id, "abstain", 0, 1, false)),
  ];
  for (const sigs of cases) {
    const out = decideState({
      signals: sigs,
      threshold_admission: 0.75,
      threshold_rejection_floor: 0.4,
      policy: "default",
    });
    assert(["auto_admitted", "needs_review", "rejected"].includes(out.state));
  }
});

// ---------------------------------------------------------------------------
// validateSignalResultsShape — exactly seven, in canonical order.
// ---------------------------------------------------------------------------
Deno.test("scoring: validateSignalResultsShape accepts canonical 7-signal array", () => {
  assertEquals(validateSignalResultsShape(fullSignals()), null);
});

Deno.test("scoring: validateSignalResultsShape rejects wrong length", () => {
  const six = fullSignals().slice(0, 6);
  const err = validateSignalResultsShape(six);
  assert(err && err.includes("length"));
});

Deno.test("scoring: validateSignalResultsShape rejects wrong order", () => {
  const swapped = fullSignals();
  [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
  const err = validateSignalResultsShape(swapped);
  assert(err && err.includes("must be"));
});

// ---------------------------------------------------------------------------
// Sanity: IDENTITY_SIGNAL_IDS + COHERENCE_SIGNAL_ID partition SIGNAL_IDS.
// ---------------------------------------------------------------------------
Deno.test("scoring: identity + coherence signals partition the seven", () => {
  const all = new Set([...IDENTITY_SIGNAL_IDS, COHERENCE_SIGNAL_ID]);
  assertEquals(all.size, 7);
  for (const id of SIGNAL_IDS) assert(all.has(id));
});
