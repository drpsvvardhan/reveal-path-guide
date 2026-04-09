import React from "react";
import { UtensilsCrossed, Mic, MessageCircle, Upload, ListChecks, Phone } from "lucide-react";

interface QuickActionItem {
  icon: React.ElementType;
  label: string;
  action?: string;
}

const actions: QuickActionItem[] = [
  { icon: UtensilsCrossed, label: "Log food" },
  { icon: Mic, label: "Voice note" },
  { icon: MessageCircle, label: "Ask a question", action: "ask" },
  { icon: Upload, label: "Upload report", action: "records" },
  { icon: ListChecks, label: "View plan", action: "actions" },
  { icon: Phone, label: "Message coach", action: "care-team" },
];

interface QuickActionsProps {
  onNavigate?: (id: string) => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({ onNavigate }) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {actions.map((item) => (
        <button
          key={item.label}
          onClick={() => item.action && onNavigate?.(item.action)}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-sans font-medium text-foreground hover:bg-muted/60 hover:border-secondary/30 transition-all whitespace-nowrap shrink-0"
        >
          <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
          {item.label}
        </button>
      ))}
    </div>
  );
};

export default QuickActions;
