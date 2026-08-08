// tests/context-budget.test.ts
//
// Context budget guard — it is better to refuse than to silently break
// grounding. No silent truncation, ever (docs/ASK_MY_TWIN_CONSTITUTION.md).

import { describe, it, expect } from "vitest";
import {
  resolveContextTokenBudget,
  checkContextBudget,
  DEFAULT_CONTEXT_TOKEN_BUDGET,
  CONTEXT_BUDGET_FALLBACK_MESSAGE,
} from "../supabase/functions/_shared/contextBudget.ts";

describe("resolveContextTokenBudget", () => {
  it("defaults when unset", () => {
    expect(resolveContextTokenBudget(undefined)).toBe(
      DEFAULT_CONTEXT_TOKEN_BUDGET
    );
    expect(resolveContextTokenBudget(null)).toBe(DEFAULT_CONTEXT_TOKEN_BUDGET);
    expect(resolveContextTokenBudget("")).toBe(DEFAULT_CONTEXT_TOKEN_BUDGET);
  });

  it("rejects garbage and non-positive values", () => {
    expect(resolveContextTokenBudget("not-a-number")).toBe(
      DEFAULT_CONTEXT_TOKEN_BUDGET
    );
    expect(resolveContextTokenBudget("-5")).toBe(DEFAULT_CONTEXT_TOKEN_BUDGET);
    expect(resolveContextTokenBudget("0")).toBe(DEFAULT_CONTEXT_TOKEN_BUDGET);
  });

  it("accepts a configured integer budget", () => {
    expect(resolveContextTokenBudget("200000")).toBe(200000);
    expect(resolveContextTokenBudget("120000.9")).toBe(120000);
  });
});

describe("checkContextBudget", () => {
  it("is within budget at and below the boundary", () => {
    expect(checkContextBudget(100, 100).withinBudget).toBe(true);
    expect(checkContextBudget(99, 100).withinBudget).toBe(true);
  });

  it("exceeds strictly above the boundary", () => {
    const r = checkContextBudget(101, 100);
    expect(r.withinBudget).toBe(false);
    expect(r.estimatedTokens).toBe(101);
    expect(r.budget).toBe(100);
  });
});

describe("CONTEXT_BUDGET_FALLBACK_MESSAGE", () => {
  it("contains no extractable doctor question", () => {
    const quotePattern = /["“”'‘’]([^"“”'‘’]+?)["“”'‘’]/g;
    const quoted = [...CONTEXT_BUDGET_FALLBACK_MESSAGE.matchAll(quotePattern)]
      .map((m) => m[1])
      .filter((q) => q.includes("?") && q.length >= 10);
    expect(quoted).toEqual([]);
  });

  it("never asks the patient to shrink their own data", () => {
    expect(CONTEXT_BUDGET_FALLBACK_MESSAGE.toLowerCase()).not.toContain(
      "delete"
    );
    expect(CONTEXT_BUDGET_FALLBACK_MESSAGE).toContain("system limitation");
  });
});
