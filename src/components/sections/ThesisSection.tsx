import React from "react";
import { useActiveManifest } from "@/hooks/useActiveManifest";
import { motion } from "framer-motion";
import ProgressRing from "@/components/ProgressRing";

interface BiologyDomain {
  name: string;
  emoji: string;
  status: "improving" | "stable" | "needs-attention";
  statusLabel: string;
  summary: string;
  whyItMatters: string;
  whatHelps: string;
  deepProgress: number;
}

const domains: BiologyDomain[] = [
  {
    name: "Inflammation", emoji: "🔥", status: "improving", statusLabel: "Improving",
    summary: "Inflammatory markers trending down. hs-CRP dropping as gut healing progresses.",
    whyItMatters: "Chronic inflammation drives fatigue, brain fog, and metabolic dysfunction.",
    whatHelps: "Anti-inflammatory eating pattern and consistent gut repair protocol.",
    deepProgress: 72,
  },
  {
    name: "Blood Sugar Control", emoji: "🩸", status: "improving", statusLabel: "Getting better",
    summary: "Fasting glucose and post-meal spikes are both improving. Insulin sensitivity recovering.",
    whyItMatters: "Better blood sugar control means more stable energy and less fat storage.",
    whatHelps: "Walking after meals and reducing refined carbs at dinner.",
    deepProgress: 65,
  },
  {
    name: "Gut Health", emoji: "🦠", status: "stable", statusLabel: "Rebuilding",
    summary: "Gut barrier integrity improving. Zonulin levels trending toward normal range.",
    whyItMatters: "The gut barrier is the origin of your inflammatory cascade.",
    whatHelps: "L-Glutamine, targeted probiotics, and eliminating inflammatory triggers.",
    deepProgress: 55,
  },
  {
    name: "Sleep & Recovery", emoji: "😴", status: "needs-attention", statusLabel: "Needs focus",
    summary: "Averaging 5.8 hours with fragmented deep sleep. Recovery scores inconsistent.",
    whyItMatters: "Poor sleep undermines glucose control and raises inflammation.",
    whatHelps: "Earlier wind-down, screen reduction, and consistent wake time.",
    deepProgress: 35,
  },
];

const statusColors: Record<string, { text: string; bg: string }> = {
  improving: { text: "text-success", bg: "bg-sage-light" },
  stable: { text: "text-secondary", bg: "bg-sky-light" },
  "needs-attention": { text: "text-accent", bg: "bg-pink-light" },
};

const ThesisSection: React.FC = () => {
  const manifest = useActiveManifest();
  const { patientThesis } = manifest;

  if (!patientThesis) return null;

  return (
    <section className="animate-fade-in max-w-2xl space-y-8">
      <div>
        <h2 className="text-sm font-sans font-medium uppercase tracking-widest text-primary mb-6">
          What's happening in your body
        </h2>
        <blockquote className="text-2xl md:text-3xl font-serif leading-snug mb-6">
          {patientThesis.title}
        </blockquote>
        <p className="text-base md:text-lg text-muted-foreground leading-relaxed whitespace-pre-line">
          {patientThesis.body}
        </p>
      </div>

      {/* Biology domain cards */}
      <div>
        <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Your biological terrain
        </h3>
        <div className="space-y-3">
          {domains.map((domain, i) => {
            const colors = statusColors[domain.status];
            return (
              <motion.div
                key={domain.name}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="glass-card p-5"
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl">{domain.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="font-sans font-semibold text-sm text-foreground">{domain.name}</h4>
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${colors.text} ${colors.bg}`}>
                        {domain.statusLabel}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{domain.summary}</p>
                  </div>
                </div>

                {/* Deep progress bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Deep progress</span>
                    <span className="text-[10px] text-muted-foreground">{domain.deepProgress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${domain.deepProgress}%` }}
                      transition={{ duration: 1, delay: 0.3 + i * 0.05 }}
                      className="h-full rounded-full bg-primary"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-border/30">
                  <div>
                    <span className="text-[10px] font-sans font-semibold text-muted-foreground uppercase tracking-wider">Why this matters</span>
                    <p className="text-xs text-foreground/70 leading-relaxed mt-0.5">{domain.whyItMatters}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-sans font-semibold text-muted-foreground uppercase tracking-wider">What's helping</span>
                    <p className="text-xs text-foreground/70 leading-relaxed mt-0.5">{domain.whatHelps}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ThesisSection;
