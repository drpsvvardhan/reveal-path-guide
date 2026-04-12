import React from "react";
import { useManifest } from "@/context/ManifestContext";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";
import { useOnboarding } from "@/context/OnboardingContext";
import WelcomeStep from "./WelcomeStep";
import ProfileStep from "./ProfileStep";
import UploadStep from "./UploadStep";
import ProcessingStep from "./ProcessingStep";
import CompleteStep from "./CompleteStep";
import IntakeStep from "@/components/intake/IntakeStep";

interface OnboardingGateProps {
  children: React.ReactNode;
}

const OnboardingGate: React.FC<OnboardingGateProps> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { isViewingAs } = useViewAs();
  const { profile, isDemoMode, isLoading } = useManifest();
  const { currentStep } = useOnboarding();

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground italic font-serif">Loading your twin…</div>
      </div>
    );
  }

  if (isDemoMode || !user || isViewingAs) return <>{children}</>;
  if (!profile) return <>{children}</>;
  if (profile.onboarding_step === "done") return <>{children}</>;

  switch (currentStep) {
    case "welcome":
      return <WelcomeStep />;
    case "profile":
      return <ProfileStep />;
    case "intake":
      return <IntakeStep />;
    case "upload":
      return <UploadStep />;
    case "processing":
      return <ProcessingStep />;
    case "complete":
      return <CompleteStep />;
    default:
      return <>{children}</>;
  }
};

export default OnboardingGate;
