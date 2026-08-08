// ============================================================================
// src/components/home/IntentPassportCard.tsx
// ----------------------------------------------------------------------------
// Intent Passport — "What matters to you", in the person's own words.
//
// Rendered beside the Brief's "What your Twin is watching" so both priority
// maps stay visible. Sometimes they agree; sometimes they don't — the
// disagreement itself produces better conversations, without ever changing
// severity or truth (constitution rule 9).
// ============================================================================

import React, { useState } from "react";
import { Heart, Pencil } from "lucide-react";
import {
  useIntentProfile,
  INTENT_QUESTIONS,
  type IntentProfileAnswers,
} from "@/hooks/useIntentProfile";

const EMPTY_ANSWERS: IntentProfileAnswers = {
  think_about_most: "",
  want_to_understand: "",
  unexplained_result: "",
  ninety_day_change: "",
  doctors_missing: "",
};

export interface IntentPassportCardProps {
  effectiveUserId: string | null | undefined;
  /** Writes are own-user only; view-as sessions render read-only. */
  canEdit: boolean;
  onAsk?: (question: string) => void;
}

const IntentPassportCard: React.FC<IntentPassportCardProps> = ({
  effectiveUserId,
  canEdit,
  onAsk,
}) => {
  const { profile, loaded, saving, save } = useIntentProfile(effectiveUserId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<IntentProfileAnswers>(EMPTY_ANSWERS);

  if (!loaded) return null;

  const startEdit = () => {
    setDraft({
      think_about_most: profile?.think_about_most ?? "",
      want_to_understand: profile?.want_to_understand ?? "",
      unexplained_result: profile?.unexplained_result ?? "",
      ninety_day_change: profile?.ninety_day_change ?? "",
      doctors_missing: profile?.doctors_missing ?? "",
    });
    setEditing(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await save(draft);
    if (ok) setEditing(false);
  };

  if (editing) {
    return (
      <form
        onSubmit={submit}
        className="rounded-lg border border-border bg-card p-4 md:p-5 min-w-0 space-y-3"
      >
        <div>
          <h3 className="font-serif text-base break-words">
            What do you want your Twin to help you understand?
          </h3>
          <p className="mt-0.5 font-sans text-[11px] text-muted-foreground">
            Five questions, about 90 seconds. Your answers shape what your Twin
            shows first — they never change what your data says.
          </p>
        </div>
        {INTENT_QUESTIONS.map((q) => (
          <label key={q.key} className="block min-w-0">
            <span className="font-sans text-xs font-medium text-foreground">
              {q.label}
            </span>
            <textarea
              value={draft[q.key]}
              onChange={(e) => setDraft((d) => ({ ...d, [q.key]: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-md border border-border bg-background p-2 font-sans text-xs text-foreground outline-none focus:border-primary/60 resize-y"
            />
          </label>
        ))}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-3.5 py-2 font-sans text-xs font-semibold text-primary-foreground disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg px-3 py-2 font-sans text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  if (!profile) {
    if (!canEdit) return null;
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/60 p-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-serif text-sm break-words">
              Tell your Twin what matters to you
            </h3>
            <p className="mt-0.5 font-sans text-[11px] text-muted-foreground">
              Five questions, about 90 seconds. Shapes what you see first —
              never what your data says.
            </p>
          </div>
          <button
            onClick={startEdit}
            className="rounded-lg bg-primary px-3.5 py-2 font-sans text-xs font-semibold text-primary-foreground shrink-0"
          >
            Start
          </button>
        </div>
      </div>
    );
  }

  const answered = INTENT_QUESTIONS.filter(
    (q) => (profile[q.key] ?? "").trim() !== ""
  );

  return (
    <div className="rounded-lg border border-border bg-card p-4 md:p-5 min-w-0 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Heart className="h-3 w-3 text-muted-foreground" />
          <h4 className="font-sans text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            What matters to you
          </h4>
        </div>
        {canEdit && (
          <button
            onClick={startEdit}
            aria-label="Edit what matters to you"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <ul className="space-y-1.5 min-w-0">
        {answered.map((q) => {
          const text = (profile[q.key] ?? "").trim();
          return (
            <li key={q.key} className="min-w-0">
              <button
                onClick={() => onAsk?.(text)}
                disabled={!onAsk}
                className="text-left font-sans text-xs text-foreground/90 hover:text-primary transition-colors break-words disabled:hover:text-foreground/90"
                title={onAsk ? "Ask your Twin about this" : undefined}
              >
                {text}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="font-sans text-[10px] text-muted-foreground border-t border-border pt-2">
        Your priorities shape what appears first. They never change what your
        data shows.
      </p>
    </div>
  );
};

export default IntentPassportCard;
