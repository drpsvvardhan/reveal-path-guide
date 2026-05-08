import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";
import { Check, ChevronDown, ChevronUp, Clock, FlaskConical } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { motion } from "framer-motion";
import TappableProse from "@/components/terrain/TappableProse";
import { useActionCompletions } from "@/context/ActionCompletionContext";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import AsideVisualPanel from "@/components/layout/AsideVisualPanel";
import VoiceValidationIndicator from "@/components/clusters/VoiceValidationIndicator";

// ── Types ──

interface ActionPlanAction {
  id: string;
  what: string;
  why: string;
  how: string;
  coordinates: string[];
  gates: string[];
  retest_weeks: number;
  retest_markers: string[];
  category: string;
  sequence_priority: number;
  policy_class?: string;
  rationale?: string;
  doctor_question?: string;
  source_intervention_id?: string;
  core_title?: string;
  core_rationale?: string;
  core_observation?: string;
  core_clinician_question?: string;
}

interface RetestEntry {
  weeks: number;
  markers: string[];
  rationale: string;
}

interface ActionPlan {
  today_actions: ActionPlanAction[];
  sequence_explanation: string;
  retest_schedule: RetestEntry[];
}

// ── Coordinate badge colors ──
const COORD_COLORS: Record<string, string> = {
  E: "bg-amber-500/15 text-amber-700 border-amber-500/25",
  I: "bg-rose-500/15 text-rose-700 border-rose-500/25",
  V: "bg-blue-500/15 text-blue-700 border-blue-500/25",
  R: "bg-emerald-500/15 text-emerald-700 border-emerald-500/25",
  Σ: "bg-purple-500/15 text-purple-700 border-purple-500/25",
};

const COORD_LABELS: Record<string, string> = {
  E: "Energy", I: "Inflammation", V: "Vascular", R: "Regulation", Σ: "Scar memory",
};

// ── Policy-class badge styling ──
const POLICY_CLASS_LABELS: Record<string, string> = {
  lifestyle: "Lifestyle",
  food_pattern: "Food pattern",
  movement: "Movement",
  sleep_circadian: "Sleep & circadian",
  stress_practice: "Stress practice",
  tracking: "Tracking",
  retest: "Retest",
  doctor_question: "Doctor question",
  mechanism_education: "Education",
  supplement_with_dose: "Supplement",
  medication_change: "Medication",
  titration: "Titration",
  individualized_protocol: "Protocol",
};

const POLICY_CLASS_STYLES: Record<string, string> = {
  doctor_question: "bg-blue-500/10 text-blue-700 border-blue-500/25",
  food_pattern: "bg-amber-500/10 text-amber-700 border-amber-500/25",
  movement: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25",
  sleep_circadian: "bg-indigo-500/10 text-indigo-700 border-indigo-500/25",
  stress_practice: "bg-purple-500/10 text-purple-700 border-purple-500/25",
  retest: "bg-slate-500/10 text-slate-700 border-slate-500/25",
  tracking: "bg-slate-500/10 text-slate-700 border-slate-500/25",
  lifestyle: "bg-teal-500/10 text-teal-700 border-teal-500/25",
  mechanism_education: "bg-slate-500/10 text-slate-700 border-slate-500/25",
};

// ── Components ──

const ActionCheck: React.FC<{ done: boolean; onToggle: () => void }> = ({ done, onToggle }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onToggle(); }}
    className={`shrink-0 h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all ${
      done
        ? "bg-emerald-500 border-emerald-500 text-white scale-105"
        : "border-muted-foreground/30 hover:border-primary/50"
    }`}
  >
    {done && <Check className="h-4 w-4" strokeWidth={3} />}
  </button>
);

const InterventionCard: React.FC<{
  action: ActionPlanAction;
  index: number;
  done: boolean;
  onToggle: () => void;
  preferCore: boolean;
}> = ({ action, index, done, onToggle, preferCore }) => {
  const [howOpen, setHowOpen] = useState(false);

  // Prefer interpreter-voice Core fields when available; otherwise fall back
  // to the legacy what/how authored for clinician-supervised contexts.
  const hasCore = Boolean(action.core_title || action.core_rationale);
  if (preferCore && !hasCore) {
    // eslint-disable-next-line no-console
    console.warn(
      `[ActionSection] Core-mode fields missing for intervention "${action.id}" — falling back to directive what/how. Author core_title/core_rationale/core_observation/core_clinician_question on this entry in interventionLibrary.ts.`,
    );
  }
  const title = (preferCore && action.core_title) || action.what;
  const body = (preferCore && action.core_rationale) || action.why;
  const observation = preferCore ? action.core_observation : null;
  const howText = (preferCore && action.core_observation) ? null : action.how;
  const clinicianQuestion =
    (preferCore && action.core_clinician_question) || action.doctor_question;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`rounded-xl border bg-card p-5 transition-all ${
        done ? "border-emerald-500/20 opacity-60" : "border-border"
      }`}
    >
      <div className="flex items-start gap-4">
        <ActionCheck done={done} onToggle={onToggle} />
        <div className="flex-1 min-w-0">
          {/* Title — interpreter voice when available */}
          <h4 className={`font-serif text-lg leading-snug mb-2 ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
            <TappableProse text={title} />
          </h4>

          {/* Body — terrain-language rationale */}
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            <TappableProse text={body} />
          </p>

          {/* Coordinate + class chips */}
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            {action.policy_class && (
              <span
                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-sans font-semibold tracking-wide ${POLICY_CLASS_STYLES[action.policy_class] || "bg-muted text-muted-foreground border-border"}`}
                title={`Policy class: ${action.policy_class}`}
              >
                {POLICY_CLASS_LABELS[action.policy_class] || action.policy_class}
              </span>
            )}
            {action.coordinates.map((c) => (
              <span
                key={c}
                className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-sans font-semibold uppercase tracking-wide ${COORD_COLORS[c] || "bg-muted text-muted-foreground"}`}
                title={COORD_LABELS[c] || c}
              >
                {c}
              </span>
            ))}
            {action.gates.slice(0, 2).map((g) => (
              <span
                key={g}
                className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-[10px] font-sans text-muted-foreground"
              >
                {g}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-sans ml-1">
              <Clock className="h-2.5 w-2.5" /> next useful check-in ~{action.retest_weeks}w
            </span>
          </div>

          {/* Observation / how — expandable */}
          {(observation || howText || clinicianQuestion) && (
          <Collapsible open={howOpen} onOpenChange={setHowOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
              {howOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {preferCore ? "What to notice" : "How to do it"}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 border-t border-border pt-2">
              {observation && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <TappableProse text={observation} />
                </p>
              )}
              {howText && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <TappableProse text={howText} />
                </p>
              )}
              {!preferCore && action.rationale && (
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  <TappableProse text={action.rationale} />
                </p>
              )}
              {clinicianQuestion && (
                <div className="mt-3 rounded-md border border-blue-500/25 bg-blue-500/5 p-2">
                  <p className="text-[10px] font-sans font-semibold uppercase tracking-wide text-blue-700 mb-1">
                    Worth bringing into a clinical conversation
                  </p>
                  <p className="text-xs text-foreground leading-relaxed">
                    <TappableProse text={clinicianQuestion} />
                  </p>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ── Main Section ──

const ActionSection: React.FC = () => {
  const { user } = useAuth();
  const { effectiveUserId } = useViewAs();
  const { completedKeys, toggleDone } = useActionCompletions();
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [planStartedAt, setPlanStartedAt] = useState<string | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [voiceWarnings, setVoiceWarnings] = useState<any[] | null>(null);
  const [isRegeneratingVoice, setIsRegeneratingVoice] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [actionPlanMode, setActionPlanMode] = useState<"core" | "biotwin_plus">("core");
  const hasTriedGenRef = React.useRef(false);

  const userId = effectiveUserId || user?.id;

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("consumer_action_plan_mode")
        .eq("user_id", userId)
        .maybeSingle();
      const mode = (data as any)?.consumer_action_plan_mode;
      setActionPlanMode(mode === "biotwin_plus" ? "biotwin_plus" : "core");
    })();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    hasTriedGenRef.current = false;

    const fetchPlan = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("action_plans")
        .select("today_actions, sequence_explanation, retest_schedule, voice_validation_status, voice_validation_warnings, created_at")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const todayActions = (data?.today_actions as any) || [];
      if (data && todayActions.length > 0) {
        setPlan({
          today_actions: todayActions,
          sequence_explanation: data.sequence_explanation || "",
          retest_schedule: (data.retest_schedule as any) || [],
        });
        setVoiceStatus((data as any).voice_validation_status ?? null);
        setVoiceWarnings((data as any).voice_validation_warnings ?? null);
        // Anchor trajectory framing on the earliest plan ever generated
        // for this user, so "Tracking week N" reflects continuity rather
        // than the most recent regeneration.
        const { data: earliest } = await supabase
          .from("action_plans")
          .select("created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        setPlanStartedAt((earliest as any)?.created_at ?? (data as any)?.created_at ?? null);
        setLoading(false);
        return;
      }

      // No plan exists — try generating on-demand if user has data
      if (!hasTriedGenRef.current) {
        hasTriedGenRef.current = true;
        // Check if user has CIE data or labs
        const [{ count: gateCount }, { count: obsCount }] = await Promise.all([
          supabase.from("cie_gate_scores").select("id", { count: "exact", head: true }).eq("user_id", userId),
          supabase.from("patient_lab_observations").select("id", { count: "exact", head: true }).eq("user_id", userId),
        ]);

        if ((gateCount && gateCount > 0) || (obsCount && obsCount > 0)) {
          setGenerating(true);
          setLoading(false);
          try {
            const { data: genResult } = await supabase.functions.invoke("generate-action-plan", {
              body: { user_id: userId },
            });
            if (genResult?.today_actions) {
              setPlan({
                today_actions: genResult.today_actions,
                sequence_explanation: genResult.sequence_explanation || "",
                retest_schedule: genResult.retest_schedule || [],
              });
            }
          } catch (e) {
            console.warn("On-demand action plan generation failed:", e);
          }
          setGenerating(false);
          return;
        }
      }

      setLoading(false);
    };
    fetchPlan();
  }, [userId]);

  const actions = plan?.today_actions || [];
  const totalCount = actions.length;
  const startedCount = actions.filter((a) => completedKeys.has(a.id)).length;

  // ── Trajectory framing (replaces completion %) ──
  const trajectoryLabel = useMemo(() => {
    if (!planStartedAt) return "Day 1 of observation";
    const startMs = new Date(planStartedAt).getTime();
    const days = Math.max(0, Math.floor((Date.now() - startMs) / (1000 * 60 * 60 * 24)));
    if (days < 7) return `Day ${days + 1} of observation`;
    const weeks = Math.floor(days / 7) + 1;
    return `Tracking week ${weeks}`;
  }, [planStartedAt]);

  if (loading || generating) {
    return (
      <PatientSectionLayout eyebrow="WHAT TO DO" title={generating ? "Matching interventions to your data…" : "Loading your action plan…"}>
        <div className="h-48 flex items-center justify-center flex-col gap-3">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          {generating && <p className="text-sm text-muted-foreground">This takes a few seconds</p>}
        </div>
      </PatientSectionLayout>
    );
  }

  if (!plan || actions.length === 0) {
    // Check if user has data — if they do, their profile is well-optimized
    const hasData = plan !== null; // plan exists but 0 actions = no interventions triggered
    return (
      <PatientSectionLayout
        eyebrow="WHAT TO DO"
        title={hasData ? "Your terrain is well-managed" : "Your action plan is being prepared"}
        intro={hasData
          ? "Based on your current labs and intake data, your biomarkers and domain scores are within healthy ranges. No urgent interventions are needed right now — keep doing what you're doing."
          : "Once your terrain is rendered, we match your specific findings to concrete interventions. Each one comes with what to do, why it matters for your biology, and how to do it."
        }
      >
        <div className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
          {hasData ? (
            <>
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-emerald-500/10 mx-auto">
                <Check className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-sm text-muted-foreground">
                All gates are tracking green. Your next lab upload or intake update may surface new optimization actions.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Complete your intake and upload labs to generate your personalized action plan.
            </p>
          )}
        </div>
      </PatientSectionLayout>
    );
  }

  return (
    <PatientSectionLayout
      eyebrow="WHAT TO DO"
      title="Signals worth working with"
      intro="Each entry below is matched to a pattern in your biology, lab trends, recovery signals, and daily rhythms. The sequence is deliberate. Move gradually."
      headerExtra={
        <VoiceValidationIndicator
          status={voiceStatus}
          warnings={voiceWarnings}
          onRegenerate={async () => {
            setIsRegeneratingVoice(true);
            try {
              await supabase.functions.invoke("generate-action-plan", {
                body: { user_id: userId },
              });
              // Refetch
              const { data } = await supabase
                .from("action_plans")
                .select("today_actions, sequence_explanation, retest_schedule, voice_validation_status, voice_validation_warnings")
                .eq("user_id", userId!)
                .eq("status", "active")
                .order("created_at", { ascending: false })
                .limit(1)
                .single();
              if (data) {
                setPlan({
                  today_actions: (data.today_actions as any) || [],
                  sequence_explanation: data.sequence_explanation || "",
                  retest_schedule: (data.retest_schedule as any) || [],
                });
                setVoiceStatus((data as any).voice_validation_status ?? null);
                setVoiceWarnings((data as any).voice_validation_warnings ?? null);
              }
            } finally {
              setIsRegeneratingVoice(false);
            }
          }}
          isRegenerating={isRegeneratingVoice}
        />
      }
      aside={
        <AsideVisualPanel
          title={trajectoryLabel}
          subtitle="Patterns become more meaningful as they repeat over time."
          visual={
            <div className="py-2 text-center">
              <p className="font-serif text-base text-foreground leading-relaxed">
                Signals begin to matter when they repeat.
              </p>
              <p className="text-[11px] font-sans text-muted-foreground mt-2 italic">
                Trajectory, not snapshot.
              </p>
            </div>
          }
          items={[
            { label: "Signals being followed", value: `${totalCount}` },
            { label: "Entries started", value: `${startedCount} of ${totalCount}` },
            { label: "Next useful check-in", value: "after repeated observations" },
          ]}
          footnote="Continuity matters more than pace. The page accumulates meaning across many weeks."
        />
      }
      asideSticky
    >
      {/* ── Block 1: Today's Actions ── */}
      <div className="space-y-4">
        {/* Orientation panel — how to use this page */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-5 space-y-2">
          <p className="text-[11px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
            How to use this page
          </p>
          <p className="text-sm text-foreground leading-relaxed">
            These suggestions are matched to patterns in your biology, lab trends, recovery signals, and daily rhythms.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The goal is not to follow a rigid protocol. It is to understand which changes appear to support your terrain over time, which signals deserve attention, and which questions may be worth bringing into a deeper clinical discussion.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed italic">
            Move gradually. Notice patterns. The sequence matters more than intensity.
          </p>
        </div>

        {/* Action cards */}
        {actions.map((action, i) => (
          <InterventionCard
            key={action.id}
            action={action}
            index={i}
            done={completedKeys.has(action.id)}
            onToggle={() => toggleDone(action.id)}
            preferCore={actionPlanMode === "core"}
          />
        ))}
      </div>

      {/* ── Block 2: Sequence ── */}
      {plan.sequence_explanation && (
        <div className="space-y-3 pt-6">
          <h3 className="font-serif text-xl text-foreground">Why this sequence</h3>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {plan.sequence_explanation}
            </p>
          </div>
        </div>
      )}

      {/* ── Block 3: Retest Schedule ── */}
      {plan.retest_schedule.length > 0 && (
        <div className="space-y-3 pt-6">
          <h3 className="font-serif text-xl text-foreground flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-muted-foreground" />
            Retest schedule
          </h3>
          <div className="relative space-y-0">
            {plan.retest_schedule.map((entry, i) => (
              <div key={entry.weeks} className="flex gap-4 pb-6 last:pb-0">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-primary border-2 border-background shrink-0 z-10" />
                  {i < plan.retest_schedule.length - 1 && <div className="w-px flex-1 bg-border" />}
                </div>
                <div className="pb-2 flex-1">
                  <p className="font-sans font-semibold text-sm text-foreground mb-1">
                    {entry.weeks} weeks
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {entry.markers.map((m) => (
                      <span key={m} className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {m}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{entry.rationale}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Block 4: BioTwin+ context (only) ── */}
      {actionPlanMode === "biotwin_plus" && (
        <div className="pt-6">
          <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your action plan is in <span className="font-semibold text-foreground">BioTwin+ mode</span> — it includes clinician-supervised protocols. Each item is reviewed by your care team.
            </p>
          </div>
        </div>
      )}
    </PatientSectionLayout>
  );
};

export default ActionSection;
