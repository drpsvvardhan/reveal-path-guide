import React, { useEffect, useState, useMemo } from "react";
import { useActiveManifest } from "@/hooks/useActiveManifest";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import FlowLine from "@/components/visuals/FlowLine";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import AsideInfoPanel from "@/components/layout/AsideInfoPanel";
import TerrainRadar from "@/components/visuals/TerrainRadar";
import TerrainPortraitHero from "@/components/terrain/TerrainPortraitHero";
import { useSignatureColor } from "@/context/SignatureColorContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useCIEAssessment } from "@/context/CIEAssessmentContext";
import { CIE_DOMAINS } from "@/lib/cieSeedData";

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

interface BiologyDomain {
  name: string;
  emoji: string;
  status: "improving" | "stable" | "needs-attention";
  statusLabel: string;
  summary: string;
  score: number;
}

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
  const { domainScores, gateScores } = useCIEAssessment();
  const { patientThesis } = manifest;
  const bridges = manifest.symptomBridges || [];

  // Build terrain radar axes from real gate scores only
  const terrainAxes = useMemo(() => {
    if (Object.keys(gateScores).length === 0) return [];

    return RADAR_GATES.map((rg) => ({
      label: rg.label,
      score: gateScores[rg.gateId] ? Math.round(gateScores[rg.gateId].score) : 50,
    }));
  }, [gateScores]);

  // Build aside items from real gate scores only
  const asideItems = useMemo(() => {
    if (Object.keys(gateScores).length === 0) return [];

    const toneMap: Record<string, "success" | "accent" | "warning" | undefined> = {
      GREEN: "success",
      YELLOW: undefined,
      ORANGE: "warning",
      RED: "accent",
    };

    return RADAR_GATES.slice(0, 5).map((rg) => {
      const gs = gateScores[rg.gateId];
      const score = gs ? Math.round(gs.score) : 50;
      const tl = gs?.traffic_light || "YELLOW";
      return {
        label: rg.label,
        value: `${score}%`,
        subvalue: tl === "GREEN" ? "Healthy" : tl === "YELLOW" ? "Monitor" : tl === "ORANGE" ? "Needs attention" : "Critical",
        tone: toneMap[tl],
      };
    });
  }, [gateScores]);

  // Build biology domains from real CIE domain scores
  const domains = useMemo((): BiologyDomain[] => {
    if (Object.keys(domainScores).length === 0) return [];

    return Object.entries(domainScores)
      .map(([domainId, ds]) => {
        const domainDef = CIE_DOMAINS.find((d) => d.id === domainId);
        const score = Math.round(ds.final_score);
        const status: BiologyDomain["status"] = score >= 70 ? "improving" : score >= 45 ? "stable" : "needs-attention";
        const statusLabel = score >= 70 ? "Healthy" : score >= 45 ? "Monitor" : "Needs focus";
        return {
          name: domainDef?.name || domainId,
          emoji: "🔬",
          status,
          statusLabel,
          summary: `Scored ${score}/100 in the ${domainDef?.axisName || ""} axis.`,
          score,
        };
      })
      .sort((a, b) => a.score - b.score) // Worst first
      .slice(0, 8); // Show top 8 most important
  }, [domainScores]);

  if (!patientThesis) return null;

  return (
    <PatientSectionLayout
      eyebrow="WHAT'S HAPPENING IN YOUR BODY"
      title={patientThesis.title}
      intro={patientThesis.body}
      heroVisual={terrainAxes.length > 0 ? <TerrainRadar axes={terrainAxes} size={320} /> : undefined}
      aside={
        asideItems.length > 0 ? (
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
        ) : (
          <AsideInfoPanel
            title="Your signature"
            items={[
              { label: "Dominant pattern", value: signature.label, subvalue: `${signature.category} focus`, tone: "accent" },
            ]}
          />
        )
      }
      asideSticky
    >
      {/* Terrain Portrait Hero — top of main column */}
      <TerrainPortraitHero />

      {/* Biology domain cards — only from real CIE data */}
      {domains.length > 0 && (
        <div>
          <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Your domain scores
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

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Score</span>
                      <span className="text-[10px] text-muted-foreground">{domain.score}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${domain.score}%` }}
                        transition={{ duration: 1, delay: 0.3 + i * 0.05 }}
                        className="h-full rounded-full bg-primary"
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

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
