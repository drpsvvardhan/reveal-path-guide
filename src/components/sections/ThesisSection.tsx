import React from "react";
import { useManifest } from "@/context/ManifestContext";

const ThesisSection: React.FC = () => {
  const { manifest } = useManifest();
  const { patientThesis } = manifest;

  if (!patientThesis) return null;

  return (
    <section className="animate-fade-in max-w-2xl">
      <h2 className="text-sm font-sans font-medium uppercase tracking-widest text-secondary mb-6">
        What's happening in your body
      </h2>
      <blockquote className="text-2xl md:text-3xl font-serif text-foreground leading-snug mb-6">
        {patientThesis.title}
      </blockquote>
      <p className="text-base md:text-lg text-muted-foreground leading-relaxed whitespace-pre-line">
        {patientThesis.body}
      </p>
    </section>
  );
};

export default ThesisSection;
