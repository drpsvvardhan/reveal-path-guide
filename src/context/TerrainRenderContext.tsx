import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";
import { useCIEAssessment } from "@/context/CIEAssessmentContext";
import { useLabUploads } from "@/context/LabUploadsContext";
import type { LabObservationRow } from "@/types/manifest";

interface TerrainPortrait {
  what_you_already_know: string;
  working_harder_than_you_realize: string;
  where_to_start: string;
  the_one_action: string;
}

interface ClinicianAxisBreakdown {
  axis: string;
  interpretation: string;
  status: "attention" | "coherent" | "monitor";
}

interface PerceptionGap {
  domain: string;
  patient_score: number;
  gate: string;
  gate_traffic_light: string;
  summary: string;
}

interface ClinicianSummary {
  terrain_overview: string;
  axis_breakdown: ClinicianAxisBreakdown[];
  perception_gaps: PerceptionGap[];
  suggested_questions: string[];
}

export interface TerrainRender {
  id: string;
  version: number;
  status: string;
  patient_portrait: TerrainPortrait | null;
  clinician_summary: ClinicianSummary | null;
  generated_at: string | null;
  created_at: string;
  voice_validation_status: string | null;
  voice_validation_warnings: any[] | null;
}

interface TerrainRenderContextValue {
  activeRender: TerrainRender | null;
  isLoading: boolean;
  error: string | null;
  hasFailed: boolean;
  refresh: () => Promise<void>;
  regenerate: () => Promise<void>;
}

const TerrainRenderContext = createContext<TerrainRenderContextValue | null>(null);

export const hasCompletedCiePlaceholder = (render: TerrainRender | null): boolean => {
  const portrait = render?.patient_portrait;
  if (!portrait) return false;
  const text = [
    portrait.what_you_already_know,
    portrait.working_harder_than_you_realize,
    portrait.where_to_start,
    portrait.the_one_action,
  ].join(" ").toLowerCase();
  return text.includes("cie has not been completed") || text.includes("complete your cie assessment");
};

// Returns true when the active render is nudging the user to upload labs
// even though labs already exist on the server. This indicates the witness
// layer was stale at generation time (labs not yet witnessified) and a
// regeneration will now produce a grounded portrait.
export const hasStaleLabUploadPlaceholder = (
  render: TerrainRender | null,
  hasLabObservations: boolean,
): boolean => {
  if (!hasLabObservations) return false;
  const portrait = render?.patient_portrait;
  if (!portrait) return false;
  const text = [
    portrait.what_you_already_know,
    portrait.working_harder_than_you_realize,
    portrait.where_to_start,
    portrait.the_one_action,
  ].join(" ").toLowerCase();
  return (
    text.includes("upload your most recent lab") ||
    text.includes("upload your most recent comprehensive lab") ||
    text.includes("foundational lab work has not arrived")
  );
};

// Returns true when there is at least one lab observation that was created
// or collected AFTER the active render was generated. Any new lab data —
// whether arriving via upload, manual entry, or backfill — should immediately
// invalidate the existing portrait so the next render reflects it.
export const hasLabObservationsNewerThanRender = (
  render: TerrainRender | null,
  observations: Pick<LabObservationRow, "created_at" | "collection_date">[] | null | undefined,
): boolean => {
  if (!observations || observations.length === 0) return false;
  if (!render) return true; // labs present but no render yet
  const renderTs = render.generated_at || render.created_at;
  if (!renderTs) return true;
  const renderMs = new Date(renderTs).getTime();
  if (Number.isNaN(renderMs)) return true;
  for (const obs of observations) {
    const candidates = [obs.created_at, obs.collection_date].filter(Boolean) as string[];
    for (const ts of candidates) {
      const ms = new Date(ts).getTime();
      if (!Number.isNaN(ms) && ms > renderMs) return true;
    }
  }
  return false;
};

export const useTerrainRender = () => {
  const ctx = useContext(TerrainRenderContext);
  if (!ctx) throw new Error("useTerrainRender must be used within TerrainRenderProvider");
  return ctx;
};

export const TerrainRenderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { effectiveUserId } = useViewAs();
  const { currentAssessment } = useCIEAssessment();
  const { observations: labObservations } = useLabUploads();
  const [activeRender, setActiveRender] = useState<TerrainRender | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasFailed, setHasFailed] = useState(false);

  const fetchRender = useCallback(async () => {
    const uid = effectiveUserId;
    if (!uid) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // First try to find an active render
      const { data, error: fetchErr } = await supabase
        .from("terrain_renders")
        .select("id, version, status, patient_portrait, clinician_summary, generated_at, created_at, voice_validation_status, voice_validation_warnings")
        .eq("user_id", uid)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      if (data) {
        setActiveRender(data as unknown as TerrainRender | null);
        setHasFailed(false);
      } else {
        // Check if there's a failed render (no active one exists)
        const { data: failedData } = await supabase
          .from("terrain_renders")
          .select("id, status")
          .eq("user_id", uid)
          .eq("status", "failed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        setActiveRender(null);
        setHasFailed(!!failedData);
      }
    } catch (e: any) {
      console.error("Failed to fetch terrain render:", e);
      setError(e.message || "Failed to load terrain render");
    } finally {
      setIsLoading(false);
    }
  }, [effectiveUserId]);

  const regenerate = useCallback(async () => {
    const uid = effectiveUserId;
    if (!uid) return;

    try {
      setIsLoading(true);
      setError(null);

      if (currentAssessment?.status === "complete") {
        const { data: scoringResult, error: scoringError } = await supabase.functions.invoke("cie-score-assessment", {
          body: { assessment_id: currentAssessment.id },
        });
        if (scoringError || !scoringResult?.success || scoringResult?.witness_error) {
          throw new Error(scoringError?.message || scoringResult?.witness_error || "Failed to prepare CIE data for terrain generation");
        }
      }

      const { data: result, error: invokeError } = await supabase.functions.invoke("generate-terrain-render", {
        body: { user_id: uid, assessment_id: currentAssessment?.id },
      });
      if (invokeError || !result?.success) {
        throw new Error(invokeError?.message || result?.error || "Terrain generation failed");
      }

      // Refresh to pick up the new active render
      await fetchRender();
    } catch (e: any) {
      console.error("Failed to regenerate terrain:", e);
      setError(e.message || "Failed to regenerate terrain");
      setIsLoading(false);
    }
  }, [effectiveUserId, currentAssessment, fetchRender]);

  useEffect(() => {
    fetchRender();
  }, [fetchRender]);

  // Auto-regenerate the terrain render when the CIE assessment is newer
  // than the active render (or no active render exists despite a completed
  // CIE). Prevents the stale "Your terrain rendering cannot be generated
  // yet because your CIE has not been completed" copy from sticking after
  // the user finishes the assessment.
  const autoRegenTriggered = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (isLoading) return;
    if (!effectiveUserId) return;
    if (!currentAssessment || currentAssessment.status !== "complete") return;
    // An imported factory CIE carries its real intake date in
    // full_completed_at, which can be far in the past — but it ENTERED the
    // system at created_at. Staleness must compare against whichever is
    // newer, or a back-dated import would look older than the active
    // render and never trigger regeneration.
    const cieCandidates = [
      currentAssessment.full_completed_at,
      currentAssessment.created_at,
    ].filter(Boolean) as string[];
    if (cieCandidates.length === 0) return;
    const cieTs = cieCandidates.reduce((a, b) =>
      new Date(a).getTime() >= new Date(b).getTime() ? a : b
    );
    const renderTs = activeRender?.generated_at || activeRender?.created_at;
    const placeholder = hasCompletedCiePlaceholder(activeRender);
    const staleLabs = hasStaleLabUploadPlaceholder(activeRender, (labObservations?.length ?? 0) > 0);
    const newerLabs = hasLabObservationsNewerThanRender(activeRender, labObservations);
    const stale =
      !activeRender ||
      placeholder ||
      staleLabs ||
      newerLabs ||
      (renderTs && new Date(renderTs).getTime() < new Date(cieTs).getTime());
    if (!stale) return;
    const reason = placeholder
      ? "placeholder"
      : staleLabs
        ? "stalelabs"
        : newerLabs
          ? "newerlabs"
          : "stale";
    // Include observation count so additional uploads re-trigger regeneration
    // even when the same (now-stale) render is still active.
    const obsCount = labObservations?.length ?? 0;
    const key = `${effectiveUserId}:${currentAssessment.id}:${activeRender?.id ?? "none"}:${reason}:${obsCount}`;
    if (autoRegenTriggered.current.has(key)) return;
    autoRegenTriggered.current.add(key);
    void regenerate();
  }, [effectiveUserId, currentAssessment, activeRender, isLoading, regenerate, labObservations]);

  return (
    <TerrainRenderContext.Provider value={{ activeRender, isLoading, error, hasFailed, refresh: fetchRender, regenerate }}>
      {children}
    </TerrainRenderContext.Provider>
  );
};
