import React from "react";
import { useManifest } from "@/context/ManifestContext";
import { Pill, CalendarCheck, Users } from "lucide-react";

const CareMapSection: React.FC = () => {
  const { manifest } = useManifest();
  const cm = manifest.careMap;

  if (!cm) return null;

  return (
    <section className="animate-fade-in space-y-8">
      <h2 className="text-sm font-sans font-medium uppercase tracking-widest text-secondary">
        Care Map
      </h2>

      {/* Medications */}
      {cm.medications?.length > 0 && (
        <div>
          <h3 className="font-serif text-lg text-foreground flex items-center gap-2 mb-3">
            <Pill className="h-5 w-5 text-secondary" /> Your current protocol
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {cm.medications.map((med, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4">
                <p className="font-sans font-semibold text-foreground text-sm">{med.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{med.purpose}</p>
                {med.dose && <p className="text-xs text-foreground/70 mt-1">Dose: {med.dose}</p>}
                {med.notes && <p className="text-xs text-muted-foreground italic mt-1">{med.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checkpoints */}
      {cm.checkpoints?.length > 0 && (
        <div>
          <h3 className="font-serif text-lg text-foreground flex items-center gap-2 mb-3">
            <CalendarCheck className="h-5 w-5 text-secondary" /> Checkpoints
          </h3>
          <div className="relative space-y-0">
            {cm.checkpoints.map((cp, i) => (
              <div key={i} className="flex gap-4 pb-5 last:pb-0">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-secondary border-2 border-background shrink-0 z-10" />
                  {i < cm.checkpoints.length - 1 && <div className="w-px flex-1 bg-border" />}
                </div>
                <div>
                  <p className="font-sans font-semibold text-sm text-foreground">{cp.label} <span className="font-normal text-muted-foreground">— {cp.date}</span></p>
                  <p className="text-sm text-muted-foreground mt-0.5">{cp.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Responsibilities */}
      {cm.responsibilities?.length > 0 && (
        <div>
          <h3 className="font-serif text-lg text-foreground flex items-center gap-2 mb-3">
            <Users className="h-5 w-5 text-secondary" /> Who does what
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {cm.responsibilities.map((r, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4">
                <p className="font-sans font-semibold text-foreground text-sm mb-2">{r.who}</p>
                <ul className="space-y-1">
                  {r.tasks.map((t, j) => (
                    <li key={j} className="text-xs text-muted-foreground flex gap-2 items-start">
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-secondary shrink-0" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default CareMapSection;
