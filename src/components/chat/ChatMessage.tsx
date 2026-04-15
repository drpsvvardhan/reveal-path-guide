import React from "react";
import { Sparkles, AlertCircle, MessageCircle, User, Eye, ArrowRight } from "lucide-react";
import PatientCognitiveText from "@/components/PatientCognitiveText";
import VoiceValidationIndicator from "@/components/clusters/VoiceValidationIndicator";
import TimeSeriesBlock from "@/components/chat/TimeSeriesBlock";
import { parseTimeSeriesBlocks, stripTimeSeriesBlocks } from "@/lib/timeSeriesParser";
import type { ParsedTimeSeries } from "@/lib/timeSeriesParser";
import type { VocabularyViolation } from "@/lib/voiceValidation";

interface ChatMessageSection {
  type: "what_this_means" | "what_you_can_do" | "watch_for" | "ask_doctor" | "important" | "acknowledgment";
  mode?: "from_data" | "putting_together" | "from_knowledge";
  content: string;
}

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content?: string;
  sections?: ChatMessageSection[];
  timestamp?: string;
  voiceValidationStatus?: "passed" | "failed_with_warnings" | string | null;
  voiceValidationWarnings?: VocabularyViolation[] | null;
}

interface ChatMessageProps {
  message: ChatMessageData;
  isStreaming?: boolean;
  onSuggestionTap?: (question: string) => void;
}

const sectionMeta: Record<string, { label: string; icon: React.FC<any>; color: string }> = {
  what_this_means: { label: "What this means", icon: MessageCircle, color: "text-foreground" },
  what_you_can_do: { label: "What you can do", icon: Sparkles, color: "text-teal-700" },
  watch_for: { label: "Watch for this", icon: Eye, color: "text-amber-700" },
  ask_doctor: { label: "Ask your doctor", icon: User, color: "text-secondary" },
  important: { label: "Important", icon: AlertCircle, color: "text-red-700" },
  acknowledgment: { label: "", icon: MessageCircle, color: "text-muted-foreground" },
};

const modeLabels: Record<string, { label: string; color: string }> = {
  from_data: { label: "From your data", color: "bg-teal-100 text-teal-700 border-teal-200" },
  putting_together: { label: "Putting it together", color: "bg-blue-100 text-blue-700 border-blue-200" },
  from_knowledge: { label: "From medical knowledge", color: "bg-slate-100 text-slate-700 border-slate-200" },
};

/** Extract quoted suggestions (text in "...") from content */
function extractQuotedSuggestions(content: string): { before: string; quotes: string[]; after: string } {
  const quoteRegex = /"([^"]{20,})"/g;
  const quotes: string[] = [];
  let lastIndex = 0;
  let before = "";
  let match;

  while ((match = quoteRegex.exec(content)) !== null) {
    if (quotes.length === 0) {
      before = content.slice(0, match.index).trim();
    }
    quotes.push(match[1]);
    lastIndex = match.index + match[0].length;
  }

  const after = quotes.length > 0 ? content.slice(lastIndex).trim() : "";
  return { before: quotes.length > 0 ? before : content, quotes, after };
}

function renderContentWithQuotes(
  content: string,
  onSuggestionTap?: (q: string) => void
) {
  if (!onSuggestionTap) {
    return <PatientCognitiveText content={content} />;
  }

  const { before, quotes, after } = extractQuotedSuggestions(content);

  if (quotes.length === 0) {
    return <PatientCognitiveText content={content} />;
  }

  return (
    <>
      {before && <PatientCognitiveText content={before} />}
      <div className="mt-3 space-y-2">
        {quotes.map((q, i) => (
          <button
            key={i}
            onClick={() => onSuggestionTap(q)}
            className="w-full text-left rounded-xl border border-secondary/30 bg-secondary/5 hover:bg-secondary/10 active:bg-secondary/15 px-4 py-3 transition-colors group"
          >
            <div className="flex items-start gap-3">
              <p className="text-[14px] text-foreground leading-relaxed flex-1">
                "{q}"
              </p>
              <ArrowRight className="h-4 w-4 text-secondary shrink-0 mt-0.5 opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Tap to ask this</p>
          </button>
        ))}
      </div>
      {after && <div className="mt-2"><PatientCognitiveText content={after} /></div>}
    </>
  );
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isStreaming, onSuggestionTap }) => {
  // Parse time series blocks from assistant messages
  const timeSeries: ParsedTimeSeries[] = React.useMemo(() => {
    if (message.role !== "assistant" || isStreaming) return [];
    const raw = message.content || message.sections?.map(s => s.content).join("\n\n") || "";
    return parseTimeSeriesBlocks(raw);
  }, [message, isStreaming]);

  if (message.role === "user") {
    return (
      <div className="flex justify-end mb-6">
        <div className="max-w-[75%]">
          <div className="rounded-2xl rounded-tr-sm bg-secondary text-secondary-foreground px-5 py-3">
            <p className="font-sans text-[16px] leading-[1.5] font-[450] text-secondary-foreground">{message.content}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 mb-8">
      <div className="shrink-0">
        <div className="h-10 w-10 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-secondary" />
        </div>
      </div>

      <div className="flex-1 min-w-0 max-w-[calc(100%-56px)]">
        {/* Render time series blocks if present */}
        {timeSeries.length > 0 && (
          <div className="mb-3">
            {timeSeries.map((ts, i) => (
              <TimeSeriesBlock key={i} series={ts} />
            ))}
          </div>
        )}

        {message.sections && message.sections.length > 0 ? (
          <div className="space-y-4">
            {message.sections.map((section, idx) => {
              const meta = sectionMeta[section.type] || sectionMeta.what_this_means;
              const Icon = meta.icon;

              if (section.type === "acknowledgment") {
                return (
                  <p key={idx} className="font-serif text-[15px] italic text-muted-foreground leading-relaxed pl-1">
                    {section.content}
                  </p>
                );
              }

              const isLastSection = idx === (message.sections?.length ?? 0) - 1;
              // Strip time series markup from section content
              const displayContent = stripTimeSeriesBlocks(section.content);

              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5"
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${meta.color}`} />
                      <p className={`font-serif text-[15px] font-[550] ${meta.color}`}>
                        {meta.label}
                      </p>
                    </div>
                    {section.mode && modeLabels[section.mode] && (
                      <span
                        className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded border ${modeLabels[section.mode].color}`}
                      >
                        {modeLabels[section.mode].label}
                      </span>
                    )}
                  </div>
                  <div className="font-serif text-[16px] font-[450] text-foreground leading-[1.65]">
                    {isLastSection
                      ? renderContentWithQuotes(displayContent, onSuggestionTap)
                      : <PatientCognitiveText content={displayContent} />
                    }
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
            <div className="font-serif text-[16px] font-[450] text-foreground leading-[1.65]">
              {renderContentWithQuotes(
                stripTimeSeriesBlocks(message.content || ""),
                isStreaming ? undefined : onSuggestionTap
              )}
              {isStreaming && (
                <span className="inline-block w-2 h-4 ml-1 bg-secondary animate-pulse align-middle" />
              )}
            </div>
          </div>
        )}
        {message.voiceValidationStatus && (
          <div className="mt-2 flex justify-end">
            <VoiceValidationIndicator
              status={message.voiceValidationStatus}
              warnings={message.voiceValidationWarnings ?? null}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
