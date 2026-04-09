import React from "react";
import { useManifest } from "@/context/ManifestContext";
import { CheckCircle, AlertTriangle } from "lucide-react";

const HelpingFeedingSection: React.FC = () => {
  const { manifest } = useManifest();
  const data = manifest.helpingVsFeeding;

  if (!data) return null;

  return (
    <section className="animate-fade-in space-y-6">
      <h2 className="text-sm font-sans font-medium uppercase tracking-widest text-primary mb-2">
        What is helping — and what is still feeding the problem
      </h2>

      <div className="grid gap-6 md:grid-cols-2">
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
      </div>
    </section>
  );
};

export default HelpingFeedingSection;
