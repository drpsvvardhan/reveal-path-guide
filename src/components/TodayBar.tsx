import React from "react";
import { useManifest } from "@/context/ManifestContext";
import { ArrowRight, CalendarCheck, Check, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import ProgressRing from "./ProgressRing";
import { useActionCompletions } from "@/context/ActionCompletionContext";

const TodayBar: React.FC = () => {
  const { manifest } = useManifest();
  const today = manifest.todayBar;
  const { allActions, completedKeys, toggleDone } = useActionCompletions();

  if (!today) return null;

  const completed = allActions.filter((a) => completedKeys.has(a.key)).length;
  const progressPct = allActions.length > 0 ? Math.round((completed / allActions.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Focus strip */}
      <div className="glass-card-elevated p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-primary">
            Today
          </h3>
          {today.lastUpdated && (
            <span className="text-[10px] text-muted-foreground italic">{today.lastUpdated}</span>
          )}
        </div>

        <div className="flex items-center gap-5 mb-4">
          <ProgressRing value={progressPct} size={72} strokeWidth={5}>
            <div className="text-center">
              <span className="text-lg font-sans font-bold text-foreground">{completed}</span>
              <span className="text-[9px] text-muted-foreground block -mt-0.5">of {allActions.length}</span>
            </div>
          </ProgressRing>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground leading-snug">{today.focus}</p>
            <p className="text-xs text-muted-foreground mt-1">{today.statusNote}</p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-light">
            <ArrowRight className="h-3.5 w-3.5 text-secondary shrink-0" />
            <p className="text-xs text-foreground">{today.keyAction}</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-lavender-light">
            <CalendarCheck className="h-3.5 w-3.5 text-primary shrink-0" />
            <p className="text-xs text-foreground">{today.nextCheckpoint}</p>
          </div>
        </div>
      </div>

      {/* Daily priorities — driven by manifest actions */}
      <div>
        <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
          Today's Focus
        </h3>
        <div className="space-y-2">
          {allActions.map((a, i) => {
            const done = completedKeys.has(a.key);
            return (
              <motion.button
                key={a.key}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => toggleDone(a.key)}
                className={`w-full glass-card p-3.5 flex items-center gap-3 text-left transition-all ${
                  done ? "opacity-60" : "hover:shadow-md"
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  done ? "bg-primary border-primary" : "border-muted-foreground/40"
                }`}>
                  {done && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
                <span className="text-lg">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-sans font-medium ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {a.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{a.description.split(".")[0]}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TodayBar;
