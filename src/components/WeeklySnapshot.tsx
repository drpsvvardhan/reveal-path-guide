import React from "react";
import { useManifest } from "@/context/ManifestContext";
import { useLabUploads } from "@/context/LabUploadsContext";
import { TrendingUp, AlertTriangle, Repeat } from "lucide-react";

const WeeklySnapshot: React.FC = () => {
  const { manifest, isDemoMode } = useManifest();
  const { observations } = useLabUploads();
  const snapshot = manifest.weeklySnapshot;

  // Only show weekly snapshot section if there's actual snapshot narrative data
  if (!snapshot) return null;

  // Don't show hardcoded metric cards — they were misleading.
  // The weekly insight block only renders when the manifest carries real snapshot prose.
  // In demo mode the sampleManifest provides this; for real users it comes from the narrative pipeline.

  return (
    <div className="space-y-8">
      {/* Weekly insight */}
      <div className="bg-card border border-border/40 rounded-md p-7 space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-eyebrow text-muted-foreground">This Week</p>
          {snapshot.periodLabel && (
            <span className="text-[11px] text-muted-foreground/70">{snapshot.periodLabel}</span>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3.5">
            <TrendingUp className="h-4 w-4 text-success mt-0.5 shrink-0" strokeWidth={1.5} />
            <p className="text-[14px] text-foreground leading-relaxed">{snapshot.keyImprovement}</p>
          </div>
          <div className="flex items-start gap-3.5">
            <AlertTriangle className="h-4 w-4 text-accent mt-0.5 shrink-0" strokeWidth={1.5} />
            <p className="text-[14px] text-foreground leading-relaxed">{snapshot.fragileArea}</p>
          </div>
          <div className="flex items-start gap-3.5">
            <Repeat className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" strokeWidth={1.5} />
            <p className="text-[14px] text-foreground leading-relaxed">{snapshot.keepDoing}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklySnapshot;
