// ============================================================================
// design-experiment-protocol
// ----------------------------------------------------------------------------
// Saves a proposed plan as a draft experiment with a versioned protocol, and
// computes the admission decision ON THE SERVER from the actual proposed
// content and this person's own trusted context.
//
// The client cannot assert safety. clinician_review_required, admission_verdict,
// activation_allowed and patient_safe supplied in the request body are ignored.
// Saving and discussing a proposal is always allowed; only activation is gated,
// and activation happens in start-experiment-phase against this exact content.
// ============================================================================
import { authenticateRequest, resolveTargetUserId, jsonResponse } from "../_shared/auth.ts";
import { assessProposal, type ProposalForReview } from "../_shared/autonomy/actionPolicy.ts";
import { loadAdmissionContext } from "../_shared/autonomy/admissionContext.ts";
import { protocolContentHash } from "../_shared/autonomy/protocolContent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATEGORIES = ["food", "sleep", "movement", "stress", "timing", "recovery"];

interface RequestPayload extends Partial<ProposalForReview> {
  user_id?: string;
  source_card_id?: string | null;
  source_cluster_ids?: string[];
  source_terrain_render_id?: string | null;
  horizon_days?: number;
  min_observations_per_phase?: number;
  min_adherence_pct?: number;
  expected_direction?: string;
}

function validate(p: RequestPayload): string[] {
  const missing: string[] = [];
  if (!p.hypothesis_question || p.hypothesis_question.length < 8) missing.push("hypothesis_question");
  if (!p.perturbation_category || !CATEGORIES.includes(p.perturbation_category)) {
    missing.push("perturbation_category");
  }
  if (!p.lever) missing.push("lever");
  if (!p.rationale) missing.push("rationale");
  if (!p.primary_outcome?.name) missing.push("primary_outcome.name");
  if (!p.primary_outcome?.direction) missing.push("primary_outcome.direction");
  if (!p.primary_outcome?.cadence) missing.push("primary_outcome.cadence");
  if (!p.primary_outcome?.source) missing.push("primary_outcome.source");
  if (p.run_in_days == null || p.run_in_days < 0) missing.push("run_in_days");
  if (!p.intervention_days || p.intervention_days < 5) missing.push("intervention_days≥5");
  return missing;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authRes = await authenticateRequest(req);
    if (!authRes.ok) return jsonResponse(authRes.error.body, authRes.error.status, corsHeaders);

    const payload = (await req.json()) as RequestPayload;
    const missing = validate(payload);
    if (missing.length) {
      return jsonResponse({ error: "missing_fields", missing }, 400, corsHeaders);
    }

    // Identity binding: never trust the body alone.
    const owner = await resolveTargetUserId(authRes.auth, payload.user_id ?? null);
    if (!owner.ok) return jsonResponse(owner.error.body, owner.error.status, corsHeaders);
    const userId = owner.targetUserId;
    const supabase = authRes.auth.serviceClient;

    // Every supplied reference must belong to this person.
    let sourceCard: Record<string, unknown> | null = null;
    if (payload.source_card_id) {
      const { data: card } = await supabase
        .from("simulator_what_if_cards")
        .select("*")
        .eq("id", payload.source_card_id)
        .maybeSingle();
      if (!card || (card as Record<string, unknown>).user_id !== userId) {
        return jsonResponse(
          { error: "source_card_not_found", message: "That suggestion does not belong to this account." },
          403,
          corsHeaders,
        );
      }
      sourceCard = card as Record<string, unknown>;
    }

    // The proposal exactly as written, with server-owned fields stripped.
    const proposal: ProposalForReview = {
      template_id: typeof payload.template_id === "string" ? payload.template_id : null,
      lever: payload.lever!,
      rationale: payload.rationale!,
      hypothesis_question: payload.hypothesis_question!,
      perturbation_category: payload.perturbation_category!,
      intervention: payload.intervention ?? {},
      primary_outcome: payload.primary_outcome!,
      secondary_outcomes: payload.secondary_outcomes ?? [],
      hold_stable: payload.hold_stable ?? [],
      allowed_cointerventions: payload.allowed_cointerventions ?? [],
      stop_criteria: payload.stop_criteria ?? [],
      contraindications: payload.contraindications ?? [],
      run_in_days: payload.run_in_days ?? 0,
      intervention_days: payload.intervention_days!,
      washout_days: payload.washout_days ?? null,
      predicted_deltas: (sourceCard?.predicted_deltas as ProposalForReview["predicted_deltas"]) ??
        payload.predicted_deltas ?? [],
      confidence: (sourceCard?.confidence as number | null) ?? null,
    };

    const context = await loadAdmissionContext(supabase, userId, { isViewAs: owner.isViewAs });
    const assessment = assessProposal(proposal, context);
    const contentSha = await protocolContentHash(proposal);

    const { data: expInsert, error: expErr } = await supabase
      .from("simulator_experiments")
      .insert({
        user_id: userId,
        source_card_id: payload.source_card_id ?? null,
        lever: proposal.lever,
        rationale: proposal.rationale,
        predicted_deltas: proposal.predicted_deltas ?? [],
        horizon_days:
          payload.horizon_days ?? proposal.run_in_days + proposal.intervention_days,
        source_cluster_ids:
          (sourceCard?.source_cluster_ids as string[]) ?? payload.source_cluster_ids ?? [],
        source_terrain_render_id:
          (sourceCard?.source_terrain_render_id as string | null) ??
            payload.source_terrain_render_id ?? null,
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
        min_observations_per_phase: payload.min_observations_per_phase ?? 5,
        min_adherence_pct: payload.min_adherence_pct ?? 0.7,
        stop_criteria: proposal.stop_criteria,
        contraindications: proposal.contraindications,
        // Server-computed. Any client-supplied value for these was discarded.
        clinician_review_required: assessment.clinician_review_required,
        expected_direction: payload.expected_direction ?? proposal.primary_outcome.direction,
        admission_verdict: assessment.verdict,
        admission_reasons: assessment,
        activation_allowed: assessment.activation_allowed,
        content_sha256: contentSha,
        admission_context: {
          biomarker_count: context.biomarkers.length,
          flags: context.flags,
          sources: context.sources,
          is_view_as: owner.isViewAs,
        },
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
      },
      200,
      corsHeaders,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("design-experiment-protocol error:", message);
    return jsonResponse({ error: message }, 500, corsHeaders);
  }
});
