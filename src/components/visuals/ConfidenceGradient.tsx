import React from "react";

interface ConfidenceItem {
  label: string;
  category: "confident" | "investigating" | "watching";
}

interface ConfidenceGradientProps {
  items: ConfidenceItem[];
  className?: string;
}

const ConfidenceGradient: React.FC<ConfidenceGradientProps> = ({ items, className }) => {
  const height = 320;
  const bandHeight = 60;
  const bandY = 90;
  const padding = 40;
  const width = 880;

  const categoryPositions: Record<string, number[]> = {
    confident: [0.08, 0.16, 0.24, 0.32],
    investigating: [0.44, 0.52, 0.60],
    watching: [0.74, 0.82, 0.90],
  };

  const categoryCounts: Record<string, number> = {
    confident: 0,
    investigating: 0,
    watching: 0,
  };

  const positionedItems = items.map((item) => {
    const positions = categoryPositions[item.category];
    const idx = categoryCounts[item.category];
    categoryCounts[item.category]++;
    const xFrac = positions[idx % positions.length];
    return {
      ...item,
      x: padding + (width - 2 * padding) * xFrac,
      above: idx % 2 === 0,
    };
  });

  return (
    <div className={className}>
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="confidenceGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(174, 45%, 45%)" stopOpacity="0.8" />
            <stop offset="35%" stopColor="hsl(174, 35%, 55%)" stopOpacity="0.5" />
            <stop offset="50%" stopColor="hsl(40, 60%, 60%)" stopOpacity="0.5" />
            <stop offset="65%" stopColor="hsl(40, 50%, 60%)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="hsl(220, 20%, 55%)" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        <text x={padding + (width - 2 * padding) * 0.18} y={bandY - 20} textAnchor="middle" fill="hsl(174, 45%, 35%)" fontSize={11} fontWeight={600} style={{ letterSpacing: "0.15em", fontFamily: "var(--font-sans, Inter, sans-serif)", textTransform: "uppercase" as const }}>CONFIDENT</text>
        <text x={padding + (width - 2 * padding) * 0.52} y={bandY - 20} textAnchor="middle" fill="hsl(40, 60%, 45%)" fontSize={11} fontWeight={600} style={{ letterSpacing: "0.15em", fontFamily: "var(--font-sans, Inter, sans-serif)", textTransform: "uppercase" as const }}>INVESTIGATING</text>
        <text x={padding + (width - 2 * padding) * 0.84} y={bandY - 20} textAnchor="middle" fill="hsl(220, 20%, 45%)" fontSize={11} fontWeight={600} style={{ letterSpacing: "0.15em", fontFamily: "var(--font-sans, Inter, sans-serif)", textTransform: "uppercase" as const }}>WATCHING</text>

        <rect x={padding} y={bandY} width={width - 2 * padding} height={bandHeight} fill="url(#confidenceGrad)" rx={bandHeight / 2} />

        <line x1={padding + (width - 2 * padding) * 0.36} y1={bandY - 4} x2={padding + (width - 2 * padding) * 0.36} y2={bandY + bandHeight + 4} stroke="currentColor" strokeOpacity={0.15} strokeWidth={1} strokeDasharray="2,3" className="text-foreground" />
        <line x1={padding + (width - 2 * padding) * 0.68} y1={bandY - 4} x2={padding + (width - 2 * padding) * 0.68} y2={bandY + bandHeight + 4} stroke="currentColor" strokeOpacity={0.15} strokeWidth={1} strokeDasharray="2,3" className="text-foreground" />

        {positionedItems.map((item, i) => {
          const markerY = bandY + bandHeight / 2;
          const labelY = item.above ? bandY - 40 : bandY + bandHeight + 30;
          const lineEndY = item.above ? bandY : bandY + bandHeight;
          const color =
            item.category === "confident"
              ? "hsl(174, 45%, 35%)"
              : item.category === "investigating"
              ? "hsl(40, 60%, 45%)"
              : "hsl(220, 20%, 45%)";

          return (
            <g key={`marker-${i}`}>
              <line x1={item.x} y1={item.above ? markerY - 6 : markerY + 6} x2={item.x} y2={lineEndY + (item.above ? -8 : 8)} stroke={color} strokeOpacity={0.4} strokeWidth={1} />
              <circle cx={item.x} cy={markerY} r={6} fill="white" stroke={color} strokeWidth={2} />
              <text x={item.x} y={labelY} textAnchor="middle" fill="currentColor" fontSize={11} className="text-foreground font-sans" style={{ fontFamily: "var(--font-sans, Inter, sans-serif)" }}>
                {item.label.length > 35 ? item.label.slice(0, 33) + "…" : item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default ConfidenceGradient;
