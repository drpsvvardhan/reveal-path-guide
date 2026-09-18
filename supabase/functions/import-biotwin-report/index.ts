// ============================================================================
// import-biotwin-report  (patient self-service path)
// ----------------------------------------------------------------------------
// A patient can contribute their own documents whenever they like, without
// waiting for anybody. What this path does NOT do is let an uploaded file
// certify itself: it never writes the governed report/statement tables, never
// projects witness objects, and never supersedes an existing trusted report.
//
// The trusted install path is admin-import-biotwin, which resolves its actor on
// the server. There is no request field that can make an upload trusted.
// ============================================================================

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authenticateRequest, resolveTargetUserId } from "../_shared/auth.ts";
import { saveSelfServiceSubmission } from "../_shared/biotwin/selfServiceSubmission.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authed = await authenticateRequest(req);
  if (!authed.ok) return json(authed.error.body, authed.error.status);

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json_body" }, 400);
  }

  const requestedUserId = typeof payload.user_id === "string" ? payload.user_id : null;
  const resolved = await resolveTargetUserId(authed.auth, requestedUserId);
  if (!resolved.ok) return json(resolved.error.body, resolved.error.status);

  const result = await saveSelfServiceSubmission({
    serviceClient: authed.auth.serviceClient,
    userId: resolved.targetUserId,
    submittedBy: authed.auth.callerUserId,
    raw: payload.report,
    filename: typeof payload.filename === "string" ? payload.filename : null,
    actorKind: resolved.isViewAs ? "admin_on_behalf" : "patient_self_service",
  });
  return json(result.body, result.status);
});
