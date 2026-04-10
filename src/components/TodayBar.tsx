import React from "react";
import { useManifest } from "@/context/ManifestContext";
import { ArrowRight, CalendarCheck, Check } from "lucide-react";
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
    <div className="space-y-6">
      {/* Hero focus card — the most important visual element */}
      <div className="bg-card border border-border/60 rounded-lg p-7 md:p-8">
        <div className="flex items-center justify-between mb-5">
          <p className="text-eyebrow text-muted-foreground">Today's Focus</p>
          {today.lastUpdated && (
            <span className="text-[11px] text-muted-foreground">{today.lastUpdated}</span>
          )}
        </div>

        <div className="flex items-center gap-6 mb-6">
          <ProgressRing value={progressPct} size={76} strokeWidth={4}>
            <div className="text-center">
              <span className="text-xl font-sans font-semibold text-foreground">{completed}</span>
              <span className="text-[10px] text-muted-foreground block -mt-0.5">of {allActions.length}</span>
            </div>
          </ProgressRing>
          <div className="flex-1">
            <p className="font-serif text-lg text-foreground leading-snug">{today.focus}</p>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{today.statusNote}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-md bg-card-elevated border border-border/30">
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
            <p className="text-[13px] text-foreground">{today.keyAction}</p>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-md bg-card-elevated border border-border/30">
            <CalendarCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
            <p className="text-[13px] text-foreground">{today.nextCheckpoint}</p>
          </div>
        </div>
      </div>

      {/* Focus list */}
      <div>
        <p className="text-eyebrow text-muted-foreground mb-4 px-1">
          Actions
        </p>
        <div className="space-y-2">
          {allActions.map((a, i) => {
            const done = completedKeys.has(a.key);
            return (
              <motion.button
                key={a.key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
                onClick={() => toggleDone(a.key)}
                className={`w-full bg-card border border-border/50 rounded-md p-4 flex items-center gap-3.5 text-left transition-all duration-150 ${
                  done ? "opacity-50" : "hover:border-border hover:shadow-sm"
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-150 ${
                  done ? "bg-primary border-primary" : "border-muted-foreground/30"
                }`}>
                  {done && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[14px] font-sans font-medium ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {a.title}
                  </p>
                  <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{a.description.split(".")[0]}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TodayBar;
