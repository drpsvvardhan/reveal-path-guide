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
    <div className="space-y-8">
      {/* ── HERO FOCUS CARD — signature block ── */}
      <div className="bg-card border border-border/50 rounded-lg px-5 py-6 sm:px-8 sm:py-9 md:px-10 md:py-11">
        <div className="flex items-center justify-between mb-6">
          <p className="text-eyebrow text-muted-foreground">Today's Focus</p>
          {today.lastUpdated && (
            <span className="text-[11px] text-muted-foreground/70">{today.lastUpdated}</span>
          )}
        </div>

        <div className="flex items-center gap-4 sm:gap-8 mb-8">
          <ProgressRing value={progressPct} size={72} strokeWidth={3}>
            <div className="text-center">
              <span className="text-2xl font-sans font-semibold text-foreground">{completed}</span>
              <span className="text-[10px] text-muted-foreground block -mt-0.5">of {allActions.length}</span>
            </div>
          </ProgressRing>
          <div className="flex-1 min-w-0">
            <h2
              className="font-serif text-foreground leading-snug tracking-tight break-words"
              style={{ fontSize: "clamp(1.0625rem, 3.5vw, 1.625rem)", fontWeight: 500 }}
            >
              {today.focus}
            </h2>
            {today.statusNote && (
              <p className="text-[13px] sm:text-[14px] text-muted-foreground mt-2.5 leading-relaxed max-w-md">
                {today.statusNote}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 px-4 py-3.5 rounded-md bg-background border border-border/40 min-w-0">
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
            <p className="text-[13px] text-foreground break-words min-w-0">{today.keyAction}</p>
          </div>
          <div className="flex items-start gap-3 px-4 py-3.5 rounded-md bg-background border border-border/40 min-w-0">
            <CalendarCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
            <p className="text-[13px] text-foreground break-words min-w-0">{today.nextCheckpoint}</p>
          </div>
        </div>
      </div>

      {/* ── FOCUS LIST — causal microcopy, no emoji ── */}
      <div>
        <p className="text-eyebrow text-muted-foreground mb-5 px-1">Actions</p>
        <div className="space-y-3">
          {allActions.map((a, i) => {
            const done = completedKeys.has(a.key);
            return (
              <motion.button
                key={a.key}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
                onClick={() => toggleDone(a.key)}
                className={`w-full min-h-[44px] bg-card border border-border/40 rounded-md px-4 sm:px-5 py-4 flex items-center gap-3 sm:gap-4 text-left transition-all duration-150 ${
                  done ? "opacity-40" : "hover:border-border hover:shadow-sm"
                }`}
                style={{ paddingTop: "1rem", paddingBottom: "1rem" }}
              >
                <div className={`w-[18px] h-[18px] rounded-full border-[1.5px] flex items-center justify-center shrink-0 transition-all duration-150 ${
                  done ? "bg-primary border-primary" : "border-muted-foreground/30"
                }`}>
                  {done && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[14px] font-sans font-medium leading-snug break-words ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {a.title}
                  </p>
                  <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed break-words">{a.description.split(".")[0]}</p>
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
