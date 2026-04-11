import React from "react";
import { CIE_DOMAINS, CIE_DOMAIN_MAP } from "@/lib/cieSeedData";
import { useIntake, type IntakePhase } from "@/context/IntakeContext";

const AXIS_COLORS: Record<string, string> = {
  A: "bg-amber-500",
  B: "bg-rose-500",
  C: "bg-violet-500",
  D: "bg-emerald-500",
  E: "bg-blue-500",
  F: "bg-orange-500",
  G: "bg-pink-500",
  H: "bg-teal-500",
  I: "bg-cyan-500",
  J: "bg-indigo-500",
};

interface IntakeProgressProps {
  currentDomainId: string;
  phase: IntakePhase;
  current: number;
  total: number;
}

const IntakeProgress: React.FC<IntakeProgressProps> = ({
  currentDomainId,
  phase,
  current,
  total,
}) => {
  const domain = CIE_DOMAIN_MAP[currentDomainId];
  const axisLabel = domain
    ? `AXIS ${domain.axis}: ${domain.axisName.toUpperCase()}`
    : "";

  const phaseLabel =
    phase === "layer1"
      ? "LAYER 1 SCREENING"
      : phase === "deep_dive"
      ? `DEEP DIVE: ${currentDomainId} ${domain?.name?.toUpperCase() || ""}`
      : "COMPLETE";

  return (
    <div className="w-full space-y-3">
      {/* Phase + axis labels */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {phaseLabel}
        </span>
        <span className="text-[10px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground/70">
          {axisLabel}
        </span>
      </div>

      {/* Segmented domain bar */}
      <div className="flex gap-[2px] h-1.5 rounded-full overflow-hidden bg-muted/30">
        {CIE_DOMAINS.map((d) => {
          const isCurrent = d.id === currentDomainId;
          const domainIndex = CIE_DOMAINS.indexOf(d);
          // A domain is "done" if all its L1 questions are before the current position
          const colorClass = AXIS_COLORS[d.axis] || "bg-muted-foreground";

          return (
            <div
              key={d.id}
              className={`flex-1 rounded-[1px] transition-all duration-300 ${
                isCurrent
                  ? `${colorClass} opacity-100`
                  : domainIndex < CIE_DOMAINS.findIndex((dd) => dd.id === currentDomainId)
                  ? `${colorClass} opacity-40`
                  : "bg-muted/50"
              }`}
            />
          );
        })}
      </div>

      {/* Numeric progress */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          Question {current} of {total}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {total > 0 ? Math.round((current / total) * 100) : 0}%
        </span>
      </div>
    </div>
  );
};

export default IntakeProgress;
