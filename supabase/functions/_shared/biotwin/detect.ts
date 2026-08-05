// ============================================================================
// supabase/functions/_shared/biotwin/detect.ts
// ----------------------------------------------------------------------------
// Deterministic detection + structural validation. NO LLM. A file that does
// not declare itself as a BioTwin final corrected clinical evidence report is
// refused outright — it is never routed to generic extraction.
// ============================================================================

import {
  BIOTWIN_REPORT_TYPE,
  BIOTWIN_SCHEMA_NAME,
  type BiotwinDiagnostic,
} from "./types.ts";

export type BiotwinDetectRefusalCode =
  | "not_json_object"
  | "missing_schema_block"
  | "schema_name_mismatch"
  | "report_type_mismatch";

export interface BiotwinDetectResult {
  accepted: boolean;
  refusal_code?: BiotwinDetectRefusalCode;
  message: string;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function detectBiotwinReport(input: unknown): BiotwinDetectResult {
  if (!isObject(input)) {
    return {
      accepted: false,
      refusal_code: "not_json_object",
      message: "The uploaded file is not a JSON object, so it cannot be a BioTwin clinical evidence report.",
    };
  }
  const schema = input.schema;
  if (!isObject(schema)) {
    return {
      accepted: false,
      refusal_code: "missing_schema_block",
      message: "The file has no top-level \"schema\" block, so it cannot be identified as a BioTwin report.",
    };
  }
  if (schema.name !== BIOTWIN_SCHEMA_NAME) {
    return {
      accepted: false,
      refusal_code: "schema_name_mismatch",
      message:
        `This importer only accepts schema.name "${BIOTWIN_SCHEMA_NAME}". ` +
        `The file declares "${String(schema.name ?? "(none)")}".`,
    };
  }
  if (schema.report_type !== BIOTWIN_REPORT_TYPE) {
    return {
      accepted: false,
      refusal_code: "report_type_mismatch",
      message:
        `This importer only accepts schema.report_type "${BIOTWIN_REPORT_TYPE}". ` +
        `The file declares "${String(schema.report_type ?? "(none)")}".`,
    };
  }
  return {
    accepted: true,
    message: "Recognised as a BioTwin final corrected clinical evidence report.",
  };
}

/**
 * Structural validation of the governance-critical sections. Missing
 * governance blocks are ERRORS (the report cannot be governed without them).
 * Missing optional content sections are warnings.
 */
export function validateBiotwinStructure(input: Record<string, unknown>): BiotwinDiagnostic[] {
  const out: BiotwinDiagnostic[] = [];

  const requireObject = (path: string, value: unknown, label: string) => {
    if (!isObject(value)) {
      out.push({
        level: "error",
        code: "missing_required_section",
        path,
        message: `${label} is missing or is not an object. The report cannot be imported without it.`,
      });
    }
  };

  requireObject("release_control", input.release_control, "release_control");
  requireObject("clinical_state", input.clinical_state, "clinical_state");
  requireObject(
    "clinical_report_projection",
    input.clinical_report_projection,
    "clinical_report_projection"
  );

  const rc = isObject(input.release_control) ? input.release_control : null;
  if (rc) {
    for (const key of [
      "overall_status",
      "patient_facing_release",
      "medication_or_treatment_decision",
    ]) {
      if (typeof rc[key] !== "string") {
        out.push({
          level: "error",
          code: "missing_release_control_field",
          path: `release_control.${key}`,
          message: `release_control.${key} is missing. Release gating cannot be enforced without it.`,
        });
      }
    }
  }

  const proj = isObject(input.clinical_report_projection)
    ? input.clinical_report_projection
    : null;
  if (proj && !Array.isArray(proj.prohibited_headline_statements)) {
    out.push({
      level: "error",
      code: "missing_prohibited_headlines",
      path: "clinical_report_projection.prohibited_headline_statements",
      message:
        "The report declares no prohibited_headline_statements list. Output validation cannot be enforced, so the import is refused.",
    });
  }

  for (const optional of [
    "executive_synthesis",
    "repaired_driver_hierarchy",
    "measurement_and_action_plan",
    "medication_status",
    "genomics_and_pgx",
    "omics_readiness",
    "contradiction_reclassification",
    "semantic_repair_ledger",
    "external_evidence",
    "final_attestation",
    "provenance",
  ]) {
    if (input[optional] == null) {
      out.push({
        level: "warning",
        code: "optional_section_absent",
        path: optional,
        message: `Section "${optional}" is absent. Its panel will render empty.`,
      });
    }
  }

  return out;
}

export function hasBlockingDiagnostic(diags: BiotwinDiagnostic[]): boolean {
  return diags.some((d) => d.level === "error");
}