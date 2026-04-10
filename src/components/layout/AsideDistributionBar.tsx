import React from "react";

interface DistributionSegment {
  label: string;
  value: number;
  color: string;
}

interface AsideDistributionBarProps {
  segments: DistributionSegment[];
  total?: number;
  showLegend?: boolean;
}

const AsideDistributionBar: React.FC<AsideDistributionBarProps> = ({
  segments,
  total,
  showLegend = true,
}) => {
  const sum = total ?? segments.reduce((s, seg) => s + seg.value, 0);

  return (
    <div className="w-full space-y-4">
      <div className="flex h-3 w-full rounded-full overflow-hidden bg-muted/40">
        {segments.map((seg, i) => {
          const pct = sum > 0 ? (seg.value / sum) * 100 : 0;
          return (
            <div
              key={i}
              className="h-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                backgroundColor: seg.color,
              }}
            />
          );
        })}
      </div>

      {showLegend && (
        <div className="space-y-2">
          {segments.map((seg, i) => {
            const pct = sum > 0 ? Math.round((seg.value / sum) * 100) : 0;
            return (
              <div key={i} className="flex items-baseline justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="h-2 w-2 rounded-sm shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <p className="text-xs text-foreground truncate">{seg.label}</p>
                </div>
                <div className="flex items-baseline gap-1.5 shrink-0">
                  <p className="font-serif text-base text-foreground">{seg.value}</p>
                  <p className="text-[10px] text-muted-foreground">{pct}%</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AsideDistributionBar;
