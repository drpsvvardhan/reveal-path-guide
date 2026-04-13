import React, { useState } from "react";
import { motion, useMotionValue, useTransform, PanInfo, AnimatePresence } from "framer-motion";

interface InstinctOnboardingCardProps {
  /** Fires when the user commits by swiping right or tapping "I'm ready" */
  onReady: () => void;
}

/**
 * Card #0 in the CIE deck. Teaches the instinct-first rule physically
 * before Question 1 arrives. The patient learns the swipe mechanic on a
 * stake-free card so they don't burn their first real answer figuring out
 * the interface. Only one direction is accepted (right = ready). Left
 * swipe snaps back — you cannot opt out of instinct mode.
 */
const InstinctOnboardingCard: React.FC<InstinctOnboardingCardProps> = ({ onReady }) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-14, 0, 14]);
  const readyOpacity = useTransform(x, [0, 40, 140], [0, 0.4, 1]);
  const [committed, setCommitted] = useState(false);

  const commit = () => {
    if (committed) return;
    setCommitted(true);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate(25); } catch { /* noop */ }
    }
    setTimeout(onReady, 320);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 110) commit();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -24, scale: 0.96 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex flex-col items-center max-w-sm mx-auto select-none"
      >
        <div className="relative w-full">
          {/* Ghost cards behind to show deck depth */}
          <div className="absolute inset-0 rounded-3xl bg-card border border-border translate-y-4 scale-90 opacity-20" />
          <div className="absolute inset-0 rounded-3xl bg-card border border-border translate-y-2 scale-95 opacity-40" />

          <motion.div
            drag={committed ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            style={{ x, rotate }}
            onDragEnd={onDragEnd}
            animate={committed ? { x: 500, opacity: 0, rotate: 20 } : {}}
            whileTap={{ cursor: "grabbing" }}
            className="relative rounded-3xl bg-card border border-border px-6 py-10 shadow-lg cursor-grab touch-none"
          >
            <motion.div
              style={{ opacity: readyOpacity }}
              className="absolute top-6 right-6 rotate-[12deg] border-2 border-emerald-500 text-emerald-500 text-xs font-bold px-3 py-1 rounded"
            >
              READY
            </motion.div>

            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-5">
              Before we begin
            </div>

            <h2 className="font-serif text-2xl text-foreground leading-snug mb-5">
              Answer with your first reaction.
            </h2>

            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                This assessment reads instinct, not explanation. The answer
                your body gives in the first half-second is the one we want.
              </p>
              <p>
                Don&rsquo;t think it through. Don&rsquo;t round for comfort.
                Don&rsquo;t tell the story you&rsquo;d tell a stranger.
              </p>
              <p className="text-foreground">
                Swipe right when you&rsquo;re ready.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Tap fallback */}
        <button
          onClick={commit}
          disabled={committed}
          className="mt-6 rounded-xl border border-border bg-card px-6 py-3 text-sm font-medium hover:border-emerald-500/40 hover:text-emerald-500 transition-colors disabled:opacity-50"
        >
          I&rsquo;m ready →
        </button>

        <p className="mt-4 text-[10px] uppercase tracking-widest text-muted-foreground">
          Swipe. Don&rsquo;t think.
        </p>
      </motion.div>
    </AnimatePresence>
  );
};

export default InstinctOnboardingCard;
