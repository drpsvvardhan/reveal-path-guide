import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";
import { PatientRevealManifest, PatientProfile } from "@/types/manifest";
import { sampleManifest, buildStubManifest } from "@/data/sampleManifest";

interface ManifestContextValue {
  manifest: PatientRevealManifest;
  profile: PatientProfile | null;
  isDemoMode: boolean;
  isLoading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
}

const ManifestContext = createContext<ManifestContextValue | null>(null);

export const useManifest = () => {
  const ctx = useContext(ManifestContext);
  if (!ctx) throw new Error("useManifest must be used within ManifestProvider");
  return ctx;
};

/**
 * Check if demo mode is active via URL parameter.
 * Adding ?demo=1 to the URL puts the app in demo mode which loads the sample manifest.
 */
function checkDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("demo") === "1" || params.get("demo") === "true";
}

export const ManifestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { effectiveUserId } = useViewAs();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode] = useState<boolean>(checkDemoMode());

  const refreshProfile = useCallback(async () => {
    const uid = effectiveUserId;
    if (!uid || isDemoMode) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();

      if (dbError) throw dbError;

      if (!data) {
        // Only create profile if viewing as self (not impersonating)
        if (uid === user?.id) {
          const { data: inserted, error: insertError } = await supabase
            .from("profiles")
            .insert({ user_id: uid, onboarding_step: "welcome" })
            .select("*")
            .single();

          if (insertError) throw insertError;
          setProfile(inserted as unknown as PatientProfile);
        } else {
          setProfile(null);
        }
      } else {
        setProfile(data as unknown as PatientProfile);
      }
    } catch (e: any) {
      console.error("Profile load failed:", e);
      setError(e.message || "Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, [effectiveUserId, user, isDemoMode]);

  useEffect(() => {
    if (authLoading) return;
    refreshProfile();
  }, [authLoading, refreshProfile]);

  // Determine which manifest to return based on mode and state
  const manifest: PatientRevealManifest = React.useMemo(() => {
    // Demo mode: show full sample manifest with all hardcoded data
    if (isDemoMode) {
      return sampleManifest;
    }

    // Not logged in: show sample manifest as landing page demo
    if (!user) {
      return sampleManifest;
    }

    // Authenticated user with no profile yet: stub with minimal data
    if (!profile) {
      return buildStubManifest({ firstName: "", age: 0, sex: "other" });
    }

    // Authenticated user: always use stub manifest — real data is merged in by useActiveManifest
    return buildStubManifest({
      firstName: profile.first_name || "there",
      age: profile.age || 0,
      sex: profile.sex || "other",
    });
  }, [isDemoMode, user, profile]);

  return (
    <ManifestContext.Provider
      value={{
        manifest,
        profile,
        isDemoMode,
        isLoading,
        error,
        refreshProfile,
      }}
    >
      {children}
    </ManifestContext.Provider>
  );
};
