import React from "react";
import { Activity, TrendingUp, Database, Eye, Clock, Gauge } from "lucide-react";

export interface ReasoningContext {
  activeBiomarkers?: Array<{
    name: string;
    value: string;
    flag?: "low" | "normal" | "high" | "critical";
  }>;
  citedPatterns?: Array<{
    title: string;
    severity: "critical" | "high" | "moderate" | "informational";
  }>;
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
}

const flagColors: Record<string, string> = {
  low: "text-blue-700 bg-blue-50 border-blue-200",
  normal: "text-teal-700 bg-teal-50 border-teal-200",
  high: "text-amber-700 bg-amber-50 border-amber-200",
  critical: "text-red-700 bg-red-50 border-red-200",
};

const severityColors: Record<string, string> = {
  critical: "border-red-400 bg-red-50/40",
  high: "border-orange-400 bg-orange-50/40",
  moderate: "border-amber-300 bg-amber-50/30",
  informational: "border-slate-300 bg-slate-50/40",
};

const modeInfo: Record<string, { label: string; color: string; description: string }> = {
  from_data: {
    label: "From your data",
    color: "bg-teal-500",
    description: "Grounded in your actual measurements",
  },
  putting_together: {
    label: "Putting it together",
    color: "bg-blue-500",
    description: "Connecting multiple data sources",
  },
  from_knowledge: {
    label: "From medical knowledge",
    color: "bg-slate-500",
    description: "General medical context, not from your data",
  },
};

const ChatReasoningTrace: React.FC<ChatReasoningTraceProps> = ({ context }) => {
  const {
    activeBiomarkers = [],
    citedPatterns = [],
    dataWindow,
    currentMode,
    messageCount = 0,
  } = context;

  return (
    <div className="relative h-full flex flex-col rounded-2xl border border-border/80 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.08)] overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-60"
        style={{
          background:
            "linear-gradient(90deg, hsl(var(--secondary) / 0.5) 0%, hsl(var(--secondary) / 0.1) 60%, transparent 100%)",
        }}
      />

      <div className="px-6 pt-6 pb-4 shrink-0">
        <h3 className="font-serif text-xl text-foreground leading-tight tracking-tight">
          Reasoning trace
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          What your companion is looking at
        </p>
      </div>

      <div className="h-px bg-border/60 mx-6 shrink-0" />

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Current mode */}
        {currentMode && modeInfo[currentMode] && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
                Cognitive mode
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${modeInfo[currentMode].color}`} />
                <p className="text-sm font-medium text-foreground">
                  {modeInfo[currentMode].label}
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                {modeInfo[currentMode].description}
              </p>
            </div>
          </div>
        )}

        {/* Active biomarkers */}
        {activeBiomarkers.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
                Looking at
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeBiomarkers.map((bm, idx) => (
                <div
                  key={idx}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${
                    bm.flag ? flagColors[bm.flag] : "text-foreground border-border bg-background"
                  }`}
                >
                  <span className="font-medium">{bm.name}</span>
                  <span className="font-mono opacity-75">{bm.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cited patterns */}
        {citedPatterns.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
                Referencing patterns
              </p>
            </div>
            <div className="space-y-1.5">
              {citedPatterns.map((p, idx) => (
                <div
                  key={idx}
                  className={`rounded-md border-l-2 ${severityColors[p.severity]} border-t border-r border-b border-border/40 px-3 py-1.5`}
                >
                  <p className="text-[11px] text-foreground leading-snug">{p.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data window */}
        {dataWindow && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Database className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
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
            <p className="text-[11px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
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
                {activeBiomarkers.length || 17}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">biomarkers in scope</p>
            </div>
          </div>
        </div>

        {/* Empty state */}
        {activeBiomarkers.length === 0 && citedPatterns.length === 0 && !currentMode && (
          <div className="py-8 text-center">
            <Eye className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-xs text-muted-foreground italic max-w-[240px] mx-auto leading-relaxed">
              This panel updates as you ask questions — you'll see exactly which biomarkers and patterns the companion is reasoning about.
            </p>
          </div>
        )}
      </div>

      <div className="h-px bg-border/60 mx-6 shrink-0" />
      <div className="px-6 py-4 shrink-0">
        <p className="text-[10px] text-muted-foreground italic leading-relaxed">
          Every answer is grounded in your actual data. If the companion doesn't know, it will say so.
        </p>
      </div>
    </div>
  );
};

export default ChatReasoningTrace;
