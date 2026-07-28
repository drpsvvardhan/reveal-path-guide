import React, { useMemo, useState } from "react";
import { X, Loader2, ShieldCheck } from "lucide-react";
import type { WhatIfCard } from "@/context/SimulatorContext";

const CATEGORIES = ["food", "sleep", "movement", "stress", "timing", "recovery"] as const;

type Direction = "increase" | "decrease" | "stabilize";
type Cadence = "daily" | "per_session" | "weekly";

interface DraftProtocol {
  hypothesis_question: string;
  perturbation_category: typeof CATEGORIES[number];
  intervention: { dose?: string; intensity?: string; duration_min?: number; timing?: string; frequency?: string };
  primary_outcome: { source: "manual" | "lab" | "inbody" | "fibroscan" | "cie"; name: string; unit: string; direction: Direction; cadence: Cadence };
  hold_stable: string;
  allowed_cointerventions: string;
  run_in_days: number;
  intervention_days: number;
  washout_days: number;
  min_observations_per_phase: number;
  min_adherence_pct: number;
  stop_criteria: string;
}

interface Props {
  open: boolean;
  card: WhatIfCard | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (payload: any) => Promise<void>;
}

export default function ProtocolBuilderModal({ open, card, submitting, onClose, onConfirm }: Props) {
  const seed = useMemo<DraftProtocol>(() => {
    const t = (card?.protocol_template ?? {}) as any;
    const po = (card?.primary_outcome ?? card?.predicted_deltas?.[0]) as any;
    return {
      hypothesis_question: t.hypothesis_question || (card ? `How does ${card.lever.toLowerCase()} land for me?` : ""),
      perturbation_category: (card?.perturbation_category as any) || t.perturbation_category || "movement",
      intervention: t.intervention || { dose: "", intensity: "", duration_min: 30, timing: "morning", frequency: "daily" },
      primary_outcome: {
        source: po?.source || "manual",
        name: po?.name || po?.biomarker || "",
        unit: po?.unit || "",
        direction: (po?.direction as Direction) || "decrease",
        cadence: (po?.cadence as Cadence) || "daily",
      },
      hold_stable: (t.hold_stable ?? []).join(", "),
      allowed_cointerventions: (t.allowed_cointerventions ?? []).join(", "),
      run_in_days: t.run_in_days ?? 0,
      intervention_days: t.intervention_days ?? 14,
      washout_days: t.washout_days ?? 0,
      min_observations_per_phase: t.min_observations_per_phase ?? 3,
      min_adherence_pct: t.min_adherence_pct ?? 0.6,
      stop_criteria: (t.stop_criteria ?? ["symptom worsens", "sleep drops >1h vs baseline"]).join("\n"),
    };
  }, [card]);

  const [d, setD] = useState<DraftProtocol>(seed);

  React.useEffect(() => { if (open) { setD(seed); } }, [open, seed]);

  if (!open || !card) return null;

  const canSubmit = !submitting;
  const watchLabel = d.primary_outcome.name || "how you feel and perform";
  const stopLines = d.stop_criteria.split("\n").map(s => s.trim()).filter(Boolean);

  const handleConfirm = async () => {
    if (!canSubmit) return;
    await onConfirm({
      user_id: card.user_id,
      source_card_id: card.id,
      hypothesis_question: d.hypothesis_question,
      perturbation_category: d.perturbation_category,
      lever: card.lever,
      rationale: card.rationale,
      intervention: d.intervention,
      primary_outcome: d.primary_outcome,
      secondary_outcomes: [],
      hold_stable: d.hold_stable.split(",").map((s) => s.trim()).filter(Boolean),
      allowed_cointerventions: d.allowed_cointerventions.split(",").map((s) => s.trim()).filter(Boolean),
      run_in_days: d.run_in_days,
      intervention_days: d.intervention_days,
      washout_days: d.washout_days > 0 ? d.washout_days : null,
      min_observations_per_phase: d.min_observations_per_phase,
      min_adherence_pct: d.min_adherence_pct,
      stop_criteria: stopLines,
      contraindications: [],
      clinician_review_required: false,
      expected_direction: d.primary_outcome.direction,
      horizon_days: d.run_in_days + d.intervention_days + (d.washout_days || 0),
      predicted_deltas: card.predicted_deltas,
      source_terrain_render_id: card.source_terrain_render_id,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl">
        <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border px-5 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">Your plan now</p>
            <h2 className="font-serif text-base text-foreground break-words">{card.lever}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 h-11 w-11 -mr-2 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted/50">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-5 space-y-5 font-sans text-sm">
          <section className="space-y-1.5">
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">Why this is first</p>
            <p className="text-sm text-foreground leading-relaxed break-words">{card.rationale}</p>
          </section>

          <section className="space-y-2">
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">How to do it</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block space-y-1"><span className="text-[11px] text-muted-foreground">Dose / intensity</span><input value={d.intervention.dose ?? ""} onChange={(e) => setD({ ...d, intervention: { ...d.intervention, dose: e.target.value } })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px]" /></label>
              <label className="block space-y-1"><span className="text-[11px] text-muted-foreground">Timing</span><input value={d.intervention.timing ?? ""} onChange={(e) => setD({ ...d, intervention: { ...d.intervention, timing: e.target.value } })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px]" /></label>
              <label className="block space-y-1"><span className="text-[11px] text-muted-foreground">Duration (min)</span><input type="number" min={1} value={d.intervention.duration_min ?? 30} onChange={(e) => setD({ ...d, intervention: { ...d.intervention, duration_min: parseInt(e.target.value || "0") } })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px]" /></label>
              <label className="block space-y-1"><span className="text-[11px] text-muted-foreground">Frequency</span><input value={d.intervention.frequency ?? ""} onChange={(e) => setD({ ...d, intervention: { ...d.intervention, frequency: e.target.value } })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px]" /></label>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">What we're watching</p>
            <p className="text-sm text-foreground break-words">{watchLabel}{d.primary_outcome.unit ? ` (${d.primary_outcome.unit})` : ""} — {d.primary_outcome.cadence.replace("_", " ")}</p>
            {d.hold_stable && <p className="text-[11px] text-muted-foreground break-words">Keep steady if practical: {d.hold_stable}</p>}
          </section>

          <section className="space-y-1.5">
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">What would make us change course</p>
            {stopLines.length > 0 ? (
              <ul className="text-sm text-foreground list-disc ml-5 space-y-0.5">
                {stopLines.map((s, i) => <li key={i} className="break-words">{s}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">We'll review this plan in about {Math.max(7, d.intervention_days)} days regardless.</p>
            )}
          </section>

          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-800 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Low-risk and reversible. We'll adjust based on how you respond — no need to wait for proof.</span>
          </div>
        </div>

        <footer className="sticky bottom-0 bg-card/95 backdrop-blur border-t border-border px-5 py-3 flex items-center justify-end gap-3">
          <button onClick={onClose} className="text-sm font-sans text-muted-foreground min-h-[44px] px-3">Not now</button>
          <button onClick={handleConfirm} disabled={!canSubmit} className="inline-flex items-center gap-2 rounded-lg bg-signature text-signature-foreground px-4 py-2 text-sm font-sans min-h-[44px] disabled:opacity-50">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Start plan
          </button>
        </footer>
      </div>
    </div>
  );
}