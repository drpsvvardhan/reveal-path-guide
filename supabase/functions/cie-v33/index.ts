import { publishedEvidence } from "../_shared/cie33/evidence.ts";
import {
  authenticateRequest,
  resolveTargetUserId,
  jsonResponse,
} from "../_shared/auth.ts";
import {
  applyCommand,
  startIntake,
  IntakeError,
} from "../_shared/cie33/engine.ts";
import type { IntakeState, IntakeCommand } from "../_shared/cie33/engine.ts";
import { contentHash } from "../_shared/cie33/reference/canonical.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST")
    return jsonResponse({ error: "method_not_allowed" }, 405, cors);
  try {
    const result = await authenticateRequest(req);
    if (!result.ok)
      return jsonResponse(result.error.body, result.error.status, cors);
    const raw = await req.text();
    if (raw.length > 16000)
      throw new IntakeError(
        "PAYLOAD_TOO_LARGE",
        "The answer is too large.",
        413,
      );
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new IntakeError("INVALID_JSON", "Invalid request.");
    }
    if (!body || typeof body !== "object")
      throw new IntakeError("INVALID_REQUEST", "Invalid request.");
    const target = await resolveTargetUserId(result.auth, body.user_id);
    if (!target.ok)
      return jsonResponse(target.error.body, target.error.status, cors);
    const userId = target.targetUserId;
    const db = result.auth.serviceClient;
    if (body.action === "read" || body.action === "freshness") {
      let query = db
        .from("cie33_sessions")
        .select("state, published_state")
        .eq("user_id", userId);
      if (body.action === "freshness")
        query = query.not("published_state", "is", null);
      if (body.session_id) {
        if (!uuid.test(body.session_id))
          throw new IntakeError("INVALID_SESSION", "Invalid session.");
        query = query.eq("id", body.session_id);
      }
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (body.action === "freshness") {
        const published = data?.published_state as IntakeState | undefined;
        const evidence = published
          ? publishedEvidence(published, userId, published.id)
          : undefined;
        return jsonResponse(
          {
            latest_capture_at:
              evidence?.witnesses
                .map((w) => w.captured_at)
                .sort()
                .at(-1) ?? null,
          },
          200,
          cors,
        );
      }
      return jsonResponse({ state: data?.state ?? null }, 200, cors);
    }
    // A view-as session grants inspection, never the right to author self-report.
    if (target.isViewAs)
      throw new IntakeError(
        "SELF_REPORT_ONLY",
        "Only the patient can submit this self-report intake.",
        403,
      );
    if (!uuid.test(body.request_id ?? ""))
      throw new IntakeError(
        "REQUEST_ID_REQUIRED",
        "A valid request ID is required.",
      );
    const requestHash = contentHash({ userId, ...body });
    const { data: receipt, error: receiptError } = await db
      .from("cie33_events")
      .select("session_id, request_hash")
      .eq("user_id", userId)
      .eq("request_id", body.request_id)
      .maybeSingle();
    if (receiptError) throw receiptError;
    if (receipt) {
      if (receipt.request_hash !== requestHash)
        throw new IntakeError(
          "IDEMPOTENCY_CONFLICT",
          "This request ID was already used for a different action.",
          409,
        );
      const { data, error } = await db
        .from("cie33_sessions")
        .select("state")
        .eq("user_id", userId)
        .eq("id", receipt.session_id)
        .single();
      if (error) throw error;
      return jsonResponse({ state: data.state }, 200, cors);
    }
    let state: IntakeState;
    let expectedRevision = -1;
    let expectedHash: string | null = null;
    const now = new Date().toISOString();
    if (body.action === "start") {
      if (
        body.consent !== true ||
        body.source_role !== "self" ||
        typeof body.sensitive_consent !== "boolean"
      )
        throw new IntakeError(
          "CONSENT_REQUIRED",
          "Confirm that you are answering for yourself and consent to this intake.",
        );
      state = startIntake(userId, body.sensitive_consent, now);
    } else {
      if (
        !uuid.test(body.session_id ?? "") ||
        !Number.isInteger(body.expected_revision) ||
        typeof body.expected_hash !== "string"
      )
        throw new IntakeError(
          "STATE_BINDING_REQUIRED",
          "Reload your saved intake before continuing.",
          409,
        );
      const { data, error } = await db
        .from("cie33_sessions")
        .select("state")
        .eq("user_id", userId)
        .eq("id", body.session_id)
        .maybeSingle();
      if (error) throw error;
      if (!data)
        throw new IntakeError("SESSION_NOT_FOUND", "Intake not found.", 404);
      const previous = data.state as IntakeState;
      expectedRevision = body.expected_revision;
      expectedHash = body.expected_hash;
      if (
        previous.revision !== expectedRevision ||
        previous.stateHash !== expectedHash
      )
        throw new IntakeError(
          "STALE_STATE",
          "Your intake changed in another window. Reload to continue.",
          409,
        );
      const command = {
        action: body.action,
        answer: body.answer,
        witnessId: body.witness_id,
      } as IntakeCommand;
      state = applyCommand(previous, command, body.request_id, now);
    }
    const { data, error } = await db.rpc("cie33_commit", {
      p_user_id: userId,
      p_request_id: body.request_id,
      p_request_hash: requestHash,
      p_expected_revision: expectedRevision,
      p_expected_hash: expectedHash,
      p_state: state,
      p_action: body.action,
    });
    if (error) {
      if (["40001", "23505"].includes(error.code))
        throw new IntakeError(
          "STATE_CONFLICT",
          "The intake has changed. Reload your saved answers.",
          409,
        );
      throw error;
    }
    return jsonResponse({ state: data }, 200, cors);
  } catch (error) {
    if (error instanceof IntakeError)
      return jsonResponse(
        { error: error.code, message: error.message },
        error.status,
        cors,
      );
    // Never log answer bodies, stored witnesses, or patient identifiers.
    console.error("cie-v33 failed", {
      code: (error as { code?: string })?.code ?? "internal",
    });
    return jsonResponse(
      {
        error: "intake_unavailable",
        message:
          "Your intake could not be saved. Your last confirmed answers are preserved. Retry or reload.",
      },
      500,
      cors,
    );
  }
});
