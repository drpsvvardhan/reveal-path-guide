// ============================================================================
// persistBiotwinImport
// ----------------------------------------------------------------------------
// Deterministic persistence for an already-detected BioTwin clinical evidence
// report. Extracted verbatim from import-biotwin-report so that the admin
// import path and the patient import path share ONE persistence contract.
//
// No LLM. No clock-dependent behaviour. Witness projection stays allowlist-only.
// ============================================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  detectBiotwinReport,
  validateBiotwinStructure,
  hasBlockingDiagnostic,
} from "./detect.ts";
import { adaptBiotwinReport } from "./adapter.ts";
import {
  BIOTWIN_ADAPTER_VERSION,
  BIOTWIN_REGISTRY_SEED_VERSION,
  type BiotwinDiagnostic,
} from "./types.ts";

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface PersistResult {
  status: number;
  body: Record<string, unknown>;
}

export async function persistBiotwinImport(args: {
  serviceClient: SupabaseClient;
  userId: string;
  raw: unknown;
  uploadId?: string | null;
}): Promise<PersistResult> {
  const { serviceClient, userId, raw } = args;
  const uploadId = args.uploadId ?? null;
  const diagnostics: BiotwinDiagnostic[] = [];

  const detected = detectBiotwinReport(raw);
  if (!detected.accepted) {
    return {
      status: 422,
      body: {
        imported: false,
        refusal_code: detected.refusal_code ?? "rejected",
        diagnostics: [
          {
            level: "error",
            code: detected.refusal_code ?? "rejected",
            message: detected.message,
          },
        ],
      },
    };
  }
  const report = raw as Record<string, unknown>;

  const structural = validateBiotwinStructure(report);
  diagnostics.push(...structural);
  if (hasBlockingDiagnostic(structural)) {
    return { status: 422, body: { imported: false, refusal_code: "structure_invalid", diagnostics } };
  }

  const contentSha256 = await sha256Hex(JSON.stringify(report));
  const { data: existing, error: existingErr } = await serviceClient
    .from("biotwin_reports")
    .select("id, version, status, created_at")
    .eq("user_id", userId)
    .eq("content_sha256", contentSha256)
    .maybeSingle();
  if (existingErr) {
    return { status: 500, body: { error: "lookup_failed", message: existingErr.message } };
  }

  if (existing) {
    const { count } = await serviceClient
      .from("biotwin_statements")
      .select("id", { count: "exact", head: true })
      .eq("report_id", existing.id);
    return {
      status: 200,
      body: {
        imported: false,
        idempotent: true,
        report_id: existing.id,
        version: existing.version,
        status: existing.status,
        statement_count: count ?? 0,
        diagnostics: [
          ...diagnostics,
          {
            level: "info",
            code: "already_imported",
            message:
              "This exact report was already imported for this person. Nothing was changed.",
          },
        ],
      },
    };
  }

  const adapted = adaptBiotwinReport(report);
  diagnostics.push(...adapted.diagnostics);
  if (hasBlockingDiagnostic(adapted.diagnostics)) {
    return { status: 422, body: { imported: false, refusal_code: "adapter_error", diagnostics } };
  }

  const draft = adapted.report;

  const { data: reportRow, error: reportErr } = await serviceClient
    .from("biotwin_reports")
    .insert({
      user_id: userId,
      upload_id: uploadId,
      twin_id: draft.twin_id,
      schema_name: draft.schema_name,
      schema_version: draft.schema_version,
      report_type: draft.report_type,
      semantic_repair_version: draft.semantic_repair_version,
      generated_date: draft.generated_date,
      content_sha256: contentSha256,
      status: "active",
      release_control: draft.release_control,
      executive_synthesis: draft.executive_synthesis,
      attestation: draft.attestation,
      holds: draft.holds,
      clinician_review_required: draft.clinician_review_required,
      patient_release_permitted: draft.patient_release_permitted,
      adapter_version: BIOTWIN_ADAPTER_VERSION,
      import_diagnostics: diagnostics,
      raw_report: report,
    })
    .select("id, version, status")
    .single();
  if (reportErr || !reportRow) {
    return { status: 500, body: { error: "report_insert_failed", message: reportErr?.message } };
  }

  const statementRows = adapted.statements.map((s) => ({
    report_id: reportRow.id,
    user_id: userId,
    source_id: s.source_id,
    section: s.section,
    statement_kind: s.statement_kind,
    truth_status: s.truth_status,
    title: s.title,
    body: s.body,
    bounds: s.bounds,
    measurements: s.measurements,
    timepoint: s.timepoint,
    clinical_authority: s.clinical_authority,
    requires_measurement: s.requires_measurement,
    holds: s.holds,
    provenance: s.provenance,
    ordinal: s.ordinal,
  }));

  const { data: insertedStatements, error: stmtErr } = await serviceClient
    .from("biotwin_statements")
    .insert(statementRows)
    .select("id, source_id");
  if (stmtErr) {
    // Rollback the source so a partial import never becomes the active report.
    await serviceClient.from("biotwin_reports").delete().eq("id", reportRow.id);
    return { status: 500, body: { error: "statement_insert_failed", message: stmtErr.message } };
  }

  const statementIdBySourceId = new Map<string, string>(
    (insertedStatements ?? []).map((r) => [r.source_id as string, r.id as string]),
  );

  let witnessesCreated = 0;
  for (const candidate of adapted.witness_candidates) {
    const statementId = statementIdBySourceId.get(candidate.statement_source_id);
    if (!statementId) {
      diagnostics.push({
        level: "warning",
        code: "witness_skipped_missing_statement",
        message: `Measurement "${candidate.raw_name}" was not projected into the witness ledger because its evidence statement could not be resolved.`,
      });
      continue;
    }

    const { data: witnessId, error: witnessErr } = await serviceClient.rpc(
      "rae_insert_witness_object",
      {
        p_witness: {
          user_id: userId,
          source_table: "biotwin_statements",
          source_row_id: statementId,
          source_window: candidate.source_window,
          signal: candidate.signal,
          domain_of_access: candidate.domain_of_access,
          epistemic_role: candidate.epistemic_role,
          reliability_class: candidate.reliability_class,
          compression_depth: 0,
          observed_value: { value: candidate.value, unit: candidate.unit },
          observed_unit: candidate.unit,
          testimony: candidate.testimony,
          limitations: candidate.limitations,
          confidence_value: candidate.confidence_value,
          confidence_basis: candidate.confidence_basis,
          biological_timestamp: candidate.biological_timestamp,
          transformation_version: BIOTWIN_ADAPTER_VERSION,
          registry_seed_version: BIOTWIN_REGISTRY_SEED_VERSION,
        },
      },
    );

    if (witnessErr || !witnessId) {
      diagnostics.push({
        level: "warning",
        code: "witness_skipped_not_registered",
        message: `Measurement "${candidate.raw_name}" stayed an evidence statement only. Its signal "${candidate.signal}" is not pre-registered for this adapter (${witnessErr?.message ?? "no witness id returned"}).`,
      });
      continue;
    }

    await serviceClient
      .from("biotwin_statements")
      .update({ witness_id: witnessId })
      .eq("id", statementId);
    witnessesCreated += 1;
  }

  await serviceClient
    .from("biotwin_reports")
    .update({ import_diagnostics: diagnostics })
    .eq("id", reportRow.id);

  return {
    status: 200,
    body: {
      imported: true,
      idempotent: false,
      report_id: reportRow.id,
      version: reportRow.version,
      status: reportRow.status,
      adapter_version: BIOTWIN_ADAPTER_VERSION,
      statement_count: insertedStatements?.length ?? 0,
      truth_status_counts: adapted.counts,
      witness_candidates: adapted.witness_candidates.length,
      witnesses_created: witnessesCreated,
      witnesses_skipped: adapted.witness_candidates.length - witnessesCreated,
      clinician_review_required: draft.clinician_review_required,
      patient_release_permitted: draft.patient_release_permitted,
      holds: draft.holds,
      diagnostics,
    },
  };
}