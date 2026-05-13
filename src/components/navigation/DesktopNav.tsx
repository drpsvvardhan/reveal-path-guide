import React from "react";
import { navItems } from "./navItems";

interface Props {
  activeSection: string;
  onNavigate: (id: string) => void;
}

const DesktopNav: React.FC<Props> = ({ activeSection, onNavigate }) => (
  <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-border bg-sidebar h-screen sticky top-0 overflow-y-auto">
    <div className="px-5 pt-6 pb-5 border-b border-border">
      <h2 className="font-serif text-lg tracking-tight text-foreground">Vizzhy</h2>
      <p className="text-[12px] text-muted-foreground mt-0.5 font-sans tracking-wide">BioIntelligence</p>
    </div>
    <nav className="flex-1 py-4 px-3">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = activeSection === item.id;
        return (
          <button
            key={item.id}
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
      })}
    </nav>
  </aside>
);

export default DesktopNav;
