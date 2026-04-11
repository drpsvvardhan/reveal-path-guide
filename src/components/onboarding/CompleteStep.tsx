import React from "react";
import OnboardingLayout from "./OnboardingLayout";
import { useOnboarding } from "@/context/OnboardingContext";
import { useDerivedPatterns } from "@/context/DerivedPatternsContext";
import { useNarrative } from "@/context/NarrativeContext";
import { useLabUploads } from "@/context/LabUploadsContext";
import { Sparkles, ArrowRight } from "lucide-react";

const CompleteStep: React.FC = () => {
  const { completeOnboarding, isSaving } = useOnboarding();
  const { patterns } = useDerivedPatterns();
  const { activeNarrative } = useNarrative();
  const { observations } = useLabUploads();

  const handleEnter = () => {
    completeOnboarding();
  };

  const summaryItems = [
    { label: "Biomarkers analyzed", value: observations.length.toString() },
    { label: "Patterns detected", value: patterns.length.toString() },
    { label: "Narrative written", value: activeNarrative ? "✓" : "—" },
  ];

  return (
    <OnboardingLayout
      stepNumber={4}
      totalSteps={4}
      eyebrow="YOUR TWIN IS READY"
      title={activeNarrative?.patientThesis?.title || "Your biology, translated"}
      intro="Everything you need to understand what's happening in your body — and what to do about it — is ready for you. Here's a preview of what we found."
      footer={
        <>
          <div />
          <button
            onClick={handleEnter}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-secondary text-secondary-foreground px-5 py-2.5 text-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50"
          >
            {isSaving ? "Opening…" : "Enter your twin"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </>
      }
    >
      <div className="space-y-6 mt-2">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          {summaryItems.map((item, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-border bg-card p-4 text-center"
            >
              <p className="font-serif text-3xl text-foreground leading-none">{item.value}</p>
              <p className="text-[10px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground mt-2">
                {item.label}
              </p>
            </div>
          ))}
        </div>

        {/* Thesis preview */}
        {activeNarrative?.patientThesis?.body && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-secondary" />
              <p className="text-[11px] font-sans font-medium uppercase tracking-[0.15em] text-secondary">
                Your thesis
              </p>
            </div>
            <p className="text-base text-foreground leading-relaxed font-serif">
              {activeNarrative.patientThesis.body}
            </p>
          </div>
        )}

        {/* What's inside */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-5">
          <p className="text-[11px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground mb-3">
            What's inside your twin
          </p>
          <ul className="text-sm text-foreground/90 space-y-2 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-secondary mt-1">·</span>
              <span>
                <strong>Your Journey view</strong> — a daily rhythm of what to focus on today
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-secondary mt-1">·</span>
              <span>
                <strong>What's happening in your body</strong> — the full story of your biology right now
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-secondary mt-1">·</span>
              <span>
                <strong>Ask anything</strong> — a reasoning companion grounded in your actual data
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-secondary mt-1">·</span>
              <span>
                <strong>Questions for your doctor</strong> — ready for your next appointment
              </span>
            </li>
          </ul>
        </div>
      </div>
    </OnboardingLayout>
  );
};

export default CompleteStep;
