import React, { useState } from "react";
import { useManifest } from "@/context/ManifestContext";
import { Send } from "lucide-react";

interface MockMessage {
  role: "user" | "assistant";
  content: string;
}

const mockResponses: Record<string, { meaning: string; action: string; askDoctor: string }> = {};

const AskSection: React.FC = () => {
  const { manifest } = useManifest();
  const starters = manifest.coach?.starterQuestions ?? [];
  const [messages, setMessages] = useState<MockMessage[]>([]);
  const [input, setInput] = useState("");

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: MockMessage = { role: "user", content: text.trim() };
    const assistantMsg: MockMessage = {
      role: "assistant",
      content: `**What this means**\nThis is a great question. Based on your profile, this relates to the interconnected patterns we identified — particularly the gut-immune-metabolic cascade that's driving many of your symptoms.\n\n**What you can do**\nFocus on the current phase of your protocol. Small, consistent actions tend to compound. Your care coach can help you prioritize.\n\n**What to ask your doctor**\nConsider bringing this up at your next visit with Dr. ${manifest.careTeam?.physician?.name?.split(" ").pop() ?? "your physician"} to get their perspective on timing and approach.`,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
  };

  return (
    <section className="animate-fade-in space-y-6">
      <h2 className="text-sm font-sans font-medium uppercase tracking-widest text-secondary">
        Ask anything
      </h2>
      <p className="text-muted-foreground text-sm max-w-xl">
        This is your personal reasoning console. Ask questions about your results, protocol, or anything you're unsure about.
      </p>

      {/* Starter questions */}
      {starters.length > 0 && messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {starters.map((q, i) => (
            <button
              key={i}
              onClick={() => sendMessage(q)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors text-left"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="space-y-4 max-h-[500px] overflow-y-auto">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`rounded-xl p-4 ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground ml-8"
                : "bg-card border border-border mr-4"
            }`}
          >
            <p className={`text-sm whitespace-pre-line ${msg.role === "assistant" ? "text-foreground" : ""}`}>
              {msg.content.split(/\*\*(.*?)\*\*/g).map((part, j) =>
                j % 2 === 1 ? (
                  <strong key={j} className="block mt-3 mb-1 font-sans font-semibold text-xs uppercase tracking-wider text-secondary first:mt-0">
                    {part}
                  </strong>
                ) : (
                  <span key={j}>{part}</span>
                )
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2 items-center">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
          placeholder="Type your question..."
          className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/30"
        />
        <button
          onClick={() => sendMessage(input)}
          className="rounded-lg bg-secondary text-secondary-foreground p-2.5 hover:bg-secondary/90 transition-colors"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
};

export default AskSection;
