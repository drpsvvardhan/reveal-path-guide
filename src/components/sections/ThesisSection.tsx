import React from "react";
import { useActiveManifest } from "@/hooks/useActiveManifest";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import ProgressRing from "@/components/ProgressRing";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import AsideInfoPanel from "@/components/layout/AsideInfoPanel";

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

const BridgeCard: React.FC<{ text: string; index: number }> = ({ text, index }) => {
  const connectorMatch = text.match(/(.+?)(is (?:likely )?connected to|aligns with|reflects|comes from)(.+)/i);

  if (connectorMatch) {
    const [, left, connector, right] = connectorMatch;
    return (
      <div className="rounded-xl border border-border bg-card/40 p-5 md:p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <p className="text-base md:text-lg text-foreground font-serif italic leading-snug">
            {left.trim()}
          </p>
          <div className="flex items-center justify-center text-secondary">
            <ArrowRight className="h-4 w-4 md:rotate-0 rotate-90" />
          </div>
          <p className="text-base md:text-lg text-muted-foreground leading-snug">
            {right.trim()}
          </p>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-3 uppercase tracking-wider">
          Bridge {index + 1} · {connector.trim()}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/40 p-5 md:p-6">
      <p className="text-base md:text-lg text-foreground leading-relaxed">{text}</p>
    </div>
  );
};

const ThesisSection: React.FC = () => {
  const manifest = useActiveManifest();
  const { patientThesis } = manifest;
  const bridges = manifest.symptomBridges || [];

  if (!patientThesis) return null;

  const asideItems = [
    { label: "Inflammation", value: "72%", subvalue: "Improving", tone: "success" as const },
    { label: "Blood sugar", value: "65%", subvalue: "Getting better", tone: "accent" as const },
    { label: "Cardiovascular", value: "54%", subvalue: "Needs attention", tone: "warning" as const },
    { label: "Sleep", value: "45%", subvalue: "Fragmented" },
    { label: "Metabolic", value: "58%" },
  ];

  return (
    <PatientSectionLayout
      eyebrow="WHAT'S HAPPENING IN YOUR BODY"
      title={patientThesis.title}
      intro={patientThesis.body}
      aside={
        <AsideInfoPanel
          title="Biological terrain"
          items={asideItems}
        />
      }
      asideSticky
    >
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

      {/* Symptom bridges (merged from SymptomBridgesSection) */}
      {bridges.length > 0 && (
        <div className="pt-10 mt-10 border-t border-border/40">
          <h2 className="text-eyebrow text-secondary mb-6">
            WHY YOU MIGHT BE FEELING THIS WAY
          </h2>
          <div className="space-y-5">
            {bridges.map((bridge, idx) => (
              <BridgeCard key={idx} text={bridge} index={idx} />
            ))}
          </div>
        </div>
      )}
    </PatientSectionLayout>
  );
};

export default ThesisSection;
