// ============================================================================
// compile-biotwin-release
// ----------------------------------------------------------------------------
// Admin-only, write-nothing factory endpoint.
// Input: exact raw RUNTIME_TWIN_FINAL v18 JSON text + Founding Cohort release
// decision. Output: deterministic FINAL_CORRECTED_CLINICAL_EVIDENCE_REPORT
// already validated against the existing Release-0 importer contract.
//
// No LLM. No database writes. No clock. No generic extraction.
// ============================================================================

import { authenticateRequest } from "../_shared/auth.ts";
import {
  RELEASE_COMPILER_VERSION,
  type JsonObject,
} from "../_shared/biotwin/releaseCompiler.ts";
import { compileRuntimeTwinV18Governed } from "../_shared/biotwin/releaseCompilerGuard.ts";
import {
  detectBiotwinReport,
  validateBiotwinStructure,
  hasBlockingDiagnostic,
} from "../_shared/biotwin/detect.ts";
import { adaptBiotwinReport } from "../_shared/biotwin/adapter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authed = await authenticateRequest(req);
  if (!authed.ok) return json(authed.error.body, authed.error.status);

  // Release compilation is an explicit governance action, not a patient action.
  const { data: adminRole, error: adminErr } = await authed.auth.userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", authed.auth.callerUserId)
    .eq("role", "admin")
    .maybeSingle();
  if (adminErr || !adminRole) {
    return json({ error: "forbidden", message: "Admin role required for BioTwin release compilation." }, 403);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json() as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json_body" }, 400);
  }

  const rawTwin = typeof payload.runtime_twin_json === "string" ? payload.runtime_twin_json : null;
  const releaseDecision = payload.release_decision;
  if (!rawTwin || typeof releaseDecision !== "object" || releaseDecision === null || Array.isArray(releaseDecision)) {
    return json({
      error: "invalid_compile_request",
      message: "Provide runtime_twin_json as the exact raw v18 JSON text and release_decision as an object.",
    }, 400);
  }

  const actualSha = await sha256Hex(rawTwin);
  const releaseDecisionObject = releaseDecision as JsonObject;
  const decisionSubject = typeof releaseDecisionObject.subject === "object" && releaseDecisionObject.subject !== null && !Array.isArray(releaseDecisionObject.subject)
    ? releaseDecisionObject.subject as JsonObject
    : null;
  const decisionSha = decisionSubject?.source_twin_sha256;
  if (typeof decisionSha !== "string" || decisionSha !== actualSha) {
    return json({
      error: "source_sha_mismatch",
      message: "The release decision is not bound to the exact RUNTIME_TWIN_FINAL bytes supplied.",
      expected_sha256: typeof decisionSha === "string" ? decisionSha : null,
      actual_sha256: actualSha,
    }, 409);
  }

  let runtimeTwin: JsonObject;
  try {
    const parsed = JSON.parse(rawTwin);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return json({ error: "runtime_twin_not_object" }, 422);
    }
    runtimeTwin = parsed as JsonObject;
  } catch {
    return json({ error: "runtime_twin_invalid_json" }, 422);
  }

  const compiled = compileRuntimeTwinV18Governed(runtimeTwin, releaseDecision);
  if (!compiled.ok || !compiled.report) {
    return json({
      compiled: false,
      compiler_version: RELEASE_COMPILER_VERSION,
      source_sha256: actualSha,
      diagnostics: compiled.diagnostics,
    }, 422);
  }

  // The compiler's output is not trusted merely because the compiler produced
  // it. Re-run the exact detector/validator/adapter used by the live importer.
  const detected = detectBiotwinReport(compiled.report);
  const structural = validateBiotwinStructure(compiled.report);
  if (!detected.accepted || hasBlockingDiagnostic(structural)) {
    return json({
      compiled: false,
      error: "compiled_report_failed_import_contract",
      compiler_version: RELEASE_COMPILER_VERSION,
      source_sha256: actualSha,
      detection: detected,
      structural_diagnostics: structural,
      compiler_diagnostics: compiled.diagnostics,
    }, 422);
  }

  const adapted = adaptBiotwinReport(compiled.report);
  if (hasBlockingDiagnostic(adapted.diagnostics)) {
    return json({
      compiled: false,
      error: "compiled_report_failed_adapter",
      compiler_version: RELEASE_COMPILER_VERSION,
      source_sha256: actualSha,
      adapter_diagnostics: adapted.diagnostics,
      compiler_diagnostics: compiled.diagnostics,
    }, 422);
  }

  return json({
    compiled: true,
    compiler_version: RELEASE_COMPILER_VERSION,
    source_sha256: actualSha,
    stats: compiled.stats,
    compiler_diagnostics: compiled.diagnostics,
    importer_preview: {
      statement_counts: adapted.counts,
      witness_candidates: adapted.witness_candidates.length,
      holds: adapted.report.holds,
      patient_release_permitted: adapted.report.patient_release_permitted,
      clinician_review_required: adapted.report.clinician_review_required,
    },
    report: compiled.report,
  });
});
