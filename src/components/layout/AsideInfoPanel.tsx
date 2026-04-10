import React from "react";
import { LucideIcon } from "lucide-react";

export interface AsideInfoItem {
  icon?: LucideIcon;
  label: string;
  value: string;
  subvalue?: string;
  tone?: "default" | "accent" | "warning" | "success" | "critical";
  progress?: number;
}

interface AsideInfoPanelProps {
  title: string;
  subtitle?: string;
  items: AsideInfoItem[];
  footnote?: string;
  accentColor?: string;
}

const toneStyles: Record<string, { text: string; bg: string; bar: string }> = {
  default: { text: "text-foreground", bg: "bg-muted/30", bar: "bg-foreground/30" },
  accent: { text: "text-accent", bg: "bg-accent/8", bar: "bg-accent" },
  warning: { text: "text-warning", bg: "bg-warning/8", bar: "bg-warning" },
  success: { text: "text-success", bg: "bg-success/10", bar: "bg-success" },
  critical: { text: "text-destructive", bg: "bg-destructive/8", bar: "bg-destructive" },
};

const AsideInfoPanel: React.FC<AsideInfoPanelProps> = ({
  title,
  subtitle,
  items,
  footnote,
  accentColor,
}) => {
  return (
    <div
      className="rounded-lg border border-border/60 bg-card overflow-hidden"
      style={{
        boxShadow: "var(--shadow-elevated)",
        ...(accentColor ? { borderLeft: `2px solid ${accentColor}` } : {}),
      }}
    >
      <div className="px-7 pt-7 pb-5">
        <h3 className="font-serif text-xl text-foreground leading-tight tracking-tight" style={{ fontWeight: 500 }}>
          {title}
        </h3>
        {subtitle && (
          <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">{subtitle}</p>
        )}
      </div>

      <div className="h-px bg-border/50 mx-7" />

      <div className="px-7 py-6 space-y-6">
        {items.map((item, idx) => {
          const Icon = item.icon;
          const tone = toneStyles[item.tone || "default"];

          return (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                {Icon && (
                  <Icon className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={1.5} />
                )}
                <p className="text-[11px] font-sans font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {item.label}
                </p>
              </div>
              <p className={`font-sans text-2xl font-semibold leading-none tracking-tight ${tone.text}`}>
                {item.value}
              </p>
              {item.subvalue && (
                <p className="text-[12px] text-muted-foreground leading-relaxed">{item.subvalue}</p>
              )}
              {typeof item.progress === "number" && (
                <div className="pt-1.5">
                  <div className={`h-1 rounded-full ${tone.bg} overflow-hidden`}>
                    <div
                      className={`h-full rounded-full ${tone.bar} transition-all duration-500`}
                      style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {footnote && (
        <>
          <div className="h-px bg-border/50 mx-7" />
          <div className="px-7 py-5">
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              {footnote}
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default AsideInfoPanel;
