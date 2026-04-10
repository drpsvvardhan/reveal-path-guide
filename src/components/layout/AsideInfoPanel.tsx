import React from "react";
import { LucideIcon } from "lucide-react";

interface AsideInfoPanelProps {
  title: string;
  items: AsideInfoItem[];
  footnote?: string;
}

export interface AsideInfoItem {
  icon?: LucideIcon;
  label: string;
  value: string;
  subvalue?: string;
  tone?: "default" | "accent" | "warning" | "success";
}

const toneStyles: Record<string, string> = {
  default: "text-foreground",
  accent: "text-secondary",
  warning: "text-amber-700",
  success: "text-teal-700",
};

const AsideInfoPanel: React.FC<AsideInfoPanelProps> = ({ title, items, footnote }) => {
  return (
    <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-5 space-y-5">
      <p className="text-[10px] font-sans font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </p>
      <div className="space-y-4">
        {items.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {Icon && <Icon className="h-3 w-3" />}
                <span>{item.label}</span>
              </div>
              <p className={`text-lg font-serif ${toneStyles[item.tone || "default"]}`}>
                {item.value}
              </p>
              {item.subvalue && (
                <p className="text-[11px] text-muted-foreground">{item.subvalue}</p>
              )}
            </div>
          );
        })}
      </div>
      {footnote && (
        <p className="text-[10px] text-muted-foreground italic pt-3 border-t border-border/40 leading-relaxed">
          {footnote}
        </p>
      )}
    </div>
  );
};

export default AsideInfoPanel;
