import React from "react";
import { Database, Eye, Clock, AlertTriangle, Sparkles, Anchor } from "lucide-react";

export interface BiomarkerChip {
  name: string;
  value: string;
  unit: string;
  flag?: "low" | "high" | "critical";
}

export interface AskAnythingContext {
  biomarker_chips: {
    flagged: BiomarkerChip[];
    notable: BiomarkerChip[];
    anchor: BiomarkerChip[];
  };
  suggested_questions: string[];
  terrain_version?: number;
}

export interface ReasoningContext {
  askContext?: AskAnythingContext | null;
  askContextLoading?: boolean;
  dataWindow?: {
    from: string;
    to: string;
    sourceCount: number;
  };
  currentMode?: "from_data" | "putting_together" | "from_knowledge" | null;
  messageCount?: number;
}

interface ChatReasoningTraceProps {
  context: ReasoningContext;
  onChipTap?: (question: string) => void;
}

type ChipSection = "flagged" | "notable" | "anchor";

const BiomarkerPill: React.FC<{
  chip: BiomarkerChip;
  section: ChipSection;
  onChipTap?: (question: string) => void;
}> = ({ chip, section, onChipTap }) => {
  return (
    <button
      onClick={() => {
        const q = `Help me understand my ${chip.name} of ${chip.value} ${chip.unit}. What does this mean for me specifically and what's driving it?`;
        onChipTap?.(q);
      }}
      className="w-full text-left transition-colors cursor-pointer"
      title={`Ask about ${chip.name}`}
    >
      <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-background/50 border border-border/30 hover:bg-muted/30 hover:border-border/50">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{
            backgroundColor:
              section === "flagged"
                ? "hsl(var(--amber))"
                : section === "notable"
                  ? "hsl(var(--teal))"
                  : "hsl(var(--muted-foreground))",
          }}
        />
        <span className="flex-1 truncate font-sans text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
          {chip.name}
        </span>
        <span className="font-mono text-[13px] font-medium tabular-nums text-foreground">
          {chip.value}
        </span>
        <span className="font-sans text-[11px] font-medium text-muted-foreground">
          {chip.unit}
        </span>
      </div>
    </button>
  );
};

const ChipGroup: React.FC<{
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  chips: BiomarkerChip[];
  section: ChipSection;
  onChipTap?: (question: string) => void;
  isFirst?: boolean;
}> = ({ label, sublabel, icon, chips, section, onChipTap, isFirst }) => {
  if (chips.length === 0) return null;

  return (
    <div className={isFirst ? "" : "pt-6"}>
      {!isFirst && <div className="h-px bg-border/40 -mt-3 mb-3" />}
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="text-[10px] text-muted-foreground/60 mb-2.5 pl-5">{sublabel}</p>
      <div className="space-y-1.5">
        {chips.map((chip, idx) => (
          <BiomarkerPill
            key={idx}
            chip={chip}
            section={section}
            onChipTap={onChipTap}
          />
        ))}
      </div>
    </div>
  );
};

const ChatReasoningTrace: React.FC<ChatReasoningTraceProps> = ({ context, onChipTap }) => {
  const {
    askContext,
    askContextLoading = false,
    dataWindow,
    messageCount = 0,
  } = context;

  const flagged = askContext?.biomarker_chips?.flagged || [];
  const notable = askContext?.biomarker_chips?.notable || [];
  const anchor = askContext?.biomarker_chips?.anchor || [];
  const totalChips = flagged.length + notable.length + anchor.length;

  let firstGroupRendered = false;

  return (
    <div className="relative h-full flex flex-col rounded-2xl border border-border/80 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.08)] overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-60"
        style={{
          background:
            "linear-gradient(90deg, hsl(var(--secondary) / 0.5) 0%, hsl(var(--secondary) / 0.1) 60%, transparent 100%)",
        }}
      />

      <div className="px-6 pt-6 pb-3 shrink-0">
        <h3 className="text-subhead text-foreground leading-tight tracking-tight">
          Reasoning trace
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          What your companion is looking at
        </p>
      </div>

      <div className="h-px bg-border/60 mx-6 shrink-0" />

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-0">
        {flagged.length > 0 && (() => {
          const isFirst = !firstGroupRendered;
          firstGroupRendered = true;
          return (
            <ChipGroup
              label="Flagged"
              sublabel="needs attention"
              icon={<AlertTriangle className="h-3.5 w-3.5 text-amber" />}
              chips={flagged}
              section="flagged"
              onChipTap={onChipTap}
              isFirst={isFirst}
            />
          );
        })()}

        {notable.length > 0 && (() => {
          const isFirst = !firstGroupRendered;
          firstGroupRendered = true;
          return (
            <ChipGroup
              label="Notable"
              sublabel="worth celebrating"
              icon={<Sparkles className="h-3.5 w-3.5 text-teal" />}
              chips={notable}
              section="notable"
              onChipTap={onChipTap}
              isFirst={isFirst}
            />
          );
        })()}

        {anchor.length > 0 && (() => {
          const isFirst = !firstGroupRendered;
          firstGroupRendered = true;
          return (
            <ChipGroup
              label="Anchor"
              sublabel="central to your story"
              icon={<Anchor className="h-3.5 w-3.5 text-muted-foreground" />}
              chips={anchor}
              section="anchor"
              onChipTap={onChipTap}
              isFirst={isFirst}
            />
          );
        })()}

        {dataWindow && (
          <div className={totalChips > 0 ? "pt-6" : ""}>
            {totalChips > 0 && <div className="h-px bg-border/40 -mt-3 mb-3" />}
            <div className="flex items-center gap-1.5 mb-2">
              <Database className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Data window
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1">
              <p className="text-xs font-mono text-foreground">
                {dataWindow.from} → {dataWindow.to}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {dataWindow.sourceCount} source{dataWindow.sourceCount !== 1 ? "s" : ""} in scope
              </p>
            </div>
          </div>
        )}

        <div className={totalChips > 0 || dataWindow ? "pt-6" : ""}>
          {(totalChips > 0 || dataWindow) && <div className="h-px bg-border/40 -mt-3 mb-3" />}
          <div className="flex items-center gap-1.5 mb-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Conversation
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className="font-serif text-xl text-foreground leading-none">
                {messageCount}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">messages</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className="font-serif text-xl text-foreground leading-none">
                {totalChips || 0}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">biomarkers in scope</p>
            </div>
          </div>
        </div>

        {totalChips === 0 && askContextLoading && (
          <div className="py-8 text-center">
            <Eye className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-xs text-muted-foreground italic max-w-[240px] mx-auto leading-relaxed">
              Loading your biomarker context…
            </p>
          </div>
        )}
        {totalChips === 0 && !askContextLoading && (
          <div className="py-8 text-center">
            <Eye className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-xs text-muted-foreground italic max-w-[240px] mx-auto leading-relaxed">
              No biomarkers in scope yet. Upload labs or complete your
              assessment so your companion has data to ground in.
            </p>
          </div>
        )}
      </div>

      <div className="h-px bg-border/60 mx-6 shrink-0" />
      <div className="px-6 py-4 shrink-0">
        <p className="text-[10px] text-muted-foreground italic leading-relaxed">
          Every answer is grounded in your actual data. Tap any biomarker to ask about it.
        </p>
      </div>
    </div>
  );
};

export default ChatReasoningTrace;
