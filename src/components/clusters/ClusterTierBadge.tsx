import React from "react";
import { ClusterTier } from "@/types/clusters";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const TIER_LABELS: Record<ClusterTier, string> = {
  emerging: "Emerging",
  tentative: "Tentative",
  developing: "Developing",
  supported: "Supported",
  robust: "Robust",
};

const TIER_FILL_COUNT: Record<ClusterTier, number> = {
  emerging: 1,
  tentative: 2,
  developing: 3,
  supported: 4,
  robust: 5,
};

const TIER_DESCRIPTIONS: Record<ClusterTier, string> = {
  emerging: "Two or three signals are pointing the same way. Not yet solid; worth watching.",
  tentative: "A handful of signals are starting to hold together. The pattern is named softly.",
  developing: "Multiple signals across at least two layers of your data converge here. The pattern has structure.",
  supported: "Multiple layers of evidence converge on this cluster. The system is confident in the reading.",
  robust: "Three or more layers of evidence converge on this cluster, including imaging or omics. This is one of the clearest patterns in your terrain.",
};

interface ClusterTierBadgeProps {
  tier: ClusterTier;
  className?: string;
}

const ClusterTierBadge: React.FC<ClusterTierBadgeProps> = ({ tier, className = "" }) => {
  const fillCount = TIER_FILL_COUNT[tier];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1.5 cursor-default ${className}`}>
            <span className="text-[10px] font-sans font-medium uppercase tracking-wider text-muted-foreground">
              {TIER_LABELS[tier]}
            </span>
            <span className="inline-flex items-center gap-[3px]">
              {[1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className={`block h-[6px] w-[6px] rounded-full ${
                    i <= fillCount
                      ? "bg-secondary"
                      : "bg-border"
                  }`}
                />
              ))}
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
          {TIER_DESCRIPTIONS[tier]}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ClusterTierBadge;
