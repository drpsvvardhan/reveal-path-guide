import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Long-press recovery for CIE.
 *
 * Replaces the visible back button. Core rules:
 *   - No arrow, no visible "back" affordance on the question screen.
 *   - User must long-press the header zone for 800ms → modal appears asking
 *     "Did you misread the last question?" → if yes, snaps back exactly one card.
 *   - Hard cap: 3 recoveries per session, shown as depleting dots at the top.
 *   - Every recovery is logged with T1 answer, T2 answer, and delta.
 */

interface UseLongPressRecoveryOpts {
  maxRecoveries?: number;
  holdMs?: number;
  onRecover: () => void | Promise<void>;
}

export function useLongPressRecovery(opts: UseLongPressRecoveryOpts) {
  const { maxRecoveries = 3, holdMs = 800, onRecover } = opts;
  const [remaining, setRemaining] = useState(maxRecoveries);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  const clearHold = useCallback(() => {
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setHoldProgress(0);
  }, []);

  const startHold = useCallback(() => {
    if (remaining <= 0) return;
    startRef.current = performance.now();
    const tick = () => {
      const pct = Math.min(1, (performance.now() - startRef.current) / holdMs);
      setHoldProgress(pct);
      if (pct < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    timerRef.current = window.setTimeout(() => {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try { navigator.vibrate(30); } catch { /* noop */ }
      }
      setDialogOpen(true);
      clearHold();
    }, holdMs);
  }, [holdMs, remaining, clearHold]);

  const confirmRecover = useCallback(async () => {
    setDialogOpen(false);
    setRemaining((r) => Math.max(0, r - 1));
    await onRecover();
  }, [onRecover]);

  useEffect(() => () => clearHold(), [clearHold]);

  const bind = {
    onMouseDown: startHold,
    onMouseUp: clearHold,
    onMouseLeave: clearHold,
    onTouchStart: startHold,
    onTouchEnd: clearHold,
    onTouchCancel: clearHold,
  };

  const dialog = (
    <>
      {/* Hold progress indicator — a thin line at the top of the screen */}
      <AnimatePresence>
        {holdProgress > 0 && holdProgress < 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-0 left-0 right-0 h-0.5 bg-emerald-500 z-50 origin-left"
            style={{ transform: `scaleX(${holdProgress})` }}
          />
        )}
      </AnimatePresence>

      {/* Recovery confirmation modal */}
      <AnimatePresence>
        {dialogOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
            onClick={() => setDialogOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 8 }}
              onClick={(e) => e.stopPropagation()}
              className="mx-6 max-w-sm rounded-2xl bg-card border border-border p-6 text-center"
            >
              <h3 className="font-serif text-lg text-foreground mb-2">
                Did you misread the last question?
              </h3>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                Recovery is for factual misreads, not second-guessing. Your
                first answer is still your best answer.
                <br />
                <span className="text-xs italic">
                  {remaining} recover{remaining === 1 ? "y" : "ies"} remaining.
                </span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDialogOpen(false)}
                  className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
                >
                  Keep going
                </button>
                <button
                  onClick={confirmRecover}
                  className="flex-1 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 px-4 py-2.5 text-sm font-medium hover:bg-emerald-500/20 transition-colors"
                >
                  Go back one
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  return { bind, dialog, remaining, holdProgress };
}

/** Depleting recovery dots — show remaining recoveries at the top of the screen */
export const RecoveryDots: React.FC<{ remaining: number; max?: number }> = ({
  remaining, max = 3,
}) => (
  <div className="flex items-center justify-center gap-1.5 py-2" aria-label={`${remaining} of ${max} recoveries remaining`}>
    {Array.from({ length: max }).map((_, i) => (
      <div
        key={i}
        className={`h-1 w-1 rounded-full transition-colors ${
          i < remaining ? "bg-muted-foreground/60" : "bg-muted-foreground/15"
        }`}
      />
    ))}
  </div>
);
