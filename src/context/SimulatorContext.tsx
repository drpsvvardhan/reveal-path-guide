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
  admission_verdict?: string | null;
  admission_reasons?: any;
  evidence_label?: string | null;
  patient_safe?: boolean;
  safety_flags?: any;
  unbound_biomarkers?: any;
  protocol_template?: Record<string, any> | null;
  primary_outcome?: Record<string, any> | null;
  perturbation_category?: string | null;
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
  phase?: string;
  phase_started_at?: string | null;
  run_in_started_at?: string | null;
  intervention_started_at?: string | null;
  stopped_reason?: string | null;
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
  learning_status?: string;
  cycle_count?: number;
  replicated_by_experiment_id?: string | null;
}

export interface ExperimentProtocol {
  id: string;
  experiment_id: string;
  user_id: string;
  protocol_version: number;
  hypothesis_question: string;
  perturbation_category: string;
  intervention: Record<string, any>;
  primary_outcome: Record<string, any>;
  secondary_outcomes: any[];
  hold_stable: string[];
  allowed_cointerventions: string[];
  run_in_days: number;
  intervention_days: number;
  washout_days: number | null;
  crossover: any | null;
  min_observations_per_phase: number;
  min_adherence_pct: number;
  stop_criteria: string[];
  contraindications: string[];
  clinician_review_required: boolean;
  expected_direction: string | null;
  admission_verdict: string | null;
  admission_reasons: any;
  evidence_refs: any;
  created_at: string;
}

export interface DailyObservationRow {
  id: string;
  experiment_id: string;
  user_id: string;
  phase: string;
  observed_on: string;
  logged_at: string;
  intervention_performed: boolean | null;
  actual_dose: any | null;
  actual_time: string | null;
  actual_duration_min: number | null;
  primary_value: number | null;
  secondary_values: any;
  sleep_hours: number | null;
  sleep_quality: number | null;
  energy: number | null;
  recovery: number | null;
  symptom: number | null;
  confounders: Record<string, any>;
  note: string | null;
}

export interface ExperimentComparison {
  id: string;
  experiment_id: string;
  user_id: string;
  phase_a: string;
  phase_b: string;
  n_a: number;
  n_b: number;
  median_a: number | null;
  median_b: number | null;
  abs_change: number | null;
  pct_change: number | null;
  direction_consistency_pct: number | null;
  overlap_ratio: number | null;
  adherence_pct: number | null;
  missingness_pct: number | null;
  confounder_burden: number | null;
  result: "SIGNAL_DETECTED" | "POSSIBLE_SIGNAL" | "NO_DETECTABLE_SIGNAL" | "NOT_INTERPRETABLE" | "STOPPED_FOR_SAFETY";
  reasons: string[];
  human_summary: string;
  computed_at: string;
}

interface SimulatorContextValue {
  cards: WhatIfCard[];
  blockedCards: WhatIfCard[];
  experiments: Experiment[];
  checkpoints: Checkpoint[];
  learnings: Learning[];
  protocols: ExperimentProtocol[];
  dailyObservations: DailyObservationRow[];
  comparisons: ExperimentComparison[];
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  generateCards: (focus?: string) => Promise<void>;
  designProtocol: (payload: any) => Promise<{ experiment: Experiment; protocol: ExperimentProtocol } | null>;
  advancePhase: (experimentId: string, target?: string, stoppedReason?: string) => Promise<void>;
  logDailyObservation: (payload: any) => Promise<void>;
  comparePhases: (experimentId: string) => Promise<ExperimentComparison | null>;
  dismissCard: (cardId: string) => Promise<void>;
  runCheckpoint: (checkpointId: string) => Promise<void>;
  abandonExperiment: (experimentId: string) => Promise<void>;
  graduateExperiment: (experimentId: string) => Promise<void>;
  isAdminViewingAs: boolean;
}

const SimulatorContext = createContext<SimulatorContextValue | null>(null);

export const useSimulator = () => {
  const ctx = useContext(SimulatorContext);
  if (!ctx) throw new Error("useSimulator must be used within SimulatorProvider");
  return ctx;
};

export const SimulatorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { effectiveUserId, isViewingAs } = useViewAs();
  const uid = effectiveUserId || user?.id || null;

  const [cards, setCards] = useState<WhatIfCard[]>([]);
  const [blockedCards, setBlockedCards] = useState<WhatIfCard[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [protocols, setProtocols] = useState<ExperimentProtocol[]>([]);
  const [dailyObservations, setDailyObservations] = useState<DailyObservationRow[]>([]);
  const [comparisons, setComparisons] = useState<ExperimentComparison[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!uid) return;
    setIsLoading(true);
    setError(null);
    try {
      const patientCardsQuery = supabase
        .from("simulator_what_if_cards").select("*")
        .eq("user_id", uid).eq("patient_safe", true)
        .order("created_at", { ascending: false }).limit(20);
      const blockedCardsQuery = isViewingAs
        ? supabase.from("simulator_what_if_cards").select("*")
            .eq("user_id", uid).eq("patient_safe", false)
            .order("created_at", { ascending: false }).limit(20)
        : Promise.resolve({ data: [], error: null } as any);
      const [cardsRes, blockedRes, expRes, chkRes, lrnRes, protoRes, obsRes, cmpRes] = await Promise.all([
        patientCardsQuery,
        blockedCardsQuery,
        supabase.from("simulator_experiments").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("simulator_checkpoints").select("*").eq("user_id", uid).order("checkpoint_at", { ascending: true }),
        supabase.from("simulator_learnings").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(50),
        supabase.from("simulator_experiment_protocols").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("simulator_daily_observations").select("*").eq("user_id", uid).order("observed_on", { ascending: true }),
        supabase.from("simulator_experiment_comparisons").select("*").eq("user_id", uid).order("computed_at", { ascending: false }),
      ]);
      if (cardsRes.error) throw cardsRes.error;
      setCards((cardsRes.data as any) || []);
      setBlockedCards((blockedRes as any).data || []);
      setExperiments((expRes.data as any) || []);
      setCheckpoints((chkRes.data as any) || []);
      setLearnings((lrnRes.data as any) || []);
      setProtocols((protoRes.data as any) || []);
      setDailyObservations((obsRes.data as any) || []);
      setComparisons((cmpRes.data as any) || []);
    } catch (e: any) {
      setError(e.message || "Failed to load simulator data");
    } finally {
      setIsLoading(false);
    }
  }, [uid, isViewingAs]);

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

  const designProtocol = useCallback(async (payload: any) => {
    if (!uid) return null;
    try {
      const { data, error: err } = await supabase.functions.invoke("design-experiment-protocol", {
        body: { ...payload, user_id: uid },
      });
      if (err) throw err;
      await refresh();
      return data as any;
    } catch (e: any) {
      setError(e.message || "Failed to design protocol");
      return null;
    }
  }, [uid, refresh]);

  const advancePhase = useCallback(async (experimentId: string, target?: string, stoppedReason?: string) => {
    try {
      const { error: err } = await supabase.functions.invoke("start-experiment-phase", {
        body: { experiment_id: experimentId, target_phase: target, stopped_reason: stoppedReason },
      });
      if (err) throw err;
      await refresh();
    } catch (e: any) {
      setError(e.message || "Failed to advance phase");
    }
  }, [refresh]);

  const logDailyObservation = useCallback(async (payload: any) => {
    try {
      const { error: err } = await supabase.from("simulator_daily_observations").insert(payload);
      if (err) throw err;
      await refresh();
    } catch (e: any) {
      setError(e.message || "Failed to log observation");
    }
  }, [refresh]);

  const comparePhases = useCallback(async (experimentId: string): Promise<ExperimentComparison | null> => {
    try {
      const { data, error: err } = await supabase.functions.invoke("compare-experiment-phases", {
        body: { experiment_id: experimentId },
      });
      if (err) throw err;
      await refresh();
      return (data as any)?.comparison ?? null;
    } catch (e: any) {
      setError(e.message || "Failed to compare phases");
      return null;
    }
  }, [refresh]);

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
    // Replication gate: refuse to graduate unless the learning has cycle_count ≥ 2.
    const relevant = learnings.filter((l) => l.experiment_id === experimentId);
    const totalCycles = relevant.reduce((n, l) => n + (l.cycle_count ?? 1), 0);
    if (totalCycles < 2) {
      setError("Graduation requires a replicated cycle. Run another cycle of the same protocol first.");
      return;
    }
    await supabase
      .from("simulator_experiments")
      .update({ status: "graduated", ended_at: new Date().toISOString() })
      .eq("id", experimentId);
    await supabase
      .from("simulator_learnings")
      .update({ graduated: true, learning_status: "replicated" })
      .eq("experiment_id", experimentId);
    await refresh();
  }, [refresh]);

  return (
    <SimulatorContext.Provider
      value={{
        cards, blockedCards, experiments, checkpoints, learnings,
        protocols, dailyObservations, comparisons,
        isLoading, isGenerating, error,
        refresh, generateCards,
        designProtocol, advancePhase, logDailyObservation, comparePhases,
        dismissCard, runCheckpoint,
        abandonExperiment, graduateExperiment,
        isAdminViewingAs: isViewingAs,
      }}
    >
      {children}
    </SimulatorContext.Provider>
  );
};