import React from "react";
import { Activity, Database, Eye, Clock, AlertTriangle, Sparkles, Anchor } from "lucide-react";

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

const ChipGroup: React.FC<{
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  dotColor: string;
  chips: BiomarkerChip[];
  onChipTap?: (question: string) => void;
}> = ({ label, sublabel, icon, dotColor, chips, onChipTap }) => {
  if (chips.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {label}
        </p>
        <span className="text-[10px] text-muted-foreground/60 ml-auto">{sublabel}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => {
              const q = `Help me understand my ${chip.name} of ${chip.value} ${chip.unit}. What does this mean for me specifically and what's driving it?`;
              onChipTap?.(q);
            }}
            className="group inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] border-border/60 bg-background hover:bg-muted/60 hover:border-border transition-colors cursor-pointer text-left"
            title={`Ask about ${chip.name}`}
          >
            <div className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
            <span className="font-sans text-[12px] font-semibold text-foreground uppercase" style={{ fontVariant: 'all-small-caps' }}>{chip.name}</span>
            <span className="font-mono text-[13px] text-muted-foreground" style={{ fontWeight: 500 }}>{chip.value} <span className="text-muted-foreground/60">{chip.unit}</span></span>
          </button>
        ))}
      </div>
    </div>
  );
};

const ChatReasoningTrace: React.FC<ChatReasoningTraceProps> = ({ context, onChipTap }) => {
  const {
    askContext,
    dataWindow,
    messageCount = 0,
  } = context;

  const flagged = askContext?.biomarker_chips?.flagged || [];
  const notable = askContext?.biomarker_chips?.notable || [];
  const anchor = askContext?.biomarker_chips?.anchor || [];
  const totalChips = flagged.length + notable.length + anchor.length;

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

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Biomarker chip groups */}
        <ChipGroup
          label="Flagged"
          sublabel="needs attention"
          icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
          dotColor="bg-amber-500"
          chips={flagged}
          onChipTap={onChipTap}
        />

        <ChipGroup
          label="Notable"
          sublabel="worth celebrating"
          icon={<Sparkles className="h-3.5 w-3.5 text-teal-500" />}
          dotColor="bg-teal-500"
          chips={notable}
          onChipTap={onChipTap}
        />

        <ChipGroup
          label="Anchor"
          sublabel="central to your story"
          icon={<Anchor className="h-3.5 w-3.5 text-muted-foreground" />}
          dotColor="bg-slate-400"
          chips={anchor}
          onChipTap={onChipTap}
        />

        {/* Data window */}
        {dataWindow && (
          <div>
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

        {/* Conversation stats */}
        <div>
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

        {/* Empty state */}
        {totalChips === 0 && (
          <div className="py-8 text-center">
            <Eye className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-xs text-muted-foreground italic max-w-[240px] mx-auto leading-relaxed">
              Loading your biomarker context…
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
