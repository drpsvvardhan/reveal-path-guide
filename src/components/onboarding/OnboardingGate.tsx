import React from "react";
import { useManifest } from "@/context/ManifestContext";
import { useAuth } from "@/context/AuthContext";
import { useOnboarding } from "@/context/OnboardingContext";
import WelcomeStep from "./WelcomeStep";
import ProfileStep from "./ProfileStep";
import UploadStep from "./UploadStep";
import ProcessingStep from "./ProcessingStep";
import CompleteStep from "./CompleteStep";

interface OnboardingGateProps {
  children: React.ReactNode;
}

/**
 * Wraps the main app. If the user is authenticated but hasn't completed onboarding,
 * shows the onboarding wizard instead of the app. If they're in demo mode or have
 * completed onboarding, shows the app normally.
 */
const OnboardingGate: React.FC<OnboardingGateProps> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { profile, isDemoMode, isLoading } = useManifest();
  const { currentStep } = useOnboarding();

  // Still loading
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground italic font-serif">Loading your twin…</div>
      </div>
    );
  }

  // Demo mode or unauthenticated → show the app directly (sample manifest)
  if (isDemoMode || !user) {
    return <>{children}</>;
  }

  // Authenticated but no profile → show the app as a safe fallback
  if (!profile) {
    return <>{children}</>;
  }

  // Onboarding complete → show the app
  if (profile.onboarding_step === "done") {
    return <>{children}</>;
  }

  // Otherwise, show the appropriate onboarding step
  // TODO: Replace with actual step components once created
  switch (currentStep) {
    case "welcome":
      return <WelcomeStep />;
    case "profile":
      return <ProfileStep />;
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
