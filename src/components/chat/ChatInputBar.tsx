import React, { useState, useRef, KeyboardEvent } from "react";
import { Send, Paperclip, Sparkles, Loader2 } from "lucide-react";

interface ChatInputBarProps {
  onSend: (text: string) => void;
  isLoading?: boolean;
  suggestedQuestions?: string[];
  placeholder?: string;
}

const ChatInputBar: React.FC<ChatInputBarProps> = ({
  onSend,
  isLoading,
  suggestedQuestions = [],
  placeholder = "Ask about your results, your plan, or anything you're unsure about…",
}) => {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (q: string) => {
    setText(q);
    textareaRef.current?.focus();
  };

  return (
    <div className="space-y-3">
      {suggestedQuestions.length > 0 && !text && !isLoading && (
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="h-3 w-3 text-muted-foreground shrink-0" />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">
            Try asking
          </p>
          {suggestedQuestions.slice(0, 3).map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSuggestion(q)}
              className="text-[11px] text-foreground bg-muted/40 hover:bg-muted/80 border border-border/60 rounded-full px-3 py-1 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="relative rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.1)] overflow-hidden focus-within:border-secondary/60 focus-within:shadow-[0_1px_3px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.15)] transition-all">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          rows={1}
          className="w-full resize-none bg-transparent px-5 pt-4 pb-2 pr-16 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed"
          style={{ maxHeight: "160px" }}
        />

        <div className="flex items-center justify-between px-3 pb-2.5 pt-0">
          <div className="flex items-center gap-1">
            <button
              disabled
              className="p-1.5 rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40 transition-colors"
              title="Attach file (coming soon)"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <p className="text-[10px] text-muted-foreground/60 ml-1">
              Press <kbd className="px-1 py-0.5 bg-muted rounded text-[9px] border border-border/40">Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-muted rounded text-[9px] border border-border/40">Shift+Enter</kbd> for new line
            </p>
          </div>

          <button
            onClick={handleSend}
            disabled={!text.trim() || isLoading}
            className="h-8 w-8 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 disabled:bg-muted disabled:text-muted-foreground/50 transition-all flex items-center justify-center shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInputBar;
