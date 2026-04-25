// ============================================================================
// rae/signals/panel.ts — Signal 6: panel co-observation coherence.
// Pure. Imports only from ../types.ts.
// ============================================================================
import type { PanelEvidence, SignalResult } from "../types.ts";

export interface PanelSibling {
  observation_id: string;
  concept_id: string;
}

export interface PanelInput {
  /** Panel grouping key on the raw observation (e.g., requisition id). */
  panel_grouping_key: string | null;
  /** Sibling observations sharing the panel_grouping_key. */
  siblings: PanelSibling[];
  /** Concept IDs expected in this panel for the candidate concept. */
  expected_panel_concept_ids?: string[];
  /** Stable identifier for the matched panel (when applicable). */
  panel_id?: string | null;
  weight: number;
}

export function evaluatePanel(input: PanelInput): SignalResult {
  if (!input.panel_grouping_key) {
    const evidence: PanelEvidence = {
      signal_id: "panel",
      co_observation_ids: [],
      matched_panel: null,
      abstention_reason: "no panel_grouping_key",
    };
    return {
      signal_id: "panel",
      band: "abstain",
      score: 0,
      weight: input.weight,
      contributes_to_denominator: false,
      evidence,
      notes: ["observation not part of a panel; abstaining"],
    };
  }

  const expected = input.expected_panel_concept_ids ?? [];
  if (expected.length === 0) {
    const evidence: PanelEvidence = {
      signal_id: "panel",
      co_observation_ids: input.siblings.map((s) => s.observation_id),
      matched_panel: input.panel_id ?? null,
      abstention_reason: "no expected panel composition declared",
    };
    return {
      signal_id: "panel",
      band: "abstain",
      score: 0,
      weight: input.weight,
      contributes_to_denominator: false,
      evidence,
      notes: ["concept declares no panel expectations; abstaining"],
    };
  }

  const siblingConcepts = new Set(input.siblings.map((s) => s.concept_id));
  const present = expected.filter((c) => siblingConcepts.has(c));
  const missing = expected.filter((c) => !siblingConcepts.has(c));
  const ratio = present.length / expected.length;

  let band: SignalResult["band"];
  let score: number;
  const partial_panel_notes: string[] = [];
  const notes: string[] = [];

  if (ratio >= 1) {
    band = "pass";
    score = 1;
  } else if (ratio >= 0.5) {
    band = "partial";
    score = ratio;
    partial_panel_notes.push(
      `missing ${missing.length}/${expected.length}: ${missing.join(",")}`,
    );
  } else {
    band = "fail";
    score = 0;
    notes.push(
      `panel coverage ${(ratio * 100).toFixed(0)}% below 50%`,
    );
  }

  const evidence: PanelEvidence = {
    signal_id: "panel",
    co_observation_ids: input.siblings.map((s) => s.observation_id),
    matched_panel: input.panel_id ?? null,
    ...(partial_panel_notes.length ? { partial_panel_notes } : {}),
  };

  return {
    signal_id: "panel",
    band,
    score,
    weight: input.weight,
    contributes_to_denominator: true,
    evidence,
    notes,
  };
}