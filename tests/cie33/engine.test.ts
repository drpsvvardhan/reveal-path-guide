// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  startIntake,
  applyCommand,
  latestEntries,
} from "../../supabase/functions/_shared/cie33/engine";
import type {
  IntakeState,
  AnswerInput,
} from "../../supabase/functions/_shared/cie33/engine";
import { FOUNDATION } from "../../supabase/functions/_shared/cie33/foundation";
const user = "11111111-1111-4111-8111-111111111111";
const now = "2026-09-18T10:00:00.000Z";
export function answer(
  state: IntakeState,
  override: Partial<AnswerInput> = {},
) {
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
export function completeFoundation(sensitive = false): IntakeState {
  let state = startIntake(user, sensitive, now);
  for (let i = 0; i < 64 && state.phase === "active"; i++)
    state = answer(state);
  return applyCommand(state, { action: "finish" }, crypto.randomUUID(), now);
}
describe("CIE 3.3 Foundation integration", () => {
  it("issues the exact locked safety sentinel first and completes all 32 core questions without legacy scores", () => {
    const initial = startIntake(user, false, now);
    expect(initial.current!.instance.promptRendered).toBe(FOUNDATION[0].prompt);
    const complete = completeFoundation();
    expect(complete.phase).toBe("complete");
    expect(complete.entries).toHaveLength(32);
    expect(
      complete.entries.every(
        (e) => e.witness.commit && e.witness.subjectId === user,
      ),
    ).toBe(true);
    expect(complete).not.toHaveProperty("score");
  });
  it("keeps unknown distinct from negative and does not declare safety clearance", () => {
    const state = answer(startIntake(user, false, now), {
      semanticResponse: undefined,
      missingness: { kind: "unknown" },
    });
    expect(state.entries[0].witness.assertionPolarity).toBe("not_asserted");
    expect(state.entries[0].witness.payload).toBeUndefined();
    expect(state.safety).toBe("insufficient_coverage");
  });
  it("blocks all self-service transitions after a positive safety answer", () => {
    const state = answer(startIntake(user, false, now), {
      semanticResponse: { kind: "boolean", value: true },
    });
    expect(state.phase).toBe("safety_hold");
    expect(state.current).toBeUndefined();
    for (const action of ["finish", "resume", "pause"] as const)
      expect(() =>
        applyCommand(state, { action }, crypto.randomUUID(), now),
      ).toThrow("cannot be self-cleared");
  });
  it("rejects false without an observation capability confirmation", () => {
    expect(() =>
      answer(startIntake(user, false, now), {
        negativeCapabilityConfirmed: false,
      }),
    ).toThrow("Confirm");
  });
  it("rejects forged booleans, missingness and question bindings", () => {
    const state = startIntake(user, false, now);
    expect(() =>
      answer(state, {
        semanticResponse: { kind: "boolean", value: "false" } as never,
      }),
    ).toThrow("Yes or No");
    expect(() =>
      answer(state, {
        semanticResponse: undefined,
        missingness: { kind: "not_asked" },
      }),
    ).toThrow("missingness");
    expect(() =>
      answer(state, { questionInstanceId: crypto.randomUUID() }),
    ).toThrow("question has changed");
    expect(() => answer(state, { missingness: { kind: "unknown" } })).toThrow(
      "exactly one",
    );
  });
  it("requires reasons for not applicable and temporarily unable", () => {
    const state = startIntake(user, false, now);
    expect(() =>
      answer(state, {
        semanticResponse: undefined,
        missingness: { kind: "not_applicable", reason: "" },
      }),
    ).toThrow("Explain");
    expect(() =>
      answer(state, {
        semanticResponse: undefined,
        missingness: { kind: "temporarily_unable", reason: "made_up" } as never,
      }),
    ).toThrow("Choose why");
  });
  it("rejects unoffered choice values and preserves text exactly", () => {
    let state = startIntake(user, false, now);
    while (state.current?.key !== "goals") state = answer(state);
    const exact = "  I want to walk again.\nThis matters to me.  ";
    state = answer(state, {
      semanticResponse: { kind: "short_text", text: exact },
    });
    expect(state.entries.at(-1)!.witness.payload?.exactSourceText).toBe(exact);
    while (state.current?.key !== "function") state = answer(state);
    expect(() =>
      answer(state, {
        semanticResponse: { kind: "single_select", optionId: "fake" },
      }),
    ).toThrow("offered");
  });
  it("adds sensitive questions only under explicit consent and follow-ups only when indicated", () => {
    expect(completeFoundation(true).entries).toHaveLength(34);
    let state = startIntake(user, false, now);
    state = answer(state);
    expect(state.current?.key).toBe("nicotine");
    state = answer(state, {
      semanticResponse: { kind: "boolean", value: true },
    });
    while (state.phase === "active") state = answer(state);
    expect(state.entries.some((e) => e.key === "nicotine-details")).toBe(true);
    expect(state.entries.some((e) => e.key === "medication-details")).toBe(
      false,
    );
  });
  it("appends corrections without rewriting the previous witness", () => {
    let state = completeFoundation();
    const before = state.entries[4];
    state = applyCommand(
      state,
      { action: "revise", witnessId: before.witness.id },
      crypto.randomUUID(),
      now,
    );
    state = answer(state, {
      semanticResponse: { kind: "short_text", text: "A corrected account." },
    });
    expect(state.entries[4]).toEqual(before);
    expect(state.entries.at(-1)!.supersedes).toBe(before.witness.id);
    expect(latestEntries(state)).toHaveLength(32);
    expect(state.phase).toBe("review");
  });
  it("resumes a correction with its lineage and issues a new immutable question", () => {
    let state = completeFoundation();
    const witnessId = state.entries[4].witness.id;
    state = applyCommand(
      state,
      { action: "revise", witnessId },
      crypto.randomUUID(),
      now,
    );
    const original = state.current!.instance;
    state = applyCommand(state, { action: "pause" }, crypto.randomUUID(), now);
    state = applyCommand(state, { action: "resume" }, crypto.randomUUID(), now);
    expect(state.current!.instance.id).not.toBe(original.id);
    expect(state.current!.revisesWitnessId).toBe(witnessId);
  });
  it("rejects expired questions using server time, incomplete finish and tampered saved state", () => {
    const state = startIntake(user, false, now);
    expect(() =>
      applyCommand(state, { action: "finish" }, crypto.randomUUID(), now),
    ).toThrow("Review");
    expect(() =>
      applyCommand(
        { ...state, subjectId: crypto.randomUUID() },
        { action: "pause" },
        crypto.randomUUID(),
        now,
      ),
    ).toThrow("verified");
    const q = state.current!.instance;
    expect(() =>
      applyCommand(
        state,
        {
          action: "answer",
          answer: {
            questionInstanceId: q.id,
            questionInstanceHash: q.instanceContentHash,
            semanticResponse: { kind: "boolean", value: false },
            negativeCapabilityConfirmed: true,
          },
        },
        crypto.randomUUID(),
        "2026-09-20T10:00:00Z",
      ),
    ).toThrow("Refresh");
  });
});
