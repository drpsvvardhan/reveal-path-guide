// ============================================================================
// rae/signals/unit.ts — Signal 2: unit canonicalization.
// Pure. Imports only from ../types.ts.
// ============================================================================
import type { SignalResult, UnitEvidence } from "../types.ts";

export interface UnitConversion {
  /** Multiplicative factor: canonical_value = received_value * factor. */
  factor: number;
  /** Stable identifier for the conversion rule. */
  conversion_id: string;
}

export interface UnitInput {
  raw_unit: string | null;
  canonical_unit: string;
  /** Map of normalized received unit string -> conversion rule. */
  conversions?: Record<string, UnitConversion>;
  weight: number;
}

function norm(u: string | null | undefined): string | null {
  if (u === null || u === undefined) return null;
  const s = u.trim();
  return s.length ? s : null;
}

export function evaluateUnit(input: UnitInput): SignalResult {
  const received = norm(input.raw_unit);
  const canonical = input.canonical_unit;

  if (received === null) {
    const evidence: UnitEvidence = {
      signal_id: "unit",
      received_unit: null,
      canonical_unit: canonical,
      conversion_id: null,
      abstention_reason: "raw_unit missing",
    };
    return {
      signal_id: "unit",
      band: "abstain",
      score: 0,
      weight: input.weight,
      contributes_to_denominator: false,
      evidence,
      notes: ["unit absent; abstaining"],
    };
  }

  const recvKey = received.toLowerCase();
  const canonKey = canonical.toLowerCase();

  if (recvKey === canonKey) {
    const evidence: UnitEvidence = {
      signal_id: "unit",
      received_unit: received,
      canonical_unit: canonical,
      conversion_id: null,
    };
    return {
      signal_id: "unit",
      band: "pass",
      score: 1,
      weight: input.weight,
      contributes_to_denominator: true,
      evidence,
      notes: [],
    };
  }

  const conv = input.conversions?.[recvKey] ?? input.conversions?.[received];
  if (conv) {
    const evidence: UnitEvidence = {
      signal_id: "unit",
      received_unit: received,
      canonical_unit: canonical,
      conversion_id: conv.conversion_id,
    };
    return {
      signal_id: "unit",
      band: "partial",
      score: 0.7,
      weight: input.weight,
      contributes_to_denominator: true,
      evidence,
      notes: [`converted via ${conv.conversion_id}`],
    };
  }

  const evidence: UnitEvidence = {
    signal_id: "unit",
    received_unit: received,
    canonical_unit: canonical,
    conversion_id: null,
  };
  return {
    signal_id: "unit",
    band: "fail",
    score: 0,
    weight: input.weight,
    contributes_to_denominator: true,
    evidence,
    notes: [`no conversion from ${received} to ${canonical}`],
  };
}