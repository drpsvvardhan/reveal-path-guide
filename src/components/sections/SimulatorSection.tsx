import React, { useMemo, useState } from "react";
import { Brain, FlaskConical, GraduationCap, Loader2, Sparkles, Telescope } from "lucide-react";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import TappableProse from "@/components/terrain/TappableProse";
import { SimulatorProvider, useSimulator } from "@/context/SimulatorContext";
import WhatIfCard from "@/components/simulator/WhatIfCard";
import ExperimentCard from "@/components/simulator/ExperimentCard";

// ── The Loop:
// Observe → Explain → Simulate → Choose → Act → Compare → Learn → Internalize
const LOOP_STEPS = [
  { id: "observe", label: "Observe", desc: "From your terrain" },
  { id: "explain", label: "Explain", desc: "Why it matters" },
  { id: "simulate", label: "Simulate", desc: "What if you…" },
  { id: "choose", label: "Choose", desc: "Commit to one" },
  { id: "act", label: "Act", desc: "Run the experiment" },
  { id: "compare", label: "Compare", desc: "Prediction vs. reality" },
  { id: "learn", label: "Learn", desc: "What we found" },
  { id: "internalize", label: "Internalize", desc: "Graduate" },
];

const LoopBar: React.FC<{ activeId: string }> = ({ activeId }) => (
  <ol className="flex flex-wrap gap-x-2 gap-y-2 text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
    {LOOP_STEPS.map((s, i) => {
      const active = s.id === activeId;
      return (
        <li key={s.id} className="flex items-center gap-1.5">
          <span
            className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full border px-1.5 ${
              active
                ? "bg-signature text-signature-foreground border-signature"
                : "border-border bg-muted/20"
            }`}
          >
            {i + 1}
          </span>
          <span className={active ? "text-foreground" : ""}>{s.label}</span>
          {i < LOOP_STEPS.length - 1 && <span className="mx-1 opacity-40">→</span>}
        </li>
      );
    })}
  </ol>
);

const SimulatorInner: React.FC = () => {
  const {
    cards, experiments, checkpoints, learnings,
    isLoading, isGenerating, error,
    generateCards, commitCard, dismissCard, runCheckpoint,
    abandonExperiment, graduateExperiment,
  } = useSimulator();

  const [committingId, setCommittingId] = useState<string | null>(null);
  const [runningCheckpointId, setRunningCheckpointId] = useState<string | null>(null);

  const openCards = useMemo(
    () => cards.filter((c) => !c.dismissed_at && !c.committed_experiment_id),
    [cards],
  );
  const activeExperiments = useMemo(
    () => experiments.filter((e) => e.status === "active" || e.status === "paused"),
    [experiments],
  );
  const graduated = useMemo(
    () => experiments.filter((e) => e.status === "graduated"),
    [experiments],
  );
  const activeStep =
    openCards.length === 0 && activeExperiments.length === 0
      ? "simulate"
      : activeExperiments.length > 0
        ? "act"
        : "choose";

  const handleCommit = async (id: string) => {
    setCommittingId(id);
    await commitCard(id);
    setCommittingId(null);
  };

  const handleCheckpoint = async (id: string) => {
    setRunningCheckpointId(id);
    await runCheckpoint(id);
    setRunningCheckpointId(null);
  };

  return (
    <PatientSectionLayout
      eyebrow="BIOLOGICAL SIMULATOR"
      title="What if you ran one small experiment on your own biology?"
      intro="This is not habit tracking. We make a small prediction with you, you run it, and your retest tells us — and you — whether the model of your body was right."
      headerExtra={<LoopBar activeId={activeStep} />}
    >
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* ── Simulate ── */}
      <section className="space-y-3 min-w-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <FlaskConical className="h-4 w-4 text-signature shrink-0" />
            <h2 className="font-serif text-xl text-foreground break-words">What-if simulations</h2>
          </div>
          <button
            onClick={() => generateCards()}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-sans hover:bg-muted/40 transition-colors disabled:opacity-50 min-h-[44px]"
          >
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {openCards.length === 0 ? "Generate ideas from my terrain" : "Refresh"}
          </button>
        </div>

        {isLoading && cards.length === 0 ? (
          <div className="h-32 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : openCards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/10 p-6 text-sm text-muted-foreground leading-relaxed">
            We don't have any open simulations for you right now. Generate a fresh
            set from what your terrain is currently showing — each card is a small,
            testable prediction grounded in your own data.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 min-w-0">
            {openCards.map((c, i) => (
              <WhatIfCard
                key={c.id}
                card={c}
                index={i}
                committing={committingId === c.id}
                onCommit={() => handleCommit(c.id)}
                onDismiss={() => dismissCard(c.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Act / Compare ── */}
      <section className="space-y-3 pt-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Telescope className="h-4 w-4 text-emerald-600 shrink-0" />
          <h2 className="font-serif text-xl text-foreground break-words">Experiments in flight</h2>
        </div>
        {activeExperiments.length === 0 ? (
          <p className="text-sm text-muted-foreground leading-relaxed">
            No experiments are running yet. Choose a What-if card above to start one —
            each becomes a small bet on your biology with a built-in retest checkpoint.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 min-w-0">
            {activeExperiments.map((e, i) => (
              <ExperimentCard
                key={e.id}
                experiment={e}
                checkpoints={checkpoints}
                index={i}
                onRunCheckpoint={handleCheckpoint}
                onAbandon={() => abandonExperiment(e.id)}
                onGraduate={() => graduateExperiment(e.id)}
                runningCheckpointId={runningCheckpointId}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Learn ── */}
      <section className="space-y-3 pt-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Brain className="h-4 w-4 text-purple-600 shrink-0" />
          <h2 className="font-serif text-xl text-foreground break-words">What we've learned about you</h2>
        </div>
        {learnings.length === 0 ? (
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every completed retest adds a line here — a piece of intuition the system
            holds about how your body actually behaves, not just what's typical.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {learnings.map((l) => (
              <li
                key={l.id}
                className={`rounded-lg border p-4 min-w-0 ${
                  l.graduated
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-border bg-card"
                }`}
              >
                <p className="font-serif text-base text-foreground break-words leading-snug">
                  <TappableProse text={l.headline} />
                </p>
                {l.body && (
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed break-words">
                    <TappableProse text={l.body} />
                  </p>
                )}
                <p className="mt-2 text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
                  {new Date(l.created_at).toLocaleDateString()}
                  {l.confidence != null && ` · confidence ${Math.round(l.confidence * 100)}%`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Internalize / Graduation ── */}
      {graduated.length > 0 && (
        <section className="space-y-3 pt-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <GraduationCap className="h-4 w-4 text-amber-600 shrink-0" />
            <h2 className="font-serif text-xl text-foreground break-words">Graduated scaffolds</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            These are predictions you've now confirmed enough times that they no
            longer need the scaffold. You can feel them in your own decisions.
          </p>
          <ul className="grid gap-2 md:grid-cols-2 min-w-0">
            {graduated.map((g) => (
              <li
                key={g.id}
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-foreground break-words"
              >
                {g.lever}
              </li>
            ))}
          </ul>
        </section>
      )}
    </PatientSectionLayout>
  );
};

const SimulatorSection: React.FC = () => (
  <SimulatorProvider>
    <SimulatorInner />
  </SimulatorProvider>
);

export default SimulatorSection;