// ============================================================================
// design-experiment-protocol
// ----------------------------------------------------------------------------
// Saves a plan as a draft experiment with a versioned protocol, and computes
// the admission decision ON THE SERVER.
//
// Two paths, deliberately separate:
//
//   READY-MADE PLAN  (template_id present)
//     The server rebuilds the whole executable content itself from the
//     catalogue entry plus strictly typed bounded parameters. Client wording is
//     never executable: the patient's own words are stored as a note. If the
//     parameters do not fit the catalogue entry, nothing is executable and the
//     request is saved as a proposal instead.
//
//   PROPOSAL  (no template_id)
//     Stored exactly as written, readable, editable, discussable — and never
//     activatable. No flag in the request body can change that.
//
// Client-supplied clinician_review_required, admission_verdict,
// activation_allowed, patient_safe and confidence are ignored entirely.
// ============================================================================
import { authenticateRequest, resolveTargetUserId, jsonResponse } from "../_shared/auth.ts";
import {
  assessProposal,
  buildCanonicalAction,
  findTemplate,
  type ProposalForReview,
} from "../_shared/autonomy/actionPolicy.ts";
import { loadAdmissionContext } from "../_shared/autonomy/admissionContext.ts";
import {
  protocolContentHash,
  executableContentHash,
} from "../_shared/autonomy/protocolContent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATEGORIES = ["food", "sleep", "movement", "stress", "timing", "recovery"];

interface RequestPayload {
  user_id?: string;
  source_card_id?: string | null;
  template_id?: string | null;
  lever?: string;
  rationale?: string;
  hypothesis_question?: string;
  perturbation_category?: string;
  intervention?: Record<string, unknown>;
  primary_outcome?: Record<string, unknown>;
  secondary_outcomes?: unknown[];
  hold_stable?: string[];
  allowed_cointerventions?: string[];
  stop_criteria?: string[];
  contraindications?: string[];
  run_in_days?: number;
  intervention_days?: number;
  washout_days?: number | null;
  min_observations_per_phase?: number;
  min_adherence_pct?: number;
  patient_note?: string | null;
}

function validateProposal(p: RequestPayload): string[] {
  const missing: string[] = [];
  if (!p.hypothesis_question || p.hypothesis_question.length < 8) missing.push("hypothesis_question");
  if (!p.perturbation_category || !CATEGORIES.includes(p.perturbation_category)) {
    missing.push("perturbation_category");
  }
  if (!p.lever) missing.push("lever");
  if (!p.rationale) missing.push("rationale");
  const o = (p.primary_outcome ?? {}) as Record<string, unknown>;
  if (!o.name) missing.push("primary_outcome.name");
  if (!o.direction) missing.push("primary_outcome.direction");
  if (!o.cadence) missing.push("primary_outcome.cadence");
  if (!o.source) missing.push("primary_outcome.source");
  if (p.run_in_days == null || p.run_in_days < 0) missing.push("run_in_days");
  if (!p.intervention_days || p.intervention_days < 5) missing.push("intervention_days≥5");
  return missing;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405, corsHeaders);
  try {
    const authRes = await authenticateRequest(req);
    if (!authRes.ok) return jsonResponse(authRes.error.body, authRes.error.status, corsHeaders);

    const payload = await req.json().catch(() => null) as RequestPayload | null;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return jsonResponse({ error: "invalid_request" }, 400, corsHeaders);
    }

    // Identity binding: never trust the body alone.
    const owner = await resolveTargetUserId(authRes.auth, payload.user_id ?? null);
    if (!owner.ok) return jsonResponse(owner.error.body, owner.error.status, corsHeaders);
    const userId = owner.targetUserId;
    const supabase = authRes.auth.serviceClient;

    // Every supplied reference must belong to this person. Cluster and terrain
    // references are taken from the verified card only — never from the body.
    let sourceCard: Record<string, unknown> | null = null;
    if (payload.source_card_id) {
      const { data: card, error: cardErr } = await supabase
        .from("simulator_what_if_cards")
        .select("*")
        .eq("id", payload.source_card_id)
        .maybeSingle();
      if (cardErr) throw cardErr;
      if (!card || (card as Record<string, unknown>).user_id !== userId) {
        return jsonResponse(
          { error: "source_card_not_found", message: "That suggestion does not belong to this account." },
          403,
          corsHeaders,
        );
      }
      sourceCard = card as Record<string, unknown>;
    }

    // ---- Build the content that will actually be stored ---------------------
    const requestedTemplate = findTemplate(payload.template_id ?? null);
    let proposal: ProposalForReview;
    let canonicalProblems: string[] = [];

    if (requestedTemplate) {
      const built = buildCanonicalAction({
        template_id: requestedTemplate.id,
        intervention: payload.intervention ?? {},
        primary_outcome: (payload.primary_outcome ?? {}) as Record<string, unknown>,
        intervention_days: payload.intervention_days,
        run_in_days: payload.run_in_days,
        patient_note: payload.patient_note ?? null,
      });
      if (built.ok && built.proposal) {
        proposal = built.proposal;
      } else {
        // The parameters do not fit the catalogue entry. Keep what the patient
        // wrote, as a proposal, with no template claim attached to it.
        canonicalProblems = built.problems;
        const missing = validateProposal(payload);
        if (missing.length) return jsonResponse({ error: "missing_fields", missing }, 400, corsHeaders);
        proposal = {
          template_id: null,
          lever: payload.lever!,
          rationale: payload.rationale!,
          hypothesis_question: payload.hypothesis_question!,
          perturbation_category: payload.perturbation_category!,
          intervention: payload.intervention ?? {},
          primary_outcome: payload.primary_outcome as unknown as ProposalForReview["primary_outcome"],
          secondary_outcomes: payload.secondary_outcomes ?? [],
          hold_stable: payload.hold_stable ?? [],
          allowed_cointerventions: payload.allowed_cointerventions ?? [],
          stop_criteria: payload.stop_criteria ?? [],
          contraindications: payload.contraindications ?? [],
          run_in_days: payload.run_in_days ?? 0,
          intervention_days: payload.intervention_days!,
          washout_days: payload.washout_days ?? null,
          predicted_deltas: [],
          confidence: null,
          patient_note: payload.patient_note ?? null,
        };
      }
    } else {
      const missing = validateProposal(payload);
      if (missing.length) return jsonResponse({ error: "missing_fields", missing }, 400, corsHeaders);
      proposal = {
        template_id: null,
        lever: payload.lever!,
        rationale: payload.rationale!,
        hypothesis_question: payload.hypothesis_question!,
        perturbation_category: payload.perturbation_category!,
        intervention: payload.intervention ?? {},
        primary_outcome: payload.primary_outcome as unknown as ProposalForReview["primary_outcome"],
        secondary_outcomes: payload.secondary_outcomes ?? [],
        hold_stable: payload.hold_stable ?? [],
        allowed_cointerventions: payload.allowed_cointerventions ?? [],
        stop_criteria: payload.stop_criteria ?? [],
        contraindications: payload.contraindications ?? [],
        run_in_days: payload.run_in_days ?? 0,
        intervention_days: payload.intervention_days!,
        washout_days: payload.washout_days ?? null,
        // Predictions come from the owner-verified card, never the body.
        predicted_deltas: (sourceCard?.predicted_deltas as ProposalForReview["predicted_deltas"]) ?? [],
        confidence: null,
        patient_note: payload.patient_note ?? null,
      };
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
    if (canonicalProblems.length) {
      assessment.reasons = [...canonicalProblems, ...assessment.reasons];
    }

    const experimentContent = {
      lever: proposal.lever,
      rationale: proposal.rationale,
      predicted_deltas: proposal.predicted_deltas ?? [],
      source_card_id: payload.source_card_id ?? null,
      source_cluster_ids: (sourceCard?.source_cluster_ids as string[]) ?? [],
      source_terrain_render_id: (sourceCard?.source_terrain_render_id as string | null) ?? null,
    };
    const contentSha = await protocolContentHash(proposal);
    const executableSha = await executableContentHash({ proposal, experiment: experimentContent });

    const { data: expInsert, error: expErr } = await supabase
      .from("simulator_experiments")
      .insert({
        user_id: userId,
        ...experimentContent,
        horizon_days: proposal.run_in_days + proposal.intervention_days,
        status: "active",
        phase: "draft",
        phase_started_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (expErr) throw expErr;

    const { data: protoInsert, error: protoErr } = await supabase
      .from("simulator_experiment_protocols")
      .insert({
        experiment_id: (expInsert as Record<string, unknown>).id,
        user_id: userId,
        protocol_version: 1,
        template_id: proposal.template_id,
        hypothesis_question: proposal.hypothesis_question,
        perturbation_category: proposal.perturbation_category,
        intervention: proposal.intervention,
        primary_outcome: proposal.primary_outcome,
        secondary_outcomes: proposal.secondary_outcomes,
        hold_stable: proposal.hold_stable,
        allowed_cointerventions: proposal.allowed_cointerventions,
        run_in_days: proposal.run_in_days,
        intervention_days: proposal.intervention_days,
        washout_days: proposal.washout_days,
        crossover: null,
        min_observations_per_phase: 5,
        min_adherence_pct: 0.7,
        stop_criteria: proposal.stop_criteria,
        contraindications: proposal.contraindications,
        patient_note: proposal.patient_note,
        // Server-computed. Any client-supplied value for these was discarded.
        clinician_review_required: assessment.clinician_review_required,
        expected_direction: proposal.primary_outcome.direction,
        admission_verdict: assessment.verdict,
        admission_reasons: assessment,
        activation_allowed: assessment.activation_allowed,
        content_sha256: contentSha,
        executable_sha256: executableSha,
        admission_context: {
          fingerprint: context.fingerprint,
          available: context.available,
          unavailable_reason: context.unavailable_reason,
          flags: context.flags,
          biomarker_count: context.biomarkers.length,
          cie_safety_hold: context.cieSafetyHold,
          cie_recheck_pending: context.cieRecheckPending,
          sources: context.sources,
          is_view_as: owner.isViewAs,
        },
        admission_context_fingerprint: context.fingerprint,
        admission_computed_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (protoErr) throw protoErr;

    if (payload.source_card_id) {
      await supabase
        .from("simulator_what_if_cards")
        .update({ committed_experiment_id: (expInsert as Record<string, unknown>).id })
        .eq("id", payload.source_card_id)
        .eq("user_id", userId);
    }

    return jsonResponse(
      {
        experiment: expInsert,
        protocol: protoInsert,
        admission: assessment,
        protocol_content_sha256: contentSha,
        executable_sha256: executableSha,
      },
      200,
      corsHeaders,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("design-experiment-protocol error:", message);
    return jsonResponse({ error: "design_failed", message }, 500, corsHeaders);
  }
});
