import React from "react";
import { Shield, AlertTriangle } from "lucide-react";
import type { WhatIfCard, ExperimentProtocol, ExperimentComparison } from "@/context/SimulatorContext";

interface Props {
  blockedCards: WhatIfCard[];
  protocols: ExperimentProtocol[];
  comparisons: ExperimentComparison[];
}

export default function ClinicianReviewPanel({ blockedCards, protocols, comparisons }: Props) {
  if (blockedCards.length === 0 && protocols.length === 0) return null;
  return (
    <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-4 min-w-0">
      <header className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-amber-700 shrink-0" />
        <h3 className="font-serif text-lg text-foreground">Clinician review surface</h3>
      </header>

      {blockedCards.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">Blocked cards ({blockedCards.length})</p>
          <ul className="space-y-1.5">
            {blockedCards.map((c) => (
              <li key={c.id} className="rounded-md border border-border bg-card p-2 text-xs">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-700 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-serif text-sm break-words">{c.lever}</p>
                    <p className="text-muted-foreground">Verdict: {(c as any).admission_verdict ?? "—"}</p>
                    {Array.isArray((c as any).unbound_biomarkers) && (c as any).unbound_biomarkers.length > 0 && (
                      <p className="text-muted-foreground">Unbound: {(c as any).unbound_biomarkers.join(", ")}</p>
                    )}
                    {Array.isArray((c as any).safety_flags) && (c as any).safety_flags.length > 0 && (
                      <p className="text-muted-foreground">Safety: {(c as any).safety_flags.join(", ")}</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {protocols.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">Protocols ({protocols.length})</p>
          <ul className="space-y-1.5">
            {protocols.map((p) => {
              const c = comparisons.find((x) => x.experiment_id === p.experiment_id);
              return (
                <li key={p.id} className="rounded-md border border-border bg-card p-2 text-xs space-y-1">
                  <p className="font-serif text-sm break-words">{p.hypothesis_question}</p>
                  <p className="text-muted-foreground">Category: {p.perturbation_category} · run-in {p.run_in_days}d → intervention {p.intervention_days}d · min adherence {(Number(p.min_adherence_pct) * 100).toFixed(0)}%</p>
                  {p.stop_criteria?.length ? <p className="text-muted-foreground">Stop: {p.stop_criteria.join("; ")}</p> : null}
                  {c && <p className="text-muted-foreground">Comparison: {c.result} · consistency {c.direction_consistency_pct != null ? (c.direction_consistency_pct * 100).toFixed(0) + "%" : "—"} · adherence {c.adherence_pct != null ? (c.adherence_pct * 100).toFixed(0) + "%" : "—"}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}