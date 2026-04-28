import React, { useCallback, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDefinitionContext } from "@/hooks/useDefinitionContext";
import { useAuth } from "@/context/AuthContext";
import { resolveDefineTerm } from "@/lib/defineTermClient";

interface TappableProseProps {
  text: string;
  className?: string;
}

const COMMON_WORD_RESPONSE = "This is a common word — no technical meaning in this context.";

const TappableProse: React.FC<TappableProseProps> = ({ text, className }) => {
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [definition, setDefinition] = useState<string | null>(null);
  const [grounding, setGrounding] = useState<string | null>(null);
  const [groundedInData, setGroundedInData] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const definitionCtx = useDefinitionContext();
  const { user } = useAuth();

  // Split text into words preserving whitespace/punctuation
  const tokens = React.useMemo(() => {
    // Split into word tokens and separator tokens
    return text.split(/(\s+)/).filter(Boolean);
  }, [text]);

  // Find the sentence containing a word at a given character offset
  const extractSentence = useCallback(
    (wordStart: number): string => {
      // Simple sentence extraction: find . ! ? boundaries
      const before = text.slice(0, wordStart);
      const after = text.slice(wordStart);
      const sentStart = Math.max(
        before.lastIndexOf(".") + 1,
        before.lastIndexOf("!") + 1,
        before.lastIndexOf("?") + 1,
        0
      );
      const afterMatch = after.match(/[.!?]/);
      const sentEnd = afterMatch
        ? wordStart + (afterMatch.index || 0) + 1
        : text.length;
      return text.slice(sentStart, sentEnd).trim();
    },
    [text]
  );

  const handleWordTap = useCallback(
    async (word: string, charOffset: number) => {
      // Strip punctuation from the word for the API call
      const cleanWord = word.replace(/[^a-zA-Z0-9'-]/g, "").trim();
      if (!cleanWord || cleanWord.length < 2) return;

      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setActiveWord(cleanWord);
      setDefinition(null);
      setGrounding(null);
      setGroundedInData(false);
      setLoading(true);

      const sentence = extractSentence(charOffset);
      // Section context: up to 500 chars centered around the word
      const ctxStart = Math.max(0, charOffset - 250);
      const ctxEnd = Math.min(text.length, charOffset + 250);
      const sectionContext = text.slice(ctxStart, ctxEnd);

      try {
        const data = await resolveDefineTerm({
          term: cleanWord,
          sentence,
          sectionContext,
          definitionContext: definitionCtx,
          patientId: user?.id ?? null,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setDefinition(data.definition || "No definition available.");
        setGrounding(data.grounding ?? null);
        setGroundedInData(
          data.vizzhy_concept_mapped === true &&
            data.grounding !== null &&
            data.grounding.length > 0
        );
      } catch (err) {
        if (!controller.signal.aborted && (err as DOMException)?.name !== "AbortError") {
          setDefinition("Could not load definition.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [extractSentence, text, definitionCtx, user?.id]
  );

  // Track character offset for each token
  let charOffset = 0;

  return (
    <span className={className}>
      {tokens.map((token, i) => {
        const currentOffset = charOffset;
        charOffset += token.length;

        // If it's whitespace, render as-is
        if (/^\s+$/.test(token)) {
          return <span key={i}>{token}</span>;
        }

        const isActive = openIndex === i;

        return (
          <Popover
            key={i}
            open={isActive}
            onOpenChange={(open) => {
              if (!open) {
                setOpenIndex(null);
                setActiveWord(null);
                setDefinition(null);
                setGrounding(null);
                setGroundedInData(false);
              }
            }}
          >
            <PopoverTrigger asChild>
              <span
                role="button"
                tabIndex={0}
                className="cursor-pointer hover:bg-primary/5 rounded-sm transition-colors duration-150 -mx-px px-px"
                onClick={() => {
                  setOpenIndex(i);
                  handleWordTap(token, currentOffset);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpenIndex(i);
                    handleWordTap(token, currentOffset);
                  }
                }}
              >
                {token}
              </span>
            </PopoverTrigger>
            {isActive && (
              <PopoverContent
                className="w-64 p-3 rounded-lg border border-border/50 bg-card/95 backdrop-blur-sm shadow-lg"
                side="top"
                sideOffset={6}
                align="center"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-muted-foreground">Looking up…</span>
                  </div>
                ) : definition === COMMON_WORD_RESPONSE ? (
                  <p className="text-xs text-muted-foreground/70 italic">Not a technical term.</p>
                ) : (
                  <div>
                    <p className="text-sm text-foreground leading-relaxed">{definition}</p>
                    {grounding && (
                      <p className="text-sm text-foreground/85 leading-relaxed mt-2">
                        {grounding}
                      </p>
                    )}
                    <p className="text-[9px] text-muted-foreground/40 mt-2 font-sans tracking-wider uppercase">
                      {groundedInData ? "Vizzhy · grounded in your data" : "Vizzhy"}
                    </p>
                  </div>
                )}
              </PopoverContent>
            )}
          </Popover>
        );
      })}
    </span>
  );
};

export default TappableProse;
