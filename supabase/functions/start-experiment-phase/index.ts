// ============================================================================
// start-experiment-phase
// ----------------------------------------------------------------------------
// Moves a plan through its lifecycle:
//   draft → run_in → intervention → (washout) → ready_to_compare → completed
//   plus stopped / paused / not_interpretable / graduated
//
// Rules this handler exists to hold:
//
//   1. STOPPING AND PAUSING ARE ALWAYS ALLOWED, handled FIRST, and idempotent.
//      They need no admission, no clinician, no evidence, and they are never
//      refused because the phase moved on. A stopped plan never restarts.
//   2. Anything that starts or advances an intervention is re-admitted here,
//      against the CURRENT executable content and the CURRENT trusted context.
//      The commit is a transactional compare-and-set over the protocol version,
//      the content hash AND the context fingerprint, so a plan cannot be
//      activated on a decision computed from information that has since changed
//      (including a CIE safety hold raised a moment ago).
//   3. Graduation is decided in the database from independent cycle evidence.
// ============================================================================
import { authenticateRequest, resolveTargetUserId, jsonResponse } from "../_shared/auth.ts";
import { assessProposal } from "../_shared/autonomy/actionPolicy.ts";
import { loadAdmissionContext } from "../_shared/autonomy/admissionContext.ts";
import {
  executableContentHash,
  proposalFromProtocolRow,
} from "../_shared/autonomy/protocolContent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NEXT: Record<string, string> = {
  draft: "run_in",
  run_in: "intervention",
  intervention: "ready_to_compare",
  washout: "ready_to_compare",
  completed: "run_in",
};

/** Phases a patient may always reach, whatever the evidence says. */
const PATIENT_OWNED = new Set(["stopped", "paused"]);

/** Terminal phases. Nothing restarts from here. */
const TERMINAL = new Set(["stopped", "graduated", "not_interpretable"]);

const ERROR_MESSAGES: Record<string, { status: number; message: string }> = {
  STALE_PHASE: {
    status: 409,
    message: "This plan has moved on since the screen was loaded. Reload and try again.",
  },
  INVALID_TRANSITION: { status: 400, message: "That step is not possible from where this plan is now." },
  TERMINAL_PHASE: { status: 409, message: "This plan has already finished, so it cannot be started again." },
  PROTOCOL_REQUIRED: { status: 409, message: "This plan has no saved protocol yet, so there is nothing to start." },
  PROTOCOL_NOT_FOUND: { status: 409, message: "This plan has no saved protocol yet, so there is nothing to start." },
  PROTOCOL_SUPERSEDED: { status: 409, message: "A newer version of this plan exists. Review that one instead." },
  PROTOCOL_CHANGED: {
    status: 409,
    message: "The plan changed after it was checked, so it was not started. Review it once more.",
  },
  SOURCE_CHANGED: { status: 409, message: "The source suggestion changed. Review this plan again." },
  CONTEXT_CHANGED: {
    status: 409,
    message: "Your information changed while this was being started, so it was not started. Open it again for a fresh check.",
  },
  ADMISSION_REQUIRED: { status: 403, message: "This plan is not cleared to start on its own." },
  EXPERIMENT_NOT_FOUND: { status: 403, message: "That plan does not belong to this account." },
  REPLICATION_REQUIRED: {
    status: 409,
    message: "This needs a second, independent cycle before it becomes a settled learning.",
  },
};

function mapDbError(raw: string | undefined | null) {
  const code = Object.keys(ERROR_MESSAGES).find((k) => (raw ?? "").includes(k));
  return code ? { code, ...ERROR_MESSAGES[code] } : { code: raw ?? "unknown", status: 409, message: raw ?? "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405, corsHeaders);
  try {
    const authRes = await authenticateRequest(req);
    if (!authRes.ok) return jsonResponse(authRes.error.body, authRes.error.status, corsHeaders);

    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return jsonResponse({ error: "invalid_request" }, 400, corsHeaders);
    }
    const { experiment_id, target_phase, stopped_reason } = payload;
    if ((target_phase != null && typeof target_phase !== "string") ||
        (stopped_reason != null && (typeof stopped_reason !== "string" || stopped_reason.length > 2000))) {
      return jsonResponse({ error: "invalid_request" }, 400, corsHeaders);
    }
    if (!experiment_id) {
      return jsonResponse({ error: "experiment_id required" }, 400, corsHeaders);
    }

    const supabase = authRes.auth.serviceClient;
    const { data: exp, error: expErr } = await supabase
      .from("simulator_experiments")
      .select("*")
      .eq("id", experiment_id)
      .maybeSingle();
    if (expErr) throw expErr;
    if (!exp) return jsonResponse({ error: "experiment_not_found" }, 404, corsHeaders);
    const experiment = exp as Record<string, unknown>;

    const owner = await resolveTargetUserId(authRes.auth, experiment.user_id as string);
    if (!owner.ok) return jsonResponse(owner.error.body, owner.error.status, corsHeaders);
    const userId = owner.targetUserId;
    if (owner.isViewAs) return jsonResponse({ error: "account_holder_required" }, 403, corsHeaders);

    const current = (experiment.phase as string) || "draft";
    const desired = (target_phase as string) || NEXT[current];
    if (!desired) return jsonResponse({ error: "no_next_phase", current }, 400, corsHeaders);

    // ── 1. Patient-owned stop / pause, handled before anything else. ─────────
    if (PATIENT_OWNED.has(desired)) {
      // Idempotent: already there, or already finished for good — say so calmly
      // and never reopen a closed plan.
      if (current === desired || (desired === "stopped" && TERMINAL.has(current))) {
        return jsonResponse(
          { transition: "no_change", previous_phase: current, new_phase: current, idempotent: true },
          200,
          corsHeaders,
        );
      }
      if (desired === "paused" && TERMINAL.has(current)) {
        return jsonResponse(
          { error: "already_finished", code: "TERMINAL_PHASE", message: ERROR_MESSAGES.TERMINAL_PHASE.message },
          409,
          corsHeaders,
        );
      }
      const { data: result, error: stopErr } = await supabase.rpc("simulator_transition_phase", {
        p_user_id: userId,
        p_experiment_id: experiment_id,
        p_from_phase: current,
        p_to_phase: desired,
        p_protocol_id: null,
        p_protocol_version: null,
        p_executable_sha: null,
        p_context_fingerprint: null,
        p_admission: { activation_allowed: false, verdict: "N/A", patient_owned: true },
        p_stopped_reason: desired === "stopped" ? (stopped_reason ?? "patient_stopped") : null,
      });
      if (stopErr) {
        const mapped = mapDbError(stopErr.message);
        return jsonResponse(
          { error: "transition_failed", code: mapped.code, message: mapped.message },
          mapped.status,
          corsHeaders,
        );
      }
      return jsonResponse(
        { transition: result, previous_phase: current, new_phase: desired },
        200,
        corsHeaders,
      );
    }

    // ── 2. Graduation: decided in the database from independent cycles. ──────
    if (desired === "graduated") {
      const { data: gradResult, error: gradErr } = await supabase.rpc("simulator_graduate_experiment", {
        p_user_id: userId,
        p_experiment_id: experiment_id,
      });
      if (gradErr) {
        const mapped = mapDbError(gradErr.message);
        return jsonResponse(
          { error: "not_graduated", code: mapped.code, message: mapped.message },
          mapped.status,
          corsHeaders,
        );
      }
      return jsonResponse({ graduated: true, detail: gradResult }, 200, corsHeaders);
    }

    if (TERMINAL.has(current)) {
      return jsonResponse(
        { error: "already_finished", code: "TERMINAL_PHASE", message: ERROR_MESSAGES.TERMINAL_PHASE.message },
        409,
        corsHeaders,
      );
    }

    const allowed = new Set([NEXT[current], "not_interpretable"]);
    if (target_phase && !allowed.has(target_phase)) {
      return jsonResponse(
        { error: "invalid_transition", code: "INVALID_TRANSITION", current, target_phase },
        400,
        corsHeaders,
      );
    }

    // ── 3. Everything else is re-admitted now, on current content + context. ─
    const { data: proto, error: protoErr } = await supabase
      .from("simulator_experiment_protocols")
      .select("*")
      .eq("experiment_id", experiment_id)
      .eq("user_id", userId)
      .order("protocol_version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (protoErr) throw protoErr;
    if (!proto) {
      return jsonResponse(
        { error: "protocol_required", code: "PROTOCOL_REQUIRED", message: ERROR_MESSAGES.PROTOCOL_REQUIRED.message },
        409,
        corsHeaders,
      );
    }
    const protocol = proto as Record<string, unknown>;

    const proposal = proposalFromProtocolRow(protocol, experiment);
    const recomputedSha = await executableContentHash({ proposal, experiment });
    if (protocol.executable_sha256 && protocol.executable_sha256 !== recomputedSha) {
      return jsonResponse(
        {
          error: "protocol_changed",
          code: "PROTOCOL_CHANGED",
          message: ERROR_MESSAGES.PROTOCOL_CHANGED.message,
          stored_sha256: protocol.executable_sha256,
          recomputed_sha256: recomputedSha,
        },
        409,
        corsHeaders,
      );
    }

    // The source suggestion's current verdict is re-read: a suggestion that has
    // since been held cannot be launched through a plan built from it earlier.
    let sourceCard: Record<string, unknown> | null = null;
    if (experiment.source_card_id) {
      const { data: card, error: cardErr } = await supabase
        .from("simulator_what_if_cards")
        .select("id, user_id, admission_verdict, patient_safe, safety_flags, updated_at")
        .eq("id", experiment.source_card_id as string)
        .maybeSingle();
      if (cardErr) throw cardErr;
      if (!card || (card as Record<string, unknown>).user_id !== userId) {
        return jsonResponse(
          { error: "source_card_not_found", message: "That plan's source does not belong to this account." },
          403,
          corsHeaders,
        );
      }
      sourceCard = (card as Record<string, unknown>) ?? null;
    }

    const context = await loadAdmissionContext(supabase, userId, { isViewAs: owner.isViewAs });
    const assessment = assessProposal(proposal, {
      ...context,
      sourceCard: sourceCard
        ? {
            verdict: sourceCard.admission_verdict as string | null,
            patient_safe: sourceCard.patient_safe as boolean | null,
            safety_flags: sourceCard.safety_flags as string[] | null,
          }
        : null,
    });
    if (!assessment.activation_allowed) {
      return jsonResponse(
        {
          error: "not_cleared_to_start",
          code: "ADMISSION_REQUIRED",
          message: assessment.patient_message,
          admission: assessment,
        },
        403,
        corsHeaders,
      );
    }

    // The commit re-checks the phase, the protocol version, the executable
    // content hash and the context fingerprint under a row lock. If the context
    // changed between the read above and this commit, the transition fails.
    const { data: result, error: transErr } = await supabase.rpc("simulator_transition_phase", {
      p_user_id: userId,
      p_experiment_id: experiment_id,
      p_from_phase: current,
      p_to_phase: desired,
      p_protocol_id: protocol.id,
      p_protocol_version: protocol.protocol_version,
      p_executable_sha: recomputedSha,
      p_context_fingerprint: context.fingerprint,
      p_admission: {
        ...assessment,
        protocol_snapshot: protocol,
        experiment_snapshot: experiment,
        source_card_updated_at: sourceCard?.updated_at ?? null,
      },
      p_stopped_reason: null,
    });
    if (transErr) {
      const mapped = mapDbError(transErr.message);
      return jsonResponse(
        { error: "transition_failed", code: mapped.code, message: mapped.message, admission: assessment },
        mapped.status,
        corsHeaders,
      );
    }

    return jsonResponse(
      {
        transition: result,
        protocol_id: protocol.id,
        admission: assessment,
        previous_phase: current,
        new_phase: desired,
      },
      200,
      corsHeaders,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("start-experiment-phase error:", message);
    return jsonResponse({ error: "transition_failed", message }, 500, corsHeaders);
  }
});
