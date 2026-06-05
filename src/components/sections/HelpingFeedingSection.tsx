import React, { useState } from "react";
import TappableProse from "@/components/terrain/TappableProse";
import { useActiveManifest } from "@/hooks/useActiveManifest";
import { CheckCircle, AlertTriangle, ChevronDown } from "lucide-react";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import AsideInfoPanel from "@/components/layout/AsideInfoPanel";
import { useNavigation } from "@/context/NavigationContext";
import { useNarrative } from "@/context/NarrativeContext";
import VoiceValidationIndicator from "@/components/clusters/VoiceValidationIndicator";

const MAX_FEEDING_VISIBLE = 5;

const HelpingFeedingSection: React.FC = () => {
  const manifest = useActiveManifest();
  const { navigateTo } = useNavigation();
  const { voiceValidationStatus, voiceValidationWarnings, generateNarrative, generating } = useNarrative();
  const [isRegenerating, setIsRegenerating] = useState(false);
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
      headerExtra={
        <VoiceValidationIndicator
          status={voiceValidationStatus}
          warnings={voiceValidationWarnings}
          onRegenerate={async () => {
            setIsRegenerating(true);
            await generateNarrative();
            setIsRegenerating(false);
          }}
          isRegenerating={isRegenerating || generating}
        />
      }
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
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-subhead text-foreground mb-4">
            <CheckCircle className="h-5 w-5 text-success shrink-0" />
            <span className="break-words min-w-0">Working for you</span>
          </h3>
          <div className="space-y-3">
            {helping.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Complete your intake to see what's working for you.</p>
            ) : (
              helping.map((item, i) => (
                <div key={i} className="rounded-lg bg-sky-light border border-secondary/10 p-4 sm:p-3 min-w-0">
                  <TappableProse text={item.label} className="font-serif text-[16px] font-semibold text-foreground block mb-2 break-words" />
                  <TappableProse text={item.mechanism} className="font-serif text-[15px] text-muted-foreground leading-relaxed break-words" />
                </div>
              ))
            )}
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-subhead text-foreground mb-4">
            <AlertTriangle className="h-5 w-5 text-coral shrink-0" />
            <span className="break-words min-w-0">Working against you</span>
          </h3>
          <div className="space-y-3">
            {feedingToShow.map((item, i) => (
              <div key={i} className="rounded-lg bg-coral-light border border-coral/10 p-4 sm:p-3 min-w-0">
                <TappableProse text={item.label} className="font-serif text-[16px] font-semibold text-foreground block mb-2 break-words" />
                <TappableProse text={item.mechanism} className="font-serif text-[15px] text-muted-foreground leading-relaxed break-words" />
              </div>
            ))}
            {hasMoreFeeding && !showAllFeeding && (
              <button
                onClick={() => setShowAllFeeding(true)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[44px] px-1"
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
