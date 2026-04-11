import React, { useEffect, useState, useRef } from "react";
import OnboardingLayout from "./OnboardingLayout";
import { useOnboarding } from "@/context/OnboardingContext";
import { useDerivedPatterns } from "@/context/DerivedPatternsContext";
import { useNarrative } from "@/context/NarrativeContext";
import { CheckCircle2, Loader2, Circle } from "lucide-react";
import { motion } from "framer-motion";

const ProcessingStep: React.FC = () => {
  const { advanceToStep, markProcessingMilestone, processingState } = useOnboarding();
  const { runDerivation } = useDerivedPatterns();
  const { generateNarrative } = useNarrative();
  const [step, setStep] = useState<"idle" | "deriving" | "generating" | "done" | "failed">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasStartedRef = useRef(false);

  // Kick off the pipeline when this step mounts
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    (async () => {
      try {
        // Step 1: Run derivation
        setStep("deriving");
        markProcessingMilestone({ current_status: "Detecting patterns in your data" });
        const deriveResult = await runDerivation();

        if (!deriveResult) {
          throw new Error("Pattern detection failed");
        }

        markProcessingMilestone({
          derivation_complete: true,
          patterns_detected: deriveResult.detections_found,
          current_status: `Found ${deriveResult.detections_found} patterns`,
        });

        // Small pause so the user can see the progress
        await new Promise((r) => setTimeout(r, 800));

        // Step 2: Generate narrative
        setStep("generating");
        markProcessingMilestone({ current_status: "Writing your patient narrative" });
        const narrativeResult = await generateNarrative();

        if (!narrativeResult || !narrativeResult.success) {
          throw new Error(narrativeResult?.validation_error || "Narrative generation failed");
        }

        markProcessingMilestone({
          narrative_complete: true,
          current_status: "Your twin is ready",
        });

        // Small pause so the user can see the success state
        await new Promise((r) => setTimeout(r, 1200));

        setStep("done");
        await advanceToStep("complete");
      } catch (e: any) {
        console.error("Processing failed:", e);
        setErrorMessage(e.message || "Something went wrong while building your twin");
        setStep("failed");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    hasStartedRef.current = false;
    setStep("idle");
    setErrorMessage(null);
  };

  return (
    <OnboardingLayout
      stepNumber={4}
      totalSteps={4}
      eyebrow="BUILDING YOUR TWIN"
      title="We're reading your biology now"
      intro="This usually takes under a minute. You don't need to do anything — we'll let you know when your twin is ready."
    >
      <div className="space-y-4 mt-2">
        <ProcessingMilestone
          label="Patterns detected"
          sublabel={
            step === "deriving"
              ? "Running the rule engine against your data"
              : step === "generating" || step === "done"
              ? `${processingState.patterns_detected} patterns found`
              : "Waiting"
          }
          state={
            step === "deriving"
              ? "running"
              : step === "generating" || step === "done"
              ? "complete"
              : step === "failed" && !processingState.derivation_complete
              ? "failed"
              : "pending"
          }
        />

        <ProcessingMilestone
          label="Narrative written"
          sublabel={
            step === "generating"
              ? "Translating findings into plain language"
              : step === "done"
              ? "Your thesis, helping/feeding, and reversibility are ready"
              : step === "failed" && processingState.derivation_complete
              ? "Generation failed"
              : "Waiting"
          }
          state={
            step === "generating"
              ? "running"
              : step === "done"
              ? "complete"
              : step === "failed" && processingState.derivation_complete
              ? "failed"
              : "pending"
          }
        />

        <ProcessingMilestone
          label="Ready for you"
          sublabel={
            step === "done"
              ? "Delivering you to your Journey view"
              : "Almost there"
          }
          state={step === "done" ? "complete" : "pending"}
        />

        {step === "failed" && errorMessage && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 mt-6">
            <p className="text-sm text-destructive mb-3">
              Something went wrong: {errorMessage}
            </p>
            <button
              onClick={handleRetry}
              className="rounded-lg bg-destructive text-destructive-foreground px-4 py-2 text-xs font-medium hover:bg-destructive/90 transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </OnboardingLayout>
  );
};

const ProcessingMilestone: React.FC<{
  label: string;
  sublabel: string;
  state: "pending" | "running" | "complete" | "failed";
}> = ({ label, sublabel, state }) => {
  const Icon =
    state === "running" ? Loader2 : state === "complete" ? CheckCircle2 : Circle;
  const iconColor =
    state === "running"
      ? "text-secondary"
      : state === "complete"
      ? "text-success"
      : state === "failed"
      ? "text-destructive"
      : "text-muted-foreground/40";
  const borderColor =
    state === "running"
      ? "border-secondary/40"
      : state === "complete"
      ? "border-success/40"
      : state === "failed"
      ? "border-destructive/40"
      : "border-border";
  const bgColor =
    state === "running"
      ? "bg-secondary/5"
      : state === "complete"
      ? "bg-success/5"
      : state === "failed"
      ? "bg-destructive/5"
      : "bg-card";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-xl border ${borderColor} ${bgColor} p-5 flex items-center gap-4 transition-colors`}
    >
      <div className="shrink-0">
        <Icon className={`h-6 w-6 ${iconColor} ${state === "running" ? "animate-spin" : ""}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
      </div>
    </motion.div>
  );
};

export default ProcessingStep;
