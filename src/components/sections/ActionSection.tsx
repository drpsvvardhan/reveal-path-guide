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
import AsideProgressRing from "@/components/layout/AsideProgressRing";

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
}> = ({ action, index, done, onToggle }) => {
  const [howOpen, setHowOpen] = useState(false);

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
          {/* What */}
          <h4 className={`font-serif text-lg leading-snug mb-2 ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
            <TappableProse text={action.what} />
          </h4>

          {/* Why */}
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            <TappableProse text={action.why} />
          </p>

          {/* Coordinate + gate badges */}
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
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
              <Clock className="h-2.5 w-2.5" /> retest {action.retest_weeks}w
            </span>
          </div>

          {/* How — expandable */}
          <Collapsible open={howOpen} onOpenChange={setHowOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
              {howOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              How to do it
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 border-t border-border pt-2">
              <p className="text-xs text-muted-foreground leading-relaxed"><TappableProse text={action.how} /></p>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </motion.div>
  );
};

// ── Main Section ──

const ActionSection: React.FC = () => {
  const { user } = useAuth();
  const { effectiveUserId } = useViewAs();
  const { completedKeys, streak, toggleDone } = useActionCompletions();
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const hasTriedGenRef = React.useRef(false);

  const userId = effectiveUserId || user?.id;

  useEffect(() => {
    if (!userId) return;
    hasTriedGenRef.current = false;

    const fetchPlan = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("action_plans")
        .select("today_actions, sequence_explanation, retest_schedule")
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
  const completedCount = actions.filter((a) => completedKeys.has(a.id)).length;
  const totalCount = actions.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

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
    return (
      <PatientSectionLayout
        eyebrow="WHAT TO DO"
        title="Your action plan is being prepared"
        intro="Once your terrain is rendered, we match your specific findings to concrete interventions. Each one comes with what to do, why it matters for your biology, and how to do it."
      >
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Complete your intake and upload labs to generate your personalized action plan.
          </p>
        </div>
      </PatientSectionLayout>
    );
  }

  return (
    <PatientSectionLayout
      eyebrow="WHAT TO DO"
      title="Actions matched to your terrain"
      intro="Each intervention below is triggered by your specific data — your scores, your labs, your measurements. Start with the first one. The sequence is deliberate."
      aside={
        <AsideVisualPanel
          title="Today's progress"
          subtitle="Your sequence is what matters"
          visual={
            <AsideProgressRing
              percent={pct}
              label="completed"
              sublabel={`${completedCount} of ${totalCount}`}
              size={180}
            />
          }
          items={[
            { label: "Streak", value: `${streak} day${streak !== 1 ? "s" : ""}`, tone: "accent" },
            { label: "Today", value: `${completedCount} of ${totalCount}` },
            { label: "Actions", value: `${totalCount} matched` },
          ]}
          footnote="The sequence matters more than the pace. Start at the top and work down."
        />
      }
      asideSticky
    >
      {/* ── Block 1: Today's Actions ── */}
      <div className="space-y-4">
        {/* Progress bar */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground font-sans">
              {completedCount} of {totalCount} completed
            </p>
            <p className="text-sm font-sans font-semibold text-primary">{pct}%</p>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Action cards */}
        {actions.map((action, i) => (
          <InterventionCard
            key={action.id}
            action={action}
            index={i}
            done={completedKeys.has(action.id)}
            onToggle={() => toggleDone(action.id)}
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
    </PatientSectionLayout>
  );
};

export default ActionSection;
