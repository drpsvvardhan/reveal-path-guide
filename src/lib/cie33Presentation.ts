import type { IntakeEntry, IntakeState } from "@shared/cie33/engine";

export const MISSING_LABELS: Record<string, string> = {
  unknown: "I don't know",
  not_recalled: "I don't recall",
  declined: "I'd rather not answer",
  not_applicable: "This doesn't apply to me",
  temporarily_unable: "I can't answer right now",
};
export function currentEntries(state: IntakeState): IntakeEntry[] {
  const entries = new Map<string, IntakeEntry>();
  for (const entry of state.entries) entries.set(entry.key, entry);
  return [...entries.values()];
}
export function answerLabel(entry: IntakeEntry): string {
  const { semanticResponse: response, missingness } = entry.answer;
  if (missingness) return MISSING_LABELS[missingness.kind] ?? missingness.kind;
  if (response?.kind === "boolean") return response.value ? "Yes" : "No";
  if (response?.kind === "short_text") return response.text;
  if (response?.kind === "single_select")
    return (
      entry.question.response.options?.find((o) => o.id === response.optionId)
        ?.label ?? response.optionId
    );
  return "Response unavailable";
}
