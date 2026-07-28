import React, { useMemo, useState } from "react";
import { X, Loader2, AlertTriangle } from "lucide-react";
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
      hypothesis_question: t.hypothesis_question || (card ? `What happens to me if I ${card.lever.toLowerCase()}?` : ""),
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
      run_in_days: t.run_in_days ?? 5,
      intervention_days: t.intervention_days ?? 14,
      washout_days: t.washout_days ?? 0,
      min_observations_per_phase: t.min_observations_per_phase ?? 5,
      min_adherence_pct: t.min_adherence_pct ?? 0.7,
      stop_criteria: (t.stop_criteria ?? ["symptom worsens", "sleep drops >1h vs baseline"]).join("\n"),
    };
  }, [card]);

  const [step, setStep] = useState(0);
  const [d, setD] = useState<DraftProtocol>(seed);

  React.useEffect(() => { if (open) { setD(seed); setStep(0); } }, [open, seed]);

  if (!open || !card) return null;

  const steps = ["Question", "Perturbation", "Outcomes", "Timeline", "Adherence & safety", "Review"];

  const missing: string[] = [];
  if (!d.hypothesis_question || d.hypothesis_question.length < 8) missing.push("A specific question");
  if (!d.primary_outcome.name) missing.push("A primary outcome");
  if (!d.primary_outcome.direction) missing.push("A direction (what should change)");
  if (d.run_in_days < 3) missing.push("Run-in ≥ 3 days");
  if (d.intervention_days < 5) missing.push("Intervention ≥ 5 days");

  const canSubmit = missing.length === 0 && !submitting;

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
      stop_criteria: d.stop_criteria.split("\n").map((s) => s.trim()).filter(Boolean),
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
      <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl">
        <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border px-5 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">Design this experiment</p>
            <h2 className="font-serif text-base text-foreground break-words">{card.lever}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 h-11 w-11 -mr-2 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted/50">
            <X className="h-4 w-4" />
          </button>
        </header>

        <nav className="px-5 pt-3">
          <ol className="flex flex-wrap gap-1.5 text-[10px] font-sans uppercase tracking-wide text-muted-foreground">
            {steps.map((s, i) => (
              <li key={s} className={`px-2 py-1 rounded-md border ${i === step ? "border-signature bg-signature/10 text-signature" : i < step ? "border-emerald-500/30 text-emerald-700" : "border-border"}`}>
                {i + 1}. {s}
              </li>
            ))}
          </ol>
        </nav>

        <div className="p-5 space-y-4 font-sans text-sm">
          {step === 0 && (
            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground">What are we trying to learn about you?</span>
              <textarea rows={3} value={d.hypothesis_question} onChange={(e) => setD({ ...d, hypothesis_question: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <span className="text-[11px] text-muted-foreground">Frame it as a question you don't already know the answer to.</span>
            </label>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-xs text-muted-foreground">Category</span>
                <select value={d.perturbation_category} onChange={(e) => setD({ ...d, perturbation_category: e.target.value as any })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Dose / intensity</span><input value={d.intervention.dose ?? ""} onChange={(e) => setD({ ...d, intervention: { ...d.intervention, dose: e.target.value } })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="e.g. 3 sets × 8 reps at RPE 7" /></label>
                <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Duration (min)</span><input type="number" min={1} value={d.intervention.duration_min ?? 30} onChange={(e) => setD({ ...d, intervention: { ...d.intervention, duration_min: parseInt(e.target.value || "0") } })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
                <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Timing</span><input value={d.intervention.timing ?? ""} onChange={(e) => setD({ ...d, intervention: { ...d.intervention, timing: e.target.value } })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="e.g. within 1h of waking" /></label>
                <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Frequency</span><input value={d.intervention.frequency ?? ""} onChange={(e) => setD({ ...d, intervention: { ...d.intervention, frequency: e.target.value } })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="e.g. daily / 3× per week" /></label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Primary outcome</span><input value={d.primary_outcome.name} onChange={(e) => setD({ ...d, primary_outcome: { ...d.primary_outcome, name: e.target.value } })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="e.g. session RPE-adjusted work" /></label>
              <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Unit / scale</span><input value={d.primary_outcome.unit} onChange={(e) => setD({ ...d, primary_outcome: { ...d.primary_outcome, unit: e.target.value } })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="e.g. 1–10, kg, mg/dL" /></label>
              <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Direction we're testing</span><select value={d.primary_outcome.direction} onChange={(e) => setD({ ...d, primary_outcome: { ...d.primary_outcome, direction: e.target.value as Direction } })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"><option value="increase">increase</option><option value="decrease">decrease</option><option value="stabilize">stabilize</option></select></label>
              <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Measurement cadence</span><select value={d.primary_outcome.cadence} onChange={(e) => setD({ ...d, primary_outcome: { ...d.primary_outcome, cadence: e.target.value as Cadence } })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"><option value="daily">daily</option><option value="per_session">per session</option><option value="weekly">weekly</option></select></label>
              <label className="block space-y-1.5 sm:col-span-2"><span className="text-xs text-muted-foreground">Source</span><select value={d.primary_outcome.source} onChange={(e) => setD({ ...d, primary_outcome: { ...d.primary_outcome, source: e.target.value as any } })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"><option value="manual">Manual daily entry</option><option value="lab">Lab retest</option><option value="inbody">InBody</option><option value="fibroscan">FibroScan</option><option value="cie">CIE re-take</option></select></label>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Run-in days</span><input type="number" min={3} value={d.run_in_days} onChange={(e) => setD({ ...d, run_in_days: parseInt(e.target.value || "0") })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
              <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Intervention days</span><input type="number" min={5} value={d.intervention_days} onChange={(e) => setD({ ...d, intervention_days: parseInt(e.target.value || "0") })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
              <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Washout (optional)</span><input type="number" min={0} value={d.washout_days} onChange={(e) => setD({ ...d, washout_days: parseInt(e.target.value || "0") })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Min observations / phase</span><input type="number" min={3} value={d.min_observations_per_phase} onChange={(e) => setD({ ...d, min_observations_per_phase: parseInt(e.target.value || "0") })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
                <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Min adherence (0–1)</span><input type="number" step={0.05} min={0.3} max={1} value={d.min_adherence_pct} onChange={(e) => setD({ ...d, min_adherence_pct: parseFloat(e.target.value || "0") })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
              </div>
              <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Hold stable (comma-separated)</span><input value={d.hold_stable} onChange={(e) => setD({ ...d, hold_stable: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="sleep window, caffeine, other training" /></label>
              <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Stop criteria (one per line)</span><textarea rows={3} value={d.stop_criteria} onChange={(e) => setD({ ...d, stop_criteria: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
                <p><span className="text-muted-foreground">Question:</span> {d.hypothesis_question}</p>
                <p><span className="text-muted-foreground">Change:</span> {card.lever}</p>
                <p><span className="text-muted-foreground">Measure:</span> {d.primary_outcome.name || "—"} ({d.primary_outcome.unit || "no unit"}), {d.primary_outcome.cadence}, via {d.primary_outcome.source}</p>
                <p><span className="text-muted-foreground">Duration:</span> {d.run_in_days}d run-in → {d.intervention_days}d intervention{d.washout_days ? ` → ${d.washout_days}d washout` : ""}</p>
                <p><span className="text-muted-foreground">Adherence target:</span> {(d.min_adherence_pct * 100).toFixed(0)}% · min {d.min_observations_per_phase} obs/phase</p>
                <p><span className="text-muted-foreground">Stop if:</span> {d.stop_criteria || "—"}</p>
              </div>
              {missing.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-800 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    Missing before we can start:
                    <ul className="list-disc ml-5 mt-1">{missing.map((m) => <li key={m}>{m}</li>)}</ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="sticky bottom-0 bg-card/95 backdrop-blur border-t border-border px-5 py-3 flex items-center justify-between gap-3">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="text-xs font-sans text-muted-foreground min-h-[44px] px-3 disabled:opacity-30">Back</button>
          {step < steps.length - 1 ? (
            <button onClick={() => setStep(Math.min(steps.length - 1, step + 1))} className="inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-4 py-2 text-sm font-sans min-h-[44px]">Next</button>
          ) : (
            <button onClick={handleConfirm} disabled={!canSubmit} className="inline-flex items-center gap-2 rounded-lg bg-signature text-signature-foreground px-4 py-2 text-sm font-sans min-h-[44px] disabled:opacity-50">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm & start run-in
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}