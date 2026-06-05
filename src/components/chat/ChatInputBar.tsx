import React, { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Send, Paperclip, Loader2, Mic, MicOff } from "lucide-react";

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
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const speechSupported = typeof window !== "undefined" && 
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    if (!speechSupported) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setText(transcript);
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    return () => {
      try { recognition.abort(); } catch {}
    };
  }, [speechSupported]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setText("");
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    if (isListening) {
      try { recognitionRef.current?.stop(); } catch {}
      setIsListening(false);
    }
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

  return (
    <div className="space-y-0">
      <div className="relative rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden focus-within:border-secondary/60 transition-all">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
          }}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? "Listening…" : placeholder}
          disabled={isLoading}
          rows={1}
          className="w-full resize-none bg-transparent px-4 pt-3 pb-1.5 pr-14 text-[15px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none leading-relaxed"
          style={{ maxHeight: "120px" }}
        />

        <div className="flex items-center justify-between px-2 pb-2 pt-0">
          <div className="flex items-center gap-1">
            <button
              disabled
              className="h-11 w-11 flex items-center justify-center rounded-md text-muted-foreground/40 transition-colors"
              title="Attach file (coming soon)"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            {speechSupported && (
              <button
                onClick={toggleListening}
                disabled={isLoading}
                className={`h-11 w-11 flex items-center justify-center rounded-md transition-colors ${
                  isListening
                    ? "text-red-500 bg-red-50 animate-pulse"
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/40"
                }`}
                title={isListening ? "Stop listening" : "Voice input"}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}

            <p className="text-[9px] text-muted-foreground/40 ml-1 hidden sm:block">
              <kbd className="px-1 py-0.5 bg-muted/60 rounded text-[8px] border border-border/30">Enter</kbd> to send
            </p>
          </div>

          <button
            onClick={handleSend}
            disabled={!text.trim() || isLoading}
            className="h-11 w-11 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 disabled:bg-muted disabled:text-muted-foreground/50 transition-all flex items-center justify-center shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInputBar;
