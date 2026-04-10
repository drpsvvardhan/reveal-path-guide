import React from "react";

interface AsideVisualPanelProps {
  title: string;
  subtitle?: string;
  visual: React.ReactNode;
  items?: Array<{
    label: string;
    value: string;
    tone?: "default" | "accent" | "warning" | "success";
  }>;
  footnote?: string;
}

const toneClasses: Record<string, string> = {
  default: "text-foreground",
  accent: "text-secondary",
  warning: "text-amber-700",
  success: "text-teal-700",
};

const AsideVisualPanel: React.FC<AsideVisualPanelProps> = ({
  title,
  subtitle,
  visual,
  items,
  footnote,
}) => {
  return (
    <div className="relative rounded-2xl border border-border/80 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.08)] overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-60"
        style={{
          background:
            "linear-gradient(90deg, hsl(var(--secondary) / 0.5) 0%, hsl(var(--secondary) / 0.1) 60%, transparent 100%)",
        }}
      />

      <div className="px-6 pt-6 pb-4">
        <h3 className="font-serif text-xl text-foreground leading-tight tracking-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>

      <div className="px-6 py-4 flex items-center justify-center">
        {visual}
      </div>

      {items && items.length > 0 && (
        <>
          <div className="h-px bg-border/60 mx-6" />
          <div className="px-6 py-4 space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-baseline justify-between gap-3">
                <p className="text-[11px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
                  {item.label}
                </p>
                <p className={`font-serif text-base ${toneClasses[item.tone || "default"]}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {footnote && (
        <>
          <div className="h-px bg-border/60 mx-6" />
          <div className="px-6 py-4">
            <p className="text-[11px] text-muted-foreground italic leading-relaxed">
              {footnote}
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default AsideVisualPanel;
