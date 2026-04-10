import React from "react";
import { useActiveManifest } from "@/hooks/useActiveManifest";

const SymptomBridgesSection: React.FC = () => {
  const manifest = useActiveManifest();
  const bridges = manifest.symptomBridges;

  if (!bridges?.length) return null;

  return (
    <section className="animate-fade-in space-y-6 max-w-2xl">
      <h2 className="text-sm font-sans font-medium uppercase tracking-widest text-primary mb-2">
        Why you might be feeling this way
      </h2>
      <div className="space-y-4">
        {bridges.map((bridge, i) => (
          <div key={i} className="flex gap-4 items-start">
            <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
            <p className="text-base text-foreground leading-relaxed">{bridge}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default SymptomBridgesSection;
