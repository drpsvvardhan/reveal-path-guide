import React, { useState } from "react";
import { ShieldAlert, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface VocabularyViolation {
  sentence: string;
  cluster_id: string | null;
  cluster_tier: string | null;
  rule_violated: string;
  matched_phrase: string;
  suggested_rephrase?: string;
}

interface VoiceValidationIndicatorProps {
  status: "passed" | "failed_with_warnings" | string | null;
  warnings: VocabularyViolation[] | null;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  className?: string;
}

const VoiceValidationIndicator: React.FC<VoiceValidationIndicatorProps> = ({
  status,
  warnings,
  onRegenerate,
  isRegenerating,
  className,
}) => {
  const { user } = useAuth();
  const { effectiveUserId } = useViewAs();
  const isViewingAs = !!effectiveUserId && !!user?.id && effectiveUserId !== user.id;

  // Render nothing if passed, null, or not in view-as mode
  if (!status || status === "passed") return null;
  if (status !== "failed_with_warnings") return null;
  if (!isViewingAs) return null;

  const violationList = (warnings || []) as VocabularyViolation[];

  return (
    <span className={`inline-flex items-center gap-1.5 ${className || ""}`}>
      <Popover>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
            <span>Voice validation: draft</span>
            {violationList.length > 0 && (
              <span className="text-[10px] text-muted-foreground/60">
                ({violationList.length})
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-96 max-h-72 overflow-y-auto text-xs space-y-2 p-3"
        >
          <p className="font-sans font-semibold text-foreground text-[11px] uppercase tracking-wider mb-2">
            Vocabulary violations
          </p>
          {violationList.length === 0 ? (
            <p className="text-muted-foreground italic">No violation details available.</p>
          ) : (
            violationList.map((v, i) => (
              <div
                key={i}
                className="rounded border border-border bg-muted/30 p-2 space-y-0.5"
              >
                <p className="text-foreground leading-snug">"{v.sentence}"</p>
                <p className="text-muted-foreground">
                  <span className="font-medium">{v.rule_violated}</span>
                  {" · matched: "}
                  <span className="font-mono text-amber-600">"{v.matched_phrase}"</span>
                </p>
                {v.cluster_tier && (
                  <p className="text-muted-foreground/70">
                    Cluster tier: {v.cluster_tier}
                  </p>
                )}
              </div>
            ))
          )}
        </PopoverContent>
      </Popover>

      {onRegenerate && (
        <button
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 disabled:opacity-50 transition-colors ml-1"
        >
          <RefreshCw className={`h-3 w-3 ${isRegenerating ? "animate-spin" : ""}`} />
          Regenerate
        </button>
      )}
    </span>
  );
};

export default VoiceValidationIndicator;
