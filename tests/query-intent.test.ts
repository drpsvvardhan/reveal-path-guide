// tests/query-intent.test.ts
//
// Deterministic query-intent classifier. No LLM in the answer path; first
// match wins; rule order is part of the contract. Classification is
// telemetry only and never affects the answer — these tests pin the
// classifier itself.

import { describe, it, expect } from "vitest";
import {
  classifyQueryIntent,
  QUERY_INTENTS,
} from "../supabase/functions/_shared/queryIntent.ts";

describe("classifyQueryIntent", () => {
  it("classifies the canonical beta questions", () => {
    const cases: Array<[string, string]> = [
      ["What changed since my last visit?", "WHAT_CHANGED"],
      ["What should I ask my doctor at my next visit?", "DOCTOR_PREP"],
      ["Is my statin working?", "MEDICATION"],
      ["How has my glucose been lately?", "GLUCOSE"],
      ["Why do I keep waking up at 4am — is my sleep okay?", "SLEEP"],
      ["What should I eat for breakfast?", "FOOD"],
      ["What did my genome actually find?", "GENETICS"],
      ["What is my biological age?", "AGING"],
      ["What is my Twin still unsure about?", "UNCERTAINTY"],
      ["How has my ApoB trended over time?", "TRAJECTORY"],
      ["What is my latest ferritin value?", "VALUE"],
      ["Why is my cholesterol high?", "WHY"],
      ["Tell me something interesting.", "OTHER"],
    ];
    for (const [q, expected] of cases) {
      expect(classifyQueryIntent(q).intent, q).toBe(expected);
    }
  });

  it("first match wins: specific intents beat generic shapes", () => {
    // Contains "why" and "over time", but WHAT_CHANGED is more specific
    // and ordered first.
    expect(
      classifyQueryIntent("Why has anything new changed since my last visit?")
        .intent
    ).toBe("WHAT_CHANGED");
    // "doctor" beats the trailing "why".
    expect(
      classifyQueryIntent("What should I discuss with my doctor and why?")
        .intent
    ).toBe("DOCTOR_PREP");
    // Domain signal (glucose) beats generic trajectory.
    expect(
      classifyQueryIntent("Show my blood sugar trend over the past year")
        .intent
    ).toBe("GLUCOSE");
  });

  it("names the matched rule, null only for OTHER", () => {
    expect(classifyQueryIntent("Why is my ApoB high?").matched_rule).toBe(
      "why"
    );
    expect(classifyQueryIntent("").matched_rule).toBeNull();
    expect(classifyQueryIntent("").intent).toBe("OTHER");
  });

  it("always returns a declared intent", () => {
    const qs = [
      "hello",
      "asdfgh",
      "Can you help me?",
      "What's my latest value of that thing?",
    ];
    for (const q of qs) {
      expect(QUERY_INTENTS).toContain(classifyQueryIntent(q).intent);
    }
  });
});
