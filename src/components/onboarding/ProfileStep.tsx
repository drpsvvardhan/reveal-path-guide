import React, { useState } from "react";
import OnboardingLayout from "./OnboardingLayout";
import { useOnboarding } from "@/context/OnboardingContext";
import { ArrowLeft, ArrowRight } from "lucide-react";

const ProfileStep: React.FC = () => {
  const { formState, updateFormField, saveProfile, advanceToStep, isSaving } = useOnboarding();
  const [error, setError] = useState<string | null>(null);

  const canAdvance =
    formState.first_name.trim().length > 0 &&
    formState.age.trim().length > 0 &&
    !isNaN(parseInt(formState.age, 10)) &&
    parseInt(formState.age, 10) > 0 &&
    parseInt(formState.age, 10) < 130 &&
    formState.sex !== null;

  const handleNext = async () => {
    setError(null);
    if (!canAdvance) {
      setError("Please fill in all fields to continue.");
      return;
    }
    const success = await saveProfile();
    if (!success) {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleBack = () => {
    advanceToStep("welcome");
  };

  return (
    <OnboardingLayout
      stepNumber={2}
      totalSteps={4}
      eyebrow="ABOUT YOU"
      title="Let's start with the basics"
      intro="Your name, age, and sex at birth. These three facts let us interpret lab values correctly — reference ranges for women differ from men, and some markers shift with age."
      footer={
        <>
          <button
            onClick={handleBack}
            disabled={isSaving}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={!canAdvance || isSaving}
            className="flex items-center gap-2 rounded-xl bg-secondary text-secondary-foreground px-5 py-2.5 text-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving…" : "Continue"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </>
      }
    >
      <div className="space-y-6 mt-2">
        {/* First name */}
        <div>
          <label className="text-[11px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground block mb-2">
            What should we call you
          </label>
          <input
            type="text"
            value={formState.first_name}
            onChange={(e) => updateFormField("first_name", e.target.value)}
            placeholder="First name"
            autoFocus
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base font-serif text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary/40 transition-all"
          />
        </div>

        {/* Age */}
        <div>
          <label className="text-[11px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground block mb-2">
            Your age
          </label>
          <input
            type="number"
            min={1}
            max={129}
            value={formState.age}
            onChange={(e) => updateFormField("age", e.target.value)}
            placeholder="Years"
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base font-serif text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary/40 transition-all"
          />
        </div>

        {/* Sex */}
        <div>
          <label className="text-[11px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground block mb-2">
            Sex at birth
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(["female", "male", "other", "prefer_not_to_say"] as const).map((option) => {
              const label =
                option === "prefer_not_to_say"
                  ? "Prefer not to say"
                  : option.charAt(0).toUpperCase() + option.slice(1);
              const selected = formState.sex === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => updateFormField("sex", option)}
                  className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                    selected
                      ? "border-secondary bg-secondary/10 text-secondary"
                      : "border-border bg-card text-foreground hover:bg-muted/40"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 italic">
            We ask about sex at birth because lab reference ranges are calibrated by it. This isn't about gender identity.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    </OnboardingLayout>
  );
};

export default ProfileStep;
