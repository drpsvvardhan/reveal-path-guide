import React from "react";
import { useActiveManifest } from "@/hooks/useActiveManifest";
import { CheckCircle, AlertTriangle } from "lucide-react";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import AsideInfoPanel from "@/components/layout/AsideInfoPanel";

const HelpingFeedingSection: React.FC = () => {
  const manifest = useActiveManifest();
  const data = manifest.helpingVsFeeding;

  if (!data) return null;

  return (
    <PatientSectionLayout
      eyebrow="WHAT IS HELPING — AND WHAT IS STILL FEEDING THE PROBLEM"
      title="What's working for you, and what's working against you"
      intro="Your current supplements and interventions are doing real work. These are the drivers that are still pulling in the other direction."
      aside={
        <AsideInfoPanel
          title="Net effect"
          items={[
            { label: "Helping", value: `${data.helping?.length || 0} factors`, tone: "success" },
            { label: "Feeding", value: `${data.feeding?.length || 0} factors`, tone: "warning" },
            { label: "Direction", value: "Improving", subvalue: "More helping than hurting" },
          ]}
          footnote="Feeding the problem is not about blame — each of these is a lever you can work with."
        />
      }
      asideSticky
    >
      {/* Helping */}
      <div className="space-y-3">
        <h3 className="font-serif text-xl text-foreground flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-success" /> Working for you
        </h3>
        {data.helping.map((item, i) => (
          <div key={i} className="rounded-lg bg-sky-light border border-secondary/10 p-4">
            <p className="font-sans font-medium text-foreground text-sm mb-1">{item.label}</p>
            <p className="text-sm text-muted-foreground">{item.mechanism}</p>
          </div>
        ))}
      </div>

      {/* Feeding */}
      <div className="space-y-3">
        <h3 className="font-serif text-xl text-foreground flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-coral" /> Working against you
        </h3>
        {data.feeding.map((item, i) => (
          <div key={i} className="rounded-lg bg-coral-light border border-coral/10 p-4">
            <p className="font-sans font-medium text-foreground text-sm mb-1">{item.label}</p>
            <p className="text-sm text-muted-foreground">{item.mechanism}</p>
          </div>
        ))}
      </div>
    </PatientSectionLayout>
  );
};

export default HelpingFeedingSection;
