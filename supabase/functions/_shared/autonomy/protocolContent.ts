// ============================================================================
// Protocol content binding
// ----------------------------------------------------------------------------
// An admission decision is bound to the exact protocol content it was computed
// from. If any governed field changes, the hash changes, and a stale decision
// can no longer be used to start anything.
// ============================================================================

import type { ProposalForReview } from "./actionPolicy.ts";

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, stable(v)]),
    );
  }
  return value;
}

/** The governed content of a protocol, in a canonical byte order. */
export function canonicalProtocolContent(p: ProposalForReview): string {
  return JSON.stringify(
    stable({
      template_id: p.template_id ?? null,
      lever: p.lever ?? "",
      hypothesis_question: p.hypothesis_question ?? "",
      perturbation_category: p.perturbation_category ?? "",
      intervention: p.intervention ?? {},
      primary_outcome: p.primary_outcome ?? {},
      secondary_outcomes: p.secondary_outcomes ?? [],
      hold_stable: p.hold_stable ?? [],
      allowed_cointerventions: p.allowed_cointerventions ?? [],
      stop_criteria: p.stop_criteria ?? [],
      contraindications: p.contraindications ?? [],
      run_in_days: p.run_in_days ?? 0,
      intervention_days: p.intervention_days ?? 0,
      washout_days: p.washout_days ?? null,
    }),
  );
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function protocolContentHash(p: ProposalForReview): Promise<string> {
  return `sha256:${await sha256Hex(canonicalProtocolContent(p))}`;
}

/** Rebuild the reviewable proposal from a stored protocol row. */
export function proposalFromProtocolRow(
  row: Record<string, unknown>,
  experiment: Record<string, unknown>,
): ProposalForReview {
  return {
    template_id: (row.template_id as string | null) ?? null,
    lever: (experiment.lever as string) ?? "",
    rationale: (experiment.rationale as string) ?? "",
    hypothesis_question: (row.hypothesis_question as string) ?? "",
    perturbation_category: (row.perturbation_category as string) ?? "",
    intervention: (row.intervention as Record<string, unknown>) ?? {},
    primary_outcome: row.primary_outcome as ProposalForReview["primary_outcome"],
    secondary_outcomes: (row.secondary_outcomes as unknown[]) ?? [],
    hold_stable: (row.hold_stable as string[]) ?? [],
    allowed_cointerventions: (row.allowed_cointerventions as string[]) ?? [],
    stop_criteria: (row.stop_criteria as string[]) ?? [],
    contraindications: (row.contraindications as string[]) ?? [],
    run_in_days: (row.run_in_days as number) ?? 0,
    intervention_days: (row.intervention_days as number) ?? 0,
    washout_days: (row.washout_days as number | null) ?? null,
    predicted_deltas: (experiment.predicted_deltas as ProposalForReview["predicted_deltas"]) ?? [],
    confidence: null,
  };
}
