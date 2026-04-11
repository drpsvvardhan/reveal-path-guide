import React, { createContext, useContext, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useManifest } from "@/context/ManifestContext";
import { OnboardingStep, OnboardingFormState, OnboardingProcessingState } from "@/types/manifest";

interface OnboardingContextValue {
  currentStep: OnboardingStep;
  formState: OnboardingFormState;
  processingState: OnboardingProcessingState;
  isSaving: boolean;
  updateFormField: <K extends keyof OnboardingFormState>(field: K, value: OnboardingFormState[K]) => void;
  advanceToStep: (step: OnboardingStep) => Promise<void>;
  saveProfile: () => Promise<boolean>;
  markProcessingMilestone: (milestone: Partial<OnboardingProcessingState>) => void;
  completeOnboarding: () => Promise<void>;
  dismissFirstTimeBanner: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export const useOnboarding = () => {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
};

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { profile, refreshProfile } = useManifest();

  const [formState, setFormState] = useState<OnboardingFormState>({
    first_name: "",
    age: "",
    sex: null,
  });

  const [processingState, setProcessingState] = useState<OnboardingProcessingState>({
    pdf_uploaded: false,
    observations_extracted: 0,
    derivation_complete: false,
    patterns_detected: 0,
    narrative_complete: false,
    current_status: "Waiting for your first lab upload",
    error: null,
  });

  const [isSaving, setIsSaving] = useState(false);

  // Sync form state from profile when it loads
  React.useEffect(() => {
    if (profile) {
      setFormState({
        first_name: profile.first_name || "",
        age: profile.age?.toString() || "",
        sex: profile.sex,
      });
    }
  }, [profile]);

  const currentStep: OnboardingStep = profile?.onboarding_step || "welcome";

  const updateFormField = useCallback(
    <K extends keyof OnboardingFormState>(field: K, value: OnboardingFormState[K]) => {
      setFormState((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const advanceToStep = useCallback(
    async (step: OnboardingStep) => {
      if (!user) return;
      setIsSaving(true);
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ onboarding_step: step })
          .eq("user_id", user.id);
        if (error) throw error;
        await refreshProfile();
      } catch (e) {
        console.error("Failed to advance step:", e);
      } finally {
        setIsSaving(false);
      }
    },
    [user, refreshProfile]
  );

  const saveProfile = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    setIsSaving(true);
    try {
      const ageNum = parseInt(formState.age, 10);
      if (!formState.first_name.trim() || isNaN(ageNum) || !formState.sex) {
        return false;
      }
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: formState.first_name.trim(),
          age: ageNum,
          sex: formState.sex,
          onboarding_step: "upload",
        })
        .eq("user_id", user.id);
      if (error) throw error;
      await refreshProfile();
      return true;
    } catch (e) {
      console.error("Failed to save profile:", e);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [user, formState, refreshProfile]);

  const markProcessingMilestone = useCallback(
    (milestone: Partial<OnboardingProcessingState>) => {
      setProcessingState((prev) => ({ ...prev, ...milestone }));
    },
    []
  );

  const completeOnboarding = useCallback(async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          onboarding_step: "done",
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (error) throw error;
      await refreshProfile();
    } catch (e) {
      console.error("Failed to complete onboarding:", e);
    } finally {
      setIsSaving(false);
    }
  }, [user, refreshProfile]);

  const dismissFirstTimeBanner = useCallback(async () => {
    if (!user) return;
    try {
      await supabase
        .from("profiles")
        .update({ first_time_banner_dismissed_at: new Date().toISOString() })
        .eq("user_id", user.id);
      await refreshProfile();
    } catch (e) {
      console.error("Failed to dismiss banner:", e);
    }
  }, [user, refreshProfile]);

  return (
    <OnboardingContext.Provider
      value={{
        currentStep,
        formState,
        processingState,
        isSaving,
        updateFormField,
        advanceToStep,
        saveProfile,
        markProcessingMilestone,
        completeOnboarding,
        dismissFirstTimeBanner,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};
