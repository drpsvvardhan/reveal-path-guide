import React, { useMemo } from "react";
import { ClusterRow } from "@/types/clusters";

type Coordinate = "Energy" | "Inflammation" | "Vascular" | "Regulation" | "Scar";

const COORDINATES: { label: string; short: string; key: Coordinate }[] = [
  { label: "Energy", short: "E", key: "Energy" },
  { label: "Inflammation", short: "I", key: "Inflammation" },
  { label: "Vascular", short: "V", key: "Vascular" },
  { label: "Regulation", short: "R", key: "Regulation" },
  { label: "Scar", short: "Σ", key: "Scar" },
];

const KEYWORD_MAP: [RegExp, Coordinate][] = [
  [/inflammat|immune|barrier|gut/i, "Inflammation"],
  [/cardiovasc|vascular|endothel|particle|hdl|ldl/i, "Vascular"],
  [/regulat|thyroid|adrenal|circadian|autonomic|stress|sleep/i, "Regulation"],
  [/scar|calc|fibrosis|irreversible|historical/i, "Scar"],
  [/metabol|glucose|lipid|hepatic|mitochondrial/i, "Energy"],
];

function classifyKind(kind: string): Coordinate {
  for (const [re, coord] of KEYWORD_MAP) {
    if (re.test(kind)) return coord;
  }
  return "Energy";
}

interface CoherenceMapProps {
  clusters: ClusterRow[];
  className?: string;
}

const CoherenceMap: React.FC<CoherenceMapProps> = ({ clusters, className }) => {
  const size = 260;
  const center = size / 2;
  const maxRadius = size * 0.34;
  const axisCount = 5;

  const coordinateCounts = useMemo(() => {
    const counts: Record<Coordinate, number> = {
      Energy: 0, Inflammation: 0, Vascular: 0, Regulation: 0, Scar: 0,
    };
    clusters.forEach((c) => {
      counts[classifyKind(c.cluster_kind)]++;
    });
    return counts;
  }, [clusters]);

  // Tension edges: clusters with divergent evidence spanning two coordinates
  const tensionEdges = useMemo(() => {
    const edges: { from: number; to: number }[] = [];
    clusters.forEach((c) => {
      const primaryCoord = classifyKind(c.cluster_kind);
      if (c.tensions_held.length === 0) return;
      // Look for divergent evidence that maps to a different coordinate
      const secondaryCoords = new Set<Coordinate>();
      c.constituent_evidence.forEach((ev) => {
        if (ev.direction === "divergent") {
          const summary = ev.value_summary + " " + ev.evidence_kind;
          const mapped = classifyKind(summary);
          if (mapped !== primaryCoord) secondaryCoords.add(mapped);
        }
      });
      const fromIdx = COORDINATES.findIndex((co) => co.key === primaryCoord);
      secondaryCoords.forEach((sec) => {
        const toIdx = COORDINATES.findIndex((co) => co.key === sec);
        if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
          edges.push({ from: fromIdx, to: toIdx });
        }
      });
    });
    return edges;
  }, [clusters]);

  const maxCount = Math.max(1, ...Object.values(coordinateCounts));

  const nodePositions = COORDINATES.map((_, i) => {
    const angle = (Math.PI * 2 * i) / axisCount - Math.PI / 2;
    return {
      x: center + maxRadius * Math.cos(angle),
      y: center + maxRadius * Math.sin(angle),
      angle,
    };
  });

  const labelPositions = COORDINATES.map((coord, i) => {
    const angle = (Math.PI * 2 * i) / axisCount - Math.PI / 2;
    const labelRadius = maxRadius * 1.35;
    return {
      x: center + labelRadius * Math.cos(angle),
      y: center + labelRadius * Math.sin(angle),
      anchor:
        Math.abs(Math.cos(angle)) < 0.3
          ? "middle"
          : Math.cos(angle) > 0
          ? "start"
          : "end",
      baseline:
        Math.abs(Math.sin(angle)) < 0.3
          ? "middle"
          : Math.sin(angle) > 0
          ? "hanging"
          : "alphabetic",
      label: `${coord.label} (${coord.short})`,
    };
  });

  return (
    <div className={className}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible mx-auto"
      >
        {/* Axis lines */}
        {nodePositions.map((pos, i) => (
          <line
            key={`axis-${i}`}
            x1={center}
            y1={center}
            x2={pos.x}
            y2={pos.y}
            stroke="currentColor"
            strokeOpacity={0.08}
            strokeWidth={1}
            className="text-foreground"
          />
        ))}

        {/* Pentagon outline */}
        <polygon
          points={nodePositions.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.06}
          strokeWidth={1}
          className="text-foreground"
        />

        {/* Tension edges */}
        {tensionEdges.map((edge, i) => (
          <line
            key={`tension-${i}`}
            x1={nodePositions[edge.from].x}
            y1={nodePositions[edge.from].y}
            x2={nodePositions[edge.to].x}
            y2={nodePositions[edge.to].y}
            stroke="currentColor"
            strokeOpacity={0.2}
            strokeWidth={1}
            strokeDasharray="4,3"
            className="text-accent"
          />
        ))}

        {/* Nodes — sized by cluster count */}
        {COORDINATES.map((coord, i) => {
          const count = coordinateCounts[coord.key];
          const minR = 6;
          const maxR = 20;
          const r = count > 0 ? minR + ((maxR - minR) * count) / maxCount : 4;
          return (
            <circle
              key={`node-${i}`}
              cx={nodePositions[i].x}
              cy={nodePositions[i].y}
              r={r}
              fill="currentColor"
              fillOpacity={count > 0 ? 0.15 : 0.04}
              stroke="currentColor"
              strokeWidth={count > 0 ? 1.5 : 1}
              strokeOpacity={count > 0 ? 0.6 : 0.15}
              className="text-secondary"
            />
          );
        })}

        {/* Count labels on nodes */}
        {COORDINATES.map((coord, i) => {
          const count = coordinateCounts[coord.key];
          if (count === 0) return null;
          return (
            <text
              key={`count-${i}`}
              x={nodePositions[i].x}
              y={nodePositions[i].y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="currentColor"
              fontSize={10}
              fontWeight={600}
              className="text-foreground font-sans"
            >
              {count}
            </text>
          );
        })}

        {/* Axis labels */}
        {labelPositions.map((pos, i) => (
          <text
            key={`label-${i}`}
            x={pos.x}
            y={pos.y}
            textAnchor={pos.anchor as any}
            dominantBaseline={pos.baseline as any}
            fill="currentColor"
            fontSize={10}
            fontWeight={500}
            className="text-muted-foreground font-sans"
            style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
            {pos.label}
          </text>
        ))}
      </svg>
      <p className="text-[10px] text-muted-foreground text-center mt-2 max-w-[300px] mx-auto leading-relaxed">
        Your terrain across five coordinates. The size of each node is the number of clusters organized around it.
        {tensionEdges.length > 0 && " The dashed lines are tensions your body is currently holding."}
      </p>
    </div>
  );
};

export default CoherenceMap;
