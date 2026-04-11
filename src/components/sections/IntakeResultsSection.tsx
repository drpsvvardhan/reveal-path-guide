import React from "react";
import { useCIEAssessment } from "@/context/CIEAssessmentContext";
import { useIntake } from "@/context/IntakeContext";
import { CIE_DOMAINS, CIE_GATES, CIE_DOMAIN_MAP } from "@/lib/cieSeedData";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import AsideVisualPanel from "@/components/layout/AsideVisualPanel";
import AsideProgressRing from "@/components/layout/AsideProgressRing";
import { RefreshCw } from "lucide-react";

const TRAFFIC_COLORS: Record<string, string> = {
  GREEN: "bg-success",
  YELLOW: "bg-yellow-400",
  ORANGE: "bg-orange-500",
  RED: "bg-destructive",
};

const TRAFFIC_BG: Record<string, string> = {
  GREEN: "border-success/30 bg-success/5",
  YELLOW: "border-yellow-400/30 bg-yellow-400/5",
  ORANGE: "border-orange-500/30 bg-orange-500/5",
  RED: "border-destructive/30 bg-destructive/5",
};

const AXES = [
  { id: "A", name: "Metabolic" }, { id: "B", name: "Immune/Inflammatory" },
  { id: "C", name: "Neuro/Cognitive" }, { id: "D", name: "GI/Microbiome" },
  { id: "E", name: "Hormonal/Endocrine" }, { id: "F", name: "Cardiovascular" },
  { id: "G", name: "Musculoskeletal" }, { id: "H", name: "Detox/Environmental" },
  { id: "I", name: "Psycho-Emotional" }, { id: "J", name: "Longevity/Cellular" },
];

const IntakeResultsSection: React.FC = () => {
  const { currentAssessment, domainScores, gateScores, isLoading } = useCIEAssessment();
  const { startAssessment } = useIntake();

  if (isLoading) {
    return (
      <PatientSectionLayout eyebrow="YOUR TERRAIN" title="Loading your biological terrain…" intro="">
        <div className="animate-pulse h-40 bg-muted/30 rounded-xl" />
      </PatientSectionLayout>
    );
  }

  if (!currentAssessment) {
    return (
      <PatientSectionLayout
        eyebrow="YOUR TERRAIN"
        title="No assessment yet"
        intro="Complete the clinical intake to see your biological terrain mapped across 25 domains and 9 clinical gates."
      >
        <button
          onClick={() => startAssessment()}
          className="rounded-xl bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Start Assessment
        </button>
      </PatientSectionLayout>
    );
  }

  const gateList = CIE_GATES.map((g) => ({
    ...g,
    ...(gateScores[g.id] || { score: 50, traffic_light: "YELLOW", contributing_domains: g.domains }),
  }));

  const avgScore = Object.values(domainScores).length > 0
    ? Math.round(Object.values(domainScores).reduce((s, d) => s + d.final_score, 0) / Object.values(domainScores).length)
    : 0;

  return (
    <PatientSectionLayout
      eyebrow="YOUR TERRAIN"
      title="Your biological terrain"
      intro="A comprehensive view of your health across 25 domains and 9 clinical gates, scored from your intake assessment."
      aside={
        <AsideVisualPanel
          title="Overall terrain score"
          subtitle={`${Object.values(domainScores).length} domains scored`}
          visual={<AsideProgressRing value={avgScore} max={100} label="Avg Score" />}
          footnote={`Assessment v${currentAssessment.version} · ${currentAssessment.total_questions_answered} questions answered`}
        />
      }
    >
      {/* 9 Gates */}
      <div className="mb-10">
        <h3 className="font-serif text-lg text-foreground mb-4">Clinical Gates</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {gateList.map((gate) => {
            const tl = gate.traffic_light || "YELLOW";
            return (
              <div key={gate.id} className={`rounded-xl border p-4 ${TRAFFIC_BG[tl] || TRAFFIC_BG.YELLOW}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-3 w-3 rounded-full ${TRAFFIC_COLORS[tl] || TRAFFIC_COLORS.YELLOW}`} />
                  <span className="text-xs font-mono text-muted-foreground">{gate.id}</span>
                </div>
                <p className="font-serif text-sm font-medium text-foreground">{gate.name}</p>
                <p className="text-2xl font-serif font-bold text-foreground mt-1">{Math.round(gate.score)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {gate.contributing_domains?.join(", ") || gate.domains.join(", ")}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 25 Domains by Axis */}
      <div className="mb-8">
        <h3 className="font-serif text-lg text-foreground mb-4">Domain Scores by Axis</h3>
        <div className="space-y-6">
          {AXES.map((axis) => {
            const axisDomains = CIE_DOMAINS.filter((d) => d.axis === axis.id);
            return (
              <div key={axis.id}>
                <h4 className="text-xs font-sans font-semibold text-muted-foreground tracking-wider mb-2">
                  AXIS {axis.id} — {axis.name.toUpperCase()}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {axisDomains.map((domain) => {
                    const score = domainScores[domain.id];
                    const finalScore = score ? Math.round(score.final_score) : 50;
                    const tl = score
                      ? finalScore >= 80 ? "GREEN" : finalScore >= 60 ? "YELLOW" : finalScore >= 40 ? "ORANGE" : "RED"
                      : "YELLOW";
                    return (
                      <div key={domain.id} className={`rounded-lg border p-3 ${TRAFFIC_BG[tl]}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${TRAFFIC_COLORS[tl]}`} />
                            <span className="text-xs font-mono text-muted-foreground">{domain.id}</span>
                          </div>
                          <span className="text-lg font-serif font-bold text-foreground">{finalScore}</span>
                        </div>
                        <p className="text-xs text-foreground/80 mt-1">{domain.name}</p>
                        {score?.triggered_layer2 && (
                          <span className="text-[10px] text-accent font-medium">Deep dive completed</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Retake button */}
      <div className="pt-4 border-t border-border">
        <button
          onClick={() => startAssessment()}
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Retake Assessment
        </button>
        <p className="text-xs text-muted-foreground mt-2">
          Your previous results will be preserved. A new assessment creates a new version for comparison.
        </p>
      </div>
    </PatientSectionLayout>
  );
};

export default IntakeResultsSection;
