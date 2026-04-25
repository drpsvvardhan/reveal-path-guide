// ============================================================================
// rae/signals/lexical.ts — Signal 1: lexical name match.
// Pure. Imports only from ../types.ts. Deterministic. No I/O.
// ============================================================================
import type {
  LexicalEvidence,
  SignalResult,
} from "../types.ts";

export interface LexicalInput {
  raw_name: string;
  /** Canonical concept display name. */
  canonical_name: string;
  /** Declared synonyms for the candidate concept (lowercased compared). */
  synonyms?: string[];
  /** Other concept names that also matched (ambiguity hint). */
  ambiguous_alternatives?: string[];
  /** Registry-declared weight for this signal. */
  weight: number;
  /** Fuzzy distance ceiling to accept as a partial match. Default 2. */
  fuzzy_ceiling?: number;
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Deterministic Levenshtein distance, no allocation games. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length, n = b.length;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a.charCodeAt(i - 1) === b.charCodeAt(j - 1)
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

export function evaluateLexical(input: LexicalInput): SignalResult {
  const raw = norm(input.raw_name ?? "");
  const canon = norm(input.canonical_name ?? "");
  const syns = (input.synonyms ?? []).map(norm);
  const ceiling = input.fuzzy_ceiling ?? 2;

  let band: SignalResult["band"];
  let score: number;
  let match_type: LexicalEvidence["match_type"];
  let matched_name: string | null = null;
  let distance: number | undefined;

  if (!raw) {
    const evidence: LexicalEvidence = {
      signal_id: "lexical",
      matched_name: null,
      match_type: "none",
    };
    return {
      signal_id: "lexical",
      band: "abstain",
      score: 0,
      weight: input.weight,
      contributes_to_denominator: false,
      evidence,
      notes: ["raw_name empty; lexical signal abstains"],
    };
  }

  if (raw === canon) {
    band = "pass";
    score = 1;
    match_type = "exact";
    matched_name = input.canonical_name;
  } else if (syns.includes(raw)) {
    band = "pass";
    score = 1;
    match_type = "synonym";
    matched_name = input.canonical_name;
  } else {
    const candidates = [canon, ...syns];
    let best = Infinity;
    for (const c of candidates) {
      const d = levenshtein(raw, c);
      if (d < best) best = d;
    }
    distance = best;
    if (best <= ceiling) {
      band = "partial";
      score = Math.max(0, 1 - best / (ceiling + 1));
      match_type = "fuzzy";
      matched_name = input.canonical_name;
    } else {
      band = "fail";
      score = 0;
      match_type = "none";
      matched_name = null;
    }
  }

  const evidence: LexicalEvidence = {
    signal_id: "lexical",
    matched_name,
    match_type,
    ...(distance !== undefined ? { distance } : {}),
    ...(input.ambiguous_alternatives && input.ambiguous_alternatives.length
      ? { ambiguous_alternatives: input.ambiguous_alternatives }
      : {}),
  };

  const notes: string[] = [];
  if (input.ambiguous_alternatives && input.ambiguous_alternatives.length) {
    notes.push(
      `ambiguous: also matched ${input.ambiguous_alternatives.length} alternative(s)`,
    );
  }

  return {
    signal_id: "lexical",
    band,
    score,
    weight: input.weight,
    contributes_to_denominator: true,
    evidence,
    notes,
  };
}