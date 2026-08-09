// tests/biotwin-gate-precision.test.ts
//
// BioTwin output-gate precision — regression suite from the first live
// smoke (Aug 9): a benign "what should I pay attention to" answer was
// replaced by the governance template because the prohibition scan counted
// scattered tokens across the whole output, ignored negation, and the
// medication hold matched "you are on the right track".
//
// The gate's contract: block ASSERTION of prohibited claims and hold
// breaches; never block the honest statement that a claim is retired,
// unsupported, or unconfirmed. Scar discipline (constitution rule 8)
// REQUIRES the honest statement — a gate that punishes it inverts the
// product: the richer the twin, the less it could say.

import { describe, it, expect } from "vitest";
import {
  validateBiotwinOutput,
  EMPTY_BIOTWIN_PACKET,
  biotwinReplacementMessage,
  type BiotwinPacket,
} from "../supabase/functions/_shared/biotwin/packet.ts";

// Peter-class packet: many short scar prohibitions + always-on holds —
// exactly the shape the Release Compiler emits for a mature twin.
const packet: BiotwinPacket = {
  ...EMPTY_BIOTWIN_PACKET,
  has_report: true,
  report_id: "r1",
  holds: ["medication_hold", "decision_grade_hold", "pgx_hold"],
  prohibited_headlines: [
    "chronic short sleep",
    "severe sleep deficit",
    "sleeping five hours",
    "sleep is the single highest-yield lever",
    "favorable clocks are real",
    "aging slowly",
    "genuine resilience",
    "You have insulin resistance.",
  ],
};

// The exact answer shape suppressed in the live smoke.
const benignAnswer = `**What this means:**
**From your data:** The clearest thing to pay attention to right now is your measured particle burden, which your report confirms and ranks first. Your sleep is adequate over the measured window — your record does not show chronic short sleep, and the earlier deficit reading was retracted. Your aging clocks are held as unconfirmed, so we cannot yet say the favorable clocks are real.

**What you can do:**
- You are on the right track with the measurement plan your report lays out.
- Keep the repeat panel appointment; it is what would settle the open question.`;

describe("live-smoke regression — benign answers pass", () => {
  it("the suppressed Aug 9 answer is admitted", () => {
    const r = validateBiotwinOutput(benignAnswer, packet);
    expect(r.violations).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it("'you are on the right track' does not breach the medication hold", () => {
    const r = validateBiotwinOutput(
      "You are on the right track, and you are on a good path with the plan.",
      packet
    );
    expect(r.valid).toBe(true);
  });

  it("negated / retirement statements of a scar are the REQUIRED wording, not violations", () => {
    for (const honest of [
      "Your record does not show chronic short sleep.",
      "The earlier severe sleep deficit reading was retracted and corrected.",
      "We cannot yet say the favorable clocks are real; that remains unconfirmed.",
      "Sleep is not the single highest-yield lever for you.",
    ]) {
      expect(validateBiotwinOutput(honest, packet).valid, honest).toBe(true);
    }
  });

  it("tokens scattered across different sentences never combine", () => {
    // 'favorable' + 'clocks' + 'real' all present, but in separate sentences.
    const r = validateBiotwinOutput(
      "Your clocks were measured twice. The trend looks favorable to your team. The plan is making real progress.",
      packet
    );
    expect(r.valid).toBe(true);
  });
});

describe("true assertions still never cross", () => {
  it("direct assertion of a short scar prohibition is blocked", () => {
    for (const bad of [
      "You have chronic short sleep.",
      "Your data shows a severe sleep deficit.",
      "You are sleeping five hours a night.",
      "You have insulin resistance, so start treatment.",
    ]) {
      const r = validateBiotwinOutput(bad, packet);
      expect(r.valid, bad).toBe(false);
      expect(r.violations.some((v) => v.kind === "prohibited_headline")).toBe(
        true
      );
    }
  });

  it("same-sentence paraphrase of a long prohibition is blocked (>=85% overlap)", () => {
    const r = validateBiotwinOutput(
      "For you, sleep remains the single highest yield lever available.",
      packet
    );
    expect(r.valid).toBe(false);
  });

  it("medication status assertions and directives still breach the hold", () => {
    for (const bad of [
      "You are taking a statin already.",
      "You are on metformin.",
      "You should increase your statin dose.",
    ]) {
      const r = validateBiotwinOutput(bad, packet);
      expect(r.valid, bad).toBe(false);
      expect(r.violations.some((v) => v.kind === "hold_violation")).toBe(true);
    }
  });
});

describe("fallback template", () => {
  it("carries no extractable doctor question", () => {
    const msg = biotwinReplacementMessage(packet);
    const quotePattern = /["“”'‘’]([^"“”'‘’]+?)["“”'‘’]/g;
    const quoted = [...msg.matchAll(quotePattern)]
      .map((m) => m[1])
      .filter((q) => q.includes("?") && q.length >= 10);
    expect(quoted).toEqual([]);
  });

  it("ends with agency, not a dead end", () => {
    expect(biotwinReplacementMessage(packet)).toContain("What you can do");
  });
});
