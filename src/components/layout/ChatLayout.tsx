import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

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
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-[1480px] mx-auto h-[calc(100vh-8rem)] flex flex-col"
    >
      {/* Compact hero */}
      <header className="pb-4 pt-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center">
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
            <p className="text-[11px] font-sans font-medium uppercase tracking-[0.22em] text-signature">
              ASK ANYTHING
            </p>
            <h1 className="font-serif text-2xl md:text-3xl text-foreground leading-tight mt-0.5">
              Your reasoning companion
              {isThinking && (
                <span className="text-muted-foreground font-serif italic ml-3 text-lg">
                  thinking…
                </span>
              )}
            </h1>
          </div>
        </div>
      </header>

      {/* Main grid */}
      <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-8 flex-1 min-h-0 pb-4">
        {/* Conversation column */}
        <div className="flex flex-col min-h-0 relative">
          <div className="flex-1 overflow-y-auto pr-2 pb-4">
            {conversation}
          </div>
          <div className="shrink-0 pt-3 border-t border-border/60">
            {inputBar}
          </div>
        </div>

        {/* Reasoning trace panel */}
        <aside className="hidden xl:flex flex-col min-h-0 overflow-y-auto">
          {reasoningTrace}
        </aside>
      </div>
    </motion.section>
  );
};

export default ChatLayout;
