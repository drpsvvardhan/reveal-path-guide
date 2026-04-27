import React, { useCallback, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useDefinitionContext } from "@/hooks/useDefinitionContext";
import {
  composeDefinition,
  resolveConceptId,
  KNOWN_PHRASES,
  getDefinitionTemplate,
} from "@/lib/definitionTemplates";

/**
 * Section-level tap interceptor. Wraps any subtree and listens for clicks
 * on bare text. On click it reads the caret position, expands to the
 * tapped word + neighboring words, and:
 *   1. Greedily checks for a multi-word phrase match (4 → 3 → 2 grams).
 *   2. Falls back to single-word concept resolution.
 *   3. Falls back to the `define-term` edge call.
 *
 * Skips clicks on interactive elements (button, a, input, textarea,
 * select, label[for], [role="button"]) and elements opted out via
 * `data-no-tap`.
 */

const COMMON_WORD_RESPONSE =
  "This is a common word — no technical meaning in this context.";

const INTERACTIVE_SELECTOR =
  'button, a, input, textarea, select, [role="button"], [role="tab"], [role="menuitem"], [role="link"], [contenteditable="true"], [data-no-tap]';

function isInsideInteractive(el: Element | null): boolean {
  while (el) {
    if (el.matches?.(INTERACTIVE_SELECTOR)) return true;
    el = el.parentElement;
  }
  return false;
}

function getCaretRange(x: number, y: number): { node: Text; offset: number } | null {
  // Standard
  if (typeof document.caretRangeFromPoint === "function") {
    const range = document.caretRangeFromPoint(x, y);
    if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
      return { node: range.startContainer as Text, offset: range.startOffset };
    }
  }
  // Firefox
  // @ts-expect-error caretPositionFromPoint is non-standard typing
  if (typeof document.caretPositionFromPoint === "function") {
    // @ts-expect-error see above
    const pos = document.caretPositionFromPoint(x, y);
    if (pos && pos.offsetNode?.nodeType === Node.TEXT_NODE) {
      return { node: pos.offsetNode as Text, offset: pos.offset };
    }
  }
  return null;
}

/** Walk forward/back through sibling text nodes within the same block to
 *  collect a small window of words around the click. Stops at element
 *  boundaries that aren't pure inline (we keep it simple: same parent). */
function collectWordsAround(
  node: Text,
  offsetInNode: number
): { words: string[]; clickedWordIndex: number; sentence: string } {
  const parent = node.parentElement;
  if (!parent) return { words: [], clickedWordIndex: -1, sentence: "" };

  // Concatenate text content of the parent block to give phrase context.
  const fullText = parent.textContent ?? "";
  // Compute the absolute offset of `offsetInNode` within parent.textContent
  let absOffset = 0;
  const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
  let cur = walker.nextNode() as Text | null;
  while (cur && cur !== node) {
    absOffset += cur.length;
    cur = walker.nextNode() as Text | null;
  }
  absOffset += offsetInNode;

  // Tokenize parent text into words (preserving order)
  const tokenRegex = /[A-Za-z0-9'’\-]+/g;
  const tokens: { word: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = tokenRegex.exec(fullText))) {
    tokens.push({ word: m[0], start: m.index, end: m.index + m[0].length });
  }
  // Find the clicked token (the one whose range contains absOffset, or
  // whichever is nearest if click landed on whitespace/punctuation).
  let clickedIdx = tokens.findIndex(
    (t) => absOffset >= t.start && absOffset <= t.end
  );
  if (clickedIdx === -1) {
    // Find nearest by distance
    let bestDist = Infinity;
    tokens.forEach((t, i) => {
      const d = Math.min(
        Math.abs(absOffset - t.start),
        Math.abs(absOffset - t.end)
      );
      if (d < bestDist) {
        bestDist = d;
        clickedIdx = i;
      }
    });
  }

  // Sentence around click for edge-function context
  const before = fullText.slice(0, absOffset);
  const after = fullText.slice(absOffset);
  const sentStart = Math.max(
    before.lastIndexOf(".") + 1,
    before.lastIndexOf("!") + 1,
    before.lastIndexOf("?") + 1,
    0
  );
  const afterMatch = after.match(/[.!?]/);
  const sentEnd = afterMatch
    ? absOffset + (afterMatch.index || 0) + 1
    : fullText.length;
  const sentence = fullText.slice(sentStart, sentEnd).trim();

  return {
    words: tokens.map((t) => t.word),
    clickedWordIndex: clickedIdx,
    sentence,
  };
}

/** Try to find a known phrase that *contains* the clicked word.
 *  Looks at windows starting up to 3 words before the click. Returns
 *  the matched span info, or null. */
function findPhraseContainingClick(
  words: string[],
  clickedIdx: number
): {
  startIdx: number;
  length: number;
  conceptId?: string;
  phraseOnlyDefinition?: string;
} | null {
  const lower = words.map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ""));
  // Try window starts that could include the clicked index
  for (let start = Math.max(0, clickedIdx - 3); start <= clickedIdx; start++) {
    for (const len of [4, 3, 2]) {
      const end = start + len;
      if (clickedIdx < start || clickedIdx >= end) continue;
      if (end > lower.length) continue;
      const candidate = lower.slice(start, end).filter(Boolean).join(" ");
      const hit = KNOWN_PHRASES.find((p) => p.phrase === candidate);
      if (hit) {
        return {
          startIdx: start,
          length: len,
          conceptId: hit.conceptId,
          phraseOnlyDefinition: hit.phraseOnlyDefinition,
        };
      }
    }
  }
  return null;
}

interface TooltipState {
  x: number;
  y: number;
  loading: boolean;
  definition: string | null;
  grounding: string | null;
}

const TappableRegion: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const definitionCtx = useDefinitionContext();

  // Close on outside click / escape
  useEffect(() => {
    if (!tooltip) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTooltip(null);
    };
    const onScroll = () => setTooltip(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [tooltip]);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isInsideInteractive(target)) return;
      // Skip if click landed inside the tooltip itself
      if (target.closest("[data-tappable-tooltip]")) return;

      const range = getCaretRange(e.clientX, e.clientY);
      if (!range) return;

      const { words, clickedWordIndex, sentence } = collectWordsAround(
        range.node,
        range.offset
      );
      if (clickedWordIndex < 0 || words.length === 0) return;
      const clickedWord = words[clickedWordIndex];
      const cleanWord = clickedWord.replace(/[^a-zA-Z0-9'-]/g, "").trim();
      if (!cleanWord || cleanWord.length < 2) return;

      // Cancel in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Position tooltip near click
      const x = e.clientX;
      const y = e.clientY;
      setTooltip({ x, y, loading: true, definition: null, grounding: null });

      // 1. Phrase-first
      const phrase = findPhraseContainingClick(words, clickedWordIndex);
      if (phrase) {
        if (phrase.conceptId) {
          const composed = composeDefinition(phrase.conceptId, definitionCtx);
          if (composed) {
            setTooltip({
              x,
              y,
              loading: false,
              definition: composed.vizzhy,
              grounding: composed.grounding,
            });
            return;
          }
        }
        if (phrase.phraseOnlyDefinition) {
          setTooltip({
            x,
            y,
            loading: false,
            definition: phrase.phraseOnlyDefinition,
            grounding: null,
          });
          return;
        }
      }

      // 2. Single-word concept
      const conceptId = resolveConceptId(cleanWord);
      if (conceptId) {
        const composed = composeDefinition(conceptId, definitionCtx);
        if (composed) {
          setTooltip({
            x,
            y,
            loading: false,
            definition: composed.vizzhy,
            grounding: composed.grounding,
          });
          return;
        }
      }

      // 3. Edge fallback
      try {
        const ctxStart = Math.max(0, clickedWordIndex - 8);
        const ctxEnd = Math.min(words.length, clickedWordIndex + 8);
        const sectionContext = words.slice(ctxStart, ctxEnd).join(" ");
        const { data, error } = await supabase.functions.invoke("define-term", {
          body: { term: cleanWord, sentence, section_context: sectionContext },
        });
        if (controller.signal.aborted) return;
        if (error) {
          setTooltip({
            x,
            y,
            loading: false,
            definition: "Could not load definition.",
            grounding: null,
          });
        } else {
          setTooltip({
            x,
            y,
            loading: false,
            definition: data?.definition || "No definition available.",
            grounding: null,
          });
        }
      } catch {
        if (!controller.signal.aborted) {
          setTooltip({
            x,
            y,
            loading: false,
            definition: "Could not load definition.",
            grounding: null,
          });
        }
      }
    },
    [definitionCtx]
  );

  return (
    <>
      <div ref={containerRef} className={className} onClick={handleClick}>
        {children}
      </div>
      {tooltip &&
        createPortal(
          <div
            data-tappable-tooltip
            className="fixed z-50 w-64 p-3 rounded-lg border border-border/50 bg-card/95 backdrop-blur-sm shadow-lg pointer-events-auto"
            style={{
              left: Math.min(tooltip.x, window.innerWidth - 280),
              top: Math.max(8, tooltip.y - 12),
              transform: "translate(-50%, -100%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {tooltip.loading ? (
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-muted-foreground">Looking up…</span>
              </div>
            ) : tooltip.definition === COMMON_WORD_RESPONSE ? (
              <p className="text-xs text-muted-foreground/70 italic">
                Not a technical term.
              </p>
            ) : (
              <div>
                <p className="text-sm text-foreground leading-relaxed">
                  {tooltip.definition}
                </p>
                {tooltip.grounding && (
                  <p className="text-sm text-foreground/85 leading-relaxed mt-2">
                    {tooltip.grounding}
                  </p>
                )}
                <p className="text-[9px] text-muted-foreground/40 mt-2 font-sans tracking-wider uppercase">
                  Vizzhy
                </p>
              </div>
            )}
          </div>,
          document.body
        )}
      {/* Backdrop to dismiss */}
      {tooltip &&
        createPortal(
          <div
            className="fixed inset-0 z-40"
            onClick={() => setTooltip(null)}
          />,
          document.body
        )}
    </>
  );
};

export default TappableRegion;