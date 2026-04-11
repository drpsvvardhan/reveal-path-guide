import React from "react";
import OnboardingLayout from "./OnboardingLayout";
import { useOnboarding } from "@/context/OnboardingContext";
import { ArrowRight, Sparkles, FileText, Activity } from "lucide-react";

const WelcomeStep: React.FC = () => {
  const { advanceToStep, isSaving } = useOnboarding();

  const handleStart = () => {
    advanceToStep("profile");
  };

  return (
    <OnboardingLayout
      stepNumber={1}
      totalSteps={4}
      eyebrow="WELCOME TO VIZZHY"
      title="Your personal health intelligence layer"
      intro="In the next few minutes you'll set up your twin — a reasoning companion grounded in your actual biology. Here's what we'll do together."
      footer={
        <>
          <div />
          <button
            onClick={handleStart}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-secondary text-secondary-foreground px-5 py-2.5 text-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50"
          >
            Begin
            <ArrowRight className="h-4 w-4" />
          </button>
        </>
      }
    >
      <div className="space-y-4 mt-2">
        <StepPreview
          icon={Sparkles}
          step="01"
          title="Tell us about yourself"
          description="Just the basics — your name, age, and sex at birth. We use this to interpret lab values correctly."
        />
        <StepPreview
          icon={FileText}
          step="02"
          title="Upload your first lab report"
          description="A PDF from Quest, LabCorp, or your hospital. We read it automatically and extract every biomarker."
        />
        <StepPreview
          icon={Activity}
          step="03"
          title="We build your twin"
          description="Patterns get detected, your narrative gets written, and your Journey view opens. This takes about a minute."
        />
      </div>

      <div className="mt-8 rounded-xl border border-border/60 bg-muted/20 p-5">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Your data stays yours.</strong> Everything you upload lives in your account and is only accessible to you. Lab PDFs are stored encrypted. You can delete everything at any time from your settings.
        </p>
      </div>
    </OnboardingLayout>
  );
};

const StepPreview: React.FC<{
  icon: React.FC<any>;
  step: string;
  title: string;
  description: string;
}> = ({ icon: Icon, step, title, description }) => (
  <div className="flex gap-4 rounded-xl border border-border bg-card p-5">
    <div className="shrink-0">
      <div className="h-11 w-11 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center">
        <Icon className="h-5 w-5 text-secondary" />
      </div>
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[10px] font-mono text-muted-foreground tracking-wider">{step}</span>
        <h3 className="text-base font-medium text-foreground">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  </div>
);

export default WelcomeStep;
