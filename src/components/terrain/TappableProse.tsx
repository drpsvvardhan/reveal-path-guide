import React, { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDefinitionContext } from "@/hooks/useDefinitionContext";
import { composeDefinition, resolveConceptId } from "@/lib/definitionTemplates";

interface TappableProseProps {
  text: string;
  className?: string;
}

const COMMON_WORD_RESPONSE = "This is a common word — no technical meaning in this context.";

const TappableProse: React.FC<TappableProseProps> = ({ text, className }) => {
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [definition, setDefinition] = useState<string | null>(null);
  const [grounding, setGrounding] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const definitionCtx = useDefinitionContext();

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
      setLoading(true);

      // Concept-word interception: bypass the edge call when the tapped
      // word maps to a known concept, and compose patient-grounded text
      // client-side from the selector.
      const conceptId = resolveConceptId(cleanWord);
      if (conceptId) {
        const composed = composeDefinition(conceptId, definitionCtx);
        if (composed) {
          setDefinition(composed.vizzhy);
          setGrounding(composed.grounding);
          setLoading(false);
          return;
        }
      }

      const sentence = extractSentence(charOffset);
      // Section context: up to 500 chars centered around the word
      const ctxStart = Math.max(0, charOffset - 250);
      const ctxEnd = Math.min(text.length, charOffset + 250);
      const sectionContext = text.slice(ctxStart, ctxEnd);

      try {
        const { data, error } = await supabase.functions.invoke("define-term", {
          body: { term: cleanWord, sentence, section_context: sectionContext },
        });

        if (controller.signal.aborted) return;

        if (error) {
          setDefinition("Could not load definition.");
        } else {
          setDefinition(data?.definition || "No definition available.");
        }
      } catch {
        if (!controller.signal.aborted) {
          setDefinition("Could not load definition.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [extractSentence, text, definitionCtx]
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
                      Vizzhy
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
