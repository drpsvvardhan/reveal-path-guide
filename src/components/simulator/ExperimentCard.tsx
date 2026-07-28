import React from "react";
import { motion } from "framer-motion";
import { Award, CalendarClock, CheckCircle2, CircleDashed, Loader2, XCircle, ArrowRight, Sigma } from "lucide-react";
import TappableProse from "@/components/terrain/TappableProse";
import type { Checkpoint, Experiment, ExperimentProtocol, ExperimentComparison, DailyObservationRow } from "@/context/SimulatorContext";
import PhasedTimelineStrip from "@/components/simulator/PhasedTimelineStrip";
import ComparisonResultPanel from "@/components/simulator/ComparisonResultPanel";

const VERDICT_STYLE: Record<string, string> = {
  confirmed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  partial: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  refuted: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  inconclusive: "bg-muted text-muted-foreground border-border",
};

interface Props {
  experiment: Experiment;
  protocol?: ExperimentProtocol | null;
  comparison?: ExperimentComparison | null;
  observationsForExperiment?: DailyObservationRow[];
  cycleCount?: number;
  checkpoints: Checkpoint[];
  index: number;
  onRunCheckpoint: (id: string) => void;
  onAdvancePhase?: (target?: string, stoppedReason?: string) => void | Promise<void>;
  onCompare?: () => void | Promise<void>;
  onAbandon: () => void;
  onGraduate: () => void;
  runningCheckpointId: string | null;
}

const ExperimentCard: React.FC<Props> = ({
  experiment, protocol, comparison, observationsForExperiment = [], cycleCount = 0,
  checkpoints, index, onRunCheckpoint, onAdvancePhase, onCompare,
  onAbandon, onGraduate, runningCheckpointId,
}) => {
  const status = experiment.status;
  const isClosed = status === "graduated" || status === "abandoned";
  const dueCheckpoints = checkpoints.filter((c) => c.experiment_id === experiment.id);
  const allComplete = dueCheckpoints.length > 0 && dueCheckpoints.every((c) => c.status === "completed");
  const phase = (experiment as any).phase as string | undefined;
  const canCompare = phase === "ready_to_compare" || phase === "intervention";
  const canGraduate = (allComplete || phase === "completed") && cycleCount >= 2;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`rounded-xl border bg-card p-5 space-y-4 min-w-0 ${
        isClosed ? "border-border/50 opacity-80" : "border-border"
      }`}
    >
      <header className="flex items-start gap-3 min-w-0">
        <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
          <CircleDashed className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">
            {status === "graduated" ? "Graduated" : status === "abandoned" ? "Set aside" : "Running"}
            {` · started ${new Date(experiment.started_at).toLocaleDateString()}`}
            {cycleCount > 0 && ` · cycle ${cycleCount}`}
          </p>
          <h3 className="font-serif text-lg leading-snug text-foreground break-words">
            <TappableProse text={experiment.lever} />
          </h3>
        </div>
      </header>

      {phase && !isClosed && (
        <div className="min-w-0">
          <PhasedTimelineStrip phase={phase} />
        </div>
      )}

      <p className="text-sm text-muted-foreground leading-relaxed break-words">
        <TappableProse text={experiment.rationale} />
      </p>

      {protocol && (
        <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-xs text-muted-foreground space-y-1 break-words">
          <p><span className="font-sans font-semibold uppercase tracking-wider text-[10px] text-foreground/70">Protocol · </span>{protocol.perturbation_category}</p>
          {protocol.primary_outcome_marker && (
            <p>Primary outcome: <span className="text-foreground">{protocol.primary_outcome_marker}</span></p>
          )}
          <p>Run-in {protocol.run_in_days}d → intervention {protocol.intervention_days}d</p>
          {observationsForExperiment.length > 0 && (
            <p>Daily observations logged: {observationsForExperiment.length}</p>
          )}
        </div>
      )}

      {comparison && (
        <ComparisonResultPanel comparison={comparison} />
      )}

      {dueCheckpoints.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">
            Retest checkpoints
          </p>
          {dueCheckpoints.map((c) => {
            const due = new Date(c.checkpoint_at);
            const overdue = c.status === "pending" && due.getTime() < Date.now();
            const running = runningCheckpointId === c.id;
            return (
              <div
                key={c.id}
                className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2 min-w-0"
              >
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <CalendarClock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-sans text-foreground">
                    {due.toLocaleDateString()}
                  </span>
                  {c.status === "completed" && c.verdict && (
                    <span className={`text-[10px] font-sans font-semibold uppercase tracking-wide rounded-md border px-2 py-0.5 ${VERDICT_STYLE[c.verdict] || ""}`}>
                      {c.verdict}
                    </span>
                  )}
                  {overdue && c.status === "pending" && (
                    <span className="text-[10px] font-sans uppercase tracking-wide text-amber-600">
                      Ready to compare
                    </span>
                  )}
                </div>
                {c.biomarkers.length > 0 && (
                  <p className="text-xs text-muted-foreground break-words">
                    Watching: {c.biomarkers.join(", ")}
                  </p>
                )}
                {c.verdict_summary && (
                  <p className="text-xs text-foreground leading-relaxed break-words">
                    <TappableProse text={c.verdict_summary} />
                  </p>
                )}
                {c.status === "pending" && !isClosed && (
                  <button
                    onClick={() => onRunCheckpoint(c.id)}
                    disabled={running}
                    className="inline-flex items-center gap-1.5 text-xs font-sans text-primary hover:text-primary/80 min-h-[44px] py-2"
                  >
                    {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    Compare against my labs now
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isClosed && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {canCompare && onCompare && (
            <button
              onClick={() => onCompare()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-signature/30 bg-signature/10 text-signature px-3 py-2 text-xs font-sans font-medium hover:bg-signature/20 transition-colors min-h-[44px]"
            >
              <Sigma className="h-3.5 w-3.5" />
              Compare phases
            </button>
          )}
          {phase === "completed" && onAdvancePhase && (
            <button
              onClick={() => onAdvancePhase("run_in")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/20 text-foreground px-3 py-2 text-xs font-sans hover:bg-muted/40 transition-colors min-h-[44px]"
              title="Start another cycle to build replication"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Run another cycle
            </button>
          )}
          <button
            onClick={onGraduate}
            disabled={!canGraduate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 px-3 py-2 text-xs font-sans font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50 min-h-[44px]"
            title={canGraduate ? "Mark this experiment as internalized" : "Graduation requires at least 2 completed cycles"}
          >
            <Award className="h-3.5 w-3.5" />
            Graduate
          </button>
          <button
            onClick={onAbandon}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/20 text-muted-foreground px-3 py-2 text-xs font-sans hover:bg-muted/40 transition-colors min-h-[44px]"
          >
            <XCircle className="h-3.5 w-3.5" />
            Set aside
          </button>
        </div>
      )}
    </motion.article>
  );
};

export default ExperimentCard;