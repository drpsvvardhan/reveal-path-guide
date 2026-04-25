// ============================================================================
// rae/signals/value.ts — Signal 3: value plausibility.
// Pure. Imports only from ../types.ts.
// ============================================================================
import type { SignalResult, ValueEvidence } from "../types.ts";

export interface ValueInput {
  raw_value: number | null;
  /** Value after unit normalization (may equal raw_value when unit canonical). */
  unit_normalized_value: number | null;
  /** Plausibility band in canonical units. */
  plausibility_band: { low: number | null; high: number | null } | null;
  /** Optional fractional tolerance for "edge" classification. Default 0.1 (10%). */
  edge_tolerance?: number;
  weight: number;
}

export function evaluateValue(input: ValueInput): SignalResult {
  const v = input.unit_normalized_value;
  const band = input.plausibility_band;

  if (v === null || v === undefined || Number.isNaN(v)) {
    const evidence: ValueEvidence = {
      signal_id: "value",
      received_value: input.raw_value,
      unit_normalized_value: null,
      plausibility_band: band,
      position: "unknown",
    };
    return {
      signal_id: "value",
      band: "abstain",
      score: 0,
      weight: input.weight,
      contributes_to_denominator: false,
      evidence,
      notes: ["normalized value missing; abstaining"],
    };
  }

  if (!band || (band.low === null && band.high === null)) {
    const evidence: ValueEvidence = {
      signal_id: "value",
      received_value: input.raw_value,
      unit_normalized_value: v,
      plausibility_band: band,
      position: "unknown",
    };
    return {
      signal_id: "value",
      band: "abstain",
      score: 0,
      weight: input.weight,
      contributes_to_denominator: false,
      evidence,
      notes: ["no plausibility band; abstaining"],
    };
  }

  const tol = input.edge_tolerance ?? 0.1;
  const lo = band.low;
  const hi = band.high;

  let position: ValueEvidence["position"] = "inside";
  let bandResult: SignalResult["band"] = "pass";
  let score = 1;
  const notes: string[] = [];

  const span = (lo !== null && hi !== null) ? Math.max(1e-9, hi - lo) : null;
  const tolAbs = span !== null ? span * tol : null;

  const belowLow = lo !== null && v < lo;
  const aboveHigh = hi !== null && v > hi;

  if (!belowLow && !aboveHigh) {
    position = "inside";
    bandResult = "pass";
    score = 1;
  } else {
    const overshootLow = belowLow && lo !== null ? lo - v : 0;
    const overshootHigh = aboveHigh && hi !== null ? v - hi : 0;
    const overshoot = Math.max(overshootLow, overshootHigh);
    if (tolAbs !== null && overshoot <= tolAbs) {
      position = "edge";
      bandResult = "partial";
      score = 0.5;
      notes.push("value within edge tolerance of plausibility band");
    } else {
      position = "outside";
      bandResult = "fail";
      score = 0;
      notes.push("value outside plausibility band");
    }
  }

  const evidence: ValueEvidence = {
    signal_id: "value",
    received_value: input.raw_value,
    unit_normalized_value: v,
    plausibility_band: band,
    position,
  };

  return {
    signal_id: "value",
    band: bandResult,
    score,
    weight: input.weight,
    contributes_to_denominator: true,
    evidence,
    notes,
  };
}