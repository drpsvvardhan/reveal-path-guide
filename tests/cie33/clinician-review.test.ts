// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  startIntake,
  applyCommand,
  permitResumption,
  latestEntries,
} from "../../supabase/functions/_shared/cie33/engine";
import type {
  IntakeState,
  AnswerInput,
} from "../../supabase/functions/_shared/cie33/engine";

const patient = "11111111-1111-4111-8111-111111111111";
const clinician = "22222222-2222-4222-8222-222222222222";
const authorizationId = "33333333-3333-4333-8333-333333333333";
const now = "2026-09-18T10:00:00.000Z";
const later = "2026-09-18T12:00:00.000Z";

function respond(state: IntakeState, override: Partial<AnswerInput> = {}) {
  const q = state.current!.instance;
  return applyCommand(
    state,
    {
      action: "answer",
      answer: {
        questionInstanceId: q.id,
        questionInstanceHash: q.instanceContentHash,
        semanticResponse:
          q.response.kind === "boolean"
            ? { kind: "boolean", value: false }
            : q.response.kind === "single_select"
              ? { kind: "single_select", optionId: q.response.options![0].id }
              : { kind: "short_text", text: "This is my own account." },
        negativeCapabilityConfirmed: true,
        ...override,
      },
    },
    crypto.randomUUID(),
    now,
  );
}

/** The safety sentinel is issued first; a positive answer holds the intake. */
function heldIntake(): IntakeState {
  const start = startIntake(patient, false, now);
  const held = respond(start, {
    semanticResponse: { kind: "boolean", value: true },
    negativeCapabilityConfirmed: undefined,
  });
  expect(held.phase).toBe("safety_hold");
  expect(held.safety).toBe("handoff_required");
  return held;
}

function permit(state: IntakeState, at = later) {
  const witnessId = latestEntries(state).find((e) => e.key === "safety")!
    .witness.id;
  return permitResumption(
    state,
    {
      reviewId: "44444444-4444-4444-8444-444444444444",
      authorizationId,
      clinicianUserId: clinician,
      sourceWitnessId: witnessId,
    },
    at,
  );
}

describe("CIE 3.3 clinician safety review — engine", () => {
  it("a patient can never self-clear a hold", () => {
    const held = heldIntake();
    for (const action of ["pause", "resume", "finish"] as const) {
      expect(() =>
        applyCommand(held, { action }, crypto.randomUUID(), later),
      ).toThrow(/SAFETY_HOLD|paused for a safety handoff/i);
    }
  });

  it("permit_resumption issues a FRESH safety sentinel and retains the original answer", () => {
    const held = heldIntake();
    const original = latestEntries(held).find((e) => e.key === "safety")!;
    const resumed = permit(held);

    expect(resumed.safety).toBe("recheck_required");
    expect(resumed.phase).toBe("active");
    expect(resumed.revision).toBe(held.revision + 1);
    // original answers and witnesses are untouched
    expect(resumed.entries).toHaveLength(held.entries.length);
    expect(resumed.entries[0]).toEqual(held.entries[0]);
    // a fresh, linked safety question is outstanding — not answered for them
    expect(resumed.current!.key).toBe("safety");
    expect(resumed.current!.revisesWitnessId).toBe(original.witness.id);
    expect(resumed.current!.instance.id).not.toBe(original.question.id);
    expect(resumed.safetyReview).toMatchObject({
      clinicianUserId: clinician,
      authorizationId,
      sourceWitnessId: original.witness.id,
      sourceRevision: held.revision,
      sourceStateHash: held.stateHash,
      permittedAt: later,
    });
  });

  it("is labelled permission to resume, not clearance: the hold reinstates on a fresh positive answer", () => {
    const resumed = permit(heldIntake());
    const reheld = respond(resumed, {
      semanticResponse: { kind: "boolean", value: true },
      negativeCapabilityConfirmed: undefined,
    });
    expect(reheld.safety).toBe("handoff_required");
    expect(reheld.phase).toBe("safety_hold");
    // Both the original and the fresh answer are preserved and linked.
    const safetyEntries = reheld.entries.filter((e) => e.key === "safety");
    expect(safetyEntries).toHaveLength(2);
    expect(safetyEntries[1].supersedes).toBe(safetyEntries[0].witness.id);
  });

  it("a negative fresh answer moves the intake on without ever being self-declared", () => {
    const resumed = permit(heldIntake());
    const cleared = respond(resumed, {
      semanticResponse: { kind: "boolean", value: false },
      negativeCapabilityConfirmed: true,
    });
    expect(cleared.safety).toBe("no_signal_reported");
    expect(cleared.phase).toBe("active");
  });

  it("failure to answer the fresh recheck is NOT clearance — the hold returns", () => {
    const resumed = permit(heldIntake());
    const options = resumed.current!.instance.missingnessOptions;
    expect(options.length).toBeGreaterThan(0);
    const unanswered = respond(resumed, {
      semanticResponse: undefined,
      negativeCapabilityConfirmed: undefined,
      missingness: { kind: options[0] },
    } as Partial<AnswerInput>);
    expect(unanswered.safety).toBe("handoff_required");
    expect(unanswered.phase).toBe("safety_hold");
  });

  it("rejects a disposition on an intake that is not held", () => {
    const start = startIntake(patient, false, now);
    expect(() =>
      permitResumption(
        start,
        {
          reviewId: "44444444-4444-4444-8444-444444444444",
          authorizationId,
          clinicianUserId: clinician,
          sourceWitnessId: "anything",
        },
        later,
      ),
    ).toThrow(/NOT_HELD|not on a safety hold/i);
  });

  it("rejects a stale safety witness reference", () => {
    const held = heldIntake();
    expect(() =>
      permitResumption(
        held,
        {
          reviewId: "44444444-4444-4444-8444-444444444444",
          authorizationId,
          clinicianUserId: clinician,
          sourceWitnessId: "55555555-5555-4555-8555-555555555555",
        },
        later,
      ),
    ).toThrow(/SAFETY_WITNESS_MISMATCH|Reload/i);
  });

  it("rejects self-review", () => {
    const held = heldIntake();
    const witnessId = latestEntries(held).find((e) => e.key === "safety")!
      .witness.id;
    expect(() =>
      permitResumption(
        held,
        {
          reviewId: "44444444-4444-4444-8444-444444444444",
          authorizationId,
          clinicianUserId: patient,
          sourceWitnessId: witnessId,
        },
        later,
      ),
    ).toThrow(/SELF_REVIEW_FORBIDDEN|own intake/i);
  });

  it("a second permit on an already-resumed intake is rejected", () => {
    const resumed = permit(heldIntake());
    expect(() => permit(resumed)).toThrow(/NOT_HELD|not on a safety hold/i);
  });
});
