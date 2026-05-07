import React, { useState, useRef, useEffect, useCallback } from "react";
import ChatLayout from "@/components/layout/ChatLayout";
import ChatReasoningTrace, { ReasoningContext, AskAnythingContext } from "@/components/chat/ChatReasoningTrace";
import ChatMessage, { ChatMessageData } from "@/components/chat/ChatMessage";
import ChatInputBar from "@/components/chat/ChatInputBar";
import ChatHistoryMenu from "@/components/chat/ChatHistoryMenu";
import { useChatHistory } from "@/hooks/useChatHistory";
import { conversationToMarkdown, conversationToPlainText, copyToClipboard, downloadFile, safeFilename } from "@/lib/exportChat";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";
import { useActiveManifest } from "@/hooks/useActiveManifest";
import { useDocuments } from "@/context/DocumentContext";
import { useQueue } from "@/context/QueueContext";
import { useClusters } from "@/hooks/useClusters";
import { supabase } from "@/integrations/supabase/client";
import {
  stripClusterMarkers,
  parseProseAndCitations,
  validateProseAgainstClusters,
  ClusterTier,
  VocabularyViolation,
} from "@/lib/voiceValidation";
import {
  parseTimeSeriesBlocks,
  stripTimeSeriesBlocks,
  detectShapeMismatches,
} from "@/lib/timeSeriesParser";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/patient-chat`;
const CONTEXT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ask-anything-context`;

const FALLBACK_QUESTIONS = ["Tell me what I should be paying attention to right now"];

const SECTION_MARKERS: { pattern: RegExp; type: "important" | "what_this_means" | "what_you_can_do" | "watch_for" | "ask_doctor" }[] = [
  { pattern: /\*\*Important[ —-]+please don't wait:?\*\*/i, type: "important" },
  { pattern: /\*\*What this means:?\*\*/i, type: "what_this_means" },
  { pattern: /\*\*What you can do:?\*\*/i, type: "what_you_can_do" },
  { pattern: /\*\*Before you ask your doctor, watch for this:?\*\*/i, type: "watch_for" },
  { pattern: /\*\*What to ask your doctor:?\*\*/i, type: "ask_doctor" },
];

const MODE_PATTERNS = [
  { label: "FROM YOUR DATA", mode: "from_data" as const },
  { label: "PUTTING IT TOGETHER", mode: "putting_together" as const },
  { label: "FROM MEDICAL KNOWLEDGE", mode: "from_knowledge" as const },
];

/** Regex to detect cognitive mode sub-block headers (bold markdown or all-caps).
 *  Handles: **From your data:** / **From your data**: / **From your data** / FROM YOUR DATA:
 *  Works both at line start AND inline (mid-paragraph). */
const COGNITIVE_MODE_HEADER_RE = /\s*\*\*\s*(?:From your data|Putting it together|From medical knowledge)\s*:?\s*\*\*\s*:?\s*|\s*(?:FROM YOUR DATA|PUTTING IT TOGETHER|FROM MEDICAL KNOWLEDGE)\s*:?\s*/gi;

const COGNITIVE_MODE_MAP: Record<string, "from_data" | "putting_together" | "from_knowledge"> = {
  "from your data": "from_data",
  "putting it together": "putting_together",
  "from medical knowledge": "from_knowledge",
};

export interface CognitiveModeSubBlock {
  mode: "from_data" | "putting_together" | "from_knowledge";
  content: string;
}

/** Parse cognitive mode sub-blocks within a section's content */
export function parseCognitiveModeSubBlocks(content: string): { preamble: string; subBlocks: CognitiveModeSubBlock[] } {
  const markers: { mode: "from_data" | "putting_together" | "from_knowledge"; start: number; headerEnd: number }[] = [];
  
  COGNITIVE_MODE_HEADER_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = COGNITIVE_MODE_HEADER_RE.exec(content)) !== null) {
    const headerText = match[0].replace(/\*/g, '').replace(/:/g, '').trim().toLowerCase();
    const mode = COGNITIVE_MODE_MAP[headerText];
    if (mode) {
      markers.push({ mode, start: match.index, headerEnd: match.index + match[0].length });
    }
  }

  if (markers.length === 0) {
    // Fallback: check for old-style inline markers
    for (const mp of MODE_PATTERNS) {
      const idx = content.indexOf(mp.label);
      if (idx !== -1) {
        markers.push({ mode: mp.mode, start: idx, headerEnd: idx + mp.label.length + 1 });
      }
    }
    markers.sort((a, b) => a.start - b.start);
  }

  if (markers.length === 0) {
    return { preamble: content, subBlocks: [] };
  }

  const preamble = content.slice(0, markers[0].start).trim();
  const subBlocks: CognitiveModeSubBlock[] = [];

  for (let i = 0; i < markers.length; i++) {
    const blockEnd = i + 1 < markers.length ? markers[i + 1].start : content.length;
    const blockContent = content.slice(markers[i].headerEnd, blockEnd).trim();
    if (blockContent) {
      subBlocks.push({ mode: markers[i].mode, content: blockContent });
    }
  }

  return { preamble, subBlocks };
}

function parseAssistantResponse(raw: string): ChatMessageData["sections"] {
  const found: { type: typeof SECTION_MARKERS[number]["type"]; start: number; headerEnd: number }[] = [];
  for (const m of SECTION_MARKERS) {
    const match = raw.match(m.pattern);
    if (match && match.index !== undefined) {
      found.push({ type: m.type, start: match.index, headerEnd: match.index + match[0].length });
    }
  }
  if (found.length === 0) return undefined;
  found.sort((a, b) => a.start - b.start);

  const sections: NonNullable<ChatMessageData["sections"]> = [];
  const preText = raw.slice(0, found[0].start).trim();
  if (preText) {
    sections.push({ type: "acknowledgment", content: preText });
  }

  for (let i = 0; i < found.length; i++) {
    const contentStart = found[i].headerEnd;
    const contentEnd = i + 1 < found.length ? found[i + 1].start : raw.length;
    let content = raw.slice(contentStart, contentEnd).trim();
    if (!content) continue;

    // Determine dominant mode from first sub-block (for backward compat)
    const { subBlocks } = parseCognitiveModeSubBlocks(content);
    const mode = subBlocks.length > 0 ? subBlocks[0].mode : undefined;

    sections.push({ type: found[i].type, mode, content });
  }

  return sections.length > 0 ? sections : undefined;
}

function extractCitedPatterns(text: string) {
  const patterns: Array<{ title: string; severity: "critical" | "high" | "moderate" | "informational" }> = [];
  const keywords = [
    { keyword: /cardiovascular risk/i, title: "Cardiovascular cluster", severity: "high" as const },
    { keyword: /ldl/i, title: "LDL-C above normal", severity: "high" as const },
    { keyword: /hba1c.*rising/i, title: "HbA1c trending up", severity: "high" as const },
    { keyword: /sleep.*(gap|contradiction|fragmentation)/i, title: "Sleep contradiction", severity: "moderate" as const },
    { keyword: /crp|inflammation/i, title: "Inflammation elevated", severity: "moderate" as const },
    { keyword: /vitamin d/i, title: "Vitamin D low", severity: "informational" as const },
  ];
  for (const pk of keywords) {
    if (pk.keyword.test(text)) {
      patterns.push({ title: pk.title, severity: pk.severity });
    }
  }
  return patterns.slice(0, 4);
}

const AskSection: React.FC = () => {
  const { user } = useAuth();
  const { effectiveUserId } = useViewAs();
  const manifest = useActiveManifest();
  const { documents } = useDocuments();
  const { refresh: refreshQueue } = useQueue();
  const { clusters: activeClusters } = useClusters();
  const resolvedUserId = effectiveUserId || user?.id || null;

  const {
    conversations,
    activeId,
    messages,
    setMessages,
    newChat,
    switchTo,
    deleteConversation,
    clearCurrent,
    ensureConversation,
    persistMessage,
  } = useChatHistory(resolvedUserId);
  const [isLoading, setIsLoading] = useState(false);
  const [askContext, setAskContext] = useState<AskAnythingContext | null>(null);
  const [askContextLoading, setAskContextLoading] = useState<boolean>(true);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(FALLBACK_QUESTIONS);

  const [reasoningContext, setReasoningContext] = useState<ReasoningContext>({
    messageCount: 0,
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Fetch dynamic context from edge function
  useEffect(() => {
    if (!resolvedUserId) {
      setAskContextLoading(false);
      return;
    }
    setAskContextLoading(true);

    const fetchContext = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
          console.warn("Skipping ask-anything context fetch — no auth session");
          return;
        }
        const resp = await fetch(CONTEXT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            user_id: resolvedUserId,
            assessment_id: null,
          }),
        });

        if (resp.ok) {
          const data: AskAnythingContext = await resp.json();
          setAskContext(data);
          if (data.suggested_questions && data.suggested_questions.length > 0) {
            setSuggestedQuestions(data.suggested_questions);
          }
        }
      } catch (e) {
        console.error("Failed to fetch ask-anything context:", e);
      } finally {
        setAskContextLoading(false);
      }
    };

    fetchContext();
  }, [resolvedUserId]);

  // Update reasoning context with biomarker data window from manifest
  useEffect(() => {
    const biomarkers = manifest.rawData?.biomarkerTimeline || [];
    const seen = new Set<string>();
    const recent = biomarkers
      .slice()
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .filter((b) => {
        if (seen.has(b.name)) return false;
        seen.add(b.name);
        return true;
      })
      .slice(0, 8);

    setReasoningContext((prev) => ({
      ...prev,
      askContext,
      askContextLoading,
      dataWindow:
        recent.length > 0
          ? {
              from: recent[recent.length - 1].timestamp.slice(0, 10),
              to: recent[0].timestamp.slice(0, 10),
              sourceCount: new Set(recent.map((b) => b.source || "unknown")).size,
            }
          : undefined,
      messageCount: messages.length,
    }));
  }, [manifest, messages.length, askContext, askContextLoading]);

  // Build cluster tier map for validation
  const clusterTierMap = React.useMemo(() => {
    const map = new Map<string, ClusterTier>();
    for (const c of activeClusters) {
      map.set(c.id, c.confidence_tier as ClusterTier);
    }
    return map;
  }, [activeClusters]);

  const sendMessage = useCallback(async (text: string) => {
    const userMessage: ChatMessageData = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", timestamp: new Date().toISOString() }]);

    // Ensure a conversation exists & persist the user turn
    const convId = await ensureConversation(text);
    if (convId) await persistMessage(convId, userMessage);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error("Not signed in. Please log in to use Ask Anything.");
      }
      if (!resolvedUserId) {
        throw new Error("Your session is still loading. Please try again in a moment.");
      }
      // Strip cluster markers from prior assistant messages before re-sending
      const allMsgs = [...messages, userMessage].map((m) =>
        m.role === "assistant"
          ? {
              role: m.role,
              content: stripClusterMarkers(
                m.content || m.sections?.map((s) => s.content).join("\n\n") || ""
              ),
            }
          : {
              role: m.role,
              content: m.content || m.sections?.map((s) => s.content).join("\n\n") || "",
            }
      );

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: allMsgs,
          manifest,
          documents: documents.map((d) => ({ name: d.name, type: d.type, content: d.content })),
          model: "google/gemini-3-flash-preview",
          userId: resolvedUserId,
        }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`Chat request failed (${resp.status})`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              // During streaming, show stripped content for clean display
              const displayText = stripClusterMarkers(fullText);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: displayText } : m
                )
              );
            }
          } catch {
            // ignore partial chunk parse errors
          }
        }
      }

      // Post-stream: run voice validation on the raw response
      const { sentenceToClusterMap } = parseProseAndCitations(fullText);
      const validation = validateProseAgainstClusters(
        fullText,
        clusterTierMap,
        sentenceToClusterMap,
      );

      // Shape mismatch check for time series blocks
      const seriesList = parseTimeSeriesBlocks(fullText);
      const proseWithoutBlocks = stripTimeSeriesBlocks(fullText);
      const shapeMismatches = detectShapeMismatches(proseWithoutBlocks, seriesList);

      const allWarnings: VocabularyViolation[] = [...validation.violations];
      for (const sm of shapeMismatches) {
        allWarnings.push({
          sentence: `Shape claim "${sm.matchedPhrase}" for ${sm.marker}`,
          cluster_id: null,
          cluster_tier: null,
          rule_violated: 'global_forbidden',
          matched_phrase: `shape_mismatch: claimed "${sm.claimedShape}" but actual shape is ${sm.actualShape}`,
        });
      }

      const cleanText = stripClusterMarkers(fullText);
      const sections = parseAssistantResponse(cleanText);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: cleanText,
                sections,
                voiceValidationStatus: allWarnings.length === 0 ? 'passed' : 'failed_with_warnings',
                voiceValidationWarnings: allWarnings,
              }
            : m
        )
      );

      if (convId) {
        await persistMessage(convId, {
          id: assistantId,
          role: "assistant",
          content: cleanText,
          sections,
          voiceValidationStatus: allWarnings.length === 0 ? 'passed' : 'failed_with_warnings',
          voiceValidationWarnings: allWarnings,
        });
      }

      const citedPatterns = extractCitedPatterns(cleanText);
      const firstMode = sections?.find((s) => s.mode)?.mode || "from_data";
      setReasoningContext((prev) => ({
        ...prev,
        currentMode: firstMode,
      }));

      setTimeout(() => {
        refreshQueue().catch((e) => console.error("Queue refresh failed:", e));
      }, 1500);
    } catch (e: any) {
      console.error("Chat error:", e);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Sorry, something went wrong: ${e.message || "unknown error"}` }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [messages, manifest, documents, resolvedUserId, refreshQueue, clusterTierMap, ensureConversation, persistMessage, setMessages]);

  const handleChipTap = useCallback((question: string) => {
    sendMessage(question);
  }, [sendMessage]);

  const handleRegenerate = useCallback(() => {
    // Find last user message, drop everything after it, re-send
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === "user");
    if (lastUserIdx === -1) return;
    const realIdx = messages.length - 1 - lastUserIdx;
    const lastUser = messages[realIdx];
    setMessages(messages.slice(0, realIdx));
    sendMessage(lastUser.content || "");
  }, [messages, setMessages, sendMessage]);

  const conversationTitle = React.useMemo(() => {
    const conv = conversations.find((c) => c.id === activeId);
    if (conv) return conv.title;
    const firstUser = messages.find((m) => m.role === "user");
    return firstUser?.content?.slice(0, 60) || "Conversation";
  }, [conversations, activeId, messages]);

  const handleCopyAll = useCallback(async () => {
    await copyToClipboard(conversationToPlainText(conversationTitle, messages));
    toast.success("Conversation copied to clipboard");
  }, [conversationTitle, messages]);

  const handleDownloadMd = useCallback(() => {
    const md = conversationToMarkdown(conversationTitle, messages);
    downloadFile(`${safeFilename(conversationTitle)}.md`, "text/markdown", md);
  }, [conversationTitle, messages]);

  const handleDownloadTxt = useCallback(() => {
    const txt = conversationToPlainText(conversationTitle, messages);
    downloadFile(`${safeFilename(conversationTitle)}.txt`, "text/plain", txt);
  }, [conversationTitle, messages]);

  return (
    <ChatLayout
      isThinking={isLoading}
      headerActions={
        <ChatHistoryMenu
          conversations={conversations}
          activeId={activeId}
          onNew={newChat}
          onSwitch={switchTo}
          onDelete={deleteConversation}
          onCopyAll={handleCopyAll}
          onDownloadMd={handleDownloadMd}
          onDownloadTxt={handleDownloadTxt}
          onClear={clearCurrent}
          hasMessages={messages.length > 0}
        />
      }
      conversation={
        <div ref={scrollRef} className="h-full">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-8">
              <div className="max-w-md">
                <h2 className="font-serif text-2xl text-foreground mb-3">
                  Ask anything about your results
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  Your answers will be grounded in your actual data. The companion will tell you
                  what it knows, what it doesn't, and what to ask your doctor.
                </p>

                {/* Dynamic suggested questions */}
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  {suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(q)}
                      className="text-[12px] text-foreground bg-muted/40 hover:bg-muted/80 border border-border/60 rounded-full px-4 py-2 transition-colors text-left leading-snug max-w-[280px]"
                    >
                      {q}
                    </button>
                  ))}
                </div>

                <p className="text-[11px] text-muted-foreground/60 italic">
                  Or tap any biomarker on the right to ask about it directly.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                isStreaming={isLoading && idx === messages.length - 1 && msg.role === "assistant"}
                onSuggestionTap={!isLoading ? sendMessage : undefined}
                onRegenerate={
                  !isLoading && msg.role === "assistant" && idx === messages.length - 1
                    ? handleRegenerate
                    : undefined
                }
              />
            ))
          )}
        </div>
      }
      inputBar={
        <ChatInputBar
          onSend={sendMessage}
          isLoading={isLoading}
        />
      }
      reasoningTrace={
        <ChatReasoningTrace
          context={reasoningContext}
          onChipTap={handleChipTap}
        />
      }
    />
  );
};

export default AskSection;
