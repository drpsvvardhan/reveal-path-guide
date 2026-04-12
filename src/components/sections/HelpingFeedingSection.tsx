import React, { useState } from "react";
import TappableProse from "@/components/terrain/TappableProse";
import { useActiveManifest } from "@/hooks/useActiveManifest";
import { CheckCircle, AlertTriangle, ChevronDown } from "lucide-react";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import AsideInfoPanel from "@/components/layout/AsideInfoPanel";
import { useNavigation } from "@/context/NavigationContext";

const MAX_FEEDING_VISIBLE = 5;

const HelpingFeedingSection: React.FC = () => {
  const manifest = useActiveManifest();
  const { navigateTo } = useNavigation();
  const data = manifest.helpingVsFeeding;
  const [showAllFeeding, setShowAllFeeding] = useState(false);

  if (!data) return null;

  const helping = data.helping || [];
  const allFeeding = data.feeding || [];
  const feedingToShow = showAllFeeding ? allFeeding : allFeeding.slice(0, MAX_FEEDING_VISIBLE);
  const hasMoreFeeding = allFeeding.length > MAX_FEEDING_VISIBLE;

  const direction = helping.length >= allFeeding.length ? "Improving" : "Attention needed";
  const directionSub = helping.length >= allFeeding.length
    ? "More working for you than against you"
    : "More levers to work with than you might think";

  return (
    <PatientSectionLayout
      eyebrow="WHAT IS HELPING — AND WHAT IS STILL FEEDING THE PROBLEM"
      title="What's working for you, and what's working against you"
      intro="Your biology is already doing real work. These are the factors supporting your trajectory — and the drivers still pulling in the other direction."
      aside={
        <AsideInfoPanel
          title="Net effect"
          items={[
            { label: "Helping", value: `${helping.length} factors`, tone: "success" },
            { label: "Feeding", value: `${allFeeding.length} factors`, tone: "warning" },
            { label: "Direction", value: direction, subvalue: directionSub },
          ]}
          footnote="Feeding the problem is not about blame — each of these is a lever you can work with."
        />
      }
      asideSticky
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-medium text-foreground mb-4">
            <CheckCircle className="h-5 w-5 text-success" />
            Working for you
          </h3>
          <div className="space-y-3">
            {helping.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Complete your intake to see what's working for you.</p>
            ) : (
              helping.map((item, i) => (
                <div key={i} className="rounded-lg bg-sky-light border border-secondary/10 p-3">
                  <TappableProse text={item.label} className="font-sans font-medium text-foreground text-sm mb-0.5" />
                  <TappableProse text={item.mechanism} className="text-xs text-muted-foreground" />
                </div>
              ))
            )}
          </div>
        </div>
        <div>
          <h3 className="flex items-center gap-2 text-lg font-medium text-foreground mb-4">
            <AlertTriangle className="h-5 w-5 text-coral" />
            Working against you
          </h3>
          <div className="space-y-3">
            {feedingToShow.map((item, i) => (
              <div key={i} className="rounded-lg bg-coral-light border border-coral/10 p-3">
                <TappableProse text={item.label} className="font-sans font-medium text-foreground text-sm mb-0.5" />
                <TappableProse text={item.mechanism} className="text-xs text-muted-foreground" />
              </div>
            ))}
            {hasMoreFeeding && !showAllFeeding && (
              <button
                onClick={() => setShowAllFeeding(true)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                See all {allFeeding.length} factors
              </button>
            )}
          </div>
        </div>
      </div>
    </PatientSectionLayout>
  );
};

export default HelpingFeedingSection;
