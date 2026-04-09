import React from "react";
import { useManifest } from "@/context/ManifestContext";
import { TrendingUp, AlertTriangle, Repeat, Moon, Droplets, Heart, Flame } from "lucide-react";
import MetricCard from "./MetricCard";

const summaryItems = [
  { label: "Sleep", value: "6.2h", icon: <Moon className="w-4 h-4" />, trend: "down" as const, trendLabel: "0.5h less" },
  { label: "Glucose", value: "Stable", icon: <Droplets className="w-4 h-4" />, trend: "up" as const, trendLabel: "Improving" },
  { label: "Heart", value: "Good", icon: <Heart className="w-4 h-4" />, trend: "stable" as const, trendLabel: "Steady" },
  { label: "Activity", value: "4,200", icon: <Flame className="w-4 h-4" />, trend: "down" as const, trendLabel: "Below goal" },
];

const WeeklySnapshot: React.FC = () => {
  const { manifest } = useManifest();
  const snapshot = manifest.weeklySnapshot;

  if (!snapshot) return null;

  return (
    <div className="space-y-4">
      {/* Metric cards grid */}
      <div className="grid grid-cols-2 gap-3">
        {summaryItems.map((item) => (
          <MetricCard
            key={item.label}
            title={item.label}
            value={item.value}
            icon={item.icon}
            trend={item.trend}
            trendLabel={item.trendLabel}
          />
        ))}
      </div>

      {/* Weekly insight strip */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-primary">
            This week
          </h3>
          {snapshot.periodLabel && (
            <span className="text-[10px] text-muted-foreground italic">{snapshot.periodLabel}</span>
          )}
        </div>

        <div className="space-y-2.5">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-4 w-4 text-success mt-0.5 shrink-0" />
            <p className="text-sm text-foreground leading-snug">{snapshot.keyImprovement}</p>
          </div>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-accent mt-0.5 shrink-0" />
            <p className="text-sm text-foreground leading-snug">{snapshot.fragileArea}</p>
          </div>
          <div className="flex items-start gap-3">
            <Repeat className="h-4 w-4 text-secondary mt-0.5 shrink-0" />
            <p className="text-sm text-foreground leading-snug">{snapshot.keepDoing}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklySnapshot;
