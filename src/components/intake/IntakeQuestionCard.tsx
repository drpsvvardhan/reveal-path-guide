import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CIE_DOMAIN_MAP } from "@/lib/cieSeedData";

interface IntakeQuestionCardProps {
  questionId: string;
  text: string;
  type: string;
  domainId: string;
  currentResponse: string | null;
  onAnswer: (rawResponse: string) => void;
}

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
  never: "Never",
  rarely: "Rarely",
  sometimes: "Sometimes",
  often: "Often",
  always: "Always",
  no: "No",
  yes: "Yes",
  none: "None",
  mild: "Mild",
  moderate: "Moderate",
  severe: "Severe",
  extreme: "Extreme",
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  much_better: "Much better",
  better: "Better",
  same: "Same",
  worse: "Worse",
  much_worse: "Much worse",
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  strength: "Strength",
  cardio: "Cardio",
  mixed: "Mixed",
};

const IntakeQuestionCard: React.FC<IntakeQuestionCardProps> = ({
  questionId,
  text,
  type,
  domainId,
  currentResponse,
  onAnswer,
}) => {
  const options = OPTION_SETS[type] || OPTION_SETS.frequency;
  const domain = CIE_DOMAIN_MAP[domainId];
  const biologicalTarget = domain?.name || domainId;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={questionId}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex flex-col items-center text-center max-w-xl mx-auto"
      >
        {/* Question text */}
        <h2 className="font-serif text-xl md:text-2xl text-foreground leading-relaxed mb-8">
          {text}
        </h2>

        {/* Answer buttons */}
        <div
          className={`grid gap-3 w-full ${
            options.length === 2
              ? "grid-cols-2 max-w-xs mx-auto"
              : options.length <= 3
              ? "grid-cols-3 max-w-sm mx-auto"
              : "grid-cols-2 sm:grid-cols-5"
          }`}
        >
          {options.map((opt) => {
            const selected = currentResponse === opt;
            return (
              <button
                key={opt}
                onClick={() => onAnswer(opt)}
                className={`rounded-xl border px-4 py-3.5 text-sm font-medium transition-all duration-200 ${
                  selected
                    ? "border-secondary bg-secondary/15 text-secondary ring-1 ring-secondary/30"
                    : "border-border bg-card text-foreground hover:bg-muted/50 hover:border-muted-foreground/30"
                }`}
              >
                {DISPLAY_LABELS[opt] || opt}
              </button>
            );
          })}
        </div>

        {/* Biological target */}
        <p className="text-xs italic text-muted-foreground mt-6">
          Measuring: {biologicalTarget}
        </p>
      </motion.div>
    </AnimatePresence>
  );
};

export default IntakeQuestionCard;
