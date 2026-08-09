// ============================================================================
// supabase/functions/_shared/biotwin/types.ts
// ----------------------------------------------------------------------------
// SHAPES ONLY for the BioTwin Clinical Evidence Report adapter.
// No imports, no I/O — this file is consumed by both the Deno edge runtime
// and the vitest suite.
// ============================================================================

export const BIOTWIN_SCHEMA_NAME = "Vizzhy BioTwin Clinical Evidence Report";
export const BIOTWIN_REPORT_TYPE = "FINAL_CORRECTED_CLINICAL_EVIDENCE_REPORT";
export const BIOTWIN_ADAPTER_VERSION = "biotwin_adapter_v1";
export const BIOTWIN_REGISTRY_SEED_VERSION = "biotwin_v1";

/** Truth buckets. These are NEVER flattened into one another. */
export type BiotwinTruthStatus =
  | "confirmed"
  | "candidate"
  | "unknown"
  | "retired"
  | "prohibited";

export type BiotwinClinicalAuthority =
  | "patient_facing"
  | "clinician_only"
  | "research_only"
  | "prohibited";

export type BiotwinStatementKind =
  | "measured_evidence"
  | "confirmed_measurement"
  | "candidate_signal"
  | "open_screening"
  | "not_established"
  | "allowed_headline"
  | "prohibited_headline"
  | "driver"
  | "action"
  | "medication"
  | "genomic"
  | "pgx"
  | "omics_layer"
  | "contradiction"
  | "repair"
  | "external_evidence";

export type BiotwinHold =
  | "medication_hold"
  | "pgx_hold"
  | "cgm_hold"
  | "clinician_review_hold"
  | "patient_release_hold"
  | "decision_grade_hold";

export interface BiotwinMeasurement {
  name: string;
  value: number | null;
  unit: string | null;
  timepoint: string | null;
  percent?: number | null;
  window?: string | null;
}

export interface BiotwinStatementDraft {
  /** Stable within a report. Derived from the file's own IDs when present. */
  source_id: string;
  section: string;
  statement_kind: BiotwinStatementKind;
  truth_status: BiotwinTruthStatus;
  title: string;
  body: string | null;
  /** Bounds / limits / unresolved-validity items the report itself declares. */
  bounds: string[];
  measurements: BiotwinMeasurement[];
  timepoint: string | null;
  clinical_authority: BiotwinClinicalAuthority;
  requires_measurement: {
    next_truth_test?: string | null;
    truth_transition?: string | null;
    minimum_fields?: string[];
    specific_items?: string[];
    timeframe?: string | null;
    priority?: number | null;
  } | null;
  holds: BiotwinHold[];
  provenance: Record<string, unknown>;
  ordinal: number;
}

export interface BiotwinReportDraft {
  twin_id: string | null;
  schema_name: string;
  schema_version: string | null;
  report_type: string;
  semantic_repair_version: string | null;
  generated_date: string | null;
  release_control: Record<string, unknown>;
  executive_synthesis: Record<string, unknown>;
  attestation: Record<string, unknown>;
  holds: BiotwinHold[];
  allowed_headlines: string[];
  prohibited_headlines: string[];
  clinician_review_required: boolean;
  patient_release_permitted: boolean;
}

export type BiotwinDiagnosticLevel = "info" | "warning" | "error";

export interface BiotwinDiagnostic {
  level: BiotwinDiagnosticLevel;
  code: string;
  /** Human-readable, shown verbatim in the import UI. */
  message: string;
  path?: string;
}

/**
 * A confirmed numeric measurement that maps onto a PRE-REGISTERED biotwin_v1
 * witness signal. Anything not on the allowlist never becomes a witness.
 */
export interface BiotwinWitnessCandidate {
  statement_source_id: string;
  signal: string;
  source_window: "emr";
  domain_of_access: string;
  epistemic_role: "direct_measure";
  reliability_class: string;
  raw_name: string;
  value: number;
  unit: string;
  biological_timestamp: string;
  testimony: string;
  limitations: string[];
  confidence_value: number;
  confidence_basis: string;
}

export interface BiotwinAdaptResult {
  report: BiotwinReportDraft;
  statements: BiotwinStatementDraft[];
  witness_candidates: BiotwinWitnessCandidate[];
  diagnostics: BiotwinDiagnostic[];
  counts: Record<string, number>;
}