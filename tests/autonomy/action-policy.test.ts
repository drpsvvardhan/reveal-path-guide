// @vitest-environment node
// Regression tests for the authorization boundary itself: what the server will
// author and execute, and what it only saves as a proposal.
import { describe, expect, it } from "vitest";
import {
  ACTION_TEMPLATES,
  assessProposal,
  buildCanonicalAction,
  type AdmissionContext,
  type ProposalForReview,
} from "../../supabase/functions/_shared/autonomy/actionPolicy.ts";
import { executableContentHash } from "../../supabase/functions/_shared/autonomy/protocolContent.ts";

const readable: AdmissionContext = {
  biomarkers: ["ldl_c", "hba1c"],
  flags: [],
  available: true,
  cieSafetyHold: false,
  cieRecheckPending: false,
};

function walkPlan(overrides: Partial<ProposalForReview> = {}): ProposalForReview {
  const built = buildCanonicalAction({
    template_id: "morning_walk",
    intervention: {
      duration_min: 25,
      timing: "morning",
      frequency: "daily",
      intensity: "conversational_pace",
    },
    primary_outcome: { source: "manual", name: "energy", direction: "increase", cadence: "daily" },
    intervention_days: 21,
    run_in_days: 0,
  });
  if (!built.ok || !built.proposal) throw new Error(built.problems.join("; "));
  return { ...built.proposal, ...overrides };
}

describe("canonical server-owned actions", () => {
  it("builds an ordinary walk plan and admits it for immediate self-service start", () => {
    const assessment = assessProposal(walkPlan(), readable);
    expect(assessment.verdict).toBe("ADMIT");
    expect(assessment.activation_allowed).toBe(true);
    expect(assessment.clinician_review_required).toBe(false);
  });

  it("admits an ordinary consistent sleep window; a 480-minute window is not extreme exercise", () => {
    const built = buildCanonicalAction({
      template_id: "consistent_sleep_window",
      intervention: {
        timing: "fixed_bedtime_and_wake",
        frequency: "daily",
        duration_min: 480,
      },
      primary_outcome: { source: "manual", name: "sleep_quality", direction: "increase", cadence: "daily" },
      intervention_days: 21,
      run_in_days: 0,
    });
    expect(built.ok).toBe(true);
    const assessment = assessProposal(built.proposal!, readable);
    expect(assessment.verdict).toBe("ADMIT");
    expect(assessment.activation_allowed).toBe(true);
    expect(assessment.scope).not.toBe("extreme_exertion");
  });

  it("starts observation-only tracking even when no clinical context can be read", () => {
    const built = buildCanonicalAction({
      template_id: "symptom_tracking_only",
      intervention: { frequency: "daily" },
      primary_outcome: { source: "manual", name: "symptom", direction: "stabilize", cadence: "daily" },
      intervention_days: 14,
      run_in_days: 0,
    });
    const assessment = assessProposal(built.proposal!, {
      ...readable,
      biomarkers: [],
      available: false,
    });
    expect(assessment.verdict).toBe("ADMIT");
    expect(assessment.activation_allowed).toBe(true);
    expect(assessment.observation_only).toBe(true);
  });

  it("rejects parameters that are not exactly numbers", () => {
    const built = buildCanonicalAction({
      template_id: "morning_walk",
      intervention: {
        duration_min: "20 arbitrary text",
        timing: "morning",
        frequency: "daily",
        intensity: "conversational_pace",
      },
      primary_outcome: { source: "manual", name: "energy", direction: "increase", cadence: "daily" },
      intervention_days: 21,
      run_in_days: 0,
    });
    expect(built.ok).toBe(false);
    expect(built.problems.join(" ")).toMatch(/plain number/i);
  });

  it("rejects fields that are not part of the ready-made plan", () => {
    const built = buildCanonicalAction({
      template_id: "morning_walk",
      intervention: {
        duration_min: 25,
        timing: "morning",
        frequency: "daily",
        intensity: "conversational_pace",
        add_supplement: "berberine 500mg",
      },
      primary_outcome: { source: "manual", name: "energy", direction: "increase", cadence: "daily" },
      intervention_days: 21,
      run_in_days: 0,
    });
    expect(built.ok).toBe(false);
    expect(built.problems.join(" ")).toMatch(/not part of this ready-made plan/i);
  });

  it("rejects values outside the template's own bounds", () => {
    const built = buildCanonicalAction({
      template_id: "morning_walk",
      intervention: {
        duration_min: 400,
        timing: "morning",
        frequency: "daily",
        intensity: "conversational_pace",
      },
      primary_outcome: { source: "manual", name: "energy", direction: "increase", cadence: "daily" },
      intervention_days: 21,
      run_in_days: 0,
    });
    expect(built.ok).toBe(false);
  });

  it("every catalogue entry is buildable and either observation-only or bounded", () => {
    for (const template of ACTION_TEMPLATES) {
      expect(template.minInterventionDays).toBeLessThanOrEqual(template.maxInterventionDays);
      expect(Object.keys(template.fields).length).toBeGreaterThan(0);
      expect(template.allowedOutcomeSources.length).toBeGreaterThan(0);
    }
  });
});

describe("a template id cannot launder an intervention", () => {
  it("does not execute a plan whose text was edited while keeping the template id", () => {
    const smuggled = walkPlan({
      lever: "Start atorvastatin 40mg nightly and walk in the morning",
      rationale: "Double the dose while walking",
    });
    const assessment = assessProposal(smuggled, readable);
    expect(assessment.activation_allowed).toBe(false);
    expect(assessment.verdict).not.toBe("ADMIT");
  });

  it("does not execute when a nested stop criterion or co-intervention was added", () => {
    const smuggled = walkPlan({
      allowed_cointerventions: ["begin a 72 hour water fast"],
    });
    const assessment = assessProposal(smuggled, readable);
    expect(assessment.activation_allowed).toBe(false);
  });

  it("keeps a held source suggestion held even when rebuilt as a ready-made plan", () => {
    const assessment = assessProposal(walkPlan(), {
      ...readable,
      sourceCard: { verdict: "BLOCK", patient_safe: false, safety_flags: ["anaemia_unresolved"] },
    });
    expect(assessment.verdict).toBe("BLOCK");
    expect(assessment.activation_allowed).toBe(false);
    expect(assessment.scope).toBe("source_suggestion_held");
  });

  it("holds body-changing plans during an unresolved CIE safety handoff, but keeps reading and tracking open", () => {
    const assessment = assessProposal(walkPlan(), { ...readable, cieSafetyHold: true });
    expect(assessment.activation_allowed).toBe(false);
    expect(assessment.scope).toBe("cie_safety_handoff");
    expect(assessment.still_available.join(" ")).toMatch(/track/i);
  });

  it("does not treat an unreadable context as clearance for a body-changing plan", () => {
    const assessment = assessProposal(walkPlan(), { ...readable, available: false });
    expect(assessment.activation_allowed).toBe(false);
    expect(assessment.scope).toBe("safety_check_unavailable");
    expect(assessment.clinician_review_required).toBe(false);
    expect(assessment.context_available).toBe(false);
  });

  it("never lets a support session viewing the account start a plan", () => {
    const assessment = assessProposal(walkPlan(), { ...readable, isViewAs: true });
    expect(assessment.activation_allowed).toBe(false);
    expect(assessment.scope).toBe("view_as_session");
  });

  it("never auto-activates a free-form medication proposal, and never deletes it", () => {
    const proposal: ProposalForReview = {
      template_id: null,
      lever: "Increase my metformin to 1000mg twice daily",
      rationale: "my glucose is still high",
      hypothesis_question: "Would a higher dose settle my glucose?",
      perturbation_category: "food",
      intervention: { dose: "1000mg" },
      primary_outcome: { source: "manual", name: "energy", direction: "decrease", cadence: "daily" },
      run_in_days: 0,
      intervention_days: 28,
    };
    const assessment = assessProposal(proposal, readable);
    expect(assessment.activation_allowed).toBe(false);
    expect(assessment.clinician_review_required).toBe(true);
    expect(assessment.scope).toBe("medication_or_treatment_change");
    expect(assessment.next_steps.join(" ")).toMatch(/saved/i);
  });

  it("does not require a clinician merely because a hypothesis is uncertain", () => {
    const assessment = assessProposal(walkPlan({ confidence: 0.05 }), readable);
    expect(assessment.clinician_review_required).toBe(false);
    expect(assessment.activation_allowed).toBe(true);
  });
});

describe("executable content identity", () => {
  it("is unchanged by JSON property ordering, as a database round-trip produces", async () => {
    const proposal = walkPlan();
    const experiment = { lever: proposal.lever, rationale: proposal.rationale, predicted_deltas: [] };
    const first = await executableContentHash({ proposal, experiment });

    const reordered = JSON.parse(
      JSON.stringify({
        intervention_days: proposal.intervention_days,
        primary_outcome: {
          cadence: proposal.primary_outcome.cadence,
          direction: proposal.primary_outcome.direction,
          name: proposal.primary_outcome.name,
          source: proposal.primary_outcome.source,
          unit: proposal.primary_outcome.unit ?? null,
        },
        intervention: Object.fromEntries(Object.entries(proposal.intervention).reverse()),
        ...proposal,
      }),
    ) as ProposalForReview;
    const second = await executableContentHash({
      proposal: reordered,
      experiment: { predicted_deltas: [], rationale: proposal.rationale, lever: proposal.lever },
    });
    expect(second).toBe(first);
  });

  it("changes when any governed value changes", async () => {
    const proposal = walkPlan();
    const experiment = { lever: proposal.lever, rationale: proposal.rationale, predicted_deltas: [] };
    const first = await executableContentHash({ proposal, experiment });
    const edited = await executableContentHash({
      proposal: { ...proposal, intervention: { ...proposal.intervention, duration_min: 30 } },
      experiment,
    });
    expect(edited).not.toBe(first);
  });
});
