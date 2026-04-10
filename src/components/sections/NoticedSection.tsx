import React, { useState } from "react";
import { useDerivedPatterns } from "@/context/DerivedPatternsContext";
import { useNarrative } from "@/context/NarrativeContext";
import {
  Sparkles,
  Loader2,
  TrendingUp,
  AlertCircle,
  GitCompare,
  Activity,
  Eye,
  ChevronDown,
  ChevronUp,
  X,
  RotateCcw,
  MessageCircle,
  FileText,
  CheckCircle2,
  XCircle,
  History,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DerivedPattern } from "@/types/manifest";

// ... keep existing code (categoryIcon, categoryLabel, severityStyles, PatternCard — lines 20-138)
const categoryIcon: Record<string, React.FC<any>> = {
  trend: TrendingUp,
  threshold: AlertCircle,
  contradiction: GitCompare,
  correlation: Activity,
  watchlist: Eye,
};

const categoryLabel: Record<string, string> = {
  trend: "Trend",
  threshold: "Threshold",
  contradiction: "Contradiction",
  correlation: "Correlation",
  watchlist: "Watchlist",
};

const severityStyles: Record<string, { border: string; bg: string; text: string; label: string }> = {
  critical: {
    border: "border-red-400",
    bg: "bg-red-50/50",
    text: "text-red-700",
    label: "Urgent",
  },
  high: {
    border: "border-orange-400",
    bg: "bg-orange-50/40",
    text: "text-orange-700",
    label: "Important",
  },
  moderate: {
    border: "border-amber-300",
    bg: "bg-amber-50/30",
    text: "text-amber-700",
    label: "Worth noting",
  },
  informational: {
    border: "border-slate-200",
    bg: "bg-muted/20",
    text: "text-slate-600",
    label: "Informational",
  },
};

const PatternCard: React.FC<{ pattern: DerivedPattern; onDismiss: () => void }> = ({ pattern, onDismiss }) => {
  const [expanded, setExpanded] = useState(false);
  const Icon = categoryIcon[pattern.category] || Activity;
  const style = severityStyles[pattern.severity] || severityStyles.informational;
  const firstDate = new Date(pattern.first_detected_at).toLocaleDateString();
  const lastDate = new Date(pattern.last_confirmed_at).toLocaleDateString();
  const isMultipleRuns = firstDate !== lastDate;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`rounded-lg border-l-4 ${style.border} ${style.bg} border border-border p-4 group`}
    >
      <div className="flex items-start gap-3">
        <div className={`shrink-0 mt-0.5 ${style.text}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-sans font-medium uppercase tracking-wider ${style.text}`}>
                  {style.label}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {categoryLabel[pattern.category]}
                </span>
              </div>
              <h3 className="text-sm font-medium text-foreground mt-0.5">{pattern.title}</h3>
            </div>
            <button
              onClick={onDismiss}
              className="p-1 rounded-md hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
              title="Dismiss"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>

          <p className="text-sm text-foreground/90 leading-relaxed">{pattern.summary}</p>

          {pattern.generated_question_id && (
            <div className="flex items-center gap-1.5 text-[11px] text-secondary bg-secondary/10 rounded px-2 py-1 inline-flex">
              <MessageCircle className="h-3 w-3" />
              A question has been added to your queue
            </div>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Hide evidence" : "Show evidence"}
          </button>

          {expanded && (
            <div className="mt-2 rounded-md bg-muted/40 border border-border/40 p-2.5 space-y-1.5">
              <div className="text-[10px] font-sans font-medium uppercase tracking-wider text-muted-foreground">
                {pattern.evidence.description}
              </div>
              <pre className="text-[11px] text-foreground/80 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
                {JSON.stringify(pattern.evidence.values, null, 2)}
              </pre>
              <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                {isMultipleRuns ? `First noticed ${firstDate}, confirmed again ${lastDate}` : `Noticed ${firstDate}`}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const NoticedSection: React.FC = () => {
  const {
    patterns,
    dismissed,
    loading,
    running,
    lastRunResult,
    error,
    runDerivation,
    dismissPattern,
    restorePattern,
  } = useDerivedPatterns();

  const {
    activeNarrative,
    allVersions,
    generating: generatingNarrative,
    lastResult: narrativeResult,
    generateNarrative,
    restoreVersion,
    error: narrativeError,
  } = useNarrative();

  const [showDismissed, setShowDismissed] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const handleRun = async () => {
    await runDerivation();
  };

  const handleGenerateNarrative = async () => {
    await generateNarrative();
  };

  // Group patterns by severity for display ordering
  const bySeverity = {
    critical: patterns.filter((p) => p.severity === "critical"),
    high: patterns.filter((p) => p.severity === "high"),
    moderate: patterns.filter((p) => p.severity === "moderate"),
    informational: patterns.filter((p) => p.severity === "informational"),
  };

  return (
    <section className="animate-fade-in space-y-5">
      <div>
        <h2 className="text-sm font-sans font-medium uppercase tracking-widest text-secondary">
          What we've noticed
        </h2>
        <p className="text-muted-foreground text-sm max-w-xl mt-1">
          Patterns the system has detected in your raw data — trends, threshold crossings,
          contradictions, and behavioral correlations. These are computed, not guessed, and
          each pattern can show you the evidence that triggered it.
        </p>
      </div>

      {/* Action bar */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleRun}
            disabled={running || generatingNarrative}
            className="flex items-center gap-1.5 rounded-lg bg-secondary text-secondary-foreground px-3 py-1.5 text-xs hover:bg-secondary/90 transition-colors disabled:opacity-50"
          >
            {running ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Computing patterns...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Compute patterns
              </>
            )}
          </button>

          <button
            onClick={handleGenerateNarrative}
            disabled={generatingNarrative || running}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            title="Regenerate the narrative fields (thesis, helping/feeding, reversibility, etc.) from your raw data and detected patterns"
          >
            {generatingNarrative ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating narrative...
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5" />
                Regenerate narrative
              </>
            )}
          </button>

          {allVersions.length > 0 && (
            <button
              onClick={() => setShowVersionHistory(!showVersionHistory)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors ml-auto"
            >
              <History className="h-3.5 w-3.5" />
              Narrative history ({allVersions.length})
            </button>
          )}
        </div>

        {/* Status lines */}
        {lastRunResult && !running && (
          <div className="text-xs text-muted-foreground">
            Last pattern run: {lastRunResult.detections_found} pattern
            {lastRunResult.detections_found !== 1 ? "s" : ""} found
            {lastRunResult.inserted > 0 && ` (${lastRunResult.inserted} new)`}
            {lastRunResult.questions_queued > 0 && ` · ${lastRunResult.questions_queued} questions queued`}
          </div>
        )}

        {narrativeResult && !generatingNarrative && (
          <div className="flex items-center gap-2 text-xs">
            {narrativeResult.success ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
                <span className="text-muted-foreground">
                  Narrative version {narrativeResult.version} generated in{" "}
                  {((narrativeResult.generation_ms || 0) / 1000).toFixed(1)}s
                  {narrativeResult.retry_count && narrativeResult.retry_count > 0
                    ? ` (${narrativeResult.retry_count} ${narrativeResult.retry_count === 1 ? "retry" : "retries"})`
                    : ""}
                </span>
              </>
            ) : (
              <>
                <XCircle className="h-3.5 w-3.5 text-orange-600" />
                <span className="text-muted-foreground">
                  Generation failed validation — previous version still active
                </span>
              </>
            )}
          </div>
        )}

        {narrativeError && (
          <div className="text-xs text-destructive">{narrativeError}</div>
        )}

        {activeNarrative && !narrativeResult && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            <span>Active narrative: version {allVersions.find((v) => v.status === "active")?.version || "?"}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && patterns.length === 0 && !running && (
        <div className="text-xs text-muted-foreground italic py-4">Loading patterns...</div>
      )}

      {/* Empty state */}
      {!loading && !running && patterns.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-foreground font-medium mb-1">No patterns detected yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Click <span className="font-medium">Compute patterns</span> to run the rule engine
            against your data. Patterns will appear here with their severity, category, and evidence.
          </p>
        </div>
      )}

      {/* Active patterns by severity */}
      <div className="space-y-3">
        <AnimatePresence>
          {bySeverity.critical.map((p) => (
            <PatternCard key={p.id} pattern={p} onDismiss={() => dismissPattern(p.id)} />
          ))}
          {bySeverity.high.map((p) => (
            <PatternCard key={p.id} pattern={p} onDismiss={() => dismissPattern(p.id)} />
          ))}
          {bySeverity.moderate.map((p) => (
            <PatternCard key={p.id} pattern={p} onDismiss={() => dismissPattern(p.id)} />
          ))}
          {bySeverity.informational.map((p) => (
            <PatternCard key={p.id} pattern={p} onDismiss={() => dismissPattern(p.id)} />
          ))}
        </AnimatePresence>
      </div>

      {/* Dismissed section */}
      {dismissed.length > 0 && (
        <div className="pt-4 border-t border-border">
          <button
            onClick={() => setShowDismissed(!showDismissed)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showDismissed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Dismissed ({dismissed.length})
          </button>

          <AnimatePresence>
            {showDismissed && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 mt-3 overflow-hidden"
              >
                {dismissed.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-md border border-border/40 bg-muted/20 p-3 flex items-start justify-between gap-2 group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{p.title}</p>
                    </div>
                    <button
                      onClick={() => restorePattern(p.id)}
                      className="p-1 rounded-md hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                      title="Restore"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Narrative version history */}
      <AnimatePresence>
        {showVersionHistory && allVersions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="pt-4 border-t border-border overflow-hidden"
          >
            <p className="text-xs font-sans font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Narrative versions
            </p>
            <div className="space-y-2">
              {allVersions.map((v) => (
                <div
                  key={v.id}
                  className={`rounded-md border p-3 ${
                    v.status === "active"
                      ? "border-secondary/40 bg-secondary/5"
                      : v.status === "failed"
                      ? "border-orange-200/60 bg-orange-50/30"
                      : "border-border bg-muted/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">Version {v.version}</span>
                        {v.status === "active" && (
                          <span className="text-[10px] uppercase tracking-wider text-secondary font-medium">
                            Active
                          </span>
                        )}
                        {v.status === "failed" && (
                          <span className="text-[10px] uppercase tracking-wider text-orange-700 font-medium">
                            Failed
                          </span>
                        )}
                        {v.status === "superseded" && (
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Superseded
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {new Date(v.created_at).toLocaleString()} · {v.model_used}
                        {v.generation_ms && ` · ${(v.generation_ms / 1000).toFixed(1)}s`}
                        {v.retry_count > 0 && ` · ${v.retry_count} ${v.retry_count === 1 ? "retry" : "retries"}`}
                      </p>
                      {v.validation_error && (
                        <p className="text-[11px] text-orange-700 mt-1 italic">
                          Error: {v.validation_error.slice(0, 200)}
                        </p>
                      )}
                      {v.status !== "failed" && v.status !== "active" && (
                        <button
                          onClick={() => restoreVersion(v.id)}
                          className="text-[11px] text-secondary hover:underline mt-1"
                        >
                          Restore this version
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default NoticedSection;
