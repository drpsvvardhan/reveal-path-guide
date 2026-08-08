// ============================================================================
// src/lib/askIntent.ts
// ----------------------------------------------------------------------------
// Hands a question from the Ask My Twin home to the Ask section's governed
// chat runtime. Consume-once semantics: the pending question is cleared on
// read so remounts (including StrictMode double-effects) cannot double-send.
// This is deliberately not persisted — an unconsumed question dies with the
// page, it never replays on a later visit.
// ============================================================================

let pendingQuestion: string | null = null;

export function setPendingAskQuestion(question: string): void {
  const q = question.trim();
  pendingQuestion = q.length > 0 ? q : null;
}

export function consumePendingAskQuestion(): string | null {
  const q = pendingQuestion;
  pendingQuestion = null;
  return q;
}
