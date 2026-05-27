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
  const bandHeight = 56;
  const bandY = 140;
  const padding = 40;
  const width = 880;
  const height = 380;

  // Each category occupies a fractional sub-range of the band.
  const categoryRanges: Record<string, [number, number]> = {
    confident: [0.03, 0.33],
    investigating: [0.42, 0.62],
    watching: [0.72, 0.92],
  };

  const grouped: Record<string, ConfidenceItem[]> = {
    confident: [],
    investigating: [],
    watching: [],
  };
  items.forEach((it) => grouped[it.category]?.push(it));

  // Distribute items evenly inside their range and stagger labels across
  // 2 rows above and 2 rows below to avoid collisions on long labels.
  const positionedItems = (Object.keys(grouped) as Array<keyof typeof grouped>).flatMap(
    (cat) => {
      const list = grouped[cat];
      const [lo, hi] = categoryRanges[cat];
      return list.map((item, idx) => {
        const frac =
          list.length === 1 ? (lo + hi) / 2 : lo + ((hi - lo) * idx) / (list.length - 1);
        const row = idx % 4; // 0,1,2,3 → above-far, below-far, above-near, below-near
        const above = row % 2 === 0;
        const tier = row < 2 ? 1 : 0;
        return {
          ...item,
          x: padding + (width - 2 * padding) * frac,
          above,
          tier, // 0 = closer to band, 1 = farther
        };
      });
    }
  );

  const truncate = (s: string) => (s.length > 22 ? s.slice(0, 20) + "…" : s);

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

        <text x={padding + (width - 2 * padding) * 0.18} y={bandY - 78} textAnchor="middle" fill="hsl(174, 45%, 35%)" fontSize={11} fontWeight={600} style={{ letterSpacing: "0.15em", fontFamily: "var(--font-sans, Inter, sans-serif)", textTransform: "uppercase" as const }}>CONFIDENT</text>
        <text x={padding + (width - 2 * padding) * 0.52} y={bandY - 78} textAnchor="middle" fill="hsl(40, 60%, 45%)" fontSize={11} fontWeight={600} style={{ letterSpacing: "0.15em", fontFamily: "var(--font-sans, Inter, sans-serif)", textTransform: "uppercase" as const }}>INVESTIGATING</text>
        <text x={padding + (width - 2 * padding) * 0.84} y={bandY - 78} textAnchor="middle" fill="hsl(220, 20%, 45%)" fontSize={11} fontWeight={600} style={{ letterSpacing: "0.15em", fontFamily: "var(--font-sans, Inter, sans-serif)", textTransform: "uppercase" as const }}>WATCHING</text>

        <rect x={padding} y={bandY} width={width - 2 * padding} height={bandHeight} fill="url(#confidenceGrad)" rx={bandHeight / 2} />

        <line x1={padding + (width - 2 * padding) * 0.36} y1={bandY - 4} x2={padding + (width - 2 * padding) * 0.36} y2={bandY + bandHeight + 4} stroke="currentColor" strokeOpacity={0.15} strokeWidth={1} strokeDasharray="2,3" className="text-foreground" />
        <line x1={padding + (width - 2 * padding) * 0.68} y1={bandY - 4} x2={padding + (width - 2 * padding) * 0.68} y2={bandY + bandHeight + 4} stroke="currentColor" strokeOpacity={0.15} strokeWidth={1} strokeDasharray="2,3" className="text-foreground" />

        {positionedItems.map((item, i) => {
          const markerY = bandY + bandHeight / 2;
          const tierOffset = item.tier === 0 ? 0 : 28;
          const labelY = item.above
            ? bandY - 18 - tierOffset
            : bandY + bandHeight + 22 + tierOffset;
          const lineEndY = item.above ? labelY + 6 : labelY - 12;
          const color =
            item.category === "confident"
              ? "hsl(174, 45%, 35%)"
              : item.category === "investigating"
              ? "hsl(40, 60%, 45%)"
              : "hsl(220, 20%, 45%)";

          return (
            <g key={`marker-${i}`}>
              <line x1={item.x} y1={item.above ? markerY - 6 : markerY + 6} x2={item.x} y2={lineEndY} stroke={color} strokeOpacity={0.35} strokeWidth={1} />
              <circle cx={item.x} cy={markerY} r={6} fill="white" stroke={color} strokeWidth={2} />
              <text x={item.x} y={labelY} textAnchor="middle" fill="currentColor" fontSize={11} className="text-foreground font-sans" style={{ fontFamily: "var(--font-sans, Inter, sans-serif)" }}>
                {truncate(item.label)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default ConfidenceGradient;
