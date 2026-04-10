import React from "react";

interface ReversibilityTimelineProps {
  weeks: string[];
  months: string[];
  slow: string[];
  permanent: string[];
  className?: string;
}

const lanes = [
  { key: "weeks" as const, title: "Weeks", subtitle: "Responds fast", color: "hsl(174, 50%, 50%)" },
  { key: "months" as const, title: "Months", subtitle: "Needs time", color: "hsl(200, 45%, 50%)" },
  { key: "slow" as const, title: "Slow", subtitle: "Worth the effort", color: "hsl(40, 50%, 55%)" },
  { key: "permanent" as const, title: "Work around", subtitle: "Harder to reverse", color: "hsl(220, 15%, 55%)" },
];

const ReversibilityTimeline: React.FC<ReversibilityTimelineProps> = ({
  weeks, months, slow, permanent, className,
}) => {
  const data: Record<string, string[]> = { weeks, months, slow, permanent };

  return (
    <div className={className}>
      {/* Timeline axis */}
      <div className="relative mb-2">
        <div className="h-px bg-gradient-to-r from-[hsl(174,50%,50%)]/60 via-[hsl(40,50%,55%)]/40 to-[hsl(220,15%,55%)]/60" />
        <div className="flex justify-between mt-2">
          {lanes.map((lane) => (
            <div key={lane.key} className="text-center" style={{ width: "25%" }}>
              <p className="text-[10px] font-sans font-semibold uppercase" style={{ color: lane.color, letterSpacing: "0.15em" }}>{lane.title}</p>
              <p className="text-[10px] text-muted-foreground/70 font-sans">{lane.subtitle}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Four lanes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mt-6">
        {lanes.map((lane) => (
          <div key={lane.key} className="space-y-2">
            {data[lane.key].length === 0 && (
              <div className="rounded-lg border border-dashed border-border/40 p-3 text-center">
                <p className="text-[10px] text-muted-foreground/50 italic">Nothing here</p>
              </div>
            )}
            {data[lane.key].map((item, idx) => (
              <div
                key={idx}
                className="rounded-lg p-3 border transition-colors hover:border-opacity-60"
                style={{ borderColor: `${lane.color}40`, backgroundColor: `${lane.color}08` }}
              >
                <p className="text-xs md:text-sm text-foreground leading-snug">{item}</p>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-border/40 text-center">
        <p className="text-xs text-muted-foreground italic">
          Biology is path-dependent but rarely frozen. Most of this moves.
        </p>
      </div>
    </div>
  );
};

export default ReversibilityTimeline;
