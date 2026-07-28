import React, { useMemo, useState } from "react";
import { Brain, FlaskConical, GraduationCap, Loader2, Sparkles, Telescope } from "lucide-react";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import TappableProse from "@/components/terrain/TappableProse";
import { SimulatorProvider, useSimulator } from "@/context/SimulatorContext";
import type { WhatIfCard as WhatIfCardType } from "@/context/SimulatorContext";
import WhatIfCard from "@/components/simulator/WhatIfCard";
import ExperimentCard from "@/components/simulator/ExperimentCard";
import ProtocolBuilderModal from "@/components/simulator/ProtocolBuilderModal";
import DailyCheckInCard from "@/components/simulator/DailyCheckInCard";
import ClinicianReviewPanel from "@/components/simulator/ClinicianReviewPanel";

// The Loop: Observe → Explain → Simulate → Choose → Act → Compare → Learn → Internalize
const LOOP_STEPS = [
  { id: "observe", label: "Observe" },
  { id: "explain", label: "Explain" },
  { id: "simulate", label: "Simulate" },
  { id: "choose", label: "Choose" },
  { id: "act", label: "Act" },
  { id: "compare", label: "Compare" },
  { id: "learn", label: "Learn" },
  { id: "internalize", label: "Internalize" },
];

const LoopBar: React.FC<{ activeId: string }> = ({ activeId }) => (
  <ol className="flex flex-wrap gap-x-2 gap-y-2 text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
    {LOOP_STEPS.map((s, i) => {
      const active = s.id === activeId;
      return (
        <li key={s.id} className="flex items-center gap-1.5">
          <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full border px-1.5 ${active ? "bg-signature text-signature-foreground border-signature" : "border-border bg-muted/20"}`}>{i + 1}</span>
          <span className={active ? "text-foreground" : ""}>{s.label}</span>
          {i < LOOP_STEPS.length - 1 && <span className="mx-1 opacity-40">→</span>}
        </li>
      );
    })}
  </ol>
);

const SimulatorInner: React.FC = () => {
  const {
    cards, blockedCards, experiments, checkpoints, learnings,
    protocols, dailyObservations, comparisons,
    isLoading, isGenerating, error,
    generateCards, designProtocol, dismissCard,
    advancePhase, logDailyObservation, comparePhases,
    runCheckpoint, abandonExperiment, graduateExperiment,
    isAdminViewingAs,
  } = useSimulator();

  const [designCard, setDesignCard] = useState<WhatIfCardType | null>(null);
  const [designing, setDesigning] = useState(false);
  const [loggingObs, setLoggingObs] = useState(false);
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
  const activeExperimentsInPhase = experiments.filter(
    (e) => e.status === "active" && ["run_in", "intervention"].includes((e as any).phase || ""),
  );
  const today = new Date().toISOString().slice(0, 10);

  const activeStep =
    openCards.length === 0 && activeExperiments.length === 0
      ? "simulate"
      : activeExperiments.length > 0 ? "act" : "choose";

  const handleConfirmDesign = async (payload: any) => {
    setDesigning(true);
    const res = await designProtocol(payload);
    setDesigning(false);
    if (res) {
      await advancePhase(res.experiment.id, "run_in");
      setDesignCard(null);
    }
  };

  const handleLogObs = async (payload: any) => {
    setLoggingObs(true);
    await logDailyObservation(payload);
    setLoggingObs(false);
  };

  const handleCheckpoint = async (id: string) => {
    setRunningCheckpointId(id);
    await runCheckpoint(id);
    setRunningCheckpointId(null);
  };

  return (
    <PatientSectionLayout
      eyebrow="BIOLOGICAL SIMULATOR"
      title="What are we trying to learn about you?"
      intro="Not habit tracking. Not population rules. Each experiment starts with a specific question, a designed protocol, and a way to tell whether the answer is real for you — not typical."
      headerExtra={<LoopBar activeId={activeStep} />}
    >
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="space-y-3 min-w-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <FlaskConical className="h-4 w-4 text-signature shrink-0" />
            <h2 className="font-serif text-xl text-foreground break-words">What-if hypotheses</h2>
          </div>
          <button
            onClick={() => generateCards()}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-sans hover:bg-muted/40 transition-colors disabled:opacity-50 min-h-[44px]"
          >
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {openCards.length === 0 ? "Generate from my terrain" : "Refresh"}
          </button>
        </div>

        {isLoading && cards.length === 0 ? (
          <div className="h-32 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : openCards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/10 p-6 text-sm text-muted-foreground leading-relaxed break-words">
            There is not enough patient-specific signal to design an interpretable
            experiment right now. Add data — a fresh lab, an InBody, or a CIE
            re-take — and generate again.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 min-w-0">
            {openCards.map((c, i) => (
              <WhatIfCard
                key={c.id}
                card={c}
                index={i}
                onDesign={() => setDesignCard(c)}
                onDismiss={() => dismissCard(c.id)}
              />
            ))}
          </div>
        )}
      </section>

      {activeExperimentsInPhase.length > 0 && (
        <section className="space-y-3 pt-3 min-w-0">
          <h2 className="font-serif text-xl text-foreground break-words">What changed today?</h2>
          <div className="grid gap-4 md:grid-cols-2 min-w-0">
            {activeExperimentsInPhase.map((e) => {
              const proto = protocols.find((p) => p.experiment_id === e.id) ?? null;
              const already = dailyObservations.some((o) => o.experiment_id === e.id && o.observed_on === today);
              if (already) return null;
              return (
                <DailyCheckInCard
                  key={e.id}
                  experiment={e}
                  protocol={proto}
                  submitting={loggingObs}
                  onSubmit={handleLogObs}
                />
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-3 pt-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Telescope className="h-4 w-4 text-emerald-600 shrink-0" />
          <h2 className="font-serif text-xl text-foreground break-words">Experiments in flight</h2>
        </div>
        {activeExperiments.length === 0 ? (
          <p className="text-sm text-muted-foreground leading-relaxed">
            No experiments in flight yet. Design one from a hypothesis above — each
            experiment carries its own protocol, run-in, and stop criteria.
          </p>
        ) : (
          <div className="space-y-4 min-w-0">
            {activeExperiments.map((e, i) => {
              const proto = protocols.find((p) => p.experiment_id === e.id) ?? null;
              const cmp = comparisons.find((c) => c.experiment_id === e.id) ?? null;
              const relevantLearnings = learnings.filter((l) => l.experiment_id === e.id);
              const totalCycles = relevantLearnings.reduce((n, l) => n + (l.cycle_count ?? 1), 0);
              const obsForExp = dailyObservations.filter((o) => o.experiment_id === e.id);
              return (
                <ExperimentCard
                  key={e.id}
                  experiment={e}
                  protocol={proto}
                  comparison={cmp}
                  observationsForExperiment={obsForExp}
                  cycleCount={totalCycles}
                  checkpoints={checkpoints}
                  index={i}
                  onRunCheckpoint={handleCheckpoint}
                  onAdvancePhase={(target, reason) => advancePhase(e.id, target, reason)}
                  onCompare={async () => { await comparePhases(e.id); }}
                  onAbandon={() => abandonExperiment(e.id)}
                  onGraduate={() => graduateExperiment(e.id)}
                  runningCheckpointId={runningCheckpointId}
                />
              );
            })}
          </div>
        )}
      </section>

      {isAdminViewingAs && (
        <ClinicianReviewPanel
          blockedCards={blockedCards}
          protocols={protocols}
          comparisons={comparisons}
        />
      )}

      <section className="space-y-3 pt-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Brain className="h-4 w-4 text-purple-600 shrink-0" />
          <h2 className="font-serif text-xl text-foreground break-words">What did we learn — and how certain are we?</h2>
        </div>
        {learnings.length === 0 ? (
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every completed cycle adds a line here — a piece of intuition the system
            holds about how your body actually behaves, not just what's typical.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {learnings.map((l) => (
              <li
                key={l.id}
                className={`rounded-lg border p-4 min-w-0 ${l.graduated ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card"}`}
              >
                <p className="font-serif text-base text-foreground break-words leading-snug">
                  <TappableProse text={l.headline} />
                </p>
                {l.body && (
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed break-words">
                    <TappableProse text={l.body} />
                  </p>
                )}
                <p className="mt-2 text-[10px] font-sans uppercase tracking-wider text-muted-foreground break-words">
                  {new Date(l.created_at).toLocaleDateString()}
                  {l.confidence != null && ` · confidence ${Math.round(l.confidence * 100)}%`}
                  {l.learning_status && ` · ${l.learning_status}`}
                  {l.cycle_count != null && ` · cycle ${l.cycle_count}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {graduated.length > 0 && (
        <section className="space-y-3 pt-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <GraduationCap className="h-4 w-4 text-amber-600 shrink-0" />
            <h2 className="font-serif text-xl text-foreground break-words">Graduated scaffolds</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Predictions you have confirmed across enough cycles that they no longer
            need scaffolding — you can feel them in your own decisions.
          </p>
          <ul className="grid gap-2 md:grid-cols-2 min-w-0">
            {graduated.map((g) => (
              <li key={g.id} className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-foreground break-words">
                {g.lever}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ProtocolBuilderModal
        open={!!designCard}
        card={designCard}
        submitting={designing}
        onClose={() => setDesignCard(null)}
        onConfirm={handleConfirmDesign}
      />
    </PatientSectionLayout>
  );
};

const SimulatorSection: React.FC = () => (
  <SimulatorProvider>
    <SimulatorInner />
  </SimulatorProvider>
);

export default SimulatorSection;