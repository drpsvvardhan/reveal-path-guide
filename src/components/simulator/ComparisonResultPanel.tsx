import React from "react";
import type { ExperimentComparison } from "@/context/SimulatorContext";

const TONE: Record<string, string> = {
  SIGNAL_DETECTED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  POSSIBLE_SIGNAL: "border-amber-500/40 bg-amber-500/10 text-amber-800",
  NO_DETECTABLE_SIGNAL: "border-border bg-muted/20 text-muted-foreground",
  NOT_INTERPRETABLE: "border-amber-500/40 bg-amber-500/10 text-amber-800",
  STOPPED_FOR_SAFETY: "border-rose-500/40 bg-rose-500/10 text-rose-700",
};

const LABEL: Record<string, string> = {
  SIGNAL_DETECTED: "Signal detected",
  POSSIBLE_SIGNAL: "Possible signal",
  NO_DETECTABLE_SIGNAL: "No detectable signal",
  NOT_INTERPRETABLE: "Not interpretable",
  STOPPED_FOR_SAFETY: "Stopped for safety",
};

function pct(x: number | null | undefined) {
  return x == null ? "—" : `${(x * 100).toFixed(0)}%`;
}

export default function ComparisonResultPanel({ comp }: { comp: ExperimentComparison }) {
  return (
    <div className={`rounded-xl border p-4 space-y-3 min-w-0 ${TONE[comp.result] ?? "border-border"}`}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-sans font-semibold uppercase tracking-wider">Result</span>
        <span className="font-serif text-base text-foreground break-words">{LABEL[comp.result] ?? comp.result}</span>
      </div>
      <p className="text-sm text-foreground leading-relaxed break-words">{comp.human_summary}</p>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-sans">
        <div><dt className="text-muted-foreground">Median (run-in)</dt><dd>{comp.median_a ?? "—"}</dd></div>
        <div><dt className="text-muted-foreground">Median (intervention)</dt><dd>{comp.median_b ?? "—"}</dd></div>
        <div><dt className="text-muted-foreground">Change</dt><dd>{comp.pct_change != null ? `${(comp.pct_change * 100).toFixed(1)}%` : "—"}</dd></div>
        <div><dt className="text-muted-foreground">Direction consistency</dt><dd>{pct(comp.direction_consistency_pct)}</dd></div>
        <div><dt className="text-muted-foreground">Overlap</dt><dd>{pct(comp.overlap_ratio)}</dd></div>
        <div><dt className="text-muted-foreground">Adherence</dt><dd>{pct(comp.adherence_pct)}</dd></div>
        <div><dt className="text-muted-foreground">Confounder burden</dt><dd>{pct(comp.confounder_burden)}</dd></div>
        <div><dt className="text-muted-foreground">n (run-in / int.)</dt><dd>{comp.n_a} / {comp.n_b}</dd></div>
      </dl>
      {comp.reasons?.length > 0 && (
        <ul className="text-xs text-muted-foreground list-disc ml-5">
          {comp.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
    </div>
  );
}