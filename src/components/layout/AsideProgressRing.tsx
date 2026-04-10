import React from "react";

interface AsideProgressRingProps {
  percent: number;
  label: string;
  sublabel?: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

const AsideProgressRing: React.FC<AsideProgressRingProps> = ({
  percent,
  label,
  sublabel,
  size = 180,
  strokeWidth = 10,
  color = "hsl(var(--secondary))",
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.min(100, Math.max(0, percent));
  const offset = circumference - (clampedPercent / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeWidth={strokeWidth}
          className="text-foreground"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-serif text-4xl text-foreground leading-none">
          {clampedPercent}
          <span className="text-xl text-muted-foreground">%</span>
        </p>
        <p className="text-[11px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground mt-1">
          {label}
        </p>
        {sublabel && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</p>
        )}
      </div>
    </div>
  );
};

export default AsideProgressRing;
