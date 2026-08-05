// ============================================================================
// import-biotwin-report
// ----------------------------------------------------------------------------
// Deterministic import path for a "Vizzhy BioTwin Clinical Evidence Report".
// NO LLM is involved anywhere in this function. The report is detected,
// structurally validated, adapted by a pure function, and persisted as a
// patient-bound governed source plus governed evidence objects.
//
// Witness projection is allowlist-only: a report can never register a signal.
// Any confirmed measurement whose canonical signal is not pre-registered for
// the biotwin_v1 adapter stays a statement and yields a skipped-witness
// diagnostic.
// ============================================================================

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authenticateRequest, resolveTargetUserId } from "../_shared/auth.ts";
import {
  detectBiotwinReport,
  validateBiotwinStructure,
  hasBlockingDiagnostic,
} from "../_shared/biotwin/detect.ts";
import { adaptBiotwinReport } from "../_shared/biotwin/adapter.ts";
import {
  BIOTWIN_ADAPTER_VERSION,
  BIOTWIN_REGISTRY_SEED_VERSION,
  type BiotwinDiagnostic,
} from "../_shared/biotwin/types.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // ---- auth -----------------------------------------------------------------
  const authed = await authenticateRequest(req);
  if (!authed.ok) return json(authed.error.body, authed.error.status);

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json_body" }, 400);
  }

  const requestedUserId =
    typeof payload.user_id === "string" ? payload.user_id : null;
  const resolved = await resolveTargetUserId(authed.auth, requestedUserId);
  if (!resolved.ok) return json(resolved.error.body, resolved.error.status);
  const userId = resolved.targetUserId;

  const { serviceClient } = authed.auth;
  const diagnostics: BiotwinDiagnostic[] = [];

  // ---- detect ---------------------------------------------------------------
  const raw = payload.report;
  const detected = detectBiotwinReport(raw);
  if (!detected.accepted) {
    return json(
      {
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
      422,
    );
  }
  const report = raw as Record<string, unknown>;

  // ---- structural validation (deterministic, no extraction) ----------------
  const structural = validateBiotwinStructure(report);
  diagnostics.push(...structural);
  if (hasBlockingDiagnostic(structural)) {
    return json({ imported: false, refusal_code: "structure_invalid", diagnostics }, 422);
  }

  // ---- idempotency ----------------------------------------------------------
  const contentSha256 = await sha256Hex(JSON.stringify(report));
  const { data: existing, error: existingErr } = await serviceClient
    .from("biotwin_reports")
    .select("id, version, status, created_at")
    .eq("user_id", userId)
    .eq("content_sha256", contentSha256)
    .maybeSingle();
  if (existingErr) return json({ error: "lookup_failed", message: existingErr.message }, 500);

  if (existing) {
    const { count } = await serviceClient
      .from("biotwin_statements")
      .select("id", { count: "exact", head: true })
      .eq("report_id", existing.id);
    return json({
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
    });
  }

  // ---- adapt (pure) ---------------------------------------------------------
  const adapted = adaptBiotwinReport(report);
  diagnostics.push(...adapted.diagnostics);
  if (hasBlockingDiagnostic(adapted.diagnostics)) {
    return json({ imported: false, refusal_code: "adapter_error", diagnostics }, 422);
  }

  const draft = adapted.report;

  // ---- persist the governed source -----------------------------------------
  const { data: reportRow, error: reportErr } = await serviceClient
    .from("biotwin_reports")
    .insert({
      user_id: userId,
      upload_id: typeof payload.upload_id === "string" ? payload.upload_id : null,
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
    return json({ error: "report_insert_failed", message: reportErr?.message }, 500);
  }

  // ---- persist the evidence objects ----------------------------------------
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
    return json({ error: "statement_insert_failed", message: stmtErr.message }, 500);
  }

  const statementIdBySourceId = new Map<string, string>(
    (insertedStatements ?? []).map((r) => [r.source_id as string, r.id as string]),
  );

  // ---- allowlisted witness projection --------------------------------------
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

  // Persist the final diagnostics (witness outcomes included).
  await serviceClient
    .from("biotwin_reports")
    .update({ import_diagnostics: diagnostics })
    .eq("id", reportRow.id);

  return json({
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
  });
});