import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";
import { useManifest } from "@/context/ManifestContext";
import { useLabUploads } from "@/context/LabUploadsContext";
import { PatientNarrativeVersion, NarrativeGenerationResult, GeneratedNarrativeFields } from "@/types/manifest";

interface NarrativeContextValue {
  activeNarrative: GeneratedNarrativeFields | null;
  allVersions: PatientNarrativeVersion[];
  loading: boolean;
  generating: boolean;
  error: string | null;
  lastResult: NarrativeGenerationResult | null;
  refresh: () => Promise<void>;
  generateNarrative: () => Promise<NarrativeGenerationResult | null>;
  restoreVersion: (versionId: string) => Promise<void>;
}

const NarrativeContext = createContext<NarrativeContextValue | null>(null);

export const useNarrative = () => {
  const ctx = useContext(NarrativeContext);
  if (!ctx) throw new Error("useNarrative must be used within NarrativeProvider");
  return ctx;
};

const GENERATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-narrative`;

export const NarrativeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { effectiveUserId } = useViewAs();
  const { manifest } = useManifest();
  const { observations, observationsAsTimeline } = useLabUploads();
  const [activeNarrative, setActiveNarrative] = useState<GeneratedNarrativeFields | null>(null);
  const [allVersions, setAllVersions] = useState<PatientNarrativeVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<NarrativeGenerationResult | null>(null);

  const refresh = useCallback(async () => {
    const uid = effectiveUserId;
    if (!uid) {
      setActiveNarrative(null);
      setAllVersions([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("patient_narratives")
        .select("*")
        .eq("user_id", uid)
        .order("version", { ascending: false });

      if (dbError) throw dbError;

      const versions = (data || []) as unknown as PatientNarrativeVersion[];
      setAllVersions(versions);

      const active = versions.find((v) => v.status === "active");
      setActiveNarrative(active ? (active.narrative as GeneratedNarrativeFields) : null);
    } catch (e: any) {
      console.error("Narrative refresh failed:", e);
      setError(e.message || "Failed to load narratives");
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const generateNarrative = useCallback(async (): Promise<NarrativeGenerationResult | null> => {
    const uid = effectiveUserId;
    if (!uid || !manifest) return null;
    setGenerating(true);
    setError(null);
    try {
      // Merge uploaded lab observations into the manifest before sending
      let mergedManifest = manifest;
      if (observations.length > 0) {
        const timeline = observationsAsTimeline();
        mergedManifest = {
          ...manifest,
          rawData: {
            ...(manifest.rawData || {}),
            biomarkerTimeline: timeline,
          },
        };
      }

      const resp = await fetch(GENERATE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          manifest: mergedManifest,
          userId: uid,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Generation failed (${resp.status})`);
      }

      const result = (await resp.json()) as NarrativeGenerationResult;
      setLastResult(result);

      // Refresh versions to pick up the new one
      await refresh();

      return result;
    } catch (e: any) {
      console.error("Narrative generation failed:", e);
      setError(e.message || "Narrative generation failed");
      return null;
    } finally {
      setGenerating(false);
    }
  }, [user, manifest, observations, observationsAsTimeline, refresh]);

  const restoreVersion = useCallback(
    async (versionId: string) => {
      if (!user) return;
      const { error: dbError } = await supabase
        .from("patient_narratives")
        .update({ status: "active" as any })
        .eq("id", versionId)
        .eq("user_id", user.id);
      if (dbError) {
        console.error("Restore failed:", dbError);
        return;
      }
      await refresh();
    },
    [user, refresh]
  );

  return (
    <NarrativeContext.Provider
      value={{
        activeNarrative,
        allVersions,
        loading,
        generating,
        error,
        lastResult,
        refresh,
        generateNarrative,
        restoreVersion,
      }}
    >
      {children}
    </NarrativeContext.Provider>
  );
};
