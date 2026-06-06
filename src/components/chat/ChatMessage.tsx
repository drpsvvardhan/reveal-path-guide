import React, { useState } from "react";
import { Sparkles, AlertCircle, MessageCircle, User, Eye, ArrowRight, Copy, Code2, Check, RefreshCw } from "lucide-react";
import PatientCognitiveText from "@/components/PatientCognitiveText";
import VoiceValidationIndicator from "@/components/clusters/VoiceValidationIndicator";
import TimeSeriesBlock from "@/components/chat/TimeSeriesBlock";
import { parseTimeSeriesBlocks, stripTimeSeriesBlocks } from "@/lib/timeSeriesParser";
import { parseCognitiveModeSubBlocks, type CognitiveModeSubBlock } from "@/components/sections/AskSection";
import type { ParsedTimeSeries } from "@/lib/timeSeriesParser";
import type { VocabularyViolation } from "@/lib/voiceValidation";
import { copyToClipboard, stripMarkdown, downloadFile, safeFilename } from "@/lib/exportChat";

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
  onRegenerate?: () => void;
}

const sectionMeta: Record<string, { label: string; icon: React.FC<any>; color: string }> = {
  what_this_means: { label: "What this means", icon: MessageCircle, color: "text-foreground" },
  what_you_can_do: { label: "What you can do", icon: Sparkles, color: "text-teal-700" },
  watch_for: { label: "Watch for this", icon: Eye, color: "text-amber-700" },
  ask_doctor: { label: "Ask your doctor", icon: User, color: "text-secondary" },
  important: { label: "Important", icon: AlertCircle, color: "text-red-700" },
  acknowledgment: { label: "", icon: MessageCircle, color: "text-muted-foreground" },
};

const modeLabels: Record<string, { label: string; color: string; headerColor: string }> = {
  from_data: { label: "From your data", color: "bg-teal-100 text-teal-700 border-teal-200", headerColor: "text-teal-600" },
  putting_together: { label: "Putting it together", color: "bg-blue-100 text-blue-700 border-blue-200", headerColor: "text-purple-600" },
  from_knowledge: { label: "From medical knowledge", color: "bg-slate-100 text-slate-700 border-slate-200", headerColor: "text-amber-600" },
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

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isStreaming, onSuggestionTap, onRegenerate }) => {
  const [copied, setCopied] = useState<"plain" | "md" | null>(null);

  const fullText = (): string => {
    if (message.content && message.content.trim()) return message.content;
    if (message.sections) return message.sections.map((s) => s.content).join("\n\n");
    return "";
  };

  const handleCopy = async (mode: "plain" | "md") => {
    const raw = fullText();
    await copyToClipboard(mode === "md" ? raw : stripMarkdown(raw));
    setCopied(mode);
    setTimeout(() => setCopied(null), 1500);
  };

  /** Build markdown that mirrors what's rendered on screen:
   *  - Section labels become "## Heading"
   *  - Cognitive-mode sub-blocks become "### Mode label"
   *  - Time-series fenced blocks are stripped (they render as charts, not text)
   *  - All other markdown (paragraphs, lists, **bold**, `code`, ```fences```, [links](url),
   *    blockquotes, tables) is preserved verbatim, including blank-line paragraph breaks. */
  const buildRenderedMarkdown = (): string => {
    const blocks: string[] = [];

    if (message.sections && message.sections.length > 0) {
      for (const section of message.sections) {
        const meta = sectionMeta[section.type] || sectionMeta.what_this_means;
        const body = stripTimeSeriesBlocks(section.content).trim();
        if (section.type === "acknowledgment") {
          if (body) blocks.push(body);
          continue;
        }
        if (meta.label) blocks.push(`## ${meta.label}`);
        const { preamble, subBlocks } = parseCognitiveModeSubBlocks(body);
        if (subBlocks.length === 0) {
          if (body) blocks.push(body);
        } else {
          if (preamble.trim()) blocks.push(preamble.trim());
          for (const block of subBlocks) {
            const modeMeta = modeLabels[block.mode];
            blocks.push(`### ${modeMeta?.label || block.mode}`);
            if (block.content.trim()) blocks.push(block.content.trim());
          }
        }
      }
    } else {
      const body = stripTimeSeriesBlocks(message.content || "").trim();
      if (body) blocks.push(body);
    }

    // Join with blank lines so paragraphs, lists, and fenced code blocks
    // keep their line breaks exactly as rendered.
    return blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  };

  const handleDownloadMd = () => {
    const md = buildRenderedMarkdown();
    const stamp = message.timestamp
      ? new Date(message.timestamp).toISOString().slice(0, 19).replace(/[:T]/g, "-")
      : new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const preview = md.replace(/[#*`_>\-]/g, " ").trim().slice(0, 40);
    const name = safeFilename(preview || "message");
    downloadFile(`${name}_${stamp}.md`, "text/markdown;charset=utf-8", md);
  };

  // Parse time series blocks from assistant messages
  const timeSeries: ParsedTimeSeries[] = React.useMemo(() => {
    if (message.role !== "assistant" || isStreaming) return [];
    const raw = message.content || message.sections?.map(s => s.content).join("\n\n") || "";
    return parseTimeSeriesBlocks(raw);
  }, [message, isStreaming]);

  if (message.role === "user") {
    return (
      <div className="flex justify-end mb-6 min-w-0">
        <div className="max-w-[85%] sm:max-w-[75%] min-w-0">
          <div className="rounded-2xl rounded-tr-sm bg-secondary text-secondary-foreground px-4 sm:px-5 py-3 min-w-0">
            <p className="font-sans text-[15px] sm:text-[16px] leading-[1.5] font-[450] text-secondary-foreground break-words">{message.content}</p>
          </div>
          <div className="flex justify-end mt-1">
            <button
              onClick={() => handleCopy("plain")}
              className="text-[10px] text-muted-foreground/60 hover:text-foreground flex items-center justify-center gap-1 min-h-[44px] min-w-[44px] rounded transition-colors"
              title="Copy"
            >
              {copied === "plain" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 sm:gap-4 mb-8 min-w-0">
      <div className="shrink-0">
        <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-secondary" />
        </div>
      </div>

      <div className="flex-1 min-w-0 max-w-[calc(100%-48px)] sm:max-w-[calc(100%-56px)]">
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
              
              // Parse cognitive mode sub-blocks
              const { preamble, subBlocks } = parseCognitiveModeSubBlocks(displayContent);
              const hasSubBlocks = subBlocks.length > 0;

              return (
                <div
                  key={idx}
                  className="min-w-0 sm:rounded-2xl sm:border sm:border-border sm:bg-card sm:shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:p-5"
                >
                  <div className="flex items-center gap-2 mb-3 min-w-0">
                    <Icon className={`h-4 w-4 ${meta.color}`} />
                    <p className={`font-serif text-[15px] font-[550] break-words min-w-0 ${meta.color}`}>
                      {meta.label}
                    </p>
                  </div>
                  
                  {hasSubBlocks ? (
                    <div className="space-y-6 min-w-0">
                      {preamble && (
                        <div className="font-serif text-[16px] sm:text-[17px] font-[450] text-foreground leading-[1.65] break-words min-w-0">
                          <PatientCognitiveText content={preamble} />
                        </div>
                      )}
                      {subBlocks.map((block, bi) => {
                        const modeMeta = modeLabels[block.mode];
                        return (
                          <div key={bi} className="min-w-0">
                            <p
                              className={`font-sans text-[11px] font-semibold uppercase tracking-[0.06em] mb-4 break-words ${modeMeta?.headerColor || 'text-muted-foreground'}`}
                            >
                              {modeMeta?.label || block.mode}
                            </p>
                            <div className="font-serif text-[16px] sm:text-[17px] font-[450] text-foreground leading-[1.65] break-words min-w-0">
                              {bi === subBlocks.length - 1 && isLastSection
                                ? renderContentWithQuotes(block.content, onSuggestionTap)
                                : <PatientCognitiveText content={block.content} />
                              }
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="font-serif text-[16px] sm:text-[17px] font-[450] text-foreground leading-[1.65] break-words min-w-0">
                      {isLastSection
                        ? renderContentWithQuotes(displayContent, onSuggestionTap)
                        : <PatientCognitiveText content={displayContent} />
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="min-w-0 sm:rounded-2xl sm:border sm:border-border sm:bg-card sm:shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:p-5">
            <div className="font-serif text-[16px] font-[450] text-foreground leading-[1.65] break-words min-w-0">
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
        {!isStreaming && (
          <div className="mt-2 flex flex-wrap items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
            <button
              onClick={() => handleCopy("plain")}
              className="text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center gap-1 px-3 min-h-[44px] rounded transition-colors"
              title="Copy as plain text"
            >
              {copied === "plain" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              <span>Copy</span>
            </button>
            <button
              onClick={handleDownloadMd}
              className="text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center gap-1 px-3 min-h-[44px] rounded transition-colors"
              title="Download as Markdown (.md)"
            >
              <Code2 className="h-3 w-3" />
              <span>Download .md</span>
            </button>
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center gap-1 px-3 min-h-[44px] rounded transition-colors"
                title="Regenerate response"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Regenerate</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
