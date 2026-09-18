import { describe, expect, it } from "vitest";
import {
  containsInternalIdentifier,
  SAFE_FALLBACK_QUESTIONS,
  sanitizeSuggestedQuestions,
} from "../../supabase/functions/_shared/patientQuestionGuard";

describe("patient-facing suggested question guard", () => {
  const leaks = [
    // real shapes observed in the live rollout check
    "What does witness_id c9df00a7 say about my sleep?",
    "Why is witness 99043991-118a-422c-94b9-676d899878af flagged?",
    "How should I read observation_id 2fbf2fd1?",
    "What does state_hash 9f3ab12c7d55e0aa mean for me?",
    "Explain assessment_id a67c9c11-9817-4416-bfef-ecb185103577",
    "What does {cluster:abc123} tell me?",
    "Tell me about <placeholder> in my results",
    "Why does registry_seed_version 3.3.0 matter?",
    "What is my sha256 evidence fingerprint?",
    "What does user_id mean on my record?",
  ];

  it("flags every internal identifier / technical marker shape", () => {
    for (const q of leaks) {
      expect(containsInternalIdentifier(q), q).toBe(true);
    }
  });

  const clean = [
    "What does your ApoB at 128 mg/dL mean for your next few years?",
    "Which of my markers moved most since my last panel?",
    "My HbA1c is 5.4% — what is holding it steady?",
    "What is the smallest change that would matter most for me right now?",
    "Tell me what I should be paying attention to right now",
  ];

  it("keeps normal patient questions untouched", () => {
    for (const q of clean) {
      expect(containsInternalIdentifier(q), q).toBe(false);
    }
    const r = sanitizeSuggestedQuestions(clean.slice(0, 4));
    expect(r.questions).toEqual(clean.slice(0, 4));
    expect(r.dropped).toBe(0);
    expect(r.usedFallback).toBe(false);
  });

  it("drops leaking questions and tops up with safe fallbacks", () => {
    const r = sanitizeSuggestedQuestions([clean[0], leaks[0], leaks[1], clean[1]]);
    expect(r.dropped).toBe(2);
    expect(r.questions).toHaveLength(4);
    expect(r.questions.some((q) => containsInternalIdentifier(q))).toBe(false);
    expect(r.questions).toContain(clean[0]);
    expect(r.questions).toContain(clean[1]);
  });

  it("returns a readable safe fallback rather than broken text when all leak", () => {
    const r = sanitizeSuggestedQuestions(leaks);
    expect(r.usedFallback).toBe(true);
    expect(r.questions).toEqual([...SAFE_FALLBACK_QUESTIONS]);
    expect(r.questions.every((q) => q.trim().length > 0)).toBe(true);
  });

  it("validates values as non-empty strings", () => {
    const r = sanitizeSuggestedQuestions([
      "",
      "   ",
      null,
      undefined,
      42,
      { question: "x" },
      ["nested"],
      clean[2],
    ]);
    expect(r.questions[0]).toBe(clean[2]);
    expect(r.dropped).toBe(7);
    expect(r.questions.every((q) => typeof q === "string" && q.length > 0)).toBe(true);
  });

  it("handles non-array and empty input deterministically", () => {
    for (const bad of [undefined, null, "questions", {}, []]) {
      const r = sanitizeSuggestedQuestions(bad);
      expect(r.usedFallback).toBe(true);
      expect(r.questions).toEqual([...SAFE_FALLBACK_QUESTIONS]);
    }
  });

  it("collapses duplicates and normalises whitespace", () => {
    const r = sanitizeSuggestedQuestions([
      "  Which of my   markers moved most since my last panel?  ",
      "Which of my markers moved most since my last panel?",
    ]);
    expect(r.questions[0]).toBe("Which of my markers moved most since my last panel?");
    expect(r.questions.filter((q) => q.includes("moved most"))).toHaveLength(1);
  });
});
