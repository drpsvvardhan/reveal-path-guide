import React from "react";
import type { ParsedTimeSeries } from "@/lib/timeSeriesParser";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TimeSeriesBlockProps {
  series: ParsedTimeSeries;
}

const TimeSeriesBlock: React.FC<TimeSeriesBlockProps> = ({ series }) => {
  const chartData = series.points.map((p) => ({
    date: p.date,
    value: p.value,
    label: new Date(p.date + "T00:00:00").toLocaleDateString("en-US", {
      year: "2-digit",
      month: "short",
    }),
  }));

  return (
    <div className="my-3 rounded-xl border border-border bg-muted/30 p-4">
      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
        {series.marker} ({series.unit})
      </p>

      {/* Sparkline */}
      {chartData.length >= 2 && (
        <div className="h-24 w-full mb-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                formatter={(val: number) => [`${val} ${series.unit}`, series.marker]}
                labelFormatter={(label) => label}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--secondary))"
                strokeWidth={2}
                dot={{ r: 3, fill: "hsl(var(--secondary))" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Data table */}
      <Table>
        <TableHeader>
          <TableRow className="border-border/50">
            <TableHead className="h-8 text-xs">Date</TableHead>
            <TableHead className="h-8 text-xs text-right">
              Value ({series.unit})
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {series.points.map((p, i) => (
            <TableRow key={i} className="border-border/30">
              <TableCell className="py-1.5 text-xs">{p.date}</TableCell>
              <TableCell className="py-1.5 text-xs text-right font-mono">
                {p.value}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default TimeSeriesBlock;
