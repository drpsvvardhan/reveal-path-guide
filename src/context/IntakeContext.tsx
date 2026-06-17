import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  CIE_DOMAINS,
  CIE_GATES,
  CIE_DOMAIN_MAP,
  CIE_CONFIG,
  SCORE_MAPS,
  scoreResponse,
  computeDomainScore,
  trafficLight,
  type CieQuestion,
} from "@/lib/cieSeedData";

// ── All Layer 1 questions in axis order ──
const ALL_L1_QUESTIONS: { question: CieQuestion; domainId: string }[] = CIE_DOMAINS.flatMap(
  (d) => d.layer1.map((q) => ({ question: q, domainId: d.id }))
);

export type IntakePhase = "layer1" | "deep_dive" | "complete";

export interface IntakeProgress {
  phase: IntakePhase;
  current: number;
  total: number;
  percent: number;
}

interface DomainScore {
  layer1Score: number;
  layer2Score: number | null;
  finalScore: number;
  triggeredLayer2: boolean;
}

interface GateScore {
  score: number;
  trafficLight: string;
}

// Stored per-response so we can track latency and reconsideration state
interface ResponseRecord {
  answer: string;
  latencyMs: number;
  pendingReconsideration?: boolean; // true when user recovered to this question
}

interface IntakeState {
  currentAssessmentId: string | null;
  currentPhase: IntakePhase;
  currentQuestionIndex: number;
  totalQuestionsForPhase: number;
  responses: Record<string, ResponseRecord>;
  triggeredDomains: string[];
  domainScores: Record<string, DomainScore>;
  gateScores: Record<string, GateScore>;
  isLoading: boolean;
  error: string | null;
}

interface ReconsiderationParams {
  assessmentId: string;
  questionId: string;
  domainId: string;
  t1Answer: string;
  t1LatencyMs: number;
}

interface IntakeContextValue extends IntakeState {
  startAssessment: () => Promise<string>;
  recordResponse: (questionId: string, domainId: string, layer: number, questionType: string, rawResponse: string, latencyMs: number) => Promise<void>;
  advanceToNextQuestion: () => void;
  getCurrentQuestion: () => { question: CieQuestion; domainId: string; layer: number } | null;
  getPreviousQuestion: () => { question: CieQuestion; domainId: string; layer: number } | null;
  progress: IntakeProgress;
  evaluateLayer1Triggers: () => Promise<void>;
  completeAssessment: () => Promise<void>;
  stepBackOneQuestion: () => void;
  logReconsiderationEvent: (params: ReconsiderationParams) => Promise<void>;
}

const IntakeContext = createContext<IntakeContextValue | null>(null);

export function useIntake() {
  const ctx = useContext(IntakeContext);
  if (!ctx) throw new Error("useIntake must be used within IntakeProvider");
  return ctx;
}

// ── Build deep-dive question list from triggered domains ──
function buildDeepDiveQuestions(triggered: string[]): { question: CieQuestion; domainId: string }[] {
  return triggered.flatMap((domainId) => {
    const domain = CIE_DOMAIN_MAP[domainId];
    if (!domain) return [];
    return domain.layer2.map((q) => ({ question: q, domainId }));
  });
}

// ── Compute delta_type between T1 and T2 answers ──
function computeDeltaType(t1: string, t2: string, questionType: string): string {
  if (t1 === t2) return "same";

  // For binary, any change is a flip
  if (questionType === "yesno") return "flipped";

  // For scale types, determine position relative to midpoint
  const SCALE_ORDER: Record<string, string[]> = {
    frequency: ["never", "rarely", "sometimes", "often", "always"],
    severity: ["none", "mild", "moderate", "severe", "extreme"],
    effectiveness: ["excellent", "good", "fair", "poor", "none"],
    comparison: ["much_better", "better", "same", "worse", "much_worse"],
  };

  const scale = SCALE_ORDER[questionType];
  if (!scale) return "same";

  const i1 = scale.indexOf(t1);
  const i2 = scale.indexOf(t2);
  if (i1 === -1 || i2 === -1) return "same";

  const mid = (scale.length - 1) / 2;
  const d1 = Math.abs(i1 - mid);
  const d2 = Math.abs(i2 - mid);

  // Crossed midpoint?
  if ((i1 < mid && i2 > mid) || (i1 > mid && i2 < mid)) return "flipped";

  return d2 < d1 ? "softened" : "hardened";
}

export function IntakeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const resumeAttempted = useRef(false);

  const [state, setState] = useState<IntakeState>({
    currentAssessmentId: null,
    currentPhase: "layer1",
    currentQuestionIndex: 0,
    totalQuestionsForPhase: ALL_L1_QUESTIONS.length,
    responses: {},
    triggeredDomains: [],
    domainScores: {},
    gateScores: {},
    isLoading: false,
    error: null,
  });

  // ── Resume in-progress assessment on mount ──
  useEffect(() => {
    if (!user || resumeAttempted.current) return;
    resumeAttempted.current = true;

    (async () => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const { data: assessment } = await supabase
          .from("cie_assessments")
          .select("*")
          .eq("user_id", user.id)
          .in("status", ["in_progress", "layer1_complete"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!assessment) {
          setState((s) => ({ ...s, isLoading: false }));
          return;
        }

        // Load existing responses
        const { data: existing } = await supabase
          .from("cie_responses")
          .select("question_id, raw_response, domain_id, layer, question_type, response_latency_ms")
          .eq("assessment_id", assessment.id);

        const responses: Record<string, ResponseRecord> = {};
        if (existing) {
          for (const r of existing) {
            responses[r.question_id] = {
              answer: r.raw_response,
              latencyMs: (r as any).response_latency_ms ?? 0,
            };
          }
        }

        const triggeredDomains = assessment.triggered_domains || [];
        const isDeepDive = assessment.status === "layer1_complete" && triggeredDomains.length > 0;

        let phase: IntakePhase = "layer1";
        let questionIndex = 0;
        let totalForPhase = ALL_L1_QUESTIONS.length;

        if (isDeepDive) {
          phase = "deep_dive";
          const ddQuestions = buildDeepDiveQuestions(triggeredDomains);
          totalForPhase = ddQuestions.length;
          questionIndex = ddQuestions.findIndex((q) => !responses[q.question.id]);
          if (questionIndex === -1) questionIndex = ddQuestions.length;
        } else {
          questionIndex = ALL_L1_QUESTIONS.findIndex((q) => !responses[q.question.id]);
          if (questionIndex === -1) questionIndex = ALL_L1_QUESTIONS.length;
        }

        setState((s) => ({
          ...s,
          currentAssessmentId: assessment.id,
          currentPhase: phase,
          currentQuestionIndex: questionIndex,
          totalQuestionsForPhase: totalForPhase,
          responses,
          triggeredDomains,
          isLoading: false,
        }));
      } catch {
        setState((s) => ({ ...s, isLoading: false }));
      }
    })();
  }, [user]);

  // ── Start a new assessment ──
  const startAssessment = useCallback(async (): Promise<string> => {
    if (!user) throw new Error("Not authenticated");
    setState((s) => ({ ...s, isLoading: true, error: null }));

    const { data: version } = await supabase.rpc("next_cie_version", { p_user_id: user.id });

    const { data, error } = await supabase
      .from("cie_assessments")
      .insert({ user_id: user.id, version: version ?? 1, status: "in_progress" })
      .select("id")
      .single();

    if (error || !data) {
      setState((s) => ({ ...s, isLoading: false, error: error?.message ?? "Failed to create assessment" }));
      throw new Error(error?.message);
    }

    setState((s) => ({
      ...s,
      currentAssessmentId: data.id,
      currentPhase: "layer1",
      currentQuestionIndex: 0,
      totalQuestionsForPhase: ALL_L1_QUESTIONS.length,
      responses: {},
      triggeredDomains: [],
      domainScores: {},
      gateScores: {},
      isLoading: false,
    }));

    return data.id;
  }, [user]);

  // ── Record a response ──
  const recordResponse = useCallback(
    async (questionId: string, domainId: string, layer: number, questionType: string, rawResponse: string, latencyMs: number) => {
      if (!user || !state.currentAssessmentId) return;

      const score = scoreResponse(questionType, rawResponse, questionId);
      const existingResponse = state.responses[questionId];
      const isReconsideration = existingResponse?.pendingReconsideration === true;

      // Optimistic local update
      setState((s) => ({
        ...s,
        responses: {
          ...s.responses,
          [questionId]: { answer: rawResponse, latencyMs, pendingReconsideration: false },
        },
      }));

      if (isReconsideration) {
        // This is a T2 answer — preserve T1, update the response row
        const t1Answer = existingResponse.answer;
        const t1LatencyMs = existingResponse.latencyMs;
        const deltaType = computeDeltaType(t1Answer, rawResponse, questionType);

        // Update cie_responses with new answer + preserve T1
        await supabase
          .from("cie_responses")
          .update({
            raw_response: rawResponse,
            score,
            response_latency_ms: latencyMs,
            t1_answer: t1Answer,
            t1_latency_ms: t1LatencyMs,
          } as any)
          .eq("assessment_id", state.currentAssessmentId)
          .eq("question_id", questionId);

        // Update reconsideration_events with T2 data
        await supabase
          .from("reconsideration_events" as any)
          .update({
            t2_answer: rawResponse,
            t2_latency_ms: latencyMs,
            delta_type: deltaType,
          })
          .eq("assessment_id", state.currentAssessmentId)
          .eq("question_id", questionId)
          .is("t2_answer", null);
      } else {
        // Normal first-time answer
        const { error } = await supabase.from("cie_responses").upsert(
          {
            assessment_id: state.currentAssessmentId,
            user_id: user.id,
            question_id: questionId,
            domain_id: domainId,
            layer,
            question_type: questionType,
            raw_response: rawResponse,
            score,
            response_latency_ms: latencyMs,
          } as any,
          { onConflict: "assessment_id,question_id" }
        );

        if (error) {
          setState((s) => ({ ...s, error: error.message }));
        }
      }

      // Update assessment question count
      await supabase
        .from("cie_assessments")
        .update({ total_questions_answered: Object.keys(state.responses).length + 1 })
        .eq("id", state.currentAssessmentId);
    },
    [user, state.currentAssessmentId, state.responses]
  );

  // ── Advance to next question ──
  const advanceToNextQuestion = useCallback(() => {
    setState((s) => ({
      ...s,
      currentQuestionIndex: s.currentQuestionIndex + 1,
    }));
  }, []);

  // ── Step back one question (for long-press recovery) ──
  const stepBackOneQuestion = useCallback(() => {
    setState((s) => {
      if (s.currentQuestionIndex <= 0) return s;

      const newIndex = s.currentQuestionIndex - 1;

      // Find the question we're stepping back to
      let prevQuestionId: string | null = null;
      if (s.currentPhase === "layer1") {
        prevQuestionId = ALL_L1_QUESTIONS[newIndex]?.question.id ?? null;
      } else if (s.currentPhase === "deep_dive") {
        const ddQuestions = buildDeepDiveQuestions(s.triggeredDomains);
        prevQuestionId = ddQuestions[newIndex]?.question.id ?? null;
      }

      // Mark the previous response as pending reconsideration
      const updatedResponses = { ...s.responses };
      if (prevQuestionId && updatedResponses[prevQuestionId]) {
        updatedResponses[prevQuestionId] = {
          ...updatedResponses[prevQuestionId],
          pendingReconsideration: true,
        };
      }

      return {
        ...s,
        currentQuestionIndex: newIndex,
        responses: updatedResponses,
      };
    });
  }, []);

  // ── Log a reconsideration event ──
  const logReconsiderationEvent = useCallback(
    async (params: ReconsiderationParams) => {
      if (!user) return;

      await supabase.from("reconsideration_events" as any).insert({
        assessment_id: params.assessmentId,
        user_id: user.id,
        question_id: params.questionId,
        domain_id: params.domainId,
        t1_answer: params.t1Answer,
        t1_latency_ms: params.t1LatencyMs,
      });
    },
    [user]
  );

  // ── Get previous question (for recovery) ──
  const getPreviousQuestion = useCallback((): {
    question: CieQuestion;
    domainId: string;
    layer: number;
  } | null => {
    const prevIndex = state.currentQuestionIndex - 1;
    if (prevIndex < 0) return null;

    if (state.currentPhase === "layer1") {
      const entry = ALL_L1_QUESTIONS[prevIndex];
      if (!entry) return null;
      return { question: entry.question, domainId: entry.domainId, layer: 1 };
    }

    if (state.currentPhase === "deep_dive") {
      const ddQuestions = buildDeepDiveQuestions(state.triggeredDomains);
      const entry = ddQuestions[prevIndex];
      if (!entry) return null;
      return { question: entry.question, domainId: entry.domainId, layer: 2 };
    }

    return null;
  }, [state.currentPhase, state.currentQuestionIndex, state.triggeredDomains]);

  // ── Evaluate Layer 1 triggers ──
  const evaluateLayer1Triggers = useCallback(async () => {
    if (!state.currentAssessmentId) return;
    setState((s) => ({ ...s, isLoading: true }));

    try {
      const { data: fnResult, error: fnError } = await supabase.functions.invoke("cie-score-assessment", {
        body: { assessment_id: state.currentAssessmentId },
      });

      if (fnError) throw fnError;

      const triggered: string[] = [];
      const domainScoresMap: Record<string, DomainScore> = {};

      for (const domain of CIE_DOMAINS) {
        const l1Questions = domain.layer1;
        const l1Scores = l1Questions.map((q) => {
          const rec = state.responses[q.id];
          return rec ? scoreResponse(q.type, rec.answer, q.id) : 50;
        });
        const result = computeDomainScore(domain.id, l1Scores);
        domainScoresMap[domain.id] = result;

        if (result.triggeredLayer2) {
          triggered.push(domain.id);
        }
      }

      const ddQuestions = buildDeepDiveQuestions(triggered);

      await supabase
        .from("cie_assessments")
        .update({
          status: "layer1_complete",
          layer1_completed_at: new Date().toISOString(),
          triggered_domains: triggered,
        })
        .eq("id", state.currentAssessmentId);

      setState((s) => ({
        ...s,
        currentPhase: triggered.length > 0 ? "deep_dive" : "complete",
        currentQuestionIndex: 0,
        totalQuestionsForPhase: ddQuestions.length,
        triggeredDomains: triggered,
        domainScores: domainScoresMap,
        isLoading: false,
      }));

      if (triggered.length === 0) {
        await finalizeAssessment();
      }
    } catch (err: any) {
      setState((s) => ({ ...s, isLoading: false, error: err.message }));
    }
  }, [state.currentAssessmentId, state.responses]);

  // ── Finalize assessment ──
  const finalizeAssessment = useCallback(async () => {
    if (!state.currentAssessmentId) return;

    await supabase.functions.invoke("cie-score-assessment", {
      body: { assessment_id: state.currentAssessmentId },
    });

    await supabase
      .from("cie_assessments")
      .update({
        status: "complete",
        full_completed_at: new Date().toISOString(),
        ...(state.currentPhase === "deep_dive"
          ? { layer2_completed_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", state.currentAssessmentId);

    // Re-score after the assessment is marked complete so the witness-backed
    // terrain layer is indexed before any terrain render is generated.
    const { error: finalScoringError } = await supabase.functions.invoke("cie-score-assessment", {
      body: { assessment_id: state.currentAssessmentId },
    });
    if (finalScoringError) {
      console.error("Failed to prepare completed CIE for terrain generation:", finalScoringError);
    }

    const { data: domainRows } = await supabase
      .from("cie_domain_scores")
      .select("*")
      .eq("assessment_id", state.currentAssessmentId);

    const { data: gateRows } = await supabase
      .from("cie_gate_scores")
      .select("*")
      .eq("assessment_id", state.currentAssessmentId);

    const domainScoresMap: Record<string, DomainScore> = {};
    if (domainRows) {
      for (const r of domainRows) {
        domainScoresMap[r.domain_id] = {
          layer1Score: Number(r.layer1_score),
          layer2Score: r.layer2_score != null ? Number(r.layer2_score) : null,
          finalScore: Number(r.final_score),
          triggeredLayer2: r.triggered_layer2,
        };
      }
    }

    const gateScoresMap: Record<string, GateScore> = {};
    if (gateRows) {
      for (const r of gateRows) {
        gateScoresMap[r.gate_id] = {
          score: Number(r.score),
          trafficLight: r.traffic_light,
        };
      }
    }

    setState((s) => ({
      ...s,
      currentPhase: "complete",
      domainScores: domainScoresMap,
      gateScores: gateScoresMap,
      isLoading: false,
    }));
  }, [state.currentAssessmentId, state.currentPhase]);

  const completeAssessment = finalizeAssessment;

  // ── Get current question ──
  const getCurrentQuestion = useCallback((): {
    question: CieQuestion;
    domainId: string;
    layer: number;
  } | null => {
    if (state.currentPhase === "layer1") {
      const entry = ALL_L1_QUESTIONS[state.currentQuestionIndex];
      if (!entry) return null;
      return { question: entry.question, domainId: entry.domainId, layer: 1 };
    }

    if (state.currentPhase === "deep_dive") {
      const ddQuestions = buildDeepDiveQuestions(state.triggeredDomains);
      const entry = ddQuestions[state.currentQuestionIndex];
      if (!entry) return null;
      return { question: entry.question, domainId: entry.domainId, layer: 2 };
    }

    return null;
  }, [state.currentPhase, state.currentQuestionIndex, state.triggeredDomains]);

  // ── Progress ──
  const progress: IntakeProgress = {
    phase: state.currentPhase,
    current: state.currentQuestionIndex + 1,
    total: state.totalQuestionsForPhase,
    percent:
      state.totalQuestionsForPhase > 0
        ? Math.round((state.currentQuestionIndex / state.totalQuestionsForPhase) * 100)
        : 0,
  };

  return (
    <IntakeContext.Provider
      value={{
        ...state,
        startAssessment,
        recordResponse,
        advanceToNextQuestion,
        getCurrentQuestion,
        getPreviousQuestion,
        progress,
        evaluateLayer1Triggers,
        completeAssessment,
        stepBackOneQuestion,
        logReconsiderationEvent,
      }}
    >
      {children}
    </IntakeContext.Provider>
  );
}
