// ============================================================================
// supabase/functions/_shared/contextBudget.ts
// ----------------------------------------------------------------------------
// Context budget guard (Ask My Twin, Release 0).
//
// The full-context prompt path is acceptable for Release 0. Silent
// truncation is not: a provider quietly dropping tail context would break
// exactly the grounding guarantees the Answer Receipt certifies. So the
// runtime refuses loudly instead of trimming silently — it is better to
// refuse than to silently break grounding.
//
// The budget is configurable via the CONTEXT_TOKEN_BUDGET env var and is
// deliberately set well below real provider context limits, so the guard
// fires before the provider ever gets the chance to truncate.
// ============================================================================

export const DEFAULT_CONTEXT_TOKEN_BUDGET = 150_000;

export function resolveContextTokenBudget(
  envValue: string | undefined | null
): number {
  if (!envValue) return DEFAULT_CONTEXT_TOKEN_BUDGET;
  const parsed = Number(envValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_CONTEXT_TOKEN_BUDGET;
  }
  return Math.floor(parsed);
}

export interface ContextBudgetCheck {
  withinBudget: boolean;
  estimatedTokens: number;
  budget: number;
}

export function checkContextBudget(
  estimatedTokens: number,
  budget: number
): ContextBudgetCheck {
  return {
    withinBudget: estimatedTokens <= budget,
    estimatedTokens,
    budget,
  };
}

// Quote-free (the doctor-question extractor must not fire on a fallback)
// and honest: the question was preserved, the system needs the bounded
// retrieval path — the patient is not told to shrink their own data.
export const CONTEXT_BUDGET_FALLBACK_MESSAGE = `**What this means:**
**From medical knowledge:** Your Twin currently holds more evidence than this answer path can safely read at once, so I'm not going to answer from a partial view of your data. Answering from a truncated context could silently drop the very measurements your question depends on, and every answer here must be traceable to your full governed record.

**What you can do:**
- This is a system limitation, not a problem with your data — your question has been recorded and this situation is flagged to the Vizzhy team so the bounded retrieval path can be prioritized.
- Narrower questions about a specific marker or time period may still work while this is being addressed.`;
