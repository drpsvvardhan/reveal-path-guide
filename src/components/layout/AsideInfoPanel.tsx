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
  default: { text: "text-foreground", bg: "bg-muted/40", bar: "bg-foreground/40" },
  accent: { text: "text-secondary", bg: "bg-secondary/10", bar: "bg-secondary" },
  warning: { text: "text-amber-700", bg: "bg-amber-50", bar: "bg-amber-500" },
  success: { text: "text-teal-700", bg: "bg-teal-50", bar: "bg-teal-500" },
  critical: { text: "text-red-700", bg: "bg-red-50", bar: "bg-red-500" },
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
      className="relative rounded-2xl border border-border/80 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.08)] overflow-hidden"
      style={
        accentColor
          ? { borderLeft: `3px solid ${accentColor}` }
          : undefined
      }
    >
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

      <div className="h-px bg-border/60 mx-6" />

      <div className="px-6 py-5 space-y-5">
        {items.map((item, idx) => {
          const Icon = item.icon;
          const tone = toneStyles[item.tone || "default"];

          return (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                {Icon && (
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <p className="text-[11px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
                  {item.label}
                </p>
              </div>
              <p className={`font-serif text-2xl leading-none ${tone.text}`}>
                {item.value}
              </p>
              {item.subvalue && (
                <p className="text-xs text-muted-foreground">{item.subvalue}</p>
              )}
              {typeof item.progress === "number" && (
                <div className="pt-1">
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

export default AsideInfoPanel;
