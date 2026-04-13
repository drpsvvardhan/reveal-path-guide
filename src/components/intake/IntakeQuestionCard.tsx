import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { CIE_DOMAIN_MAP } from "@/lib/cieSeedData";

interface IntakeQuestionCardProps {
  questionId: string;
  text: string;
  type: string;
  domainId: string;
  currentResponse: string | null;
  /** Now receives both the answer AND the response latency in ms */
  onAnswer: (rawResponse: string, latencyMs: number) => void;
}

// Binary types get the full swipe treatment. 5-point types get tap+haptic.
const BINARY_TYPES = new Set(["yesno"]);

const OPTION_SETS: Record<string, string[]> = {
  frequency: ["never", "rarely", "sometimes", "often", "always"],
  yesno: ["no", "yes"],
  severity: ["none", "mild", "moderate", "severe", "extreme"],
  effectiveness: ["excellent", "good", "fair", "poor", "none"],
  comparison: ["much_better", "better", "same", "worse", "much_worse"],
  chronotype: ["morning", "afternoon", "evening"],
  activity: ["strength", "cardio", "mixed", "none"],
};

const DISPLAY_LABELS: Record<string, string> = {
  never: "Never", rarely: "Rarely", sometimes: "Sometimes", often: "Often", always: "Always",
  no: "No", yes: "Yes",
  none: "None", mild: "Mild", moderate: "Moderate", severe: "Severe", extreme: "Extreme",
  excellent: "Excellent", good: "Good", fair: "Fair", poor: "Poor",
  much_better: "Much better", better: "Better", same: "Same", worse: "Worse", much_worse: "Much worse",
  morning: "Morning", afternoon: "Afternoon", evening: "Evening",
  strength: "Strength", cardio: "Cardio", mixed: "Mixed",
};

// Small haptic helper — silent no-op on desktop, satisfying snap on mobile
const haptic = (ms = 15) => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try { navigator.vibrate(ms); } catch { /* noop */ }
  }
};

const IntakeQuestionCard: React.FC<IntakeQuestionCardProps> = ({
  questionId, text, type, domainId, currentResponse, onAnswer,
}) => {
  const options = OPTION_SETS[type] || OPTION_SETS.frequency;
  const isBinary = BINARY_TYPES.has(type);
  const domain = CIE_DOMAIN_MAP[domainId];
  const biologicalTarget = domain?.name || domainId;

  // ── Latency capture ──────────────────────────────────
  const renderedAt = useRef<number>(performance.now());
  useEffect(() => { renderedAt.current = performance.now(); }, [questionId]);

  // Domain reveal after answer, not before (prevents priming)
  const [revealed, setRevealed] = useState(false);

  const submit = (value: string) => {
    const latency = Math.round(performance.now() - renderedAt.current);
    console.log("[IntakeQuestionCard] submit called", { value, latency, questionId });
    haptic(20);
    setRevealed(true);
    setTimeout(() => {
      console.log("[IntakeQuestionCard] setTimeout firing onAnswer", { value, latency });
      onAnswer(value, latency);
    }, 220);
  };

  // ── Swipe mechanics for binary questions ────────────
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-18, 0, 18]);
  const noOpacity = useTransform(x, [-140, -40, 0], [1, 0.4, 0]);
  const yesOpacity = useTransform(x, [0, 40, 140], [0, 0.4, 1]);
  const SWIPE_THRESHOLD = 110;

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_THRESHOLD) submit("yes");
    else if (info.offset.x < -SWIPE_THRESHOLD) submit("no");
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={questionId}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -24, scale: 0.96 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="flex flex-col items-center text-center max-w-xl mx-auto select-none"
      >
        {/* ── BINARY MODE: swipeable card ── */}
        {isBinary ? (
          <div className="relative w-full max-w-sm mx-auto">
            {/* Ghost card behind to suggest a deck */}
            <div className="absolute inset-0 rounded-3xl bg-card border border-border translate-y-2 scale-95 opacity-40" />
            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.7}
              style={{ x, rotate }}
              onDragEnd={onDragEnd}
              whileTap={{ cursor: "grabbing" }}
              className="relative rounded-3xl bg-card border border-border px-6 py-12 shadow-lg cursor-grab touch-none"
            >
              {/* NO overlay — appears as user drags left */}
              <motion.div
                style={{ opacity: noOpacity }}
                className="absolute top-6 left-6 rotate-[-12deg] border-2 border-red-500 text-red-500 text-xs font-bold px-3 py-1 rounded"
              >
                NO
              </motion.div>
              {/* YES overlay — appears as user drags right */}
              <motion.div
                style={{ opacity: yesOpacity }}
                className="absolute top-6 right-6 rotate-[12deg] border-2 border-emerald-500 text-emerald-500 text-xs font-bold px-3 py-1 rounded"
              >
                YES
              </motion.div>

              <h2 className="font-serif text-xl md:text-2xl text-foreground leading-relaxed">
                {text}
              </h2>
            </motion.div>

            {/* Tap fallback for desktop / accessibility */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => submit("no")}
                className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium hover:border-red-500/40 hover:text-red-500 transition-colors"
              >
                ← No
              </button>
              <button
                onClick={() => submit("yes")}
                className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium hover:border-emerald-500/40 hover:text-emerald-500 transition-colors"
              >
                Yes →
              </button>
            </div>

            <p className="mt-4 text-[10px] uppercase tracking-widest text-muted-foreground">
              Swipe. Don&rsquo;t think.
            </p>
          </div>
        ) : (
          /* ── SCALE MODE: tap with haptic ── */
          <>
            <h2 className="font-serif text-xl md:text-2xl text-foreground leading-relaxed mb-8">
              {text}
            </h2>
            <div
              className={`grid gap-3 w-full ${
                options.length <= 3
                  ? "grid-cols-3 max-w-sm mx-auto"
                  : "grid-cols-2 sm:grid-cols-5"
              }`}
            >
              {options.map((opt) => {
                const selected = currentResponse === opt;
                return (
                  <motion.button
                    key={opt}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => submit(opt)}
                    className={`rounded-xl border px-4 py-3.5 text-sm font-medium transition-all duration-150 ${
                      selected
                        ? "border-secondary bg-secondary/15 text-secondary ring-1 ring-secondary/30"
                        : "border-border bg-card text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {DISPLAY_LABELS[opt] || opt}
                  </motion.button>
                );
              })}
            </div>
          </>
        )}

        {/* Domain revealed AFTER answer, never before (prevents priming) */}
        <div className="h-6 mt-6">
          <AnimatePresence>
            {revealed && (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs italic text-muted-foreground"
              >
                Measured: {biologicalTarget}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default IntakeQuestionCard;
