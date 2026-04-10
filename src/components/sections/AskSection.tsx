import React, { useState, useRef, useEffect } from "react";
import { useManifest } from "@/context/ManifestContext";
import { useAuth } from "@/context/AuthContext";
import { useDocuments } from "@/context/DocumentContext";
import { useQueue } from "@/context/QueueContext";
import { Send, Loader2, FileText, ChevronDown, Copy, ClipboardCheck, AlertCircle, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PatientCognitiveText, { PatientModeLegend } from "@/components/PatientCognitiveText";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import AsideInfoPanel from "@/components/layout/AsideInfoPanel";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ParsedSection {
  label: string;
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/patient-chat`;

const AI_MODELS = [
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", provider: "Anthropic" },
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", provider: "Google" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "Google" },
  { id: "openai/gpt-5.2", label: "GPT-5.2", provider: "OpenAI" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini", provider: "OpenAI" },
];

const SECTION_MARKERS: { pattern: RegExp; label: string }[] = [
  { pattern: /\*\*Important[ —-]+please don't wait:?\*\*/i, label: "Important — please don't wait" },
  { pattern: /\*\*What this means:?\*\*/i, label: "What this means" },
  { pattern: /\*\*What you can do:?\*\*/i, label: "What you can do" },
  { pattern: /\*\*Before you ask your doctor, watch for this:?\*\*/i, label: "Before you ask your doctor, watch for this" },
  { pattern: /\*\*What to ask your doctor:?\*\*/i, label: "What to ask your doctor" },
];

function parsePatientResponse(raw: string): ParsedSection[] {
  const found: { label: string; start: number; headerEnd: number }[] = [];
  for (const m of SECTION_MARKERS) {
    const match = raw.match(m.pattern);
    if (match && match.index !== undefined) {
      found.push({ label: m.label, start: match.index, headerEnd: match.index + match[0].length });
    }
  }
  if (found.length === 0) return raw.trim() ? [{ label: "Response", content: raw.trim() }] : [];
  found.sort((a, b) => a.start - b.start);
  const sections: ParsedSection[] = [];
  const preText = raw.slice(0, found[0].start).trim();
  if (preText) sections.push({ label: "Acknowledgment", content: preText });
  for (let i = 0; i < found.length; i++) {
    const contentStart = found[i].headerEnd;
    const contentEnd = i + 1 < found.length ? found[i + 1].start : raw.length;
    const content = raw.slice(contentStart, contentEnd).trim();
    if (content) sections.push({ label: found[i].label, content });
  }
  return sections;
}

const SectionCard: React.FC<{ section: ParsedSection; onCopy: (text: string) => void }> = ({ section, onCopy }) => {
  const label = section.label.toLowerCase();
  const isUrgent = label.includes("important");
  const isMeans = label === "what this means";
  const isCanDo = label === "what you can do";
  const isWatchFor = label.includes("watch for this");
  const isAskDoctor = label === "what to ask your doctor";
  const isAcknowledgment = label === "acknowledgment";

  if (isAcknowledgment) {
    return <div className="px-4 pt-3 pb-1 italic text-sm text-muted-foreground leading-relaxed">{section.content}</div>;
  }

  if (isWatchFor) {
    return (
      <div className="mx-4 mt-3 mb-2 bg-muted/40 border border-border rounded-md p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] font-sans font-medium uppercase tracking-wide text-muted-foreground">Before you ask your doctor, watch for this</span>
        </div>
        <div className="text-sm text-foreground leading-relaxed"><PatientCognitiveText content={section.content} /></div>
      </div>
    );
  }

  if (isAskDoctor) {
    const lines = section.content.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const cards: React.ReactNode[] = [];
    let currentQuestion: string | null = null;
    let currentRationale: string[] = [];
    const flush = (idx: number) => {
      if (currentQuestion) {
        const q = currentQuestion.replace(/^[""'""]|[""'""]$/g, "").trim();
        const rationale = currentRationale.join(" ").trim();
        cards.push(<AskDoctorCard key={`ask-${idx}`} question={q} rationale={rationale} onCopy={onCopy} />);
      }
      currentQuestion = null; currentRationale = [];
    };
    lines.forEach((line, idx) => {
      const isQuoted = /^[-*•]?\s*[""'""]/.test(line) || /\?[""'""]?\s*$/.test(line);
      if (isQuoted) { flush(idx); currentQuestion = line.replace(/^[-*•]\s*/, ""); }
      else if (currentQuestion) { currentRationale.push(line); }
      else { cards.push(<p key={`orphan-${idx}`} className="text-sm text-foreground leading-relaxed px-4 mb-2"><PatientCognitiveText content={line} /></p>); }
    });
    flush(lines.length);
    return (
      <div className="py-3">
        <SectionHeader label={section.label} accent="bg-blue-500" textClass="text-blue-700" />
        <div className="space-y-2 px-4">{cards}</div>
      </div>
    );
  }

  let accent = "bg-slate-400"; let textClass = "text-slate-700"; let bgClass = "";
  if (isUrgent) { accent = "bg-orange-500"; textClass = "text-orange-700"; bgClass = "bg-orange-50/40 border-l-2 border-orange-500"; }
  else if (isMeans) { accent = "bg-slate-800"; textClass = "text-slate-800"; }
  else if (isCanDo) { accent = "bg-teal-600"; textClass = "text-teal-700"; bgClass = "bg-teal-50/30"; }

  return (
    <div className={`py-3 ${bgClass}`}>
      <SectionHeader label={section.label} accent={accent} textClass={textClass} urgent={isUrgent} />
      <div className="px-4 text-[15px] text-foreground leading-relaxed"><PatientCognitiveText content={section.content} /></div>
    </div>
  );
};

const SectionHeader: React.FC<{ label: string; accent: string; textClass: string; urgent?: boolean }> = ({ label, accent, textClass, urgent }) => (
  <div className="flex items-center gap-2 px-4 mb-2">
    <div className={`w-[3px] h-4 rounded-sm ${accent}`} />
    <span className={`text-sm font-sans font-medium ${textClass}`}>{label}</span>
    {urgent && <AlertCircle className="w-4 h-4 text-orange-600" />}
  </div>
);

const AskDoctorCard: React.FC<{ question: string; rationale: string; onCopy: (t: string) => void }> = ({ question, rationale, onCopy }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(question); setCopied(true); onCopy(question); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="bg-card border border-blue-200/60 rounded-md p-3">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm italic text-foreground leading-relaxed flex-1">"{question}"</p>
        <button onClick={handleCopy} className="p-1 rounded-md hover:bg-muted transition-colors shrink-0" aria-label="Copy this question" title="Copy for your next appointment">
          {copied ? <ClipboardCheck className="h-3.5 w-3.5 text-teal-600" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      </div>
      {rationale && <p className="text-[12px] text-muted-foreground leading-relaxed">{rationale}</p>}
    </div>
  );
};

const AskSection: React.FC = () => {
  const { manifest } = useManifest();
  const { user } = useAuth();
  const { documents } = useDocuments();
  const { refresh: refreshQueue, questions: queuedQuestions } = useQueue();
  const starters = manifest.coach?.starterQuestions ?? [];
  const doctorQuestions = manifest.doctorQuestions ?? [];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[0].id);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [copiedQ, setCopiedQ] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    setError(null);
    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages); setInput(""); setIsLoading(true);
    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: allMessages.map((m) => ({ role: m.role, content: m.content })), manifest, documents: documents.map((d) => ({ name: d.name, type: d.type, content: d.content })), model: selectedModel, userId: user?.id }),
      });
      if (!resp.ok) { const errData = await resp.json().catch(() => ({})); throw new Error(errData.error || `Request failed (${resp.status})`); }
      if (!resp.body) throw new Error("No response stream");
      const reader = resp.body.getReader(); const decoder = new TextDecoder(); let textBuffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex); textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try { const parsed = JSON.parse(jsonStr); const content = parsed.choices?.[0]?.delta?.content as string | undefined; if (content) upsertAssistant(content); }
          catch { textBuffer = line + "\n" + textBuffer; break; }
        }
      }
    } catch (e: any) { console.error("Chat error:", e); setError(e.message || "Something went wrong. Please try again."); }
    finally { setTimeout(() => { refreshQueue().catch((e) => console.error("Queue refresh failed:", e)); }, 1500); setIsLoading(false); }
  };

  const copyDoctorQ = (text: string, idx: number) => { navigator.clipboard.writeText(text); setCopiedQ(idx); setTimeout(() => setCopiedQ(null), 2000); };
  const handleAskCopy = (_text: string) => {};

  const biomarkerCount = 17;

  return (
    <PatientSectionLayout
      eyebrow="ASK ANYTHING ABOUT YOUR RESULTS"
      title="Your personal reasoning companion"
      intro="Ask about your results, your plan, your uploaded records, or anything you're unsure about. Answers are grounded in your data and will tell you what to ask your doctor."
      aside={
        <AsideInfoPanel
          title="Companion state"
          items={[
            { label: "Model", value: AI_MODELS.find((m) => m.id === selectedModel)?.label || "—" },
            { label: "Grounded in", value: `${biomarkerCount} biomarkers` },
            { label: "Queue", value: `${queuedQuestions.length} pending`, tone: "accent" },
          ]}
          footnote="Every answer is grounded in your actual data. If the companion doesn't know, it will say so."
        />
      }
    >
      <div className="relative">
        <button onClick={() => setShowModelPicker(!showModelPicker)} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors">
          <span className="text-muted-foreground">Model:</span>
          <span className="font-medium">{AI_MODELS.find((m) => m.id === selectedModel)?.label}</span>
          <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${showModelPicker ? "rotate-180" : ""}`} />
        </button>
        {showModelPicker && (
          <div className="absolute top-full left-0 mt-1 z-20 rounded-lg border border-border bg-card shadow-lg py-1 min-w-[220px]">
            {AI_MODELS.map((model) => (
              <button key={model.id} onClick={() => { setSelectedModel(model.id); setShowModelPicker(false); }} className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-muted transition-colors ${selectedModel === model.id ? "text-secondary font-medium" : "text-foreground"}`}>
                <span>{model.label}</span><span className="text-xs text-muted-foreground">{model.provider}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {documents.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-navy-light px-3 py-2 text-xs text-foreground">
          <FileText className="h-3.5 w-3.5 text-primary" />
          {documents.length} medical record{documents.length > 1 ? "s" : ""} loaded — the companion will reference them in responses
        </div>
      )}

      {doctorQuestions.length > 0 && messages.length === 0 && (
        <div className="space-y-2">
          <p className="text-xs font-sans font-medium uppercase tracking-wider text-muted-foreground">Questions already queued for your doctor</p>
          <div className="space-y-2 max-h-[160px] overflow-y-auto">
            {doctorQuestions.slice(0, 3).map((q, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 group">
                <p className="text-xs text-foreground italic flex-1 line-clamp-2">"{q.question}"</p>
                <button onClick={() => copyDoctorQ(q.question, i)} className="p-1 rounded-md hover:bg-muted transition-colors shrink-0" aria-label="Copy question">
                  {copiedQ === i ? <ClipboardCheck className="h-3.5 w-3.5 text-secondary" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {starters.length > 0 && messages.length === 0 && (
        <div className="space-y-2">
          <p className="text-xs font-sans font-medium uppercase tracking-wider text-muted-foreground">Suggested starter questions</p>
          <div className="flex flex-wrap gap-2">
            {starters.map((q, i) => (
              <button key={i} onClick={() => sendMessage(q)} disabled={isLoading} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors text-left disabled:opacity-50">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={scrollRef} className="space-y-4 max-h-[600px] overflow-y-auto scroll-smooth">
        <AnimatePresence>
          {messages.map((msg, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={msg.role === "user" ? "flex justify-end" : ""}>
              {msg.role === "user" ? (
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-3 text-sm leading-relaxed">{msg.content}</div>
              ) : (
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  {(() => {
                    const sections = parsePatientResponse(msg.content);
                    if (sections.length <= 1) return <div className="px-4 py-3 text-[15px] text-foreground leading-relaxed"><PatientCognitiveText content={msg.content} /></div>;
                    return (
                      <div className="divide-y divide-border/40">
                        {sections.map((sec, si) => <SectionCard key={si} section={sec} onCopy={handleAskCopy} />)}
                        <PatientModeLegend />
                      </div>
                    );
                  })()}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" />Thinking...</div>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
          placeholder="Ask about your results, your plan, or anything you're unsure about..."
          disabled={isLoading}
          className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 disabled:opacity-50"
        />
        <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading} className="rounded-lg bg-secondary text-secondary-foreground px-4 py-2.5 hover:bg-secondary/90 transition-colors disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </PatientSectionLayout>
  );
};

export default AskSection;
