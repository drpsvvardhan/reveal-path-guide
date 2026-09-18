// ============================================================================
// Patient self-service BioTwin submission
// ----------------------------------------------------------------------------
// A file a patient uploads is PATIENT-SUPPLIED EVIDENCE. It is kept verbatim,
// with provenance, readable by them straight away. What it cannot do is
// certify itself: containing an attestation block, a "confirmed" clinical
// authority, a release permission or a treatment approval gives it none of
// those things here.
//
// So this path:
//   • never writes biotwin_reports / biotwin_statements
//   • never projects witness objects
//   • never supersedes or edits an existing trusted active report
//   • records whether the file asserted authority, so the difference is visible
//
// The trusted path (admin/compiler) lives in persist.ts and is reached only
// with a server-resolved actor. There is no caller-supplied "trusted" flag.
// ============================================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { detectBiotwinReport, validateBiotwinStructure } from "./detect.ts";
import { sha256Hex } from "./persist.ts";
import type { BiotwinDiagnostic } from "./types.ts";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Did the file try to speak with a clinician's voice? */
export function assertsAuthority(report: Record<string, unknown>): boolean {
  const attestation = report.attestation;
  const release = report.release_control;
  const attested = isObject(attestation) && Object.keys(attestation).length > 0;
  const released = isObject(release) &&
    /permit|release|approved|cleared/i.test(
      String(release.patient_facing_release ?? "") +
        String(release.medication_or_treatment_decision ?? "") +
        String(release.overall_status ?? ""),
    );
  return attested || released;
}

export function summariseSubmission(report: Record<string, unknown>) {
  const projection = isObject(report.clinical_report_projection)
    ? report.clinical_report_projection
    : {};
  const measurements = Array.isArray((projection as Record<string, unknown>).measurements)
    ? ((projection as Record<string, unknown>).measurements as unknown[]).length
    : 0;
  const sections = Object.keys(report).length;
  return {
    schema_name: typeof (report.schema as Record<string, unknown> | undefined)?.name === "string"
      ? String((report.schema as Record<string, unknown>).name)
      : null,
    report_type: typeof (report.schema as Record<string, unknown> | undefined)?.report_type === "string"
      ? String((report.schema as Record<string, unknown>).report_type)
      : null,
    top_level_sections: sections,
    measurement_entries: measurements,
    generated_date: typeof report.generated_date === "string" ? report.generated_date : null,
  };
}

export interface SelfServiceResult {
  status: number;
  body: Record<string, unknown>;
}

export async function saveSelfServiceSubmission(args: {
  serviceClient: SupabaseClient;
  userId: string;
  submittedBy: string;
  raw: unknown;
  filename?: string | null;
  actorKind?: "patient_self_service" | "admin_on_behalf";
}): Promise<SelfServiceResult> {
  const { serviceClient, userId, submittedBy, raw } = args;
  const actorKind = args.actorKind ?? "patient_self_service";

  const detected = detectBiotwinReport(raw);
  if (!detected.accepted) {
    return {
      status: 422,
      body: {
        imported: false,
        accepted: false,
        refusal_code: detected.refusal_code ?? "rejected",
        diagnostics: [
          { level: "error", code: detected.refusal_code ?? "rejected", message: detected.message },
        ],
      },
    };
  }
  const report = raw as Record<string, unknown>;

  // Structural problems are reported honestly, but they never delete the file:
  // a patient's upload is kept either way so they are not asked twice.
  const structural: BiotwinDiagnostic[] = validateBiotwinStructure(report);
  const contentSha = await sha256Hex(JSON.stringify(report));
  const authority = assertsAuthority(report);
  const summary = summariseSubmission(report);

  const { data: existing } = await serviceClient
    .from("biotwin_patient_submissions")
    .select("id, version, review_state, created_at")
    .eq("user_id", userId)
    .eq("content_sha256", contentSha)
    .maybeSingle();

  const { data: trustedReport } = await serviceClient
    .from("biotwin_reports")
    .select("id, version, created_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  const notices: BiotwinDiagnostic[] = [
    ...structural,
    {
      level: "info",
      code: "kept_as_your_own_evidence",
      message:
        "Your document content is saved and is yours to read right away. It is recorded as information you contributed, so nothing in it is treated as a clinician's sign-off.",
    },
  ];
  if (authority) {
    notices.push({
      level: "info",
      code: "authority_not_inherited",
      message:
        "The file contains sign-off and release wording. That wording is kept as part of your document, but it does not by itself make anything here approved.",
    });
  }
  if (trustedReport) {
    notices.push({
      level: "info",
      code: "existing_report_preserved",
      message:
        "The report already on your account is unchanged. Your upload sits alongside it rather than replacing it.",
    });
  }

  if (existing) {
    return {
      status: 200,
      body: {
        imported: false,
        accepted: true,
        idempotent: true,
        submission_id: (existing as Record<string, unknown>).id,
        version: (existing as Record<string, unknown>).version,
        review_state: (existing as Record<string, unknown>).review_state,
        authority_asserted_in_file: authority,
        parsed_summary: summary,
        diagnostics: [
          ...notices,
          {
            level: "info",
            code: "already_received",
            message: "You have already uploaded this exact file, so nothing was duplicated.",
          },
        ],
      },
    };
  }

  const { count } = await serviceClient
    .from("biotwin_patient_submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const { data: inserted, error: insertErr } = await serviceClient
    .from("biotwin_patient_submissions")
    .insert({
      user_id: userId,
      version: (count ?? 0) + 1,
      content_sha256: contentSha,
      schema_name: summary.schema_name,
      report_type: summary.report_type,
      submitted_filename: args.filename ?? null,
      submitted_by: submittedBy,
      actor_kind: actorKind,
      review_state: "received_unverified",
      authority_asserted_in_file: authority,
      parsed_summary: summary,
      diagnostics: notices,
      raw_submission: report,
    })
    .select("id, version, review_state")
    .single();

  if (insertErr || !inserted) {
    return {
      status: 500,
      body: { imported: false, accepted: false, error: "submission_failed", message: insertErr?.message },
    };
  }

  return {
    status: 200,
    body: {
      imported: false,
      accepted: true,
      idempotent: false,
      submission_id: (inserted as Record<string, unknown>).id,
      version: (inserted as Record<string, unknown>).version,
      review_state: (inserted as Record<string, unknown>).review_state,
      authority_asserted_in_file: authority,
      witnesses_created: 0,
      parsed_summary: summary,
      diagnostics: notices,
    },
  };
}
