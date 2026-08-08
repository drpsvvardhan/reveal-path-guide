// ============================================================================
// src/lib/biotwin/suggestedQuestions.ts
// ----------------------------------------------------------------------------
// Deterministic suggested questions for the Ask My Twin home.
//
// Rules (docs/ASK_MY_TWIN_CONSTITUTION.md):
//   - No LLM. Questions are templates over the deterministic Brief.
//   - The Brief already contains only patient-releasable material, so no
//     suggestion can name evidence held from patient release.
//   - Version questions state version facts — never "what changed in my
//     biology" until the diff engine earns that phrase.
// ============================================================================

import type { BiologicalIntelligenceBrief } from "./brief";

export const MAX_SUGGESTIONS = 5;

export function buildSuggestedQuestions(
  brief: BiologicalIntelligenceBrief
): string[] {
  const suggestions: string[] = [];

  if (brief.state === "released") {
    const topDriver = brief.what_matters_now[0];
    if (topDriver) {
      suggestions.push(`Why does "${topDriver.title}" matter for me?`);
    }
    if (brief.watching_next.items.length > 0) {
      suggestions.push("What are we testing next, and why?");
    }
    if (brief.still_learning.items.length > 0) {
      suggestions.push("What is my Twin still unsure about?");
    }
    if (
      brief.freshness.twin_version != null &&
      brief.freshness.twin_version > 1
    ) {
      suggestions.push("What does the latest version of my Twin say?");
    }
  } else {
    // No released report: only questions the witness layer can answer.
    suggestions.push("What do my lab results show over time?");
    suggestions.push("Which of my measurements changed most recently?");
  }

  suggestions.push("What should I ask my doctor at my next visit?");

  return suggestions.slice(0, MAX_SUGGESTIONS);
}
