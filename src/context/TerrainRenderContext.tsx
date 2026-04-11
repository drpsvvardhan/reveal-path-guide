import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

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
}

interface TerrainRenderContextValue {
  activeRender: TerrainRender | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const TerrainRenderContext = createContext<TerrainRenderContextValue | null>(null);

export const useTerrainRender = () => {
  const ctx = useContext(TerrainRenderContext);
  if (!ctx) throw new Error("useTerrainRender must be used within TerrainRenderProvider");
  return ctx;
};

export const TerrainRenderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeRender, setActiveRender] = useState<TerrainRender | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRender = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchErr } = await supabase
        .from("terrain_renders")
        .select("id, version, status, patient_portrait, clinician_summary, generated_at, created_at")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      setActiveRender(data as unknown as TerrainRender | null);
    } catch (e: any) {
      console.error("Failed to fetch terrain render:", e);
      setError(e.message || "Failed to load terrain render");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRender();
  }, [fetchRender]);

  return (
    <TerrainRenderContext.Provider value={{ activeRender, isLoading, error, refresh: fetchRender }}>
      {children}
    </TerrainRenderContext.Provider>
  );
};
