import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

interface CIEDomainScore {
  domain_id: string;
  axis: string;
  layer1_score: number;
  layer2_score: number | null;
  final_score: number;
  triggered_layer2: boolean;
}

interface CIEGateScore {
  gate_id: string;
  gate_name: string;
  score: number;
  traffic_light: string;
  contributing_domains: string[];
}

interface CIEAssessment {
  id: string;
  version: number;
  status: string;
  total_questions_answered: number;
  triggered_domains: string[];
  created_at: string;
  full_completed_at: string | null;
}

interface CIEAssessmentContextValue {
  currentAssessment: CIEAssessment | null;
  domainScores: Record<string, CIEDomainScore>;
  gateScores: Record<string, CIEGateScore>;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const CIEAssessmentContext = createContext<CIEAssessmentContextValue | null>(null);

export function useCIEAssessment() {
  const ctx = useContext(CIEAssessmentContext);
  if (!ctx) throw new Error("useCIEAssessment must be used within CIEAssessmentProvider");
  return ctx;
}

export const CIEAssessmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currentAssessment, setCurrentAssessment] = useState<CIEAssessment | null>(null);
  const [domainScores, setDomainScores] = useState<Record<string, CIEDomainScore>>({});
  const [gateScores, setGateScores] = useState<Record<string, CIEGateScore>>({});
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Get the most recent completed assessment
      const { data: assessment } = await supabase
        .from("cie_assessments")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "complete")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!assessment) {
        setCurrentAssessment(null);
        setDomainScores({});
        setGateScores({});
        setIsLoading(false);
        return;
      }

      setCurrentAssessment({
        id: assessment.id,
        version: assessment.version,
        status: assessment.status,
        total_questions_answered: assessment.total_questions_answered,
        triggered_domains: assessment.triggered_domains,
        created_at: assessment.created_at,
        full_completed_at: assessment.full_completed_at,
      });

      // Fetch domain scores
      const { data: domains } = await supabase
        .from("cie_domain_scores")
        .select("*")
        .eq("assessment_id", assessment.id);

      const dMap: Record<string, CIEDomainScore> = {};
      (domains || []).forEach((d) => {
        dMap[d.domain_id] = {
          domain_id: d.domain_id,
          axis: d.axis,
          layer1_score: Number(d.layer1_score),
          layer2_score: d.layer2_score !== null ? Number(d.layer2_score) : null,
          final_score: Number(d.final_score),
          triggered_layer2: d.triggered_layer2,
        };
      });
      setDomainScores(dMap);

      // Fetch gate scores
      const { data: gates } = await supabase
        .from("cie_gate_scores")
        .select("*")
        .eq("assessment_id", assessment.id);

      const gMap: Record<string, CIEGateScore> = {};
      (gates || []).forEach((g) => {
        gMap[g.gate_id] = {
          gate_id: g.gate_id,
          gate_name: g.gate_name,
          score: Number(g.score),
          traffic_light: g.traffic_light,
          contributing_domains: g.contributing_domains,
        };
      });
      setGateScores(gMap);
    } catch (e) {
      console.error("Failed to load CIE assessment:", e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <CIEAssessmentContext.Provider value={{ currentAssessment, domainScores, gateScores, isLoading, refresh }}>
      {children}
    </CIEAssessmentContext.Provider>
  );
};
