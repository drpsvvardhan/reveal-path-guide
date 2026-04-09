import React, { useState } from "react";
import { useManifest } from "@/context/ManifestContext";
import { ArrowRight, Lock, Copy, ClipboardCheck, ChevronDown, ChevronUp, CheckCircle2, Clock, HelpCircle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type ActionStatus = "none" | "done" | "started" | "need-help";

const statusConfig: Record<ActionStatus, { label: string; class: string; icon: React.ElementType }> = {
  none: { label: "Mark progress", class: "border-border text-muted-foreground hover:border-secondary/40", icon: Clock },
  done: { label: "Done today", class: "border-secondary/40 bg-secondary/10 text-secondary", icon: CheckCircle2 },
  started: { label: "Started", class: "border-amber/40 bg-amber-light text-amber", icon: Clock },
  "need-help": { label: "Need help", class: "border-accent/40 bg-coral-light text-accent", icon: HelpCircle },
};

const statusCycle: ActionStatus[] = ["none", "started", "done", "need-help"];

const WhyExpander: React.FC<{ action: { whyFirst?: string; whatItAffects?: string; whatToNotice?: string } }> = ({ action }) => {
  const [open, setOpen] = useState(false);
  const hasContent = action.whyFirst || action.whatItAffects || action.whatToNotice;
  if (!hasContent) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-secondary hover:text-secondary/80 transition-colors mt-2">
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {open ? "Less detail" : "Why this? What to notice?"}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2 border-t border-border pt-2">
        {action.whyFirst && (
          <div>
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-secondary mb-0.5">Why this first</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{action.whyFirst}</p>
          </div>
        )}
        {action.whatItAffects && (
          <div>
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-secondary mb-0.5">What it affects</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{action.whatItAffects}</p>
          </div>
        )}
        {action.whatToNotice && (
          <div>
            <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-secondary mb-0.5">What to notice</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{action.whatToNotice}</p>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

const ActionSection: React.FC = () => {
  const { manifest } = useManifest();
  const { sequencedActions, doctorQuestions, monitoringPlan, expectedProgress } = manifest;
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [actionStates, setActionStates] = useState<Record<string, ActionStatus>>({});

  const copyQuestion = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const cycleStatus = (key: string) => {
    const current = actionStates[key] || "none";
    const nextIdx = (statusCycle.indexOf(current) + 1) % statusCycle.length;
    setActionStates((prev) => ({ ...prev, [key]: statusCycle[nextIdx] }));
  };

  const renderStatusPill = (key: string) => {
    const status = actionStates[key] || "none";
    const config = statusConfig[status];
    const Icon = config.icon;
    return (
      <button
        onClick={(e) => { e.stopPropagation(); cycleStatus(key); }}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-sans font-medium transition-all ${config.class}`}
      >
        <Icon className="h-3 w-3" />
        {config.label}
      </button>
    );
  };

  return (
    <section className="animate-fade-in space-y-10">
      <h2 className="text-sm font-sans font-medium uppercase tracking-widest text-secondary">
        What to do
      </h2>

      {/* Start Here */}
      {sequencedActions?.startHere && (
        <div className="rounded-xl border-2 border-secondary/30 bg-teal-light p-6">
          <div className="flex items-start justify-between gap-3 mb-2">
            <span className="text-xs font-sans font-semibold uppercase tracking-wider text-secondary">
              Start here
            </span>
            {renderStatusPill("start")}
          </div>
          <h3 className="font-serif text-xl text-foreground mb-2">{sequencedActions.startHere.title}</h3>
          <p className="text-muted-foreground mb-2">{sequencedActions.startHere.description}</p>
          {sequencedActions.startHere.details && (
            <p className="text-sm text-foreground/70 border-t border-secondary/10 pt-3 mt-3">{sequencedActions.startHere.details}</p>
          )}
          <WhyExpander action={sequencedActions.startHere} />
        </div>
      )}

      {/* Then Add */}
      {sequencedActions?.thenAdd?.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-serif text-lg text-foreground flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-secondary" /> Then add
          </h3>
          {sequencedActions.thenAdd.map((a, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3 mb-1">
                <p className="font-sans font-medium text-foreground text-sm">{a.title}</p>
                {renderStatusPill(`then-${i}`)}
              </div>
              <p className="text-sm text-muted-foreground">{a.description}</p>
              <WhyExpander action={a} />
            </div>
          ))}
        </div>
      )}

      {/* Not Yet */}
      {sequencedActions?.notYet?.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-serif text-lg text-foreground flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" /> Not yet
          </h3>
          {sequencedActions.notYet.map((a, i) => (
            <div key={i} className="rounded-lg border border-border bg-muted/50 p-4">
              <p className="font-sans font-medium text-foreground text-sm mb-1">{a.title}</p>
              <p className="text-sm text-muted-foreground mb-2">{a.description}</p>
              <div className="text-xs text-muted-foreground space-y-1 border-t border-border pt-2">
                <p><span className="font-medium">Why wait:</span> {a.why}</p>
                <p><span className="font-medium">Unlocked when:</span> {a.unlockedWhen}</p>
                <p><span className="font-medium">Decided by:</span> {a.unlockedBy}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Doctor Questions */}
      {doctorQuestions?.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-serif text-lg text-foreground">Questions to bring to your doctor</h3>
          {doctorQuestions.map((q, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4 relative group">
              <p className="font-serif text-foreground text-base italic pr-8">"{q.question}"</p>
              <p className="text-xs text-muted-foreground mt-2">{q.rationale}</p>
              <button
                onClick={() => copyQuestion(q.question, i)}
                className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-muted transition-colors"
                aria-label="Copy question"
              >
                {copiedIdx === i ? <ClipboardCheck className="h-4 w-4 text-secondary" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Monitoring Plan */}
      {monitoringPlan?.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-serif text-lg text-foreground">What we'll monitor</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {monitoringPlan.map((m, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4">
                <div className="flex justify-between items-start mb-1">
                  <p className="font-sans font-medium text-foreground text-sm">{m.name}</p>
                  <span className="text-xs bg-navy-light text-primary rounded-full px-2 py-0.5">{m.nextCheck}</span>
                </div>
                <p className="text-xs text-muted-foreground">{m.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expected Progress */}
      {expectedProgress && (
        <div className="space-y-4">
          <h3 className="font-serif text-lg text-foreground">What to expect</h3>
          <div className="relative space-y-0">
            {[
              { label: "First 2 weeks", text: expectedProgress.weeks2 },
              { label: "First 3 months", text: expectedProgress.months3 },
              { label: "3–6 months", text: expectedProgress.months6 },
              { label: "6–12 months", text: expectedProgress.months12 },
            ].map((stage, i) => (
              <div key={i} className="flex gap-4 pb-6 last:pb-0">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-secondary border-2 border-background shrink-0 z-10" />
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
