import React from "react";
import { useManifest } from "@/context/ManifestContext";
import { TrendingUp, AlertTriangle, Repeat } from "lucide-react";

const WeeklySnapshot: React.FC = () => {
  const { manifest } = useManifest();
  const snapshot = manifest.weeklySnapshot;

  if (!snapshot) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-secondary">
          This week
        </h3>
        {snapshot.periodLabel && (
          <span className="text-[10px] text-muted-foreground italic">{snapshot.periodLabel}</span>
        )}
      </div>

      <div className="space-y-2.5">
        <div className="flex items-start gap-3">
          <TrendingUp className="h-4 w-4 text-secondary mt-0.5 shrink-0" />
          <p className="text-sm text-foreground leading-snug">{snapshot.keyImprovement}</p>
        </div>
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber mt-0.5 shrink-0" />
          <p className="text-sm text-foreground leading-snug">{snapshot.fragileArea}</p>
        </div>
        <div className="flex items-start gap-3">
          <Repeat className="h-4 w-4 text-sage mt-0.5 shrink-0" />
          <p className="text-sm text-foreground leading-snug">{snapshot.keepDoing}</p>
        </div>
      </div>
    </div>
  );
};

export default WeeklySnapshot;
