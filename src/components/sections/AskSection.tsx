import React, { useState, useRef, useEffect } from "react";
import { useManifest } from "@/context/ManifestContext";
import { useDocuments } from "@/context/DocumentContext";
import { Send, Loader2, FileText, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/patient-chat`;

function buildPatientContext(manifest: any): string {
  const parts: string[] = [];
  const p = manifest.patient;
  if (p) parts.push(`Patient: ${p.firstName}, ${p.age}y, ${p.sex}`);
  if (manifest.patientThesis?.title) parts.push(`Primary thesis: ${manifest.patientThesis.title}`);
  if (manifest.patientThesis?.body) parts.push(manifest.patientThesis.body);
  if (manifest.symptomBridges?.length) parts.push(`Symptom bridges:\n- ${manifest.symptomBridges.join("\n- ")}`);
  if (manifest.reversibility) {
    const r = manifest.reversibility;
    if (r.weeks?.length) parts.push(`Reversible in weeks: ${r.weeks.join("; ")}`);
    if (r.months?.length) parts.push(`Reversible in months: ${r.months.join("; ")}`);
  }
  if (manifest.sequencedActions?.startHere) {
    parts.push(`Current priority action: ${manifest.sequencedActions.startHere.title} — ${manifest.sequencedActions.startHere.description}`);
  }
  if (manifest.careTeam?.physician) parts.push(`Physician: ${manifest.careTeam.physician.name}`);
  if (manifest.careTeam?.coach) parts.push(`Coach: ${manifest.careTeam.coach.name}`);
  return parts.join("\n\n");
}

const AskSection: React.FC = () => {
  const { manifest } = useManifest();
  const { documents } = useDocuments();
  const starters = manifest.coach?.starterQuestions ?? [];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    setError(null);

    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
          patientContext: buildPatientContext(manifest),
          documents: documents.map((d) => ({ name: d.name, type: d.type, content: d.content })),
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${resp.status})`);
      }

      if (!resp.body) throw new Error("No response stream");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e: any) {
      console.error("Chat error:", e);
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = (content: string) => {
    // Simple markdown bold rendering
    return content.split(/\*\*(.*?)\*\*/g).map((part, j) =>
      j % 2 === 1 ? (
        <strong
          key={j}
          className="block mt-4 mb-1.5 font-sans font-semibold text-xs uppercase tracking-wider text-secondary first:mt-0"
        >
          {part}
        </strong>
      ) : (
        <span key={j}>{part}</span>
      )
    );
  };

  return (
    <section className="animate-fade-in space-y-5">
      <h2 className="text-sm font-sans font-medium uppercase tracking-widest text-secondary">
        Ask anything
      </h2>
      <p className="text-muted-foreground text-sm max-w-xl">
        Your personal reasoning console. Ask about your results, protocol, uploaded records, or anything you're unsure about.
      </p>

      {/* Document indicator */}
      {documents.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-navy-light px-3 py-2 text-xs text-foreground">
          <FileText className="h-3.5 w-3.5 text-primary" />
          {documents.length} medical record{documents.length > 1 ? "s" : ""} loaded — AI will reference them in responses
        </div>
      )}

      {/* Starter questions */}
      {starters.length > 0 && messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {starters.map((q, i) => (
            <button
              key={i}
              onClick={() => sendMessage(q)}
              disabled={isLoading}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors text-left disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="space-y-4 max-h-[500px] overflow-y-auto scroll-smooth">
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-xl p-4 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground ml-8"
                  : "bg-card border border-border mr-4"
              }`}
            >
              <p className={`text-sm whitespace-pre-line leading-relaxed ${msg.role === "assistant" ? "text-foreground" : ""}`}>
                {msg.role === "assistant" ? renderContent(msg.content) : msg.content}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm px-4 py-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking...
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 items-center">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
          placeholder={documents.length > 0 ? "Ask about your records, results, or care plan..." : "Type your question..."}
          disabled={isLoading}
          className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/30 disabled:opacity-50"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={isLoading || !input.trim()}
          className="rounded-lg bg-secondary text-secondary-foreground p-2.5 hover:bg-secondary/90 transition-colors disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </section>
  );
};

export default AskSection;
