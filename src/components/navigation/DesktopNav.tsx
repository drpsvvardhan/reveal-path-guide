import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { navItems, NavItem } from "./navItems";

interface Props {
  activeSection: string;
  onNavigate: (id: string) => void;
  /** Release 0 cohort gate: the Ask My Twin home item shows only when enabled. */
  homeEnabled?: boolean;
}

const NavButton: React.FC<{
  item: NavItem;
  active: boolean;
  onNavigate: (id: string) => void;
}> = ({ item, active, onNavigate }) => {
  const Icon = item.icon;
  return (
    <button
      onClick={() => onNavigate(item.id)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left text-[14px] transition-colors duration-150 mb-0.5 ${
        active
          ? "bg-primary text-primary-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary-foreground" : ""}`} strokeWidth={1.5} />
      <span className="truncate">{item.label}</span>
    </button>
  );
};

const DesktopNav: React.FC<Props> = ({ activeSection, onNavigate, homeEnabled = false }) => {
  const primary = navItems.filter(
    (i) => i.group === "primary" && (homeEnabled || i.id !== "home")
  );
  const explore = navItems.filter((i) => i.group === "explore");
  const exploreActive = explore.some((i) => i.id === activeSection);
  // Hidden, not deleted: the deeper panels stay one click away, open
  // automatically when one of them is the active section.
  const [exploreOpen, setExploreOpen] = useState(false);
  const showExplore = exploreOpen || exploreActive;

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-border bg-sidebar h-screen sticky top-0 overflow-y-auto">
      <div className="px-5 pt-6 pb-5 border-b border-border">
        <h2 className="font-serif text-lg tracking-tight text-foreground">Vizzhy</h2>
        <p className="text-[12px] text-muted-foreground mt-0.5 font-sans tracking-wide">BioIntelligence</p>
      </div>
      <nav className="flex-1 py-4 px-3">
        {primary.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={activeSection === item.id}
            onNavigate={onNavigate}
          />
        ))}

        <button
          onClick={() => setExploreOpen((o) => !o)}
          className="w-full flex items-center gap-2 px-3 py-2 mt-3 text-[11px] font-sans font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          {showExplore ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Explore my Twin
        </button>
        {showExplore &&
          explore.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={activeSection === item.id}
              onNavigate={onNavigate}
            />
          ))}
      </nav>
    </aside>
  );
};

export default DesktopNav;
