// Frontend-side BioTwin types. Generic to the report schema — no person-specific
// constants and no display logic keyed to any individual.

export const BIOTWIN_SCHEMA_NAME = "Vizzhy BioTwin Clinical Evidence Report";
export const BIOTWIN_REPORT_TYPE = "FINAL_CORRECTED_CLINICAL_EVIDENCE_REPORT";

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

export interface BiotwinMeasurement {
  name: string;
  value: number | null;
  unit: string | null;
  timepoint: string | null;
  percent?: number | null;
  window?: string | null;
}

export interface BiotwinStatement {
  id: string;
  source_id: string;
  section: string;
  statement_kind: string;
  truth_status: BiotwinTruthStatus;
  title: string;
  body: string | null;
  bounds: string[] | null;
  measurements: BiotwinMeasurement[] | null;
  timepoint: string | null;
  clinical_authority: BiotwinClinicalAuthority;
  requires_measurement: Record<string, unknown> | null;
  holds: string[] | null;
  witness_id: string | null;
  ordinal: number;
  /**
   * Adapter-preserved source metadata. For driver statements this carries
   * the source report's own governed ranking ({ rank, state }) from
   * repaired_driver_hierarchy — the ONLY ranking the UI may use. Ordinal is
   * storage order, not importance.
   */
  provenance?: Record<string, unknown> | null;
}

export interface BiotwinReport {
  id: string;
  twin_id: string | null;
  version: number;
  status: string;
  generated_date: string | null;
  schema_version: string | null;
  semantic_repair_version: string | null;
  release_control: Record<string, unknown> | null;
  executive_synthesis: Record<string, unknown> | null;
  attestation: Record<string, unknown> | null;
  holds: string[] | null;
  clinician_review_required: boolean;
  patient_release_permitted: boolean;
  adapter_version: string;
  import_diagnostics: BiotwinDiagnostic[] | null;
  created_at: string;
}

export interface BiotwinDiagnostic {
  level: "info" | "warning" | "error";
  code: string;
  message: string;
  path?: string;
}

export interface BiotwinImportResult {
  imported: boolean;
  idempotent?: boolean;
  report_id?: string;
  version?: number;
  status?: string;
  refusal_code?: string;
  statement_count?: number;
  truth_status_counts?: Record<string, number>;
  witnesses_created?: number;
  witnesses_skipped?: number;
  clinician_review_required?: boolean;
  patient_release_permitted?: boolean;
  holds?: string[];
  diagnostics: BiotwinDiagnostic[];
}

/** Deterministic client-side pre-check so an obviously wrong file never uploads. */
export function looksLikeBiotwinReport(parsed: unknown): boolean {
  if (typeof parsed !== "object" || parsed === null) return false;
  const schema = (parsed as Record<string, unknown>).schema;
  if (typeof schema !== "object" || schema === null) return false;
  const s = schema as Record<string, unknown>;
  return s.name === BIOTWIN_SCHEMA_NAME && s.report_type === BIOTWIN_REPORT_TYPE;
}

export const TRUTH_LABEL: Record<BiotwinTruthStatus, string> = {
  confirmed: "Established",
  candidate: "Possible, not yet established",
  unknown: "Open question",
  retired: "No longer supported",
  prohibited: "Must not be claimed",
};

export function statementsBy(
  statements: BiotwinStatement[],
  predicate: (s: BiotwinStatement) => boolean,
): BiotwinStatement[] {
  return statements.filter(predicate).sort((a, b) => a.ordinal - b.ordinal);
}

export function readString(
  obj: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const v = obj?.[key];
  return typeof v === "string" && v.trim() ? v : null;
}