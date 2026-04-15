import React from "react";
import { useActiveManifest } from "@/hooks/useActiveManifest";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import ReversibilityTimeline from "@/components/visuals/ReversibilityTimeline";

const ReversibilitySection: React.FC = () => {
  const manifest = useActiveManifest();
  const rev = manifest.reversibility;

  if (!rev) return null;

  return (
    <PatientSectionLayout
      eyebrow="WHAT CAN STILL CHANGE"
      title="Most of this is reversible with focused attention"
      intro="Biology is path-dependent but not fixed. These are the things that respond to different time horizons of effort."
    >
      <ReversibilityTimeline
        weeks={rev.weeks || []}
        months={rev.months || []}
        slow={rev.slow || []}
        permanent={rev.permanent || []}
      />

      {rev.closingLine && (
        <p className="text-center text-base italic text-muted-foreground font-serif pt-2">
          {rev.closingLine}
        </p>
      )}
    </PatientSectionLayout>
  );
};

export default ReversibilitySection;
