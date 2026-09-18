// ============================================================================
// start-experiment-phase
// ----------------------------------------------------------------------------
// Moves a plan through its lifecycle:
//   draft → run_in → intervention → (washout) → ready_to_compare → completed
//   plus stopped / paused / not_interpretable / graduated
//
// Two rules hold this together:
//   1. STOPPING AND PAUSING ARE ALWAYS ALLOWED. They need no admission, no
//      clinician, and no evidence.
//   2. Anything that starts or advances an intervention is re-admitted here,
//      against the CURRENT protocol content and the CURRENT trusted context,
//      and committed through a transactional CAS function. A stale or edited
//      protocol therefore cannot inherit an earlier approval.
// ============================================================================
import { authenticateRequest, resolveTargetUserId, jsonResponse } from "../_shared/auth.ts";
import { assessProposal } from "../_shared/autonomy/actionPolicy.ts";
import { loadAdmissionContext } from "../_shared/autonomy/admissionContext.ts";
import {
  protocolContentHash,
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
  ready_to_compare: "completed",
};

// Phases a patient may always reach, whatever the evidence says.
const PATIENT_OWNED = new Set(["stopped", "paused"]);

const ERROR_MESSAGES: Record<string, { status: number; message: string }> = {
  STALE_PHASE: { status: 409, message: "This plan has moved on since the screen was loaded. Reload and try again." },
  PROTOCOL_REQUIRED: { status: 409, message: "This plan has no saved protocol yet, so there is nothing to start." },
  PROTOCOL_NOT_FOUND: { status: 409, message: "This plan has no saved protocol yet, so there is nothing to start." },
  PROTOCOL_SUPERSEDED: { status: 409, message: "A newer version of this plan exists. Start that one instead." },
  PROTOCOL_CHANGED: { status: 409, message: "The plan changed after it was checked, so it was not started. Review it once more." },
  ADMISSION_REQUIRED: { status: 403, message: "This plan is not cleared to start on its own." },
  EXPERIMENT_NOT_FOUND: { status: 403, message: "That plan does not belong to this account." },
  REPLICATION_REQUIRED: { status: 409, message: "Graduation needs a repeated cycle. Run the same plan once more first." },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authRes = await authenticateRequest(req);
    if (!authRes.ok) return jsonResponse(authRes.error.body, authRes.error.status, corsHeaders);

    const { experiment_id, target_phase, stopped_reason } = await req.json();
    if (!experiment_id) {
      return jsonResponse({ error: "experiment_id required" }, 400, corsHeaders);
    }

    const supabase = authRes.auth.serviceClient;
    const { data: exp } = await supabase
      .from("simulator_experiments")
      .select("*")
      .eq("id", experiment_id)
      .maybeSingle();
    if (!exp) {
      return jsonResponse({ error: "experiment_not_found" }, 404, corsHeaders);
    }
    const experiment = exp as Record<string, unknown>;

    const owner = await resolveTargetUserId(authRes.auth, experiment.user_id as string);
    if (!owner.ok) return jsonResponse(owner.error.body, owner.error.status, corsHeaders);
    const userId = owner.targetUserId;

    const current = (experiment.phase as string) || "draft";
    const desired = (target_phase as string) || NEXT[current];
    if (!desired) {
      return jsonResponse({ error: "no_next_phase", current }, 400, corsHeaders);
    }

    // Graduation is its own server-computed gate.
    if (desired === "graduated") {
      const { error: gradErr } = await supabase.rpc("simulator_graduate_experiment", {
        p_user_id: userId,
        p_experiment_id: experiment_id,
      });
      if (gradErr) {
        const mapped = ERROR_MESSAGES[gradErr.message?.replace(/^.*?([A-Z_]{5,})$/, "$1") ?? ""] ??
          ERROR_MESSAGES[gradErr.message ?? ""];
        return jsonResponse(
          { error: "not_graduated", code: gradErr.message, message: mapped?.message ?? gradErr.message },
          mapped?.status ?? 409,
          corsHeaders,
        );
      }
      return jsonResponse({ graduated: true }, 200, corsHeaders);
    }

    const allowed = new Set([NEXT[current], ...PATIENT_OWNED, "not_interpretable"]);
    if (target_phase && !allowed.has(target_phase)) {
      return jsonResponse({ error: "invalid_transition", current, target_phase }, 400, corsHeaders);
    }

    // ── Patient-owned stop / pause: no admission, no gate. ──────────────────
    if (PATIENT_OWNED.has(desired)) {
      const { data: result, error: stopErr } = await supabase.rpc("simulator_transition_phase", {
        p_user_id: userId,
        p_experiment_id: experiment_id,
        p_from_phase: current,
        p_to_phase: desired,
        p_protocol_id: null,
        p_protocol_sha: null,
        p_admission: { activation_allowed: false, verdict: "N/A" },
        p_stopped_reason: stopped_reason ?? "patient_stopped",
      });
      if (stopErr) {
        const mapped = ERROR_MESSAGES[stopErr.message ?? ""];
        return jsonResponse(
          { error: "transition_failed", code: stopErr.message, message: mapped?.message ?? stopErr.message },
          mapped?.status ?? 409,
          corsHeaders,
        );
      }
      return jsonResponse({ transition: result, previous_phase: current, new_phase: desired }, 200, corsHeaders);
    }

    // ── Everything else is re-admitted now, on current content and context. ─
    const { data: proto } = await supabase
      .from("simulator_experiment_protocols")
      .select("*")
      .eq("experiment_id", experiment_id)
      .eq("user_id", userId)
      .order("protocol_version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!proto) {
      return jsonResponse(
        { error: "protocol_required", message: ERROR_MESSAGES.PROTOCOL_REQUIRED.message },
        409,
        corsHeaders,
      );
    }
    const protocol = proto as Record<string, unknown>;

    const proposal = proposalFromProtocolRow(protocol, experiment);
    const recomputedSha = await protocolContentHash(proposal);
    if (protocol.content_sha256 && protocol.content_sha256 !== recomputedSha) {
      return jsonResponse(
        {
          error: "protocol_changed",
          message: ERROR_MESSAGES.PROTOCOL_CHANGED.message,
          stored_sha256: protocol.content_sha256,
          recomputed_sha256: recomputedSha,
        },
        409,
        corsHeaders,
      );
    }

    const context = await loadAdmissionContext(supabase, userId, { isViewAs: owner.isViewAs });
    const assessment = assessProposal(proposal, context);
    if (!assessment.activation_allowed) {
      return jsonResponse(
        {
          error: "not_cleared_to_start",
          message: assessment.patient_message,
          admission: assessment,
        },
        403,
        corsHeaders,
      );
    }

    const { data: result, error: transErr } = await supabase.rpc("simulator_transition_phase", {
      p_user_id: userId,
      p_experiment_id: experiment_id,
      p_from_phase: current,
      p_to_phase: desired,
      p_protocol_id: protocol.id,
      p_protocol_sha: recomputedSha,
      p_admission: assessment,
      p_stopped_reason: null,
    });
    if (transErr) {
      const mapped = ERROR_MESSAGES[transErr.message ?? ""];
      return jsonResponse(
        { error: "transition_failed", code: transErr.message, message: mapped?.message ?? transErr.message },
        mapped?.status ?? 409,
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
    return jsonResponse({ error: message }, 500, corsHeaders);
  }
});
