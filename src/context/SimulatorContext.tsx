import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";

export interface PredictedDelta {
  biomarker: string;
  direction: "increase" | "decrease" | "stabilize";
  magnitude?: string;
  unit?: string;
  coordinate?: string;
  confidence?: number;
  rationale?: string;
}

export interface WhatIfCard {
  id: string;
  user_id: string;
  lever: string;
  rationale: string;
  predicted_deltas: PredictedDelta[];
  horizon_days: number;
  confidence: number | null;
  focus: string | null;
  source_cluster_ids: string[];
  source_terrain_render_id: string | null;
  engine_version: string | null;
  seen_at: string | null;
  dismissed_at: string | null;
  committed_experiment_id: string | null;
  created_at: string;
}

export interface Experiment {
  id: string;
  user_id: string;
  source_card_id: string | null;
  lever: string;
  rationale: string;
  predicted_deltas: PredictedDelta[];
  horizon_days: number;
  started_at: string;
  ended_at: string | null;
  status: "active" | "paused" | "graduated" | "abandoned";
  source_cluster_ids: string[];
  source_terrain_render_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface Checkpoint {
  id: string;
  user_id: string;
  experiment_id: string;
  checkpoint_at: string;
  biomarkers: string[];
  status: "pending" | "completed" | "missed" | "skipped";
  measured_deltas: any | null;
  verdict: "confirmed" | "partial" | "refuted" | "inconclusive" | null;
  verdict_summary: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Learning {
  id: string;
  user_id: string;
  experiment_id: string | null;
  checkpoint_id: string | null;
  kind: string;
  headline: string;
  body: string | null;
  confidence: number | null;
  evidence_witness_ids: string[];
  graduated: boolean;
  created_at: string;
}

interface SimulatorContextValue {
  cards: WhatIfCard[];
  experiments: Experiment[];
  checkpoints: Checkpoint[];
  learnings: Learning[];
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  generateCards: (focus?: string) => Promise<void>;
  commitCard: (cardId: string) => Promise<Experiment | null>;
  dismissCard: (cardId: string) => Promise<void>;
  runCheckpoint: (checkpointId: string) => Promise<void>;
  abandonExperiment: (experimentId: string) => Promise<void>;
  graduateExperiment: (experimentId: string) => Promise<void>;
}

const SimulatorContext = createContext<SimulatorContextValue | null>(null);

export const useSimulator = () => {
  const ctx = useContext(SimulatorContext);
  if (!ctx) throw new Error("useSimulator must be used within SimulatorProvider");
  return ctx;
};

export const SimulatorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { effectiveUserId } = useViewAs();
  const uid = effectiveUserId || user?.id || null;

  const [cards, setCards] = useState<WhatIfCard[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!uid) return;
    setIsLoading(true);
    setError(null);
    try {
      const [cardsRes, expRes, chkRes, lrnRes] = await Promise.all([
        supabase.from("simulator_what_if_cards").select("*").eq("user_id", uid).eq("patient_safe", true).order("created_at", { ascending: false }).limit(20),
        supabase.from("simulator_experiments").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("simulator_checkpoints").select("*").eq("user_id", uid).order("checkpoint_at", { ascending: true }),
        supabase.from("simulator_learnings").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(50),
      ]);
      if (cardsRes.error) throw cardsRes.error;
      setCards((cardsRes.data as any) || []);
      setExperiments((expRes.data as any) || []);
      setCheckpoints((chkRes.data as any) || []);
      setLearnings((lrnRes.data as any) || []);
    } catch (e: any) {
      setError(e.message || "Failed to load simulator data");
    } finally {
      setIsLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const generateCards = useCallback(async (focus?: string) => {
    if (!uid) return;
    setIsGenerating(true);
    setError(null);
    try {
      const { error: err } = await supabase.functions.invoke("simulate-what-if", {
        body: { user_id: uid, focus: focus ?? null },
      });
      if (err) throw err;
      await refresh();
    } catch (e: any) {
      setError(e.message || "Failed to generate What-if cards");
    } finally {
      setIsGenerating(false);
    }
  }, [uid, refresh]);

  const commitCard = useCallback(async (cardId: string): Promise<Experiment | null> => {
    if (!uid) return null;
    const card = cards.find((c) => c.id === cardId);
    if (!card) return null;
    const { data: inserted, error: insErr } = await supabase
      .from("simulator_experiments")
      .insert({
        user_id: uid,
        source_card_id: card.id,
        lever: card.lever,
        rationale: card.rationale,
        predicted_deltas: card.predicted_deltas as any,
        horizon_days: card.horizon_days,
        source_cluster_ids: card.source_cluster_ids,
        source_terrain_render_id: card.source_terrain_render_id,
      })
      .select()
      .single();
    if (insErr) {
      setError(insErr.message);
      return null;
    }
    await supabase
      .from("simulator_what_if_cards")
      .update({ committed_experiment_id: (inserted as any).id })
      .eq("id", card.id);
    await refresh();
    return inserted as any;
  }, [uid, cards, refresh]);

  const dismissCard = useCallback(async (cardId: string) => {
    await supabase
      .from("simulator_what_if_cards")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", cardId);
    await refresh();
  }, [refresh]);

  const runCheckpoint = useCallback(async (checkpointId: string) => {
    setError(null);
    try {
      const { error: err } = await supabase.functions.invoke("compare-experiment-checkpoint", {
        body: { checkpoint_id: checkpointId },
      });
      if (err) throw err;
      await refresh();
    } catch (e: any) {
      setError(e.message || "Failed to compare checkpoint");
    }
  }, [refresh]);

  const abandonExperiment = useCallback(async (experimentId: string) => {
    await supabase
      .from("simulator_experiments")
      .update({ status: "abandoned", ended_at: new Date().toISOString() })
      .eq("id", experimentId);
    await refresh();
  }, [refresh]);

  const graduateExperiment = useCallback(async (experimentId: string) => {
    await supabase
      .from("simulator_experiments")
      .update({ status: "graduated", ended_at: new Date().toISOString() })
      .eq("id", experimentId);
    await refresh();
  }, [refresh]);

  return (
    <SimulatorContext.Provider
      value={{
        cards, experiments, checkpoints, learnings,
        isLoading, isGenerating, error,
        refresh, generateCards, commitCard, dismissCard, runCheckpoint,
        abandonExperiment, graduateExperiment,
      }}
    >
      {children}
    </SimulatorContext.Provider>
  );
};