import React, { useState } from "react";
import { useManifest } from "@/context/ManifestContext";
import { Pill, CalendarCheck, Users, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import AsideVisualPanel from "@/components/layout/AsideVisualPanel";
import AsideProgressRing from "@/components/layout/AsideProgressRing";

const CareMapSection: React.FC = () => {
  const { manifest } = useManifest();
  const cm = manifest.careMap;

  if (!cm) return null;

  const medCount = cm.medications?.length || 0;

  return (
    <PatientSectionLayout
      eyebrow="CARE MAP"
      title="Your current protocol and the checkpoints ahead"
      intro="Everything you're currently taking, what each one is for, and the milestones where we review how it's going."
      aside={
        <AsideVisualPanel
          title="Protocol adherence"
          subtitle="Last 7 days across all supplements"
          visual={
            <AsideProgressRing
              percent={82}
              label="on track"
              sublabel="82 of 100"
              size={180}
              color="hsl(174, 55%, 45%)"
            />
          }
          items={[
            { label: "Active protocol items", value: medCount.toString() },
            { label: "Next checkpoint", value: "Week 2", tone: "accent" },
            { label: "Next bloodwork", value: "Week 8" },
          ]}
          footnote="Consistent intake matters more than perfect intake. Missing a day is recoverable; missing a week needs a note."
        />
      }
    >
      {/* Medications */}
      {cm.medications?.length > 0 && (
        <div>
          <h3 className="font-serif text-lg text-foreground flex items-center gap-2 mb-3">
            <Pill className="h-5 w-5 text-primary" /> Your current protocol
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {cm.medications.map((med, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4 min-w-0">
                <p className="font-sans font-semibold text-foreground text-sm break-words">{med.name}</p>
                <p className="text-xs text-muted-foreground mt-1 break-words">{med.purpose}</p>
                {med.dose && <p className="text-xs text-foreground/70 mt-1 break-words">Dose: {med.dose}</p>}
                {med.notes && <p className="text-xs text-muted-foreground italic mt-1 break-words">{med.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checkpoints */}
      {cm.checkpoints?.length > 0 && (
        <div>
          <h3 className="font-serif text-lg text-foreground flex items-center gap-2 mb-3">
            <CalendarCheck className="h-5 w-5 text-primary" /> Checkpoint timeline
          </h3>
          <div className="relative space-y-0">
            {cm.checkpoints.map((cp, i) => (
              <CheckpointCard key={i} checkpoint={cp} isLast={i === cm.checkpoints.length - 1} />
            ))}
          </div>
        </div>
      )}

      {/* Responsibilities */}
      {cm.responsibilities?.length > 0 && (
        <div>
          <h3 className="font-serif text-lg text-foreground flex items-center gap-2 mb-3">
            <Users className="h-5 w-5 text-primary" /> Who does what
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {cm.responsibilities.map((r, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4 min-w-0">
                <p className="font-sans font-semibold text-foreground text-sm mb-2 break-words">{r.who}</p>
                <ul className="space-y-1">
                  {r.tasks.map((t, j) => (
                    <li key={j} className="text-xs text-muted-foreground flex gap-2 items-start min-w-0">
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                      <span className="break-words min-w-0">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </PatientSectionLayout>
  );
};

const CheckpointCard: React.FC<{ checkpoint: any; isLast: boolean }> = ({ checkpoint: cp, isLast }) => {
  const [open, setOpen] = useState(false);
  const hasDetail = cp.checking || cp.whyItMatters || cp.owner;

  return (
    <div className="flex gap-4 pb-5 last:pb-0 min-w-0">
      <div className="flex flex-col items-center">
        <div className="h-3 w-3 rounded-full bg-primary border-2 border-background shrink-0 z-10" />
        {!isLast && <div className="w-px flex-1 bg-border" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-sans font-semibold text-sm text-foreground break-words">
          {cp.label} <span className="font-normal text-muted-foreground">— {cp.date}</span>
        </p>
        <p className="text-sm text-muted-foreground mt-0.5 break-words">{cp.description}</p>
        {cp.owner && (
          <span className="inline-block mt-1.5 text-[10px] font-sans font-medium uppercase tracking-wider bg-lavender-light text-primary rounded-full px-2 py-0.5">{cp.owner}</span>
        )}
        {hasDetail && (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors mt-1.5 min-h-[44px]">
              {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {open ? "Less" : "What & why"}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1.5 border-t border-border pt-2">
              {cp.checking && <p className="text-xs text-muted-foreground break-words"><span className="font-medium text-foreground">Checking:</span> {cp.checking}</p>}
              {cp.whyItMatters && <p className="text-xs text-muted-foreground break-words"><span className="font-medium text-foreground">Why it matters:</span> {cp.whyItMatters}</p>}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
};

export default CareMapSection;
