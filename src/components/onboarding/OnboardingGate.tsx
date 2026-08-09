import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  const { currentStep, completeOnboarding } = useOnboarding();

  // An uploaded/imported BioTwin already contains the intake + lab work.
  // Those patients must never be pushed back through the 75-question deck.
  const [twinCheck, setTwinCheck] = useState<"checking" | "none" | "present">("checking");

  useEffect(() => {
    let cancelled = false;
    if (!user || isDemoMode || isViewingAs) {
      setTwinCheck("none");
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("biotwin_reports")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);
      if (cancelled) return;
      setTwinCheck(!error && data && data.length > 0 ? "present" : "none");
    })();
    return () => { cancelled = true; };
  }, [user, isDemoMode, isViewingAs]);

  // Persist the skip so the gate resolves instantly next time.
  useEffect(() => {
    if (twinCheck === "present" && profile && profile.onboarding_step !== "done") {
      completeOnboarding();
    }
  }, [twinCheck, profile, completeOnboarding]);

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
  if (twinCheck === "present") return <>{children}</>;
  if (twinCheck === "checking") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground italic font-serif">Loading your twin…</div>
      </div>
    );
  }

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
