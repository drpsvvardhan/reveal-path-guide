import React from "react";

interface TerrainAxis {
  label: string;
  score: number; // 0-100
}

interface TerrainRadarProps {
  axes: TerrainAxis[];
  size?: number;
  className?: string;
}

const TerrainRadar: React.FC<TerrainRadarProps> = ({ axes, size = 340, className }) => {
  const center = size / 2;
  const maxRadius = size * 0.38;
  const ringCount = 4;
  const axisCount = axes.length;

  const dataPoints = axes.map((axis, i) => {
    const angle = (Math.PI * 2 * i) / axisCount - Math.PI / 2;
    const r = (axis.score / 100) * maxRadius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
      angle,
      label: axis.label,
      score: axis.score,
    };
  });

  const polygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  const axisLines = axes.map((_, i) => {
    const angle = (Math.PI * 2 * i) / axisCount - Math.PI / 2;
    return {
      x2: center + maxRadius * Math.cos(angle),
      y2: center + maxRadius * Math.sin(angle),
    };
  });

  const labelPositions = axes.map((axis, i) => {
    const angle = (Math.PI * 2 * i) / axisCount - Math.PI / 2;
    const labelRadius = maxRadius * 1.22;
    return {
      x: center + labelRadius * Math.cos(angle),
      y: center + labelRadius * Math.sin(angle),
      label: axis.label,
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
    };
  });

  return (
    <div className={className}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        {[...Array(ringCount)].map((_, i) => {
          const r = (maxRadius * (i + 1)) / ringCount;
          return (
            <circle
              key={`ring-${i}`}
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.06}
              strokeWidth={1}
              className="text-foreground"
            />
          );
        })}

        {axisLines.map((line, i) => (
          <line
            key={`axis-${i}`}
            x1={center}
            y1={center}
            x2={line.x2}
            y2={line.y2}
            stroke="currentColor"
            strokeOpacity={0.08}
            strokeWidth={1}
            className="text-foreground"
          />
        ))}

        <polygon
          points={polygonPoints}
          fill="currentColor"
          fillOpacity={0.12}
          stroke="currentColor"
          strokeWidth={1.5}
          className="text-secondary"
        />

        {dataPoints.map((p, i) => (
          <circle
            key={`point-${i}`}
            cx={p.x}
            cy={p.y}
            r={4}
            fill="currentColor"
            className="text-secondary"
          />
        ))}

        {labelPositions.map((pos, i) => (
          <text
            key={`label-${i}`}
            x={pos.x}
            y={pos.y}
            textAnchor={pos.anchor as any}
            dominantBaseline={pos.baseline as any}
            fill="currentColor"
            fontSize={11}
            fontWeight={500}
            className="text-muted-foreground font-sans"
            style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
            {pos.label}
          </text>
        ))}

        {dataPoints.map((p, i) => {
          const offsetR = 18;
          const lx = p.x + offsetR * Math.cos(p.angle);
          const ly = p.y + offsetR * Math.sin(p.angle);
          return (
            <text
              key={`score-${i}`}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="currentColor"
              fontSize={10}
              className="text-foreground font-sans font-medium"
            >
              {p.score}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

export default TerrainRadar;
