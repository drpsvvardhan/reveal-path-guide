import React, { useRef, useEffect } from "react";
import { navItems } from "./navItems";

interface Props {
  activeSection: string;
  onNavigate: (id: string) => void;
}

const MobileNav: React.FC<Props> = ({ activeSection, onNavigate }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current?.querySelector(`[data-nav="${activeSection}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeSection]);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md safe-area-pb">
      <div ref={scrollRef} className="flex overflow-x-auto scrollbar-hide py-1.5 px-2 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              data-nav={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg shrink-0 min-w-[56px] transition-colors ${
                active ? "text-secondary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[10px] font-sans font-medium">{item.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
