import type { IntakeState } from "@shared/cie33/engine";
import { Button } from "@/components/ui/button";
import { currentEntries, answerLabel } from "@/lib/cie33Presentation";

export default function CIE33Review({
  state,
  onRevise,
  busy = false,
}: {
  state: IntakeState;
  onRevise?: (witnessId: string) => void;
  busy?: boolean;
}) {
  const entries = currentEntries(state);
  const chapters = [...new Set(entries.map((e) => e.chapter))];
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Your words and their time windows are saved with each answer.
        Corrections create a new entry and preserve the earlier account.
      </p>
      {state.safety === "insufficient_coverage" && (
        <p className="rounded-lg border p-3 text-sm">
          The immediate safety question was not answered. Safety coverage is
          incomplete.
        </p>
      )}
      {chapters.map((chapter) => (
        <section key={chapter} aria-label={chapter} className="space-y-3">
          <h3 className="font-serif text-xl">{chapter}</h3>
          {entries
            .filter((e) => e.chapter === chapter)
            .map((entry) => (
              <article
                key={entry.witness.id}
                className="rounded-xl border border-border bg-card p-4 space-y-2"
              >
                <p className="text-sm font-medium">
                  {entry.question.promptRendered}
                </p>
                <p className="text-xs text-muted-foreground">
                  {entry.question.referenceWindowRendered} · Recorded{" "}
                  {new Date(entry.answer.acceptedAt).toLocaleDateString()}
                </p>
                <p className="whitespace-pre-wrap break-words">
                  {answerLabel(entry)}
                </p>
                {entry.answer.missingness?.kind === "not_applicable" && (
                  <p className="text-sm whitespace-pre-wrap">
                    {entry.answer.missingness.reason}
                  </p>
                )}
                {entry.supersedes && (
                  <p className="text-xs text-muted-foreground">
                    Corrected response · Earlier entry retained
                  </p>
                )}
                {onRevise && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => onRevise(entry.witness.id)}
                  >
                    Correct answer
                  </Button>
                )}
              </article>
            ))}
        </section>
      ))}
    </div>
  );
}
