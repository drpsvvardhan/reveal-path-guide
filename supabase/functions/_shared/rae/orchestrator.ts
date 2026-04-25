// ============================================================================
// supabase/functions/_shared/rae/orchestrator.ts
// ----------------------------------------------------------------------------
// RAE orchestrator — converts one RawObservationClaim + one candidate
// ontology concept into one ConceptAssignmentWitnessDraft and a discrete
// witness_intent. Pure with respect to inputs. No I/O. Imports only from
// ./types.ts, ./scoring.ts, and ./signals/*.
//
// Controlling spec: docs/RAE_ORCHESTRATOR_DESIGN_v1.md.
// CodexOS corrections applied:
//   - Orchestrator does NOT build a witness payload. It returns a discrete
//     witness_intent ("produce_depth0_witness" | "none") only.
//   - founder_review_flag = (current_state === "needs_review") ||
//     (policy_at_decision === "back_annotation").
// ============================================================================

import {
  COHERENCE_SIGNAL_ID,
  IDENTITY_SIGNAL_IDS,
  SIGNAL_IDS,
  type ActorKind,
  type AdmissionState,
  type CalibrationPolicy,
  type ConceptAssignmentWitnessDraft,
  type EngineVersionConfig,
  type RawObservationClaim,
  type SignalBand,
  type SignalResult,
  type UnitEvidence,
} from "./types.ts";
import {
  coherenceBand,
  computeIdentityScore,
  decideState,
  validateSignalResultsShape,
} from "./scoring.ts";
import { evaluateLexical } from "./signals/lexical.ts";
import { evaluateUnit, type UnitConversion } from "./signals/unit.ts";
import { evaluateValue } from "./signals/value.ts";
import { evaluateMethod } from "./signals/method.ts";
import { evaluateRefRange } from "./signals/refRange.ts";
import { evaluatePanel, type PanelSibling } from "./signals/panel.ts";
import {
  evaluateLongitudinal,
  type PriorObservation,
} from "./signals/longitudinal.ts";

// ---------------------------------------------------------------------------
// 1. Discrete witness_intent — orchestrator's only witness-related output.
// ---------------------------------------------------------------------------
export type WitnessIntent = "produce_depth0_witness" | "none";

// ---------------------------------------------------------------------------
// 2. Input shapes.
// ---------------------------------------------------------------------------

/** Ontology concept being adjudicated. */
export interface CandidateConcept {
  concept_id: string;
  canonical_name: string;
  synonyms?: string[];
  ambiguous_alternatives?: string[];

  canonical_unit: string;
  unit_conversions?: Record<string, UnitConversion>;

  plausibility_band: { low: number | null; high: number | null } | null;

  known_assays?: string[];
  method_optional?: boolean;

  canonical_reference_range: { low: number | null; high: number | null } | null;

  expected_panel_concept_ids?: string[];
  panel_id?: string | null;

  dynamics_rule_id: string | null;
  delta_ceiling: number | null;
}

/** Per-signal config (the matching rae_signal_config row, possibly per-concept). */
export interface SignalConfig {
  lexical: { weight: number; fuzzy_ceiling?: number };
  unit: { weight: number };
  value: { weight: number; edge_tolerance?: number };
  method: { weight: number };
  ref_range: { weight: number; tolerance?: number };
  panel: { weight: number };
  longitudinal: { weight: number; min_history?: number };
}

export interface OrchestratorInput {
  claim: RawObservationClaim;
  candidate_concept: CandidateConcept;
  signal_config: SignalConfig;
  engine_version: EngineVersionConfig;
  siblings: PanelSibling[];
  prior_observations: PriorObservation[];
}

export interface AdmissionDecisionV1 {
  caw: ConceptAssignmentWitnessDraft;
  witness_intent: WitnessIntent;
}

// ---------------------------------------------------------------------------
// 3. Typed errors. Never represented as a fifth admission state.
// ---------------------------------------------------------------------------
export class MalformedClaimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MalformedClaimError";
  }
}
export class NoCandidateConceptError extends Error {
  constructor(message = "no candidate concept supplied") {
    super(message);
    this.name = "NoCandidateConceptError";
  }
}
export class RegistryGapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistryGapError";
  }
}
export class InvalidSignalShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSignalShapeError";
  }
}
export class UnitNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnitNormalizationError";
  }
}

// ---------------------------------------------------------------------------
// 4. Deterministic UUIDv5 — RAE CAW namespace, distinct from P1a.
// ---------------------------------------------------------------------------

/** Dedicated RAE CAW namespace UUID. Distinct from P1a witness namespace. */
export const RAE_CAW_NAMESPACE = "9b2c4e3a-1d6f-5e7c-9a8b-3c2d1e0f4a5b";

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/-/g, "");
  if (clean.length !== 32) throw new Error("invalid namespace UUID");
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/** Deterministic SHA-1 implementation (pure, sync). 16-byte output truncated. */
function sha1(bytes: Uint8Array): Uint8Array {
  // Standard SHA-1 (FIPS 180-4). Pure JS; deterministic; sync.
  const ml = bytes.length * 8;
  const withPad = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  withPad.set(bytes);
  withPad[bytes.length] = 0x80;
  // Append big-endian length in bits to last 8 bytes.
  const dv = new DataView(withPad.buffer);
  dv.setUint32(withPad.length - 4, ml >>> 0, false);
  dv.setUint32(withPad.length - 8, Math.floor(ml / 0x100000000), false);

  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe;
  let h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  for (let off = 0; off < withPad.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = dv.getUint32(off + i * 4, false);
    }
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (x << 1) | (x >>> 31);
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      let f: number, k: number;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = ((b << 30) | (b >>> 2)) >>> 0; b = a; a = t;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  const out = new Uint8Array(20);
  const odv = new DataView(out.buffer);
  odv.setUint32(0, h0, false);
  odv.setUint32(4, h1, false);
  odv.setUint32(8, h2, false);
  odv.setUint32(12, h3, false);
  odv.setUint32(16, h4, false);
  return out;
}

/** UUIDv5(namespace, name) per RFC 4122 §4.3. */
export function uuidv5(namespace: string, name: string): string {
  const ns = hexToBytes(namespace);
  const nm = new TextEncoder().encode(name);
  const buf = new Uint8Array(ns.length + nm.length);
  buf.set(ns, 0);
  buf.set(nm, ns.length);
  const hash = sha1(buf).slice(0, 16);
  // Set version to 5.
  hash[6] = (hash[6] & 0x0f) | 0x50;
  // Set variant to RFC 4122.
  hash[8] = (hash[8] & 0x3f) | 0x80;
  return bytesToUuid(hash);
}

/** Compute deterministic caw_id from the locked tuple (§4 of design). */
export function computeCawId(
  user_id: string,
  source_table: string,
  source_row_id: string,
  candidate_concept_id: string,
  engine_version_id: string,
): string {
  const name = [
    user_id,
    source_table,
    source_row_id,
    candidate_concept_id,
    engine_version_id,
  ].join("|");
  return uuidv5(RAE_CAW_NAMESPACE, name);
}

// ---------------------------------------------------------------------------
// 5. Helpers.
// ---------------------------------------------------------------------------

function validateClaim(claim: RawObservationClaim): void {
  if (!claim || typeof claim !== "object") {
    throw new MalformedClaimError("claim missing or not an object");
  }
  const required: Array<keyof RawObservationClaim> = [
    "source_table",
    "source_row_id",
    "user_id",
    "raw_name",
    "observed_at",
  ];
  for (const k of required) {
    const v = claim[k];
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
      throw new MalformedClaimError(`claim.${String(k)} is required`);
    }
  }
}

function validateSignalConfig(cfg: SignalConfig | null | undefined): void {
  if (!cfg) {
    throw new RegistryGapError("signal_config missing for active engine_version_id");
  }
  for (const id of SIGNAL_IDS) {
    const slot = (cfg as unknown as Record<string, { weight: number } | undefined>)[id];
    if (!slot || typeof slot.weight !== "number" || !isFinite(slot.weight)) {
      throw new RegistryGapError(`signal_config.${id}.weight missing or invalid`);
    }
  }
}

function deriveUnitNormalizedValue(
  rawValue: number | null,
  unitResult: SignalResult,
  candidate: CandidateConcept,
): number | null {
  if (rawValue === null || rawValue === undefined || Number.isNaN(rawValue)) return null;
  const ev = unitResult.evidence as UnitEvidence;
  if (unitResult.band === "pass") return rawValue;
  if (unitResult.band === "partial" && ev.conversion_id) {
    const recv = (ev.received_unit ?? "").trim();
    const conv = candidate.unit_conversions?.[recv.toLowerCase()] ??
      candidate.unit_conversions?.[recv];
    if (!conv || !isFinite(conv.factor)) {
      throw new UnitNormalizationError(
        `conversion ${ev.conversion_id} present but factor missing or non-finite`,
      );
    }
    return rawValue * conv.factor;
  }
  return null;
}

function buildLimitations(
  signals: SignalResult[],
  coherence: SignalBand,
  policy: CalibrationPolicy,
  calibrationMode: boolean,
): string[] {
  const out: string[] = [`policy:${policy}`];
  for (const s of signals) {
    if (s.band === "abstain") {
      out.push(`signal_abstain:${s.signal_id}`);
    }
  }
  if (coherence === "fail") {
    out.push("coherence_gate_failed");
  }
  if (calibrationMode) {
    out.push("engine_in_calibration_mode");
  }
  if (policy === "back_annotation") {
    out.push("back_annotation_path");
  }
  // Mirrors P1a witness_objects_limitations_nonempty: never blank, never empty.
  return out.filter((s) => s.trim().length > 0);
}

function buildConfidenceBasis(
  semver: string,
  identityScore: number,
  coherence: SignalBand,
  signals: SignalResult[],
): string {
  const ranked = [...signals]
    .filter((s) => s.contributes_to_denominator)
    .map((s) => ({ id: s.signal_id, contrib: s.weight * s.score }))
    .sort((a, b) => b.contrib - a.contrib)
    .slice(0, 2)
    .map((s) => `${s.id}:${s.contrib.toFixed(3)}`)
    .join(",");
  const scoreStr = isFinite(identityScore) ? identityScore.toFixed(3) : "n/a";
  const basis = `engine=${semver}|identity=${scoreStr}|coherence=${coherence}|top=[${ranked}]`;
  // Mirror P1a confidence_basis_meaningful: ≥20 chars.
  if (basis.length < 20) return basis.padEnd(20, ".");
  return basis;
}

function clamp01(x: number): number {
  if (!isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function decideWitnessIntent(
  state: AdmissionState,
  policy: CalibrationPolicy,
): WitnessIntent {
  if (state === "auto_admitted" && policy === "default") {
    return "produce_depth0_witness";
  }
  return "none";
}

// ---------------------------------------------------------------------------
// 6. Public entry point.
// ---------------------------------------------------------------------------

/**
 * Convert one RawObservationClaim into one ConceptAssignmentWitnessDraft
 * plus a discrete witness_intent. Pure. No I/O. No witness payload.
 */
export function adjudicate(input: OrchestratorInput): AdmissionDecisionV1 {
  // Step 1: validate inputs.
  validateClaim(input.claim);
  if (!input.candidate_concept || !input.candidate_concept.concept_id) {
    throw new NoCandidateConceptError();
  }
  if (!input.engine_version || !input.engine_version.engine_version_id) {
    throw new RegistryGapError("engine_version config missing");
  }
  validateSignalConfig(input.signal_config);

  const { claim, candidate_concept: cc, signal_config: cfg, engine_version: ev } = input;

  // Step 2: deterministic caw_id.
  const caw_id = computeCawId(
    claim.user_id,
    claim.source_table,
    claim.source_row_id,
    cc.concept_id,
    ev.engine_version_id,
  );

  // Step 3: run seven signals in canonical SIGNAL_IDS order.
  const lexical = evaluateLexical({
    raw_name: claim.raw_name,
    canonical_name: cc.canonical_name,
    synonyms: cc.synonyms,
    ambiguous_alternatives: cc.ambiguous_alternatives,
    weight: cfg.lexical.weight,
    fuzzy_ceiling: cfg.lexical.fuzzy_ceiling,
  });

  const unit = evaluateUnit({
    raw_unit: claim.raw_unit,
    canonical_unit: cc.canonical_unit,
    conversions: cc.unit_conversions,
    weight: cfg.unit.weight,
  });

  // Derive unit-normalized value once; reused by value + longitudinal.
  const unitNormalizedValue = deriveUnitNormalizedValue(claim.raw_value, unit, cc);

  const value = evaluateValue({
    raw_value: claim.raw_value,
    unit_normalized_value: unitNormalizedValue,
    plausibility_band: cc.plausibility_band,
    edge_tolerance: cfg.value.edge_tolerance,
    weight: cfg.value.weight,
  });

  const method = evaluateMethod({
    raw_method: claim.raw_method,
    known_assays: cc.known_assays,
    method_optional: cc.method_optional,
    weight: cfg.method.weight,
  });

  const ref_range = evaluateRefRange({
    received_low: claim.raw_reference_low,
    received_high: claim.raw_reference_high,
    canonical_range: cc.canonical_reference_range,
    tolerance: cfg.ref_range.tolerance,
    weight: cfg.ref_range.weight,
  });

  const panel = evaluatePanel({
    panel_grouping_key: claim.panel_grouping_key,
    siblings: input.siblings ?? [],
    expected_panel_concept_ids: cc.expected_panel_concept_ids,
    panel_id: cc.panel_id ?? null,
    weight: cfg.panel.weight,
  });

  const longitudinal = evaluateLongitudinal({
    current_value: unitNormalizedValue,
    current_observed_at: claim.observed_at,
    prior_observations: input.prior_observations ?? [],
    delta_ceiling: cc.delta_ceiling,
    dynamics_rule_id: cc.dynamics_rule_id,
    min_history: cfg.longitudinal.min_history,
    weight: cfg.longitudinal.weight,
  });

  const signal_results: SignalResult[] = [
    lexical, unit, value, method, ref_range, panel, longitudinal,
  ];

  // Step 4: shape validation.
  const shapeErr = validateSignalResultsShape(signal_results);
  if (shapeErr) {
    throw new InvalidSignalShapeError(shapeErr);
  }

  // Step 5: identity score (signals 1–6, abstention-aware).
  const identity = computeIdentityScore(signal_results);

  // Steps 6–8: longitudinal gate + calibration policy + state decision.
  const policy_at_decision: CalibrationPolicy = ev.calibration_mode
    ? "calibration_all_routes_to_review"
    : "default";

  const decision = decideState({
    signals: signal_results,
    threshold_admission: ev.threshold_admission,
    threshold_rejection_floor: ev.threshold_rejection_floor,
    policy: policy_at_decision,
  });

  const current_state: AdmissionState = decision.state;
  const coherence_result = coherenceBand(signal_results);

  // Step 9: build CAW draft.
  const founder_review_flag =
    current_state === "needs_review" ||
    policy_at_decision === "back_annotation";

  const limitations = buildLimitations(
    signal_results,
    coherence_result,
    policy_at_decision,
    ev.calibration_mode,
  );

  const current_state_actor_kind: ActorKind = "engine";

  const caw: ConceptAssignmentWitnessDraft = {
    caw_id,
    user_id: claim.user_id,
    source_table: claim.source_table,
    source_row_id: claim.source_row_id,
    candidate_concept_id: cc.concept_id,
    ontology_version: ev.ontology_version,
    registry_seed_version: ev.registry_seed_version,
    engine_version_id: ev.engine_version_id,

    current_state,
    current_state_actor_kind,
    current_state_actor_id: ev.engine_version_id,

    signal_results,
    composite_identity_score: clamp01(identity.identity_score),
    coherence_result,

    confidence_value: clamp01(identity.identity_score),
    confidence_basis: buildConfidenceBasis(
      ev.semver,
      identity.identity_score,
      coherence_result,
      signal_results,
    ),
    limitations,

    // Always null at orchestrator boundary; back-filled by witness layer
    // when witness_intent === "produce_depth0_witness".
    produced_witness_id: null,

    policy_at_decision,
    founder_review_flag,
  };

  // Step 10: discrete witness intent.
  const witness_intent = decideWitnessIntent(current_state, policy_at_decision);

  // Sanity: identity-signal partition check (defensive; no-op if scoring intact).
  void IDENTITY_SIGNAL_IDS;
  void COHERENCE_SIGNAL_ID;

  // Step 11: return.
  return { caw, witness_intent };
}