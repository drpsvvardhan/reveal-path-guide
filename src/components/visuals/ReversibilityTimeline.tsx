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
      <div className="space-y-10">
        {lanes.map((lane) => {
          const items = data[lane.key];
          if (items.length === 0) return null;

          return (
            <div key={lane.key}>
              {/* Lane header — large, authoritative */}
              <div className="flex items-baseline gap-4 mb-5">
                <span
                  className="text-[28px] font-serif font-semibold tracking-tight"
                  style={{ color: lane.color }}
                >
                  {lane.title}
                </span>
                <span
                  className="text-[14px] font-serif italic text-muted-foreground/70"
                >
                  {lane.subtitle}
                </span>
                <div className="flex-1 h-px mt-1" style={{ backgroundColor: `${lane.color}30` }} />
                <span
                  className="text-[12px] font-mono font-medium tabular-nums"
                  style={{ color: lane.color }}
                >
                  {items.length}
                </span>
              </div>

              {/* Items grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-1">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl px-5 py-4 border transition-all hover:shadow-sm"
                    style={{
                      borderColor: `${lane.color}25`,
                      backgroundColor: `${lane.color}08`,
                      borderLeftWidth: "4px",
                      borderLeftColor: lane.color,
                    }}
                  >
                    <TappableProse
                      text={item}
                      className="text-[15px] font-serif text-foreground leading-[1.7] font-normal"
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 pt-5 border-t border-border/30 text-center">
        <p className="text-[13px] text-muted-foreground italic font-serif">
          Biology is path-dependent but rarely frozen. Most of this moves.
        </p>
      </div>
    </div>
  );
};

export default ReversibilityTimeline;
