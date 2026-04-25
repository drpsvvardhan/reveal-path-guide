// ============================================================================
// supabase/functions/_shared/rae/types.ts
// ----------------------------------------------------------------------------
// RAE TypeScript contracts. SHAPES ONLY — no logic, no I/O, no imports
// from any reasoning surface. Mirrors docs/RAE_IMPLEMENTATION_PLAN_v1.md
// §3 (states), §4 (signal shape), §6 (TS sketch) and the schema enum
// public.rae_admission_state.
// ============================================================================

// 1. Admission states — locked at exactly four (CodexOS OQ-6).
export const ADMISSION_STATES = [
  "auto_admitted",
  "needs_review",
  "rejected",
  "human_confirmed",
] as const;

export type AdmissionState = typeof ADMISSION_STATES[number];

export type ActorKind = "engine" | "human";

// 2. Signals — locked at exactly seven, in declared order.
export const SIGNAL_IDS = [
  "lexical",
  "unit",
  "value",
  "method",
  "ref_range",
  "panel",
  "longitudinal",
] as const;

export type SignalId = typeof SIGNAL_IDS[number];

export const IDENTITY_SIGNAL_IDS: readonly SignalId[] = [
  "lexical",
  "unit",
  "value",
  "method",
  "ref_range",
  "panel",
] as const;

export const COHERENCE_SIGNAL_ID: SignalId = "longitudinal";

export type SignalBand = "pass" | "fail" | "partial" | "abstain";

// 3. Per-signal evidence — discriminated union keyed by signal_id.
export interface LexicalEvidence {
  signal_id: "lexical";
  matched_name: string | null;
  match_type: "exact" | "synonym" | "fuzzy" | "none";
  distance?: number;
  ambiguous_alternatives?: string[];
}

export interface UnitEvidence {
  signal_id: "unit";
  received_unit: string | null;
  canonical_unit: string | null;
  conversion_id?: string | null;
  abstention_reason?: string;
}

export interface ValueEvidence {
  signal_id: "value";
  received_value: number | null;
  unit_normalized_value: number | null;
  plausibility_band: { low: number | null; high: number | null } | null;
  position: "inside" | "edge" | "outside" | "unknown";
}

export interface MethodEvidence {
  signal_id: "method";
  received_method: string | null;
  matched_assay: string | null;
  abstention_reason?: string;
}

export interface RefRangeEvidence {
  signal_id: "ref_range";
  received_low: number | null;
  received_high: number | null;
  canonical_range: { low: number | null; high: number | null } | null;
  conflict: boolean;
}

export interface PanelEvidence {
  signal_id: "panel";
  co_observation_ids: string[];
  matched_panel: string | null;
  partial_panel_notes?: string[];
  abstention_reason?: string;
}

export interface LongitudinalEvidence {
  signal_id: "longitudinal";
  prior_witness_ids: string[];
  dynamics_rule_id: string | null;
  delta_observed: number | null;
  delta_ceiling: number | null;
  result: "coherent" | "incoherent" | "insufficient_history";
}

export type SignalEvidence =
  | LexicalEvidence
  | UnitEvidence
  | ValueEvidence
  | MethodEvidence
  | RefRangeEvidence
  | PanelEvidence
  | LongitudinalEvidence;

// 4. SignalResult — uniform envelope for all seven signals.
export interface SignalResult {
  signal_id: SignalId;
  band: SignalBand;
  /** [0,1]; 0 when band is "abstain" or "fail"; partial in (0,1). */
  score: number;
  /** Registry-declared weight, copied in for audit. */
  weight: number;
  /** False when band === "abstain". */
  contributes_to_denominator: boolean;
  evidence: SignalEvidence;
  notes: string[];
}

// 5. Raw observation claim — what RAE adjudicates (source-table-agnostic).
export interface RawObservationClaim {
  source_table: string;
  source_row_id: string;
  user_id: string;
  raw_name: string;
  raw_unit: string | null;
  raw_value: number | null;
  raw_method: string | null;
  raw_reference_low: number | null;
  raw_reference_high: number | null;
  observed_at: string;
  panel_grouping_key: string | null;
}

// 6. Engine-version config — orchestrator reads at admit-time.
export type CalibrationPolicy =
  | "default"
  | "calibration_all_routes_to_review"
  | "back_annotation";

export interface EngineVersionConfig {
  engine_version_id: string;
  semver: string;
  registry_seed_version: string;
  ontology_version: string;
  threshold_admission: number;
  threshold_rejection_floor: number;
  calibration_mode: boolean;
}

// 7. CAW draft (orchestrator output) and persisted shape.
export interface ConceptAssignmentWitnessDraft {
  caw_id: string;
  user_id: string;
  source_table: string;
  source_row_id: string;
  candidate_concept_id: string;
  ontology_version: string;
  registry_seed_version: string;
  engine_version_id: string;

  current_state: AdmissionState;
  current_state_actor_kind: ActorKind;
  current_state_actor_id: string;

  /** Length 7, ordered to match SIGNAL_IDS. */
  signal_results: SignalResult[];
  composite_identity_score: number;
  coherence_result: SignalBand;

  confidence_value: number;
  /** ≥ 20 chars (mirrors P1a confidence_basis_meaningful). */
  confidence_basis: string;
  /** ≥ 1 entry, no blanks (mirrors P1a witness_objects_limitations_nonempty). */
  limitations: string[];

  /** NULL unless current_state ∈ { auto_admitted, human_confirmed }. */
  produced_witness_id: string | null;

  policy_at_decision: CalibrationPolicy;
  founder_review_flag: boolean;
}

export interface ConceptAssignmentWitness extends ConceptAssignmentWitnessDraft {
  id: string;
  current_state_entered_at: string;
  created_at: string;
  updated_at: string;
}

// 8. AdmissionDecision — orchestrator return type.
export interface AdmissionDecision {
  caw: ConceptAssignmentWitnessDraft;
  produced_witness_id: string | null;
}

// 9. StateTransitionRequest — input shape for the state machine.
export interface StateTransitionRequest {
  from_state: AdmissionState | null;
  to_state: AdmissionState;
  actor_kind: ActorKind;
  actor_id: string;
  reason: string;
  policy?: CalibrationPolicy;
}
