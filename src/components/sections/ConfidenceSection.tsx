import React from "react";
import { useActiveManifest } from "@/hooks/useActiveManifest";
import { CheckCircle, Search, RefreshCw } from "lucide-react";

const ConfidenceSection: React.FC = () => {
  const manifest = useActiveManifest();
  const cb = manifest.confidenceBreakdown;

  if (!cb) return null;

  const groups = [
    { title: "Things we're confident about", items: cb.confident, icon: CheckCircle, colorClass: "text-success" },
    { title: "Things we're still investigating", items: cb.investigating, icon: Search, colorClass: "text-amber" },
    { title: "Things worth retesting to be sure", items: cb.retest, icon: RefreshCw, colorClass: "text-accent" },
  ];

  return (
    <section className="animate-fade-in space-y-6">
      <h2 className="text-sm font-sans font-medium uppercase tracking-widest text-primary">
        How sure are we
      </h2>

      <div className="space-y-5">
        {groups.map(({ title, items, icon: Icon, colorClass }) => {
          if (!items?.length) return null;
          return (
            <div key={title}>
              <h3 className="font-serif text-lg text-foreground flex items-center gap-2 mb-3">
                <Icon className={`h-5 w-5 ${colorClass}`} /> {title}
              </h3>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="mt-2 h-1.5 w-1.5 rounded-full bg-foreground/25 shrink-0" />
                    <p className="text-sm text-foreground/80">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ConfidenceSection;
