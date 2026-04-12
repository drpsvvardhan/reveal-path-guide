import React, { useState, useRef, useEffect } from "react";
import ChatLayout from "@/components/layout/ChatLayout";
import ChatReasoningTrace, { ReasoningContext } from "@/components/chat/ChatReasoningTrace";
import ChatMessage, { ChatMessageData } from "@/components/chat/ChatMessage";
import ChatInputBar from "@/components/chat/ChatInputBar";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";
import { useActiveManifest } from "@/hooks/useActiveManifest";
import { useDocuments } from "@/context/DocumentContext";
import { useQueue } from "@/context/QueueContext";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/patient-chat`;

const SUGGESTED_QUESTIONS = [
  "Why do I feel worse in the afternoon?",
  "Is it safe to exercise while my gut heals?",
  "What should I eat during the gut repair protocol?",
];

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

  // Pre-text as acknowledgment
  const preText = raw.slice(0, found[0].start).trim();
  if (preText) {
    sections.push({ type: "acknowledgment", content: preText });
  }

  for (let i = 0; i < found.length; i++) {
    const contentStart = found[i].headerEnd;
    const contentEnd = i + 1 < found.length ? found[i + 1].start : raw.length;
    let content = raw.slice(contentStart, contentEnd).trim();
    if (!content) continue;

    // Detect cognitive mode
    let mode: "from_data" | "putting_together" | "from_knowledge" | undefined;
    for (const mp of MODE_PATTERNS) {
      if (content.includes(mp.label)) {
        mode = mp.mode;
        break;
      }
    }

    sections.push({ type: found[i].type, mode, content });
  }

  return sections.length > 0 ? sections : undefined;
}

function extractCitedPatterns(text: string): ReasoningContext["citedPatterns"] {
  const patterns: NonNullable<ReasoningContext["citedPatterns"]> = [];
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
  const manifest = useActiveManifest();
  const { documents } = useDocuments();
  const { refresh: refreshQueue } = useQueue();

  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [reasoningContext, setReasoningContext] = useState<ReasoningContext>({
    activeBiomarkers: [],
    citedPatterns: [],
    messageCount: 0,
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Populate biomarkers from manifest
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
      activeBiomarkers: recent.map((b) => ({
        name: b.name,
        value: `${b.value} ${b.unit}`,
        flag: b.flag,
      })),
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
  }, [manifest, messages.length]);

  const sendMessage = async (text: string) => {
    const userMessage: ChatMessageData = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const allMsgs = [...messages, userMessage];
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMsgs.map((m) => ({
            role: m.role,
            content: m.content || m.sections?.map((s) => s.content).join("\n\n") || "",
          })),
          manifest,
          documents: documents.map((d) => ({ name: d.name, type: d.type, content: d.content })),
          model: "claude-sonnet-4-20250514",
          userId: user?.id,
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
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: fullText } : m
                )
              );
            }
          } catch {
            // ignore partial chunk parse errors
          }
        }
      }

      // Parse structured sections
      const sections = parseAssistantResponse(fullText);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: sections ? fullText : fullText, sections }
            : m
        )
      );

      // Update reasoning trace
      const citedPatterns = extractCitedPatterns(fullText);
      const firstMode = sections?.find((s) => s.mode)?.mode || "from_data";
      setReasoningContext((prev) => ({
        ...prev,
        citedPatterns,
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
  };

  return (
    <ChatLayout
      isThinking={isLoading}
      conversation={
        <div ref={scrollRef} className="h-full">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-8">
              <div className="max-w-md">
                <h2 className="font-serif text-2xl text-foreground mb-3">
                  Ask anything about your results
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your answers will be grounded in your actual data. The companion will tell you
                  what it knows, what it doesn't, and what to ask your doctor.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                isStreaming={isLoading && idx === messages.length - 1 && msg.role === "assistant"}
              />
            ))
          )}
        </div>
      }
      inputBar={
        <ChatInputBar
          onSend={sendMessage}
          isLoading={isLoading}
          suggestedQuestions={messages.length === 0 ? SUGGESTED_QUESTIONS : []}
        />
      }
      reasoningTrace={<ChatReasoningTrace context={reasoningContext} />}
    />
  );
};

export default AskSection;
