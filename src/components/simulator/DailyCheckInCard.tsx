import React, { useState } from "react";
import { Loader2, PenLine } from "lucide-react";
import type { Experiment } from "@/context/SimulatorContext";

interface ProtocolLite {
  primary_outcome?: { name?: string; unit?: string; cadence?: string };
  intervention?: { dose?: string; duration_min?: number; timing?: string };
  min_observations_per_phase?: number;
  min_adherence_pct?: number;
}

interface Props {
  experiment: Experiment;
  protocol: ProtocolLite | null;
  submitting: boolean;
  onSubmit: (payload: any) => Promise<void>;
}

export default function DailyCheckInCard({ experiment, protocol, submitting, onSubmit }: Props) {
  const [performed, setPerformed] = useState<boolean | null>(null);
  const [primary, setPrimary] = useState("");
  const [sleep, setSleep] = useState("");
  const [energy, setEnergy] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [conf, setConf] = useState<Record<string, boolean>>({});

  const primaryLabel = protocol?.primary_outcome?.name || "Primary value";
  const unit = protocol?.primary_outcome?.unit || "";
  const canSubmit = performed !== null && !submitting;

  const handle = async () => {
    await onSubmit({
      experiment_id: experiment.id,
      user_id: experiment.user_id,
      phase: (experiment as any).phase || "intervention",
      observed_on: new Date().toISOString().slice(0, 10),
      intervention_performed: performed,
      primary_value: primary ? Number(primary) : null,
      sleep_hours: sleep ? Number(sleep) : null,
      energy: energy ?? null,
      note: note || null,
      confounders: conf,
    });
    setPerformed(null); setPrimary(""); setSleep(""); setEnergy(null); setNote(""); setConf({});
  };

  const toggle = (k: string) => setConf({ ...conf, [k]: !conf[k] });

  return (
    <div className="rounded-xl border border-signature/30 bg-signature/5 p-4 space-y-3 min-w-0">
      <div className="flex items-center gap-2">
        <PenLine className="h-4 w-4 text-signature shrink-0" />
        <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted-foreground break-words">
          Today's 30-second check-in — {experiment.lever}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Did you do the intervention today?</p>
          <div className="flex gap-2">
            <button onClick={() => setPerformed(true)} className={`min-h-[44px] px-3 rounded-lg border text-xs font-sans ${performed === true ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700" : "border-border"}`}>Yes</button>
            <button onClick={() => setPerformed(false)} className={`min-h-[44px] px-3 rounded-lg border text-xs font-sans ${performed === false ? "bg-rose-500/15 border-rose-500/40 text-rose-700" : "border-border"}`}>No</button>
          </div>
        </div>
        <label className="space-y-1 block">
          <span className="text-xs text-muted-foreground">{primaryLabel}{unit ? ` (${unit})` : ""}</span>
          <input value={primary} onChange={(e) => setPrimary(e.target.value)} inputMode="decimal" className="w-full min-h-[44px] rounded-lg border border-border bg-background px-3 text-sm" />
        </label>
        <label className="space-y-1 block">
          <span className="text-xs text-muted-foreground">Sleep last night (h)</span>
          <input value={sleep} onChange={(e) => setSleep(e.target.value)} inputMode="decimal" className="w-full min-h-[44px] rounded-lg border border-border bg-background px-3 text-sm" />
        </label>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Energy today</p>
          <div className="flex flex-wrap gap-1">
            {[1,2,3,4,5].map((n) => (
              <button key={n} onClick={() => setEnergy(n)} className={`min-h-[44px] w-11 rounded-lg border text-xs font-sans ${energy === n ? "bg-signature/15 border-signature/40 text-signature" : "border-border"}`}>{n}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Anything unusual today?</p>
        <div className="flex flex-wrap gap-1.5">
          {["illness","travel","alcohol","unusual_stress","diet_deviation","med_change"].map((k) => (
            <button key={k} onClick={() => toggle(k)} className={`min-h-[36px] px-2.5 rounded-md border text-[11px] font-sans ${conf[k] ? "bg-amber-500/15 border-amber-500/40 text-amber-800" : "border-border text-muted-foreground"}`}>
              {k.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Note (optional)</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      </label>
      <div className="flex justify-end">
        <button onClick={handle} disabled={!canSubmit} className="inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-4 py-2 text-sm font-sans min-h-[44px] disabled:opacity-50">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Log today
        </button>
      </div>
    </div>
  );
}