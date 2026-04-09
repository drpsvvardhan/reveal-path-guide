import React from "react";
import { useManifest } from "@/context/ManifestContext";
import { Target, ArrowRight, CalendarCheck, Info } from "lucide-react";

const TodayBar: React.FC = () => {
  const { manifest } = useManifest();
  const today = manifest.todayBar;

  if (!today) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-secondary">
          Today
        </h3>
        {today.lastUpdated && (
          <span className="text-[10px] text-muted-foreground italic">
            {today.lastUpdated}
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-7 w-7 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
            <Target className="h-3.5 w-3.5 text-secondary" />
          </div>
          <div>
            <p className="text-[10px] font-sans font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Focus</p>
            <p className="text-sm text-foreground leading-snug">{today.focus}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-7 w-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <ArrowRight className="h-3.5 w-3.5 text-accent" />
          </div>
          <div>
            <p className="text-[10px] font-sans font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Key action</p>
            <p className="text-sm text-foreground leading-snug">{today.keyAction}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-7 w-7 rounded-lg bg-navy-light flex items-center justify-center shrink-0">
            <CalendarCheck className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-sans font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Next checkpoint</p>
            <p className="text-sm text-foreground leading-snug">{today.nextCheckpoint}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-7 w-7 rounded-lg bg-sage-light flex items-center justify-center shrink-0">
            <Info className="h-3.5 w-3.5 text-sage" />
          </div>
          <div>
            <p className="text-[10px] font-sans font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Status</p>
            <p className="text-sm text-foreground leading-snug">{today.statusNote}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TodayBar;
