// ============================================================================
// rae/signals/method.ts — Signal 4: assay/method match.
// Pure. Imports only from ../types.ts.
// ============================================================================
import type { MethodEvidence, SignalResult } from "../types.ts";

export interface MethodInput {
  raw_method: string | null;
  /** Known assay identifiers for the candidate concept. */
  known_assays?: string[];
  /** When true, the concept does not require a method (e.g., basic chemistry). */
  method_optional?: boolean;
  weight: number;
}

function norm(s: string | null | undefined): string | null {
  if (s === null || s === undefined) return null;
  const t = s.trim().toLowerCase();
  return t.length ? t : null;
}

export function evaluateMethod(input: MethodInput): SignalResult {
  const received = norm(input.raw_method);
  const known = (input.known_assays ?? []).map((a) => a.toLowerCase());

  if (received === null) {
    const evidence: MethodEvidence = {
      signal_id: "method",
      received_method: null,
      matched_assay: null,
      abstention_reason: input.method_optional
        ? "method optional for this concept"
        : "raw_method missing",
    };
    return {
      signal_id: "method",
      band: "abstain",
      score: 0,
      weight: input.weight,
      contributes_to_denominator: false,
      evidence,
      notes: ["method absent; abstaining"],
    };
  }

  if (known.length === 0) {
    const evidence: MethodEvidence = {
      signal_id: "method",
      received_method: input.raw_method,
      matched_assay: null,
      abstention_reason: "no known_assays declared for concept",
    };
    return {
      signal_id: "method",
      band: "abstain",
      score: 0,
      weight: input.weight,
      contributes_to_denominator: false,
      evidence,
      notes: ["concept has no declared assays; abstaining"],
    };
  }

  const exact = known.indexOf(received);
  if (exact >= 0) {
    const evidence: MethodEvidence = {
      signal_id: "method",
      received_method: input.raw_method,
      matched_assay: input.known_assays![exact],
    };
    return {
      signal_id: "method",
      band: "pass",
      score: 1,
      weight: input.weight,
      contributes_to_denominator: true,
      evidence,
      notes: [],
    };
  }

  const partialIdx = known.findIndex(
    (k) => k.includes(received) || received.includes(k),
  );
  if (partialIdx >= 0) {
    const evidence: MethodEvidence = {
      signal_id: "method",
      received_method: input.raw_method,
      matched_assay: input.known_assays![partialIdx],
    };
    return {
      signal_id: "method",
      band: "partial",
      score: 0.6,
      weight: input.weight,
      contributes_to_denominator: true,
      evidence,
      notes: ["substring match against known assay"],
    };
  }

  const evidence: MethodEvidence = {
    signal_id: "method",
    received_method: input.raw_method,
    matched_assay: null,
  };
  return {
    signal_id: "method",
    band: "fail",
    score: 0,
    weight: input.weight,
    contributes_to_denominator: true,
    evidence,
    notes: [`method ${input.raw_method} not in known assays`],
  };
}