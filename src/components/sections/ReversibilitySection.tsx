import React from "react";
import { useActiveManifest } from "@/hooks/useActiveManifest";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import AsideInfoPanel from "@/components/layout/AsideInfoPanel";

const tiers = [
  { key: "weeks" as const, label: "Can improve in weeks", colorClass: "bg-sky-light border-secondary/20" },
  { key: "months" as const, label: "Can improve in months", colorClass: "bg-lavender-light border-primary/10" },
  { key: "slow" as const, label: "Changes slowly — worth the effort", colorClass: "bg-amber-light border-amber/15" },
  { key: "permanent" as const, label: "Harder to reverse — we work around it", colorClass: "bg-pink-light border-accent/10" },
];

const ReversibilitySection: React.FC = () => {
  const manifest = useActiveManifest();
  const rev = manifest.reversibility;

  if (!rev) return null;

  return (
    <PatientSectionLayout
      eyebrow="WHAT CAN STILL CHANGE"
      title="Most of this is reversible with focused attention"
      intro="Biology is path-dependent but not fixed. These are the things that respond to different time horizons of effort."
      aside={
        <AsideInfoPanel
          title="Timeline summary"
          items={[
            { label: "Changes in weeks", value: `${rev.weeks?.length || 0} items`, tone: "accent" },
            { label: "Changes in months", value: `${rev.months?.length || 0} items`, tone: "accent" },
            { label: "Slow changes", value: `${rev.slow?.length || 0} items` },
            { label: "Work around", value: `${rev.permanent?.length || 0} items` },
          ]}
        />
      }
    >
      <div className="space-y-4">
        {tiers.map(({ key, label, colorClass }) => {
          const items = rev[key];
          if (!items?.length) return null;
          return (
            <div key={key} className={`rounded-xl border p-5 ${colorClass}`}>
              <h3 className="font-serif text-lg text-foreground mb-3">{label}</h3>
              <ul className="space-y-2">
                {items.map((item, i) => (
                  <li key={i} className="text-sm text-foreground/80 flex gap-2 items-start">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-foreground/30 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {rev.closingLine && (
        <p className="text-center text-base italic text-muted-foreground font-serif pt-2">
          {rev.closingLine}
        </p>
      )}
    </PatientSectionLayout>
  );
};

export default ReversibilitySection;
