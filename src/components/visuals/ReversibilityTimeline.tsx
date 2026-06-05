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
      <div className="space-y-8 sm:space-y-10 min-w-0">
        {lanes.map((lane) => {
          const items = data[lane.key];
          if (items.length === 0) return null;

          return (
            <div key={lane.key} className="min-w-0">
              {/* Lane header — large, authoritative */}
              <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1 mb-4 sm:mb-5 min-w-0">
                <span
                  className="text-[22px] sm:text-[28px] font-serif font-semibold tracking-tight break-words"
                  style={{ color: lane.color }}
                >
                  {lane.title}
                </span>
                <span
                  className="text-[13px] sm:text-[14px] font-serif italic text-muted-foreground/70 break-words min-w-0"
                >
                  {lane.subtitle}
                </span>
                <div className="hidden sm:block flex-1 h-px mt-1" style={{ backgroundColor: `${lane.color}30` }} />
                <span
                  className="text-[12px] font-mono font-medium tabular-nums shrink-0 ml-auto sm:ml-0"
                  style={{ color: lane.color }}
                >
                  {items.length}
                </span>
              </div>

              {/* Items grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:pl-1 min-w-0">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl px-4 py-3.5 sm:px-5 sm:py-4 border transition-all hover:shadow-sm min-w-0"
                    style={{
                      borderColor: `${lane.color}25`,
                      backgroundColor: `${lane.color}08`,
                      borderLeftWidth: "4px",
                      borderLeftColor: lane.color,
                    }}
                  >
                    <TappableProse
                      text={item}
                      className="block text-[15px] font-serif text-foreground leading-[1.7] font-normal break-words"
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 sm:mt-10 pt-5 border-t border-border/30 text-center min-w-0">
        <p className="text-[13px] text-muted-foreground italic font-serif break-words">
          Biology is path-dependent but rarely frozen. Most of this moves.
        </p>
      </div>
    </div>
  );
};

export default ReversibilityTimeline;
