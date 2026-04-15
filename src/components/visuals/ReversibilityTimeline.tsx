import React from "react";
import TappableProse from "@/components/terrain/TappableProse";

interface ReversibilityTimelineProps {
  weeks: string[];
  months: string[];
  slow: string[];
  permanent: string[];
  className?: string;
}

const lanes = [
  { key: "weeks" as const, title: "Weeks", subtitle: "Responds fast", color: "hsl(174, 50%, 50%)", icon: "⚡" },
  { key: "months" as const, title: "Months", subtitle: "Needs time", color: "hsl(200, 45%, 50%)", icon: "🔄" },
  { key: "slow" as const, title: "Slow", subtitle: "Worth the effort", color: "hsl(40, 50%, 55%)", icon: "🌱" },
  { key: "permanent" as const, title: "Work around", subtitle: "Harder to reverse", color: "hsl(220, 15%, 55%)", icon: "🪨" },
];

const ReversibilityTimeline: React.FC<ReversibilityTimelineProps> = ({
  weeks, months, slow, permanent, className,
}) => {
  const data: Record<string, string[]> = { weeks, months, slow, permanent };

  return (
    <div className={className}>
      {/* Stacked lane sections — each lane is a full-width row */}
      <div className="space-y-6">
        {lanes.map((lane) => {
          const items = data[lane.key];
          if (items.length === 0) return null;

          return (
            <div key={lane.key}>
              {/* Lane header */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: lane.color }}
                />
                <h3
                  className="text-subhead"
                  style={{ color: lane.color }}
                >
                  {lane.title}
                </h3>
                <span className="text-[11px] text-muted-foreground/60 font-sans">
                  {lane.subtitle} · {items.length} {items.length === 1 ? "item" : "items"}
                </span>
                <div className="flex-1 h-px" style={{ backgroundColor: `${lane.color}25` }} />
              </div>

              {/* Items as a wrapping grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-5">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg px-4 py-3 border transition-colors hover:border-opacity-60"
                    style={{
                      borderColor: `${lane.color}30`,
                      backgroundColor: `${lane.color}0a`,
                      borderLeftWidth: "3px",
                      borderLeftColor: lane.color,
                    }}
                  >
                    <TappableProse text={item} className="text-[14px] text-foreground leading-relaxed" />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 pt-4 border-t border-border/40 text-center">
        <p className="text-xs text-muted-foreground italic">
          Biology is path-dependent but rarely frozen. Most of this moves.
        </p>
      </div>
    </div>
  );
};

export default ReversibilityTimeline;
