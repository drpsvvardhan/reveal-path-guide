import React, { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, PanelRightClose, PanelRightOpen } from "lucide-react";

interface ChatLayoutProps {
  conversation: React.ReactNode;
  inputBar: React.ReactNode;
  reasoningTrace: React.ReactNode;
  isThinking?: boolean;
}

const ChatLayout: React.FC<ChatLayoutProps> = ({
  conversation,
  inputBar,
  reasoningTrace,
  isThinking,
}) => {
  const [traceOpen, setTraceOpen] = useState(false);

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-[1600px] mx-auto h-[calc(100vh-6rem)] flex flex-col"
    >
      {/* Compact hero */}
      <header className="pb-3 pt-1 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-9 w-9 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-secondary" />
            </div>
            {isThinking && (
              <>
                <div className="absolute inset-0 rounded-full border-2 border-secondary/40 animate-ping" />
                <div className="absolute -inset-1 rounded-full border border-secondary/20 animate-pulse" />
              </>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-sans font-medium uppercase tracking-[0.22em] text-signature">
              ASK ANYTHING
            </p>
            <h1 className="font-serif text-xl md:text-2xl text-foreground leading-tight">
              Your reasoning companion
              {isThinking && (
                <span className="text-muted-foreground font-serif italic ml-2 text-base">
                  thinking…
                </span>
              )}
            </h1>
          </div>
        </div>

        {/* Toggle reasoning trace on smaller screens */}
        <button
          onClick={() => setTraceOpen(!traceOpen)}
          className="xl:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          title={traceOpen ? "Hide reasoning trace" : "Show reasoning trace"}
        >
          {traceOpen ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
        </button>
      </header>

      {/* Main grid — chat takes majority of space */}
      <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-6 flex-1 min-h-0 pb-2">
        {/* Conversation column — much wider now */}
        <div className="flex flex-col min-h-0 relative">
          <div className="flex-1 overflow-y-auto pr-1 pb-2">
            {conversation}
          </div>
          <div className="shrink-0 pt-2 border-t border-border/40">
            {inputBar}
          </div>
        </div>

        {/* Reasoning trace panel — collapsible on mobile, narrower on desktop */}
        <aside
          className={`flex flex-col min-h-0 overflow-y-auto transition-all duration-300 ${
            traceOpen
              ? "fixed inset-y-0 right-0 w-[320px] bg-background z-50 shadow-2xl p-4 pt-16 border-l border-border"
              : "hidden xl:flex"
          }`}
        >
          {traceOpen && (
            <button
              onClick={() => setTraceOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 xl:hidden"
            >
              <PanelRightClose className="h-5 w-5" />
            </button>
          )}
          {reasoningTrace}
        </aside>
      </div>
    </motion.section>
  );
};

export default ChatLayout;
