import React, { useState } from "react";
import { BiomarkerObservation } from "@/types/manifest";

interface BiomarkerTimelineProps {
  observations: BiomarkerObservation[];
  className?: string;
}

const BiomarkerTimeline: React.FC<BiomarkerTimelineProps> = ({ observations, className }) => {
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);

  const byMarker: Record<string, BiomarkerObservation[]> = {};
  for (const obs of observations) {
    if (!byMarker[obs.name]) byMarker[obs.name] = [];
    byMarker[obs.name].push(obs);
  }

  const topMarkers = Object.entries(byMarker)
    .filter(([, obs]) => obs.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 4)
    .map(([name]) => name);

  if (topMarkers.length === 0) {
    return (
      <div className={`rounded-xl border border-border bg-card/50 p-5 ${className || ""}`}>
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.2em] text-muted-foreground mb-3">BIOMARKER TIMELINE</p>
        <p className="text-xs text-muted-foreground italic">
          Upload more labs to see your biomarker trends over time. At least two measurements per marker are needed.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-border bg-card/50 p-5 space-y-4 ${className || ""}`}>
      <div>
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1">BIOMARKER TIMELINE</p>
        <p className="text-[11px] text-muted-foreground">Your most-tracked markers over time</p>
      </div>
      <div className="space-y-5">
        {topMarkers.map((markerName) => (
          <MiniLineChart
            key={markerName}
            name={markerName}
            observations={byMarker[markerName]}
            highlighted={selectedMarker === markerName}
            onHover={() => setSelectedMarker(markerName)}
            onLeave={() => setSelectedMarker(null)}
          />
        ))}
      </div>
    </div>
  );
};

const MiniLineChart: React.FC<{
  name: string;
  observations: BiomarkerObservation[];
  highlighted: boolean;
  onHover: () => void;
  onLeave: () => void;
}> = ({ name, observations, highlighted, onHover, onLeave }) => {
  const width = 280;
  const height = 50;
  const pad = 4;

  const sorted = [...observations].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const values = sorted.map((o) => o.value);
  const refLow = sorted.find((o) => o.refLow != null)?.refLow;
  const refHigh = sorted.find((o) => o.refHigh != null)?.refHigh;
  const minVal = Math.min(...values, refLow ?? Infinity);
  const maxVal = Math.max(...values, refHigh ?? -Infinity);
  const range = maxVal - minVal || 1;

  const points = sorted.map((obs, i) => {
    const x = pad + ((width - 2 * pad) * i) / (sorted.length - 1 || 1);
    const y = pad + (height - 2 * pad) * (1 - (obs.value - minVal) / range);
    return { x, y, value: obs.value, unit: obs.unit, date: obs.timestamp, flag: obs.flag };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  const latest = sorted[sorted.length - 1];
  const first = sorted[0];
  const delta = latest.value - first.value;
  const deltaSymbol = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
  const deltaColor =
    latest.flag === "high" || latest.flag === "critical"
      ? "text-amber-700"
      : latest.flag === "low"
      ? "text-blue-700"
      : "text-muted-foreground";

  const refBandTop = refHigh != null ? pad + (height - 2 * pad) * (1 - (refHigh - minVal) / range) : null;
  const refBandBottom = refLow != null ? pad + (height - 2 * pad) * (1 - (refLow - minVal) / range) : null;

  return (
    <div onMouseEnter={onHover} onMouseLeave={onLeave} className="space-y-1 cursor-default">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-foreground truncate">{name}</p>
        <div className="flex items-baseline gap-1 shrink-0">
          <span className="text-xs font-mono text-foreground">{latest.value} {latest.unit}</span>
          <span className={`text-[10px] ${deltaColor}`}>{deltaSymbol}</span>
        </div>
      </div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
        {refBandTop != null && refBandBottom != null && (
          <rect x={0} y={refBandTop} width={width} height={refBandBottom - refBandTop} fill="hsl(174, 40%, 50%)" fillOpacity={0.06} />
        )}
        <path d={pathD} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={highlighted ? "text-secondary" : "text-foreground/60"} />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="currentColor" className={highlighted ? "text-secondary" : "text-foreground/60"} />
        ))}
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={4} fill="none" stroke="currentColor" strokeWidth={1.5} className={latest.flag === "high" ? "text-amber-600" : latest.flag === "low" ? "text-blue-600" : "text-success"} />
      </svg>
      <div className="flex justify-between text-[9px] text-muted-foreground/60">
        <span>{first.timestamp.slice(0, 7)}</span>
        <span>{latest.timestamp.slice(0, 7)}</span>
      </div>
    </div>
  );
};

export default BiomarkerTimeline;
