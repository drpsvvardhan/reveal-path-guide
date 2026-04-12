import React, { useState, useMemo } from "react";
import { useManifest } from "@/context/ManifestContext";
import { useLabUploads } from "@/context/LabUploadsContext";
import { motion } from "framer-motion";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import AsideInfoPanel from "@/components/layout/AsideInfoPanel";

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border/50 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{payload[0].value}</p>
    </div>
  );
}

interface TrendItem {
  label: string;
  unit: string;
  color: string;
  data: { week: string; value: number }[];
  insight: string;
}

const COLORS = [
  "hsl(340, 55%, 62%)",
  "hsl(200, 55%, 55%)",
  "hsl(260, 40%, 55%)",
  "hsl(155, 40%, 42%)",
  "hsl(30, 55%, 55%)",
];

const JourneySection: React.FC = () => {
  const { manifest, isDemoMode } = useManifest();
  const { observations } = useLabUploads();
  const { studyOverview } = manifest;

  // Build trend data from real lab observations, grouped by canonical_name
  const trends = useMemo((): TrendItem[] => {
    if (observations.length === 0) return [];

    const grouped: Record<string, { name: string; displayName: string; unit: string; points: { date: string; value: number }[] }> = {};

    for (const obs of observations) {
      const key = obs.canonical_name;
      if (!grouped[key]) {
        grouped[key] = {
          name: obs.canonical_name,
          displayName: obs.display_name || obs.canonical_name,
          unit: obs.unit,
          points: [],
        };
      }
      grouped[key].points.push({ date: obs.collection_date, value: Number(obs.value) });
    }

    // Only show biomarkers with data points, sorted by most data first
    return Object.values(grouped)
      .filter((g) => g.points.length > 0)
      .sort((a, b) => b.points.length - a.points.length)
      .slice(0, 8) // Show top 8 biomarkers
      .map((g, i) => ({
        label: g.displayName,
        unit: g.unit,
        color: COLORS[i % COLORS.length],
        data: g.points
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((p, idx) => ({ week: p.date, value: p.value })),
        insight: `${g.displayName}: ${g.points.length} observation${g.points.length > 1 ? "s" : ""} recorded`,
      }));
  }, [observations]);

  // Build aside items from real observations — show latest value for key biomarkers
  const asideItems = useMemo(() => {
    if (observations.length === 0) return [];

    // Pick the most recent observation per canonical_name, show top 4
    const latest: Record<string, { name: string; value: number; unit: string; flag: string | null }> = {};
    for (const obs of observations) {
      const existing = latest[obs.canonical_name];
      if (!existing || obs.collection_date > (existing as any).date) {
        latest[obs.canonical_name] = {
          name: obs.display_name || obs.canonical_name,
          value: Number(obs.value),
          unit: obs.unit,
          flag: obs.flag,
        };
      }
    }

    return Object.values(latest).slice(0, 5).map((item) => ({
      label: item.name,
      value: `${item.value} ${item.unit}`,
      subvalue: item.flag === "H" ? "High" : item.flag === "L" ? "Low" : "Normal",
      tone: (item.flag === "H" || item.flag === "L" ? "warning" : "success") as "warning" | "success",
    }));
  }, [observations]);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const activeTrend = trends[selectedIdx] || null;

  return (
    <PatientSectionLayout
      eyebrow="YOUR JOURNEY"
      title="Here's what we found"
      intro={studyOverview.summary}
      aside={
        asideItems.length > 0 ? (
          <AsideInfoPanel
            title="Latest results"
            subtitle="From your uploaded labs"
            items={asideItems}
          />
        ) : undefined
      }
      asideSticky
    >
      {studyOverview.statLine && (
        <div className="inline-flex items-center gap-2 rounded-full bg-lavender-light px-4 py-2 text-sm text-foreground">
          {studyOverview.statLine}
        </div>
      )}

      {studyOverview.layers.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {studyOverview.layers.map((layer) => (
            <div
              key={layer.id}
              className={`rounded-xl border p-5 transition-all ${
                layer.status === "complete"
                  ? "border-secondary/30 bg-sky-light"
                  : layer.status === "in-progress"
                  ? "border-amber/30 bg-amber-light"
                  : "border-border bg-card opacity-75"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{layer.icon}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-sans font-medium ${
                    layer.status === "complete"
                      ? "bg-secondary/15 text-secondary"
                      : layer.status === "in-progress"
                      ? "bg-amber/15 text-amber"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {layer.status === "complete" ? "Complete" : layer.status === "in-progress" ? "In Progress" : "Pending"}
                </span>
              </div>
              <h3 className="font-serif text-lg mb-1">{layer.title}</h3>
              <p className="text-sm text-muted-foreground">{layer.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Trend lines — only when real data exists */}
      {trends.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground">
            Your Biomarkers
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {trends.map((t, idx) => (
              <button
                key={t.label}
                onClick={() => setSelectedIdx(idx)}
                className={`shrink-0 px-4 py-2 rounded-full text-xs font-sans font-medium transition-all ${
                  selectedIdx === idx
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-muted text-muted-foreground border border-transparent hover:bg-muted/80"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTrend && (
            <motion.div
              key={selectedIdx}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-sans font-semibold text-sm text-foreground">{activeTrend.label}</h4>
                <span className="text-xs text-muted-foreground">{activeTrend.unit}</span>
              </div>
              {activeTrend.data.length > 1 ? (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activeTrend.data}>
                      <defs>
                        <linearGradient id={`grad-${selectedIdx}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={activeTrend.color} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={activeTrend.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 12%, 84%)" />
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(225, 15%, 42%)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(225, 15%, 42%)" }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone" dataKey="value"
                        stroke={activeTrend.color} strokeWidth={2}
                        fill={`url(#grad-${selectedIdx})`}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
                  <p>{activeTrend.data[0]?.value} {activeTrend.unit} — single observation</p>
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-border/30">
                <p className="text-sm text-foreground leading-relaxed">{activeTrend.insight}</p>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Empty state when no data at all */}
      {trends.length === 0 && studyOverview.layers.length === 0 && (
        <div className="rounded-xl border border-border bg-card/40 p-8 text-center">
          <p className="text-muted-foreground text-sm">
            Upload lab reports or complete your intake to see your biomarker trends here.
          </p>
        </div>
      )}

      {manifest.todayBar?.lastUpdated && (
        <p className="text-[10px] text-muted-foreground italic pt-2">
          {manifest.todayBar.lastUpdated}
        </p>
      )}
    </PatientSectionLayout>
  );
};

export default JourneySection;
