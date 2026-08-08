import React, { useRef, useEffect } from "react";
import { navItems } from "./navItems";

interface Props {
  activeSection: string;
  onNavigate: (id: string) => void;
  /** Release 0 cohort gate: the Ask My Twin home item shows only when enabled. */
  homeEnabled?: boolean;
}

const MobileNav: React.FC<Props> = ({ activeSection, onNavigate, homeEnabled = false }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current?.querySelector(`[data-nav="${activeSection}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeSection]);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <div ref={scrollRef} className="flex overflow-x-auto scrollbar-hide py-1 px-2 gap-1">
        {navItems
          .filter((item) => homeEnabled || item.id !== "home")
          .map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              data-nav={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg shrink-0 min-w-[56px] min-h-[44px] transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-sans font-medium">{item.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
