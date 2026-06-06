import React from "react";
import { useActiveManifest } from "@/hooks/useActiveManifest";
import { useCIEAssessment } from "@/context/CIEAssessmentContext";
import { CheckCircle, Search, RefreshCw } from "lucide-react";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import AsideVisualPanel from "@/components/layout/AsideVisualPanel";
import AsideDistributionBar from "@/components/layout/AsideDistributionBar";
import ConfidenceGradient from "@/components/visuals/ConfidenceGradient";

const ConfidenceSection: React.FC = () => {
  const manifest = useActiveManifest();
  const { gateScores } = useCIEAssessment();
  const cb = manifest.confidenceBreakdown;

  if (!cb) return null;

  // When CIE data exists, build gradient items from actual gate scores
  const hasCIE = Object.keys(gateScores).length > 0;

  const groups = [
    { title: "Things we're confident about", items: cb.confident, icon: CheckCircle, colorClass: "text-success" },
    { title: "Things we're still investigating", items: cb.investigating, icon: Search, colorClass: "text-amber" },
    { title: "Things worth retesting to be sure", items: cb.retest, icon: RefreshCw, colorClass: "text-accent" },
  ];

  const confidentCount = cb.confident?.length || 0;
  const investigatingCount = cb.investigating?.length || 0;
  const watchingCount = cb.retest?.length || 0;

  const gradientItems: { label: string; category: "confident" | "investigating" | "watching" }[] = hasCIE
    ? Object.values(gateScores).map((gs) => ({
        label: `${gs.gate_name} (${Math.round(gs.score)})`,
        category: gs.traffic_light === "GREEN" ? "confident" as const
          : gs.traffic_light === "RED" ? "watching" as const
          : "investigating" as const,
      }))
    : [
        ...(cb.confident || []).map((label) => ({ label, category: "confident" as const })),
        ...(cb.investigating || []).map((label) => ({ label, category: "investigating" as const })),
        ...(cb.retest || []).map((label) => ({ label, category: "watching" as const })),
      ];

  return (
    <PatientSectionLayout
      eyebrow="HOW SURE ARE WE"
      title="Our certainty, laid out honestly"
      intro="Not everything we observe is equally certain. Here's where we are confident, where we're still investigating, and what we're watching to be sure."
      aside={
        <AsideVisualPanel
          title="Certainty landscape"
          subtitle="Where we stand across what we know"
          visual={
            <AsideDistributionBar
              segments={[
                { label: "Confident", value: confidentCount, color: "hsl(174, 55%, 45%)" },
                { label: "Investigating", value: investigatingCount, color: "hsl(40, 70%, 55%)" },
                { label: "Watching", value: watchingCount, color: "hsl(220, 25%, 55%)" },
              ]}
            />
          }
          footnote="Uncertainty is active attention, not doubt. A 'watching' item is something we're tracking to confirm."
        />
      }
    >
      {/* Horizontal gradient: desktop/tablet only. At <640px the SVG would scale
          down so far that the staggered 11px labels collide and clip. The grouped
          list below shows the same information in a phone-friendly stacked form. */}
      {gradientItems.length > 0 && (
        <div className="hidden sm:block">
          <ConfidenceGradient items={gradientItems} className="mb-8" />
        </div>
      )}

      <div className="space-y-5 min-w-0">
        {groups.map(({ title, items, icon: Icon, colorClass }) => {
          if (!items?.length) return null;
          return (
            <div key={title} className="min-w-0">
              <h3 className="text-subhead text-foreground flex items-start gap-2 mb-3 min-w-0 break-words">
                <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${colorClass}`} />
                <span className="min-w-0 break-words">{title}</span>
              </h3>
              <div className="space-y-2 min-w-0">
                {items.map((item, i) => (
                  <div key={i} className="flex gap-3 items-start min-w-0">
                    <div className="mt-2 h-1.5 w-1.5 rounded-full bg-foreground/25 shrink-0" />
                    <p className="text-sm text-foreground/80 min-w-0 break-words">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </PatientSectionLayout>
  );
};

export default ConfidenceSection;
