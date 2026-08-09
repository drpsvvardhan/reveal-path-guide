// ============================================================================
// admin-import-biotwin
// ----------------------------------------------------------------------------
// Admin-only Twin installation for a named account. Two accepted inputs:
//
//   1. report                                 → direct deterministic import
//   2. runtime_twin_json + release_decision    → compile v18 first, then import
//
// No LLM. The compiler and the importer contract are unchanged: the compiled
// output is re-validated by the same detector/validator/adapter the patient
// path uses, and witness projection stays allowlist-only.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  RELEASE_COMPILER_VERSION,
  type JsonObject,
} from "../_shared/biotwin/releaseCompiler.ts";
import { compileRuntimeTwinV18Governed } from "../_shared/biotwin/releaseCompilerGuard.ts";
import { persistBiotwinImport, sha256Hex } from "../_shared/biotwin/persist.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

  const serviceClient = createClient(supabaseUrl, serviceKey);
  const { data: roleRow } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return json({ error: "forbidden", message: "Admin role required." }, 403);

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json_body" }, 400);
  }

  const targetUserId = typeof payload.user_id === "string" ? payload.user_id.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) {
    return json({ error: "invalid_target_user", message: "Provide the target account's user_id." }, 400);
  }

  const { data: targetProfile } = await serviceClient
    .from("profiles")
    .select("user_id")
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (!targetProfile) {
    return json({ error: "target_not_found", message: "No profile exists for that account." }, 404);
  }

  let reportToImport: unknown = payload.report ?? null;
  let compileInfo: Record<string, unknown> | null = null;

  const rawTwin = typeof payload.runtime_twin_json === "string" ? payload.runtime_twin_json : null;
  const releaseDecision = payload.release_decision;

  if (!reportToImport) {
    if (
      !rawTwin ||
      typeof releaseDecision !== "object" ||
      releaseDecision === null ||
      Array.isArray(releaseDecision)
    ) {
      return json(
        {
          error: "invalid_import_request",
          message:
            "Provide either a compiled report, or runtime_twin_json (exact raw v18 text) with release_decision.",
        },
        400,
      );
    }

    const actualSha = await sha256Hex(rawTwin);
    const decisionObject = releaseDecision as JsonObject;
    const subject =
      typeof decisionObject.subject === "object" &&
      decisionObject.subject !== null &&
      !Array.isArray(decisionObject.subject)
        ? (decisionObject.subject as JsonObject)
        : null;
    const decisionSha = subject?.source_twin_sha256;
    if (typeof decisionSha !== "string" || decisionSha !== actualSha) {
      return json(
        {
          error: "source_sha_mismatch",
          message: "The release decision is not bound to the exact RUNTIME_TWIN_FINAL bytes supplied.",
          expected_sha256: typeof decisionSha === "string" ? decisionSha : null,
          actual_sha256: actualSha,
        },
        409,
      );
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
      return json(
        {
          imported: false,
          compiled: false,
          compiler_version: RELEASE_COMPILER_VERSION,
          source_sha256: actualSha,
          diagnostics: compiled.diagnostics,
        },
        422,
      );
    }

    reportToImport = compiled.report;
    compileInfo = {
      compiled: true,
      compiler_version: RELEASE_COMPILER_VERSION,
      source_sha256: actualSha,
      stats: compiled.stats,
      compiler_diagnostics: compiled.diagnostics,
    };
  }

  const result = await persistBiotwinImport({
    serviceClient,
    userId: targetUserId,
    raw: reportToImport,
    uploadId: typeof payload.upload_id === "string" ? payload.upload_id : null,
  });

  return json(
    {
      ...result.body,
      target_user_id: targetUserId,
      installed_by: userData.user.id,
      ...(compileInfo ?? {}),
    },
    result.status,
  );
});