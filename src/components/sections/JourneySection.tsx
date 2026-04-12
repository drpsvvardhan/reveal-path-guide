import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { useTerrainRender } from "@/context/TerrainRenderContext";
import { useCIEAssessment } from "@/context/CIEAssessmentContext";
import { useLabUploads } from "@/context/LabUploadsContext";
import { useNarrative } from "@/context/NarrativeContext";
import { useDerivedPatterns } from "@/context/DerivedPatternsContext";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";
import { supabase } from "@/integrations/supabase/client";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import GateChips from "@/components/sections/journey/GateChips";
import DrillDownGrid from "@/components/sections/journey/DrillDownGrid";
import BaselineCards from "@/components/sections/journey/BaselineCards";
import TappableProse from "@/components/terrain/TappableProse";

const toDateKey = (d: string) => d.slice(0, 10);

interface ActionPlanAction {
  id: string;
  what: string;
  why: string;
  how: string;
  coordinates: string[];
  gates: string[];
  category: string;
}

const JourneySection: React.FC = () => {
  const { activeRender, isLoading: renderLoading, hasFailed, regenerate } = useTerrainRender();
  const { currentAssessment, gateScores, domainScores } = useCIEAssessment();
  const { observations, uploads } = useLabUploads();
  const { activeNarrative } = useNarrative();
  const { patterns } = useDerivedPatterns();
  const { user } = useAuth();
  const { effectiveUserId } = useViewAs();
  const [topAction, setTopAction] = useState<ActionPlanAction | null>(null);

  const userId = effectiveUserId || user?.id;

  const hasTerrainRender = !!activeRender?.patient_portrait;
  const hasAssessment = !!currentAssessment;
  const hasUploads = uploads.length > 0;

  // Fetch top action from action_plans
  useEffect(() => {
    if (!userId) return;
    const fetchTopAction = async () => {
      const { data } = await supabase
        .from("action_plans")
        .select("today_actions")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (data?.today_actions) {
        const actions = data.today_actions as any[];
        if (actions.length > 0) setTopAction(actions[0]);
      }
    };
    fetchTopAction();
  }, [userId]);

  // Extract portrait data
  const portrait = activeRender?.patient_portrait as {
    what_you_already_know?: string;
    working_harder_than_you_realize?: string;
    where_to_start?: string;
    the_one_action?: string;
  } | null;

  // Hero headline: first sentence from what_you_already_know
  const heroTitle = useMemo(() => {
    if (!portrait?.what_you_already_know) return null;
    const text = portrait.what_you_already_know;
    const firstSentence = text.match(/^[^.!?]+[.!?]/)?.[0] ?? text.slice(0, 120);
    return firstSentence.replace(/\.$/, "");
  }, [portrait]);

  // Hero intro: first sentence from working_harder
  const heroIntro = useMemo(() => {
    if (!portrait?.working_harder_than_you_realize) return null;
    const text = portrait.working_harder_than_you_realize;
    return text.match(/^[^.!?]+[.!?]/)?.[0] ?? text.slice(0, 160);
  }, [portrait]);

  // Gate chips
  const gateChipData = useMemo(() => {
    return Object.values(gateScores).sort((a, b) => a.score - b.score);
  }, [gateScores]);

  // Drill-down cards
  const drillCards = useMemo(() => {
    const cards: { sectionId: string; title: string; preview: string }[] = [];

    // Thesis
    const thesisBody = activeNarrative?.patientThesis?.body;
    cards.push({
      sectionId: "thesis",
      title: "What's happening in your body",
      preview: thesisBody ? thesisBody.slice(0, 120) + "…" : "Your biological terrain analysis",
    });

    // Helping & feeding
    const helpCount = activeNarrative?.helpingVsFeeding?.helping?.length ?? 0;
    const feedCount = activeNarrative?.helpingVsFeeding?.feeding?.length ?? 0;
    cards.push({
      sectionId: "helping-feeding",
      title: "What's helping — and what's feeding it",
      preview: helpCount || feedCount
        ? `${helpCount} factor${helpCount !== 1 ? "s" : ""} helping, ${feedCount} factor${feedCount !== 1 ? "s" : ""} feeding`
        : "Identify what supports and what burdens your terrain",
    });

    // Noticed
    const highSeverity = patterns.length > 0
      ? patterns.reduce((max, p) => {
          const order = { critical: 0, high: 1, moderate: 2, low: 3 };
          return (order[p.severity as keyof typeof order] ?? 3) < (order[max as keyof typeof order] ?? 3) ? p.severity : max;
        }, patterns[0].severity)
      : null;
    cards.push({
      sectionId: "noticed",
      title: "What we've noticed",
      preview: patterns.length > 0
        ? `${patterns.length} pattern${patterns.length !== 1 ? "s" : ""} detected, highest severity: ${highSeverity}`
        : "Pattern detection from your data layers",
    });

    // Terrain
    const domainCount = Object.keys(domainScores).length;
    cards.push({
      sectionId: "terrain",
      title: "Your terrain",
      preview: domainCount > 0
        ? `Scored across ${domainCount} domains from your intake`
        : "Complete your intake to see your terrain map",
    });

    // Ask
    cards.push({
      sectionId: "ask",
      title: "Ask anything",
      preview: observations.length > 0
        ? `${observations.length} biomarker${observations.length !== 1 ? "s" : ""} in scope for your companion`
        : "Your AI companion grounded in your data",
    });

    return cards;
  }, [activeNarrative, patterns, domainScores, observations]);

  // Baseline observations (for when no trends exist)
  const hasTrends = useMemo(() => {
    const grouped: Record<string, Set<string>> = {};
    for (const obs of observations) {
      if (!grouped[obs.canonical_name]) grouped[obs.canonical_name] = new Set();
      grouped[obs.canonical_name].add(toDateKey(obs.collection_date));
    }
    return Object.values(grouped).some((dates) => dates.size >= 2);
  }, [observations]);

  // Relative time since portrait
  const portraitAge = useMemo(() => {
    if (!activeRender?.generated_at) return null;
    try {
      return formatDistanceToNow(new Date(activeRender.generated_at), { addSuffix: true });
    } catch {
      return null;
    }
  }, [activeRender]);

  // Loading state
  if (renderLoading) {
    return (
      <PatientSectionLayout eyebrow="YOUR TERRAIN" title="Loading…">
        <div className="h-48 flex items-center justify-center">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </PatientSectionLayout>
    );
  }

  // ─── EMPTY STATE: no terrain render yet ───
  if (!hasTerrainRender) {
    const missingSteps: string[] = [];
    if (!hasAssessment) missingSteps.push("complete your intake");
    if (!hasUploads) missingSteps.push("upload a lab report");

    return (
      <PatientSectionLayout
        eyebrow="YOUR TERRAIN"
        title="Your terrain hasn't been built yet"
        intro={
          missingSteps.length > 0
            ? `To see yourself reflected here, ${missingSteps.join(" and ")}.`
            : "Your terrain portrait is being generated. Check back shortly."
        }
      >
        {!hasAssessment && (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="font-serif text-lg text-foreground mb-2">Start your clinical intake</p>
            <p className="text-sm text-muted-foreground">
              75 questions that map your biological terrain across 25 domains. This is how we learn to see you.
            </p>
          </div>
        )}
        {hasAssessment && (hasUploads || hasFailed) && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {hasFailed
                ? "Your terrain portrait couldn't be generated on the first try. Tap below to retry."
                : "Your data is here. Your terrain portrait should appear soon — the rendering engine may still be processing."}
            </p>
            {hasFailed && (
              <button
                onClick={() => regenerate()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Retry terrain generation
              </button>
            )}
          </div>
        )}
      </PatientSectionLayout>
    );
  }

  // ─── LIVING TERRAIN DASHBOARD ───
  return (
    <PatientSectionLayout
      eyebrow="YOUR TERRAIN"
      title={heroTitle ?? "Your biological terrain"}
      intro={heroIntro ?? undefined}
    >
      {/* TODAY BLOCK — prefer action plan, fall back to terrain portrait */}
      {(topAction || portrait?.the_one_action) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3"
        >
          <p className="text-eyebrow text-primary">START HERE TODAY</p>
          <TappableProse
            text={topAction?.what || portrait?.the_one_action || ""}
            className="font-serif text-xl text-foreground leading-snug"
          />
          {topAction?.why && (
            <TappableProse
              text={topAction.why}
              className="text-sm text-muted-foreground leading-relaxed"
            />
          )}
          {portraitAge && (
            <p className="text-[10px] text-muted-foreground italic">
              Your portrait was last updated {portraitAge}
            </p>
          )}
        </motion.div>
      )}

      {/* CURRENT STATE — CIE gate chips */}
      {gateChipData.length > 0 && <GateChips gates={gateChipData} />}

      {/* DRILL DOWN */}
      <DrillDownGrid cards={drillCards} />

      {/* BASELINE / TRENDS sidebar content inline for now */}
      {observations.length > 0 && !hasTrends && (
        <BaselineCards observations={observations} />
      )}
    </PatientSectionLayout>
  );
};

export default JourneySection;
