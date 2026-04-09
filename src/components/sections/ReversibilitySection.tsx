import React from "react";
import { useManifest } from "@/context/ManifestContext";

const tiers = [
  { key: "weeks" as const, label: "Can improve in weeks", colorClass: "bg-teal-light border-secondary/20" },
  { key: "months" as const, label: "Can improve in months", colorClass: "bg-navy-light border-primary/10" },
  { key: "slow" as const, label: "Changes slowly — worth the effort", colorClass: "bg-amber-light border-amber/15" },
  { key: "permanent" as const, label: "Harder to reverse — we work around it", colorClass: "bg-coral-light border-coral/10" },
];

const ReversibilitySection: React.FC = () => {
  const { manifest } = useManifest();
  const rev = manifest.reversibility;

  if (!rev) return null;

  return (
    <section className="animate-fade-in space-y-6">
      <h2 className="text-sm font-sans font-medium uppercase tracking-widest text-secondary mb-2">
        What can still change
      </h2>

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
    </section>
  );
};

export default ReversibilitySection;
