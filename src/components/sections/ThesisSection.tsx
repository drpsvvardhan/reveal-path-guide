import React, { useEffect, useState } from "react";
import { useActiveManifest } from "@/hooks/useActiveManifest";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import FlowLine from "@/components/visuals/FlowLine";
import ProgressRing from "@/components/ProgressRing";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import AsideInfoPanel from "@/components/layout/AsideInfoPanel";
import TerrainRadar from "@/components/visuals/TerrainRadar";
import TerrainPortraitHero from "@/components/terrain/TerrainPortraitHero";
import { useSignatureColor } from "@/context/SignatureColorContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

// Gate-to-radar mapping: 7 most clinically meaningful gates
const RADAR_GATES = [
  { gateId: "BRI", label: "Brain" },
  { gateId: "BCS", label: "Barrier" },
  { gateId: "FPIS", label: "Fuel" },
  { gateId: "TIS", label: "Tissue" },
  { gateId: "CLI", label: "Longevity" },
  { gateId: "HPI", label: "Potential" },
  { gateId: "GRIP", label: "Risk" },
];

const FALLBACK_AXES = [
  { label: "Brain", score: 58 },
  { label: "Barrier", score: 72 },
  { label: "Fuel", score: 54 },
  { label: "Tissue", score: 45 },
  { label: "Longevity", score: 68 },
  { label: "Potential", score: 62 },
  { label: "Risk", score: 51 },
];

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
  const { color: signature } = useSignatureColor();
  const { user } = useAuth();
  const { patientThesis } = manifest;
  const bridges = manifest.symptomBridges || [];

  const [terrainAxes, setTerrainAxes] = useState(FALLBACK_AXES);
  const [asideItems, setAsideItems] = useState<Array<{ label: string; value: string; subvalue?: string; tone?: "success" | "accent" | "warning" }>>([
    { label: "Brain", value: "58%", subvalue: "Baseline" },
    { label: "Barrier", value: "72%", subvalue: "Stable" },
    { label: "Fuel", value: "54%", subvalue: "Needs attention", tone: "warning" },
    { label: "Tissue", value: "45%", subvalue: "Low", tone: "warning" },
    { label: "Longevity", value: "68%" },
  ]);

  // Load CIE gate scores if available
  useEffect(() => {
    if (!user) return;

    (async () => {
      const { data: assessment } = await supabase
        .from("cie_assessments")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "complete")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!assessment) return;

      const { data: gateScores } = await supabase
        .from("cie_gate_scores")
        .select("gate_id, score, traffic_light")
        .eq("assessment_id", assessment.id);

      if (!gateScores || gateScores.length === 0) return;

      const gateMap: Record<string, { score: number; traffic_light: string }> = {};
      for (const gs of gateScores) {
        gateMap[gs.gate_id] = { score: Number(gs.score), traffic_light: gs.traffic_light };
      }

      // Build radar axes from gate scores
      const axes = RADAR_GATES.map((rg) => ({
        label: rg.label,
        score: gateMap[rg.gateId] ? Math.round(gateMap[rg.gateId].score) : 50,
      }));

      setTerrainAxes(axes);

      // Build aside items from top gates
      const toneMap: Record<string, "success" | "accent" | "warning" | undefined> = {
        GREEN: "success",
        YELLOW: undefined,
        ORANGE: "warning",
        RED: "accent",
      };

      const aside = RADAR_GATES.slice(0, 5).map((rg) => {
        const gs = gateMap[rg.gateId];
        const score = gs ? Math.round(gs.score) : 50;
        const tl = gs?.traffic_light || "YELLOW";
        return {
          label: rg.label,
          value: `${score}%`,
          subvalue: tl === "GREEN" ? "Healthy" : tl === "YELLOW" ? "Monitor" : tl === "ORANGE" ? "Needs attention" : "Critical",
          tone: toneMap[tl],
        };
      });

      setAsideItems(aside);
    })();
  }, [user]);

  if (!patientThesis) return null;

  return (
    <PatientSectionLayout
      eyebrow="WHAT'S HAPPENING IN YOUR BODY"
      title={patientThesis.title}
      intro={patientThesis.body}
      heroVisual={<TerrainRadar axes={terrainAxes} size={320} />}
      aside={
        <div className="space-y-4">
          <AsideInfoPanel
            title="Your signature"
            items={[
              { label: "Dominant pattern", value: signature.label, subvalue: `${signature.category} focus`, tone: "accent" },
            ]}
          />
          <AsideInfoPanel
            title="Biological terrain"
            items={asideItems}
            footnote="Your biological terrain is a snapshot of how different systems are functioning right now."
          />
        </div>
      }
      asideSticky
    >
      {/* Terrain Portrait Hero — top of main column */}
      <TerrainPortraitHero />

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

      {/* Symptom bridges */}
      {bridges.length > 0 && (
        <div className="pt-10 mt-10 relative">
          <FlowLine variant="divider" className="absolute top-0 left-0 w-full h-5 text-secondary/40" />
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
