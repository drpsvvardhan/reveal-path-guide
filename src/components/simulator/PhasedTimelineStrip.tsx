import React from "react";
import { Check, Circle, Dot } from "lucide-react";

const STEPS: Array<{ id: string; label: string }> = [
  { id: "draft", label: "Design" },
  { id: "run_in", label: "Run-in" },
  { id: "intervention", label: "Intervention" },
  { id: "ready_to_compare", label: "Compare" },
  { id: "completed", label: "Completed" },
];

const TERMINAL: Record<string, { label: string; tone: string }> = {
  stopped: { label: "Stopped", tone: "text-rose-700 border-rose-500/40 bg-rose-500/10" },
  not_interpretable: { label: "Not interpretable", tone: "text-amber-700 border-amber-500/40 bg-amber-500/10" },
};

interface Props { phase: string }

export default function PhasedTimelineStrip({ phase }: Props) {
  const terminal = TERMINAL[phase];
  if (terminal) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-sans uppercase tracking-wide ${terminal.tone}`}>
        <Dot className="h-3 w-3" />
        {terminal.label}
      </span>
    );
  }

  const idx = STEPS.findIndex((s) => s.id === phase);
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
      {STEPS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={s.id} className="flex items-center gap-1">
            <span
              className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${
                done
                  ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/40"
                  : active
                    ? "bg-signature text-signature-foreground border-signature"
                    : "border-border bg-muted/20"
              }`}
            >
              {done ? <Check className="h-2.5 w-2.5" /> : <Circle className="h-1.5 w-1.5 fill-current" />}
            </span>
            <span className={active || done ? "text-foreground" : ""}>{s.label}</span>
            {i < STEPS.length - 1 && <span className="opacity-40">→</span>}
          </li>
        );
      })}
    </ol>
  );
}