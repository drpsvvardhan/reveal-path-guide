import React from "react";
import { useManifest } from "@/context/ManifestContext";

const JourneySection: React.FC = () => {
  const { manifest } = useManifest();
  const { studyOverview } = manifest;

  return (
    <section className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl md:text-4xl font-serif text-foreground mb-3">
          Here's what we read about you
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
          {studyOverview.summary}
        </p>
      </div>

      <div className="inline-flex items-center gap-2 rounded-full bg-navy-light px-4 py-2 text-sm text-foreground">
        {studyOverview.statLine}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {studyOverview.layers.map((layer) => (
          <div
            key={layer.id}
            className={`rounded-xl border p-5 transition-all ${
              layer.status === "complete"
                ? "border-secondary/30 bg-teal-light"
                : layer.status === "in-progress"
                ? "border-amber/30 bg-amber-light"
                : "border-border bg-card opacity-75"
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">{layer.icon}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-sans font-medium ${
                  layer.status === "complete"
                    ? "bg-secondary/15 text-secondary"
                    : layer.status === "in-progress"
                    ? "bg-amber/15 text-amber"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {layer.status === "complete" ? "Complete" : layer.status === "in-progress" ? "In Progress" : "Pending"}
              </span>
            </div>
            <h3 className="font-serif text-lg text-foreground mb-1">{layer.title}</h3>
            <p className="text-sm text-muted-foreground">{layer.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default JourneySection;
