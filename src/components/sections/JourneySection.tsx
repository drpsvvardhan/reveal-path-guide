import React, { useState } from "react";
import { useManifest } from "@/context/ManifestContext";
import { motion } from "framer-motion";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import AsideInfoPanel from "@/components/layout/AsideInfoPanel";

const trendData = {
  inflammation: {
    label: "Inflammation (CRP)", unit: "mg/L", color: "hsl(340, 55%, 62%)",
    data: [
      { week: "W1", value: 4.2 }, { week: "W2", value: 3.9 }, { week: "W3", value: 3.8 },
      { week: "W4", value: 3.5 }, { week: "W5", value: 3.6 }, { week: "W6", value: 3.2 },
      { week: "W7", value: 3.0 }, { week: "W8", value: 2.8 },
    ],
    insight: "CRP trending down from 4.2 to 2.8. Clear improvement in systemic inflammation.",
    progressType: "stable" as const,
  },
  glucose: {
    label: "Glucose Stability", unit: "mg/dL", color: "hsl(200, 55%, 55%)",
    data: [
      { week: "W1", value: 128 }, { week: "W2", value: 122 }, { week: "W3", value: 118 },
      { week: "W4", value: 115 }, { week: "W5", value: 119 }, { week: "W6", value: 112 },
      { week: "W7", value: 108 }, { week: "W8", value: 105 },
    ],
    insight: "Fasting glucose improving consistently. Post-meal spikes are getting smaller.",
    progressType: "stable" as const,
  },
  sleep: {
    label: "Sleep Duration", unit: "hrs", color: "hsl(260, 40%, 55%)",
    data: [
      { week: "W1", value: 5.8 }, { week: "W2", value: 6.1 }, { week: "W3", value: 5.9 },
      { week: "W4", value: 6.4 }, { week: "W5", value: 6.0 }, { week: "W6", value: 6.3 },
      { week: "W7", value: 5.7 }, { week: "W8", value: 6.2 },
    ],
    insight: "Sleep is inconsistent — averaging 6.1h with dips below 6.",
    progressType: "fragile" as const,
  },
  energy: {
    label: "Daily Steps", unit: "steps", color: "hsl(155, 40%, 42%)",
    data: [
      { week: "W1", value: 3200 }, { week: "W2", value: 4100 }, { week: "W3", value: 3800 },
      { week: "W4", value: 5200 }, { week: "W5", value: 4600 }, { week: "W6", value: 5800 },
      { week: "W7", value: 5100 }, { week: "W8", value: 4200 },
    ],
    insight: "Activity varies. Consistency matters more than occasional peaks.",
    progressType: "fragile" as const,
  },
};

type TrendKey = keyof typeof trendData;

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border/50 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{payload[0].value}</p>
    </div>
  );
}

const JourneySection: React.FC = () => {
  const { manifest } = useManifest();
  const { studyOverview } = manifest;
  const [selectedTrend, setSelectedTrend] = useState<TrendKey>("inflammation");
  const activeTrend = trendData[selectedTrend];

  return (
    <PatientSectionLayout
      eyebrow="YOUR JOURNEY"
      title="Here's what we found"
      intro={studyOverview.summary}
      aside={
        <AsideInfoPanel
          title="Today's metrics"
          items={[
            { label: "Sleep", value: "6.2 hrs", subvalue: "+0.5h vs last week", tone: "accent" },
            { label: "Glucose", value: "Stable", subvalue: "Improving", tone: "success" },
            { label: "Heart", value: "Good", subvalue: "Steady" },
            { label: "Activity", value: "4,200 steps", subvalue: "Below goal", tone: "warning" },
          ]}
          footnote="Updated from your latest tracker sync · 2 hours ago"
        />
      }
      asideSticky
    >
      <div className="inline-flex items-center gap-2 rounded-full bg-lavender-light px-4 py-2 text-sm text-foreground">
        {studyOverview.statLine}
      </div>

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

      {/* Trend lines */}
      <div className="space-y-4">
        <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground">
          Your Trends
        </h3>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {(Object.keys(trendData) as TrendKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setSelectedTrend(key)}
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-sans font-medium transition-all ${
                selectedTrend === key
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "bg-muted text-muted-foreground border border-transparent hover:bg-muted/80"
              }`}
            >
              {trendData[key].label}
            </button>
          ))}
        </div>

        <motion.div
          key={selectedTrend}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-sans font-semibold text-sm text-foreground">{activeTrend.label}</h4>
            <span className="text-xs text-muted-foreground">{activeTrend.unit}</span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activeTrend.data}>
                <defs>
                  <linearGradient id={`grad-${selectedTrend}`} x1="0" y1="0" x2="0" y2="1">
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
                  fill={`url(#grad-${selectedTrend})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 pt-3 border-t border-border/30">
            <p className="text-sm text-foreground leading-relaxed">{activeTrend.insight}</p>
            <div className={`flex items-center gap-2 text-xs font-medium mt-1.5 ${
              activeTrend.progressType === "stable" ? "text-success" : "text-accent"
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                activeTrend.progressType === "stable" ? "bg-success" : "bg-accent"
              }`} />
              {activeTrend.progressType === "stable" ? "Stable progress" : "Fragile — needs consistency"}
            </div>
          </div>
        </motion.div>
      </div>

      {manifest.todayBar?.lastUpdated && (
        <p className="text-[10px] text-muted-foreground italic pt-2">
          {manifest.todayBar.lastUpdated}
        </p>
      )}
    </PatientSectionLayout>
  );
};

export default JourneySection;
