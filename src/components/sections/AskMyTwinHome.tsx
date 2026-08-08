// ============================================================================
// src/components/sections/AskMyTwinHome.tsx
// ----------------------------------------------------------------------------
// Ask My Twin — the patient home. One page: greeting, freshness, the
// deterministic Biological Intelligence Brief, one large ask input, and
// deterministic suggested questions. Everything else is secondary
// navigation. The input hands the question to the existing governed chat
// runtime (AskSection) — same endpoint, same buffered admission gate.
// ============================================================================

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, MessageSquare, Dna, FolderOpen } from "lucide-react";
import { useManifest } from "@/context/ManifestContext";
import { useBioTwin } from "@/context/BioTwinContext";
import { useNavigation } from "@/context/NavigationContext";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";
import IntentPassportCard from "@/components/home/IntentPassportCard";
import { supabase } from "@/integrations/supabase/client";
import { projectBrief } from "@/lib/biotwin/brief";
import { buildSuggestedQuestions } from "@/lib/biotwin/suggestedQuestions";
import { setPendingAskQuestion } from "@/lib/askIntent";
import {
  fetchLatestEvidenceDate,
  type FreshnessQueryClient,
} from "@/lib/evidenceFreshness";
import BioTwinBriefCard from "@/components/biotwin/BioTwinBriefCard";

function greetingForHour(hour: number): string {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const AskMyTwinHome: React.FC = () => {
  const { manifest } = useManifest();
  const { report, statements, loading: twinLoading } = useBioTwin();
  const { navigateTo } = useNavigation();
  const { user } = useAuth();
  const { effectiveUserId, isViewingAs } = useViewAs();
  const [question, setQuestion] = useState("");
  const [latestEvidenceDate, setLatestEvidenceDate] = useState<string | null>(
    null
  );

  const brief = useMemo(
    () => projectBrief(report, statements),
    [report, statements]
  );
  const suggestions = useMemo(() => buildSuggestedQuestions(brief), [brief]);

  // Evidence freshness clock — same governed definition the Answer Receipt
  // uses, scoped explicitly to the effective user (admins hold read-all on
  // witness_objects, so view-as must never surface another patient's
  // date). Recomputes when the view-as target switches. If the read fails
  // or is empty, the clock is omitted; it is never fabricated.
  const targetUserId = effectiveUserId ?? user?.id ?? null;
  useEffect(() => {
    if (!targetUserId) return;
    let cancelled = false;
    setLatestEvidenceDate(null);
    (async () => {
      try {
        const latest = await fetchLatestEvidenceDate(
          supabase as unknown as FreshnessQueryClient,
          targetUserId
        );
        if (!cancelled && latest) setLatestEvidenceDate(latest);
      } catch {
        /* omit the clock rather than fabricate it */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  const ask = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setPendingAskQuestion(trimmed);
    navigateTo("ask");
  };

  const firstName = manifest.patient.firstName || "there";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-6 min-w-0"
    >
      {/* Greeting + freshness */}
      <div className="min-w-0">
        <h1 className="font-serif text-2xl md:text-3xl text-foreground break-words">
          {greetingForHour(new Date().getHours())}, {firstName}
        </h1>
        <p className="mt-1 font-sans text-xs text-muted-foreground">
          {brief.freshness.twin_updated
            ? `Twin updated ${brief.freshness.twin_updated}`
            : "Your Twin has not been released yet"}
          {latestEvidenceDate
            ? ` · Evidence available through ${latestEvidenceDate}`
            : ""}
        </p>
      </div>

      {/* Ask box — the product */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="min-w-0"
      >
        <label htmlFor="ask-my-twin-input" className="sr-only">
          Ask your Twin anything
        </label>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 pl-4 shadow-sm focus-within:border-primary/60 transition-colors">
          <input
            id="ask-my-twin-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What would you like to know about yourself?"
            className="flex-1 bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!question.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2.5 font-sans text-xs font-semibold text-primary-foreground disabled:opacity-40 transition-opacity min-h-[44px]"
          >
            Ask
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>

      {/* Deterministic suggested questions */}
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => ask(s)}
            className="rounded-full border border-border bg-card px-3 py-1.5 font-sans text-xs text-foreground/90 hover:border-primary/50 hover:bg-muted/40 transition-colors break-words text-left"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Two priority maps, both visible, neither erasing the other:
          what the Twin is watching (biological priority, governed) and
          what matters to the person (their own words, zero truth
          authority). */}
      {twinLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
      ) : (
        <BioTwinBriefCard brief={brief} latestEvidenceDate={latestEvidenceDate} />
      )}

      <IntentPassportCard
        effectiveUserId={targetUserId}
        canEdit={!isViewingAs}
        onAsk={ask}
      />

      {/* Secondary navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          onClick={() => navigateTo("queue")}
          className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-3.5 text-left hover:bg-muted/40 transition-colors min-w-0"
        >
          <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="font-sans text-xs font-medium text-foreground truncate">
            Questions for my doctor
          </span>
        </button>
        <button
          onClick={() => navigateTo("biotwin")}
          className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-3.5 text-left hover:bg-muted/40 transition-colors min-w-0"
        >
          <Dna className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="font-sans text-xs font-medium text-foreground truncate">
            Explore my Twin
          </span>
        </button>
        <button
          onClick={() => navigateTo("records")}
          className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-3.5 text-left hover:bg-muted/40 transition-colors min-w-0"
        >
          <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="font-sans text-xs font-medium text-foreground truncate">
            Medical records
          </span>
        </button>
      </div>
    </motion.div>
  );
};

export default AskMyTwinHome;
