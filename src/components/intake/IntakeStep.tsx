import React, { useEffect, useCallback, useState } from "react";
import { useIntake } from "@/context/IntakeContext";
import { useOnboarding } from "@/context/OnboardingContext";
import IntakeQuestionCard from "./IntakeQuestionCard";
import IntakeProgress from "./IntakeProgress";
import IntakeResultsScreen from "./IntakeResultsScreen";
import OnboardingLayout from "@/components/onboarding/OnboardingLayout";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

const IntakeStep: React.FC = () => {
  const {
    currentAssessmentId,
    currentPhase,
    responses,
    isLoading,
    error,
    startAssessment,
    recordResponse,
    advanceToNextQuestion,
    getCurrentQuestion,
    evaluateLayer1Triggers,
    completeAssessment,
    progress,
    totalQuestionsForPhase,
    currentQuestionIndex,
  } = useIntake();

  const { advanceToStep } = useOnboarding();
  const [transitioning, setTransitioning] = useState(false);

  // Auto-start assessment if none exists
  useEffect(() => {
    if (!currentAssessmentId && !isLoading) {
      startAssessment().catch(console.error);
    }
  }, [currentAssessmentId, isLoading, startAssessment]);

  const currentQ = getCurrentQuestion();

  const handleAnswer = useCallback(
    async (rawResponse: string) => {
      if (!currentQ) return;
      setTransitioning(true);

      await recordResponse(
        currentQ.question.id,
        currentQ.domainId,
        currentQ.layer,
        currentQ.question.type,
        rawResponse,
        0 // latencyMs — will be wired properly in Prompt 3
      );

      // Check if this was the last question in the phase
      const isLastInPhase = currentQuestionIndex >= totalQuestionsForPhase - 1;

      if (currentPhase === "layer1" && isLastInPhase) {
        await evaluateLayer1Triggers();
      } else if (currentPhase === "deep_dive" && isLastInPhase) {
        await completeAssessment();
      } else {
        advanceToNextQuestion();
      }

      // Small delay for animation
      setTimeout(() => setTransitioning(false), 100);
    },
    [
      currentQ,
      currentQuestionIndex,
      totalQuestionsForPhase,
      currentPhase,
      recordResponse,
      advanceToNextQuestion,
      evaluateLayer1Triggers,
      completeAssessment,
    ]
  );

  const handleContinueToUpload = useCallback(async () => {
    await advanceToStep("upload");
  }, [advanceToStep]);

  const handleBack = useCallback(() => {
    advanceToStep("profile");
  }, [advanceToStep]);

  // Show results screen when complete
  if (currentPhase === "complete") {
    return <IntakeResultsScreen onContinue={handleContinueToUpload} />;
  }

  // Loading state
  if (isLoading || !currentAssessmentId) {
    return (
      <OnboardingLayout
        stepNumber={3}
        totalSteps={5}
        eyebrow="CLINICAL INTAKE"
        title="Preparing your assessment…"
        intro=""
        footer={<div />}
      >
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </OnboardingLayout>
    );
  }

  // No more questions (shouldn't happen, but fallback)
  if (!currentQ) {
    return (
      <OnboardingLayout
        stepNumber={3}
        totalSteps={5}
        eyebrow="CLINICAL INTAKE"
        title="Processing…"
        intro=""
        footer={<div />}
      >
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </OnboardingLayout>
    );
  }

  const currentResponse = responses[currentQ.question.id] || null;

  return (
    <OnboardingLayout
      stepNumber={3}
      totalSteps={5}
      eyebrow="CLINICAL INTAKE"
      title=""
      intro=""
      hideHeader
      footer={
        <>
          <button
            onClick={handleBack}
            disabled={isLoading}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Profile
          </button>
          <span className="text-xs text-muted-foreground">
            {progress.current} / {progress.total}
          </span>
        </>
      }
    >
      <div className="space-y-8">
        {/* Progress bar */}
        <IntakeProgress
          currentDomainId={currentQ.domainId}
          phase={currentPhase}
          current={progress.current}
          total={progress.total}
        />

        {/* Question card */}
        <div className="py-4">
          <IntakeQuestionCard
            questionId={currentQ.question.id}
            text={currentQ.question.text}
            type={currentQ.question.type}
            domainId={currentQ.domainId}
            currentResponse={currentResponse?.answer ?? null}
            onAnswer={handleAnswer}
          />
        </div>

        {/* Error display */}
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-center">
            {error}
          </div>
        )}
      </div>
    </OnboardingLayout>
  );
};

export default IntakeStep;
