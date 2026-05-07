// Shared deterministic dose-pattern detector.
// Used by patient-chat (post-stream guard) and generate-action-plan
// (deterministic-library audit). The validator is the structural
// backstop — never the system prompt.
export const DOSE_PATTERN = new RegExp(
  String.raw`\b\d{1,5}(?:[.,]\d{1,3})?\s*(?:IU|mg|mcg|µg|ug|g|ng|tsp|tbsp|ml|cc|drops?|tablets?|capsules?|softgels?|units?|servings?)\b`,
  "gi",
);

export function detectDosePatterns(text: string): string[] {
  const matches = text.match(DOSE_PATTERN);
  return matches ? Array.from(new Set(matches.map((m) => m.trim()))) : [];
}

export const SAFE_FALLBACK_MESSAGE =
  `I want to be careful here. Specific doses depend on your full clinical picture and should come from your physician, not from me. I can help you understand what your data is showing, what questions to bring to your doctor, and what the trade-offs of different approaches are. Want me to do that instead?`;

export function detectDosePatternsInActions(
  actions: Array<{ id: string; what?: string; how?: string }>,
): Array<{ id: string; field: "what" | "how"; pattern: string }> {
  const hits: Array<{ id: string; field: "what" | "how"; pattern: string }> = [];
  for (const action of actions) {
    for (const field of ["what", "how"] as const) {
      const text = (action[field] ?? "") as string;
      const matches = text.match(DOSE_PATTERN);
      if (matches) {
        for (const m of matches) {
          hits.push({ id: action.id, field, pattern: m.trim() });
        }
      }
    }
  }
  return hits;
}