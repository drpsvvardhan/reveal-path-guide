import React from "react";
import { useManifest } from "@/context/ManifestContext";
import { TrendingUp, AlertTriangle, Repeat, Moon, Droplets, Heart, Flame } from "lucide-react";
import MetricCard from "./MetricCard";

const summaryItems = [
  { label: "Sleep", value: "6.2h", icon: <Moon className="w-4 h-4" strokeWidth={1.5} />, trend: "down" as const, trendLabel: "Slightly below optimal" },
  { label: "Glucose", value: "Stable", icon: <Droplets className="w-4 h-4" strokeWidth={1.5} />, trend: "up" as const, trendLabel: "Trending toward target" },
  { label: "Heart", value: "Good", icon: <Heart className="w-4 h-4" strokeWidth={1.5} />, trend: "stable" as const, trendLabel: "Holding steady" },
  { label: "Activity", value: "4,200", icon: <Flame className="w-4 h-4" strokeWidth={1.5} />, trend: "down" as const, trendLabel: "Below daily target" },
];

const WeeklySnapshot: React.FC = () => {
  const { manifest } = useManifest();
  const snapshot = manifest.weeklySnapshot;

  if (!snapshot) return null;

  return (
    <div className="space-y-8">
      {/* Metric cards — precision instruments */}
      <div className="grid grid-cols-2 gap-3">
        {summaryItems.map((item) => (
          <MetricCard
            key={item.label}
            title={item.label}
            value={item.value}
            trend={item.trend}
            trendLabel={item.trendLabel}
          />
        ))}
      </div>

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
