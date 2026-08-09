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
import { persistBiotwinImport } from "../_shared/biotwin/persist.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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

  // Detection, validation, adaptation, persistence and allowlisted witness
  // projection all live in the shared module so the admin path cannot drift.
  const result = await persistBiotwinImport({
    serviceClient,
    userId,
    raw: payload.report,
    uploadId: typeof payload.upload_id === "string" ? payload.upload_id : null,
  });
  return json(result.body, result.status);
});