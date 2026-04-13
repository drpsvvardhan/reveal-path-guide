import React, { useState, useMemo } from "react";
import { BiomarkerObservation } from "@/types/manifest";
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BiomarkerTimelineProps {
  observations: BiomarkerObservation[];
  className?: string;
}

const toDateKey = (ts: string) => ts.slice(0, 10);

/** Categorize markers by clinical priority */
const prioritizeMarkers = (byMarker: Record<string, BiomarkerObservation[]>) => {
  const flagged: string[] = [];    // Out-of-range latest value
  const trending: string[] = [];   // In-range but has trend (≥2 dates)
  const baseline: string[] = [];   // Single date only

  for (const [name, obs] of Object.entries(byMarker)) {
    const sorted = [...obs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const latest = sorted[0];
    const distinctDates = new Set(obs.map((o) => toDateKey(o.timestamp)));
    const hasTrend = distinctDates.size >= 2;
    const isOutOfRange = latest.flag === "high" || latest.flag === "low" || latest.flag === "critical";

    if (isOutOfRange) {
      flagged.push(name);
    } else if (hasTrend) {
      trending.push(name);
    } else {
      baseline.push(name);
    }
  }

  // Sort each group by observation count descending
  const sortByCount = (a: string, b: string) => byMarker[b].length - byMarker[a].length;
  flagged.sort(sortByCount);
  trending.sort(sortByCount);
  baseline.sort(sortByCount);

  return { flagged, trending, baseline };
};

const BiomarkerTimeline: React.FC<BiomarkerTimelineProps> = ({ observations, className }) => {
  const [showAll, setShowAll] = useState(false);

  const byMarker = useMemo(() => {
    const map: Record<string, BiomarkerObservation[]> = {};
    for (const obs of observations) {
      if (!map[obs.name]) map[obs.name] = [];
      map[obs.name].push(obs);
    }
    return map;
  }, [observations]);

  const { flagged, trending, baseline } = useMemo(() => prioritizeMarkers(byMarker), [byMarker]);

  const totalMarkers = flagged.length + trending.length + baseline.length;

  if (totalMarkers === 0) {
    return (
      <div className={`rounded-xl border border-border bg-card/50 p-5 ${className || ""}`}>
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.2em] text-muted-foreground mb-3">BIOMARKER TIMELINE</p>
        <p className="text-xs text-muted-foreground italic">
          Upload more labs to see your biomarker trends over time.
        </p>
      </div>
    );
  }

  // Snapshot: top 4 flagged, then trending to fill
  const snapshotCount = 4;
  const snapshot = [...flagged, ...trending].slice(0, snapshotCount);
  const remaining = [...flagged, ...trending, ...baseline].filter((n) => !snapshot.includes(n));
  const hasMore = remaining.length > 0;

  // "Watch next" — flagged markers with only 1 date (need retest)
  const watchNext = flagged.filter((name) => {
    const distinctDates = new Set(byMarker[name].map((o) => toDateKey(o.timestamp)));
    return distinctDates.size < 2;
  }).slice(0, 3);

  // Flagged markers with trends — these are the ones that matter most for "follow next"
  const followNext = flagged.filter((name) => {
    const distinctDates = new Set(byMarker[name].map((o) => toDateKey(o.timestamp)));
    return distinctDates.size >= 2;
  }).slice(0, 3);

  return (
    <div className={`rounded-xl border border-border bg-card/50 p-5 space-y-4 ${className || ""}`}>
      {/* Header */}
      <div>
        <p className="text-[10px] font-sans font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1">
          BIOMARKER TIMELINE
        </p>
        <p className="text-[11px] text-muted-foreground">
          {flagged.length > 0
            ? `${flagged.length} marker${flagged.length !== 1 ? "s" : ""} out of range · ${trending.length} tracking normally`
            : `${trending.length} marker${trending.length !== 1 ? "s" : ""} tracking over time`}
        </p>
      </div>

      {/* Snapshot — top priority markers */}
      <div className="space-y-4">
        {snapshot.map((name) => {
          const obs = byMarker[name];
          const distinctDates = new Set(obs.map((o) => toDateKey(o.timestamp)));
          return distinctDates.size >= 2 ? (
            <MiniLineChart key={name} name={name} observations={obs} />
          ) : (
            <SingleMeasurementCard key={name} name={name} observations={obs} />
          );
        })}
      </div>

      {/* What to follow next */}
      {(followNext.length > 0 || watchNext.length > 0) && (
        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Eye className="h-3 w-3 text-muted-foreground" />
            <p className="text-[10px] font-sans font-medium uppercase tracking-[0.2em] text-muted-foreground">
              FOLLOW NEXT
            </p>
          </div>
          {followNext.map((name) => {
            const obs = byMarker[name];
            const sorted = [...obs].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
            const first = sorted[0];
            const latest = sorted[sorted.length - 1];
            const delta = latest.value - first.value;
            const direction = delta > 0 ? "rising" : delta < 0 ? "falling" : "stable";
            return (
              <div key={name} className="flex items-center gap-2 py-1">
                <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                <span className="text-[11px] text-foreground font-medium truncate">{name}</span>
                <span className="text-[10px] text-muted-foreground">— {direction}, still out of range</span>
              </div>
            );
          })}
          {watchNext.map((name) => {
            const latest = [...byMarker[name]].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
            return (
              <div key={name} className="flex items-center gap-2 py-1">
                <TrendingUp className="h-3 w-3 text-blue-600 shrink-0" />
                <span className="text-[11px] text-foreground font-medium truncate">{name}</span>
                <span className="text-[10px] text-muted-foreground">— retest needed ({latest.value} {latest.unit})</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Expand all */}
      {hasMore && (
        <>
          <button
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-1 border-t border-border pt-3"
          >
            {showAll ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showAll ? "Show less" : `Show all ${totalMarkers} markers`}
          </button>
          <AnimatePresence>
            {showAll && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 overflow-hidden"
              >
                {remaining.map((name) => {
                  const obs = byMarker[name];
                  const distinctDates = new Set(obs.map((o) => toDateKey(o.timestamp)));
                  return distinctDates.size >= 2 ? (
                    <MiniLineChart key={name} name={name} observations={obs} />
                  ) : (
                    <SingleMeasurementCard key={name} name={name} observations={obs} />
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};

/** Card for markers with only one calendar date */
const SingleMeasurementCard: React.FC<{
  name: string;
  observations: BiomarkerObservation[];
}> = ({ name, observations }) => {
  const sorted = [...observations].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const latest = sorted[0];
  const isOutOfRange = latest.flag === "high" || latest.flag === "low" || latest.flag === "critical";

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <p className={`text-xs font-medium truncate ${isOutOfRange ? "text-amber-700" : "text-foreground"}`}>{name}</p>
        <div className="flex items-baseline gap-1 shrink-0">
          <span className="text-xs font-mono text-foreground">{latest.value} {latest.unit}</span>
          {latest.flag && latest.flag !== "normal" && (
            <span className={`text-[9px] uppercase font-medium ${latest.flag === "critical" ? "text-red-600" : latest.flag === "high" ? "text-amber-600" : "text-blue-600"}`}>
              {latest.flag}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 py-2">
        <svg width={280} height={20} viewBox="0 0 280 20" className="w-full">
          <circle cx={140} cy={10} r={4} fill="currentColor" className={isOutOfRange ? "text-amber-500/60" : "text-foreground/40"} />
        </svg>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[9px] text-muted-foreground/60">{toDateKey(latest.timestamp)}</span>
        <span className="text-[9px] text-muted-foreground italic">Awaiting second measurement</span>
      </div>
    </div>
  );
};

const MiniLineChart: React.FC<{
  name: string;
  observations: BiomarkerObservation[];
}> = ({ name, observations }) => {
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
  const isOutOfRange = latest.flag === "high" || latest.flag === "low" || latest.flag === "critical";
  const lineColor = isOutOfRange ? "text-amber-600/70" : "text-foreground/60";
  const deltaColor = isOutOfRange
    ? latest.flag === "low" ? "text-blue-700" : "text-amber-700"
    : "text-muted-foreground";

  const refBandTop = refHigh != null ? pad + (height - 2 * pad) * (1 - (refHigh - minVal) / range) : null;
  const refBandBottom = refLow != null ? pad + (height - 2 * pad) * (1 - (refLow - minVal) / range) : null;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <p className={`text-xs font-medium truncate ${isOutOfRange ? "text-amber-700" : "text-foreground"}`}>{name}</p>
        <div className="flex items-baseline gap-1 shrink-0">
          <span className="text-xs font-mono text-foreground">{latest.value} {latest.unit}</span>
          <span className={`text-[10px] ${deltaColor}`}>{deltaSymbol}</span>
        </div>
      </div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
        {refBandTop != null && refBandBottom != null && (
          <rect x={0} y={refBandTop} width={width} height={refBandBottom - refBandTop} fill="hsl(174, 40%, 50%)" fillOpacity={0.06} />
        )}
        <path d={pathD} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={lineColor} />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="currentColor" className={lineColor} />
        ))}
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={4} fill="none" stroke="currentColor" strokeWidth={1.5} className={isOutOfRange ? "text-amber-600" : "text-teal-600"} />
      </svg>
      <div className="flex justify-between text-[9px] text-muted-foreground/60">
        <span>{toDateKey(first.timestamp)}</span>
        <span>{toDateKey(latest.timestamp)}</span>
      </div>
    </div>
  );
};

export default BiomarkerTimeline;
