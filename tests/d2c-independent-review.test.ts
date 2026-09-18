import { describe, expect, it } from "vitest";
import { assessProposal, buildCanonicalAction } from "../supabase/functions/_shared/autonomy/actionPolicy";
import { draftFromTemplate, findTemplate } from "../src/lib/autonomy/templates";

const noClinicalData = { biomarkers: [], flags: [], available: true, cieSafetyHold: false, cieRecheckPending: false };
const draft = (id: string) => buildCanonicalAction(draftFromTemplate(findTemplate(id)!)).proposal!;

describe("independent D2C authority review", () => {
  it.each(["symptom_tracking_only", "consistent_sleep_window", "evening_screen_curfew"])(
    "%s remains available without a clinician or laboratory data",
    (id) => {
      const decision = assessProposal(draft(id), noClinicalData);
      expect(decision.activation_allowed).toBe(true);
      expect(decision.clinician_review_required).toBe(false);
    },
  );

  it("does not treat a numeric prefix as a bounded numeric parameter", () => {
    const proposal = draft("morning_walk");
    proposal.intervention.duration_min = "15 followed by an experimental infusion";
    expect(assessProposal(proposal, noClinicalData).activation_allowed).toBe(false);
  });

  it("does not grant a template's authority to an unrelated intervention title", () => {
    const proposal = draft("morning_walk");
    proposal.lever = "Administer an experimental infusion";
    expect(assessProposal(proposal, noClinicalData).activation_allowed).toBe(false);
  });

  it("does not certify evidence using a client supplied confidence score", () => {
    const proposal = { ...draft("evening_screen_curfew"), confidence: 1 };
    expect(assessProposal(proposal, noClinicalData).evidence_label).not.toBe("well_supported");
  });
});

it("admits canonical content after JSONB property reordering", () => {
  const p = draft("consistent_sleep_window");
  p.intervention = Object.fromEntries(Object.entries(p.intervention).reverse());
  p.primary_outcome = Object.fromEntries(Object.entries(p.primary_outcome).reverse()) as typeof p.primary_outcome;
  expect(assessProposal(p,noClinicalData).activation_allowed).toBe(true);
});
it("a pending CIE recheck holds changes but leaves tracking available", () => {
  const ctx={...noClinicalData,cieRecheckPending:true};
  expect(assessProposal(draft("consistent_sleep_window"),ctx).activation_allowed).toBe(false);
  expect(assessProposal(draft("symptom_tracking_only"),ctx).activation_allowed).toBe(true);
});
