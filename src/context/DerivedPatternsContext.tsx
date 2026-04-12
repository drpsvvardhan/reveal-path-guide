import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";
import { useManifest } from "@/context/ManifestContext";
import { useQueue } from "@/context/QueueContext";
import { useLabUploads } from "@/context/LabUploadsContext";
import { DerivedPattern } from "@/types/manifest";

interface DeriveRunResult {
  detections_found: number;
  inserted: number;
  updated: number;
  questions_queued: number;
}

interface DerivedPatternsContextValue {
  patterns: DerivedPattern[];
  dismissed: DerivedPattern[];
  loading: boolean;
  running: boolean;
  error: string | null;
  lastRunResult: DeriveRunResult | null;
  refresh: () => Promise<void>;
  runDerivation: () => Promise<DeriveRunResult | null>;
  dismissPattern: (id: string) => Promise<void>;
  restorePattern: (id: string) => Promise<void>;
}

const DerivedPatternsContext = createContext<DerivedPatternsContextValue | null>(null);

export const useDerivedPatterns = () => {
  const ctx = useContext(DerivedPatternsContext);
  if (!ctx) throw new Error("useDerivedPatterns must be used within DerivedPatternsProvider");
  return ctx;
};

const DERIVE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/derive-patterns`;

export const DerivedPatternsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { effectiveUserId } = useViewAs();
  const { manifest } = useManifest();
  const { refresh: refreshQueue } = useQueue();
  const { observations, observationsAsTimeline } = useLabUploads();
  const [patterns, setPatterns] = useState<DerivedPattern[]>([]);
  const [dismissed, setDismissed] = useState<DerivedPattern[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRunResult, setLastRunResult] = useState<DeriveRunResult | null>(null);

  const refresh = useCallback(async () => {
    const uid = effectiveUserId;
    if (!uid) {
      setPatterns([]);
      setDismissed([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("derived_patterns")
        .select("*")
        .eq("user_id", uid)
        .order("severity", { ascending: true })
        .order("last_confirmed_at", { ascending: false });

      if (dbError) throw dbError;

      const all = (data || []) as unknown as DerivedPattern[];
      setPatterns(all.filter((p) => p.status === "active"));
      setDismissed(all.filter((p) => p.status === "dismissed"));
    } catch (e: any) {
      console.error("Pattern refresh failed:", e);
      setError(e.message || "Failed to load patterns");
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runDerivation = useCallback(async (): Promise<DeriveRunResult | null> => {
    if (!user || !manifest) return null;
    setRunning(true);
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

      const resp = await fetch(DERIVE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          manifest: mergedManifest,
          userId: effectiveUserId,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Derivation failed (${resp.status})`);
      }

      const result = await resp.json();
      setLastRunResult(result);

      // Refresh patterns and queue to pick up new entries
      await refresh();
      await refreshQueue();

      return result;
    } catch (e: any) {
      console.error("Derivation failed:", e);
      setError(e.message || "Derivation failed");
      return null;
    } finally {
      setRunning(false);
    }
  }, [user, manifest, observations, observationsAsTimeline, refresh, refreshQueue]);

  const dismissPattern = useCallback(
    async (id: string) => {
      const { error: dbError } = await supabase
        .from("derived_patterns")
        .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
        .eq("id", id);
      if (dbError) throw dbError;
      await refresh();
    },
    [refresh]
  );

  const restorePattern = useCallback(
    async (id: string) => {
      const { error: dbError } = await supabase
        .from("derived_patterns")
        .update({ status: "active", dismissed_at: null })
        .eq("id", id);
      if (dbError) throw dbError;
      await refresh();
    },
    [refresh]
  );

  return (
    <DerivedPatternsContext.Provider
      value={{
        patterns,
        dismissed,
        loading,
        running,
        error,
        lastRunResult,
        refresh,
        runDerivation,
        dismissPattern,
        restorePattern,
      }}
    >
      {children}
    </DerivedPatternsContext.Provider>
  );
};
