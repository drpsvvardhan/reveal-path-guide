import React from "react";
import type { ParsedTimeSeries } from "@/lib/timeSeriesParser";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { computeTrajectoryShape } from "@/lib/timeSeriesParser";

interface TimeSeriesBlockProps {
  series: ParsedTimeSeries;
}

const shapeLabels: Record<string, { label: string; icon: React.FC<any> }> = {
  monotonic_up: { label: "Trending up", icon: TrendingUp },
  monotonic_down: { label: "Trending down", icon: TrendingDown },
  peak: { label: "Peaked then returned", icon: TrendingDown },
  valley: { label: "Dipped then recovered", icon: TrendingUp },
  stable: { label: "Stable", icon: Minus },
  oscillating: { label: "Variable", icon: Minus },
  other: { label: "", icon: Minus },
};

const TimeSeriesBlock: React.FC<TimeSeriesBlockProps> = ({ series }) => {
  const chartData = series.points.map((p) => ({
    date: p.date,
    value: p.value,
    label: new Date(p.date + "T00:00:00").toLocaleDateString("en-US", {
      year: "2-digit",
      month: "short",
    }),
  }));

  const shape = computeTrajectoryShape(series.points.map((p) => p.value));
  const shapeMeta = shapeLabels[shape] || shapeLabels.other;
  const ShapeIcon = shapeMeta.icon;

  const minVal = Math.min(...series.points.map((p) => p.value));
  const maxVal = Math.max(...series.points.map((p) => p.value));
  const latestVal = series.points[series.points.length - 1]?.value;

  return (
    <div className="my-2 rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground tracking-wide">
            {series.marker}
          </span>
          <span className="text-[10px] text-muted-foreground">({series.unit})</span>
        </div>
        <div className="flex items-center gap-1.5">
          {shapeMeta.label && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <ShapeIcon className="h-3 w-3" />
              {shapeMeta.label}
            </span>
          )}
          <span className="text-sm font-mono font-semibold text-foreground ml-2">
            {latestVal} {series.unit}
          </span>
        </div>
      </div>

      {/* Sparkline */}
      {chartData.length >= 2 && (
        <div className="h-28 w-full px-2 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[Math.floor(minVal * 0.9), Math.ceil(maxVal * 1.1)]}
                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                formatter={(val: number) => [`${val} ${series.unit}`, series.marker]}
                labelFormatter={(label) => label}
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--secondary))"
                strokeWidth={2}
                dot={{ r: 3.5, fill: "hsl(var(--secondary))", strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Compact data rows */}
      <div className="px-4 py-2 space-y-0.5">
        {series.points.map((p, i) => (
          <div key={i} className="flex items-center justify-between py-0.5">
            <span className="text-[11px] text-muted-foreground">
              {new Date(p.date + "T00:00:00").toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="text-[12px] font-mono text-foreground font-medium">
              {p.value} {series.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TimeSeriesBlock;
