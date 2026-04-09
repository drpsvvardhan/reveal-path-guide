import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useManifest } from "@/context/ManifestContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Copy, ClipboardCheck, ChevronDown, ChevronUp, Check, HelpCircle, Flame } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { motion } from "framer-motion";

type ActionStatus = "none" | "done";

/* ── Difficulty badges ── */
const difficultyFor = (title: string): "EASY" | "MODERATE" | "INVOLVED" => {
  const t = title.toLowerCase();
  if (t.includes("walk") || t.includes("sleep") || t.includes("wind") || t.includes("take") || t.includes("medication")) return "EASY";
  if (t.includes("blood sugar") || t.includes("dinner") || t.includes("nutrient") || t.includes("stabilize")) return "MODERATE";
  return "INVOLVED";
};

const difficultyColors: Record<string, string> = {
  EASY: "bg-emerald-500/15 text-emerald-700 border-emerald-500/25",
  MODERATE: "bg-amber-500/15 text-amber-700 border-amber-500/25",
  INVOLVED: "bg-rose-500/15 text-rose-700 border-rose-500/25",
};

const nudgeFor = (action: { whyFirst?: string; whatToNotice?: string }): string => {
  if (action.whatToNotice) {
    const short = action.whatToNotice.split(".")[0];
    return short.length > 80 ? short.slice(0, 77) + "…" : short;
  }
  if (action.whyFirst) {
    const short = action.whyFirst.split(".")[0];
    return short.length > 80 ? short.slice(0, 77) + "…" : short;
  }
  return "";
};

/* ── Why detail expander ── */
const WhyExpander: React.FC<{ action: { whyFirst?: string; whatItAffects?: string; whatToNotice?: string } }> = ({ action }) => {
  const [open, setOpen] = useState(false);
  const hasContent = action.whyFirst || action.whatItAffects || action.whatToNotice;
  if (!hasContent) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors mt-3">
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {open ? "Less detail" : "Why this? What to notice?"}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2 border-t border-border pt-2">
        {action.whyFirst && (
          <div>
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-primary mb-0.5">Why this first</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{action.whyFirst}</p>
          </div>
        )}
        {action.whatItAffects && (
          <div>
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-primary mb-0.5">What it affects</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{action.whatItAffects}</p>
          </div>
        )}
        {action.whatToNotice && (
          <div>
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-primary mb-0.5">What to notice</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{action.whatToNotice}</p>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

/* ── Checkmark ── */
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

/* ── Action Card ── */
const ActionCard: React.FC<{
  icon: string;
  title: string;
  description: string;
  action: any;
  done: boolean;
  onToggle: () => void;
  loading?: boolean;
}> = ({ icon, title, description, action, done, onToggle, loading }) => {
  const difficulty = difficultyFor(title);
  const nudge = nudgeFor(action);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border bg-card p-5 transition-all ${
        done ? "border-emerald-500/20 opacity-75" : "border-border"
      }`}
    >
      <div className="flex items-start gap-4">
        <ActionCheck done={done} onToggle={onToggle} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{icon}</span>
            <h4 className={`font-serif text-lg leading-snug ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {title}
            </h4>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">{description}</p>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-sans font-semibold uppercase tracking-wide ${difficultyColors[difficulty]}`}>
              {difficulty}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-sans">
              <Check className="h-3 w-3" /> Ready now
            </span>
          </div>
          {nudge && (
            <p className="text-xs text-primary/80 italic font-sans mt-2">{nudge}</p>
          )}
          <WhyExpander action={action} />
        </div>
      </div>
    </motion.div>
  );
};

const actionIcons = ["🏃", "🌙", "💊", "🥗", "🧬", "🧘", "💤", "🩺"];

/* ── Streak helpers ── */
const todayStr = () => new Date().toISOString().slice(0, 10);

const computeStreak = (dates: string[], totalActions: number): number => {
  if (totalActions === 0) return 0;
  // Count completions per date
  const countByDate: Record<string, number> = {};
  dates.forEach((d) => { countByDate[d] = (countByDate[d] || 0) + 1; });
  
  // Walk backwards from today
  let streak = 0;
  const d = new Date();
  while (true) {
    const ds = d.toISOString().slice(0, 10);
    if ((countByDate[ds] || 0) >= totalActions) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else if (ds === todayStr()) {
      // today incomplete is ok, still check yesterday
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
};

/* ── Streak Badge ── */
const StreakBadge: React.FC<{ streak: number }> = ({ streak }) => {
  if (streak === 0) return null;
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 border border-accent/25 px-3 py-1"
    >
      <Flame className="h-4 w-4 text-accent" />
      <span className="text-sm font-sans font-semibold text-accent">{streak}-day streak</span>
    </motion.div>
  );
};

/* ── Main Section ── */
const ActionSection: React.FC = () => {
  const { manifest } = useManifest();
  const { user } = useAuth();
  const { sequencedActions, doctorQuestions, monitoringPlan, expectedProgress } = manifest;
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [completedKeys, setCompletedKeys] = useState<Set<string>>(new Set());
  const [streak, setStreak] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const allActions = useMemo(() => {
    const items: { key: string; title: string; description: string; action: any; icon: string }[] = [];
    if (sequencedActions?.startHere) {
      items.push({
        key: "start",
        title: sequencedActions.startHere.title,
        description: sequencedActions.startHere.description,
        action: sequencedActions.startHere,
        icon: "🛡️",
      });
    }
    sequencedActions?.thenAdd?.forEach((a, i) => {
      items.push({
        key: `then-${i}`,
        title: a.title,
        description: a.description,
        action: a,
        icon: actionIcons[i % actionIcons.length],
      });
    });
    return items;
  }, [sequencedActions]);

  const userId = user?.id;

  // Load today's completions + streak data
  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      // Today's completions
      const today = todayStr();
      const { data: todayData } = await supabase
        .from("action_completions")
        .select("action_key")
        .eq("user_id", userId)
        .eq("completed_date", today);
      
      if (todayData) {
        setCompletedKeys(new Set(todayData.map((r) => r.action_key)));
      }

      // Last 60 days for streak calc
      const sixtyAgo = new Date();
      sixtyAgo.setDate(sixtyAgo.getDate() - 60);
      const { data: streakData } = await supabase
        .from("action_completions")
        .select("completed_date")
        .eq("user_id", userId)
        .gte("completed_date", sixtyAgo.toISOString().slice(0, 10));

      if (streakData) {
        const dates = streakData.map((r) => r.completed_date);
        setStreak(computeStreak(dates, allActions.length));
      }
      setLoaded(true);
    };
    load();
  }, [userId, allActions.length]);

  const toggleDone = useCallback(async (key: string) => {
    if (!userId) return;
    const today = todayStr();
    const isDone = completedKeys.has(key);

    // Optimistic update
    setCompletedKeys((prev) => {
      const next = new Set(prev);
      if (isDone) next.delete(key);
      else next.add(key);
      return next;
    });

    if (isDone) {
      await supabase
        .from("action_completions")
        .delete()
        .eq("user_id", userId)
        .eq("action_key", key)
        .eq("completed_date", today);
    } else {
      await supabase
        .from("action_completions")
        .insert({ user_id: userId, action_key: key, completed_date: today });
    }

    // Recalculate streak
    const sixtyAgo = new Date();
    sixtyAgo.setDate(sixtyAgo.getDate() - 60);
    const { data: streakData } = await supabase
      .from("action_completions")
      .select("completed_date")
      .eq("user_id", userId)
      .gte("completed_date", sixtyAgo.toISOString().slice(0, 10));
    if (streakData) {
      setStreak(computeStreak(streakData.map((r) => r.completed_date), allActions.length));
    }
  }, [userId, completedKeys, allActions.length]);

  const completedCount = allActions.filter((a) => completedKeys.has(a.key)).length;
  const totalCount = allActions.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const copyQuestion = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <section className="animate-fade-in space-y-8">
      {/* Header + Streak */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-1">Today's Actions</h2>
          <p className="text-sm text-muted-foreground font-sans">Personalized for where your body is right now.</p>
        </div>
        <StreakBadge streak={streak} />
      </div>

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
        {pct === 100 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-emerald-600 font-sans mt-2 flex items-center gap-1"
          >
            <Check className="h-3 w-3" /> All actions completed today — great work!
          </motion.p>
        )}
      </div>

      {/* Action cards */}
      <div className="space-y-4">
        {allActions.map((item, i) => (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <ActionCard
              icon={item.icon}
              title={item.title}
              description={item.description}
              action={item.action}
              done={completedKeys.has(item.key)}
              onToggle={() => toggleDone(item.key)}
            />
          </motion.div>
        ))}
      </div>

      {/* Not yet */}
      {sequencedActions?.notYet?.length > 0 && (
        <div className="space-y-3 pt-4">
          <h3 className="font-serif text-lg flex items-center gap-2 text-muted-foreground">
            <Lock className="h-4 w-4" /> Not yet
          </h3>
          {sequencedActions.notYet.map((a, i) => (
            <div key={i} className="rounded-xl border border-border bg-muted/40 p-5 opacity-60">
              <p className="font-serif text-base text-foreground mb-1">{a.title}</p>
              <p className="text-sm text-muted-foreground mb-3">{a.description}</p>
              <div className="text-xs text-muted-foreground space-y-1 border-t border-border pt-2">
                <p><span className="font-medium">Why wait:</span> {a.why}</p>
                <p><span className="font-medium">Unlocked when:</span> {a.unlockedWhen}</p>
                <p><span className="font-medium">Decided by:</span> {a.unlockedBy}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Doctor questions */}
      {doctorQuestions?.length > 0 && (
        <div className="space-y-3 pt-4">
          <h3 className="font-serif text-xl text-foreground">Questions for your doctor</h3>
          {doctorQuestions.map((q, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 relative group">
              <p className="font-serif text-foreground text-base italic pr-8">"{q.question}"</p>
              <p className="text-xs text-muted-foreground mt-2">{q.rationale}</p>
              <button
                onClick={() => copyQuestion(q.question, i)}
                className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-muted transition-colors"
                aria-label="Copy question"
              >
                {copiedIdx === i ? <ClipboardCheck className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Monitoring */}
      {monitoringPlan?.length > 0 && (
        <div className="space-y-3 pt-4">
          <h3 className="font-serif text-xl text-foreground">What we'll monitor</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {monitoringPlan.map((m, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <div className="flex justify-between items-start mb-1">
                  <p className="font-sans font-medium text-foreground text-sm">{m.name}</p>
                  <span className="text-xs bg-lavender-light text-primary rounded-full px-2 py-0.5">{m.nextCheck}</span>
                </div>
                <p className="text-xs text-muted-foreground">{m.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expected progress */}
      {expectedProgress && (
        <div className="space-y-4 pt-4">
          <h3 className="font-serif text-xl text-foreground">What to expect</h3>
          <div className="relative space-y-0">
            {[
              { label: "First 2 weeks", text: expectedProgress.weeks2 },
              { label: "First 3 months", text: expectedProgress.months3 },
              { label: "3–6 months", text: expectedProgress.months6 },
              { label: "6–12 months", text: expectedProgress.months12 },
            ].map((stage, i) => (
              <div key={i} className="flex gap-4 pb-6 last:pb-0">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-primary border-2 border-background shrink-0 z-10" />
                  {i < 3 && <div className="w-px flex-1 bg-border" />}
                </div>
                <div className="pb-2">
                  <p className="font-sans font-semibold text-sm text-foreground mb-1">{stage.label}</p>
                  <p className="text-sm text-muted-foreground">{stage.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default ActionSection;
