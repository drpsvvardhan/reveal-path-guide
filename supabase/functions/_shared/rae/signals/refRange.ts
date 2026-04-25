// ============================================================================
// rae/signals/refRange.ts — Signal 5: reference range coherence.
// Pure. Imports only from ../types.ts.
// ============================================================================
import type { RefRangeEvidence, SignalResult } from "../types.ts";

export interface RefRangeInput {
  received_low: number | null;
  received_high: number | null;
  canonical_range: { low: number | null; high: number | null } | null;
  /** Fractional tolerance for "partial" agreement. Default 0.15. */
  tolerance?: number;
  weight: number;
}

export function evaluateRefRange(input: RefRangeInput): SignalResult {
  const r = input.canonical_range;
  const rl = input.received_low;
  const rh = input.received_high;
  const tol = input.tolerance ?? 0.15;

  // Abstain when neither side present.
  if ((rl === null && rh === null) || !r || (r.low === null && r.high === null)) {
    const evidence: RefRangeEvidence = {
      signal_id: "ref_range",
      received_low: rl,
      received_high: rh,
      canonical_range: r,
      conflict: false,
    };
    return {
      signal_id: "ref_range",
      band: "abstain",
      score: 0,
      weight: input.weight,
      contributes_to_denominator: false,
      evidence,
      notes: ["insufficient ref-range data; abstaining"],
    };
  }

  const within = (a: number | null, b: number | null) => {
    if (a === null || b === null) return null;
    const denom = Math.max(1e-9, Math.abs(b));
    return Math.abs(a - b) / denom;
  };

  const lowDelta = within(rl, r.low);
  const highDelta = within(rh, r.high);

  const deltas = [lowDelta, highDelta].filter((d): d is number => d !== null);
  if (deltas.length === 0) {
    const evidence: RefRangeEvidence = {
      signal_id: "ref_range",
      received_low: rl,
      received_high: rh,
      canonical_range: r,
      conflict: false,
    };
    return {
      signal_id: "ref_range",
      band: "abstain",
      score: 0,
      weight: input.weight,
      contributes_to_denominator: false,
      evidence,
      notes: ["non-overlapping ref-range bounds; abstaining"],
    };
  }

  const worst = Math.max(...deltas);
  let band: SignalResult["band"];
  let score: number;
  let conflict = false;
  const notes: string[] = [];

  if (worst <= 1e-6) {
    band = "pass";
    score = 1;
  } else if (worst <= tol) {
    band = "partial";
    score = Math.max(0, 1 - worst / (tol * 2));
    notes.push(`ref-range deviation ${(worst * 100).toFixed(1)}%`);
  } else {
    band = "fail";
    score = 0;
    conflict = true;
    notes.push(`ref-range conflict ${(worst * 100).toFixed(1)}%`);
  }

  const evidence: RefRangeEvidence = {
    signal_id: "ref_range",
    received_low: rl,
    received_high: rh,
    canonical_range: r,
    conflict,
  };

  return {
    signal_id: "ref_range",
    band,
    score,
    weight: input.weight,
    contributes_to_denominator: true,
    evidence,
    notes,
  };
}