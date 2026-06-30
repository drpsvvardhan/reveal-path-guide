import React from "react";
import { motion } from "framer-motion";
import { Award, CalendarClock, CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";
import TappableProse from "@/components/terrain/TappableProse";
import type { Checkpoint, Experiment } from "@/context/SimulatorContext";

const VERDICT_STYLE: Record<string, string> = {
  confirmed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  partial: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  refuted: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  inconclusive: "bg-muted text-muted-foreground border-border",
};

interface Props {
  experiment: Experiment;
  checkpoints: Checkpoint[];
  index: number;
  onRunCheckpoint: (id: string) => void;
  onAbandon: () => void;
  onGraduate: () => void;
  runningCheckpointId: string | null;
}

const ExperimentCard: React.FC<Props> = ({
  experiment, checkpoints, index, onRunCheckpoint, onAbandon, onGraduate, runningCheckpointId,
}) => {
  const status = experiment.status;
  const isClosed = status === "graduated" || status === "abandoned";
  const dueCheckpoints = checkpoints.filter((c) => c.experiment_id === experiment.id);
  const allComplete = dueCheckpoints.length > 0 && dueCheckpoints.every((c) => c.status === "completed");

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
          </p>
          <h3 className="font-serif text-lg leading-snug text-foreground break-words">
            <TappableProse text={experiment.lever} />
          </h3>
        </div>
      </header>

      <p className="text-sm text-muted-foreground leading-relaxed break-words">
        <TappableProse text={experiment.rationale} />
      </p>

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
          <button
            onClick={onGraduate}
            disabled={!allComplete}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 px-3 py-2 text-xs font-sans font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50 min-h-[44px]"
            title={allComplete ? "Mark this experiment as internalized" : "Complete all retest checkpoints first"}
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