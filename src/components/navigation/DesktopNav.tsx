import React from "react";
import { navItems } from "./navItems";

interface Props {
  activeSection: string;
  onNavigate: (id: string) => void;
}

const DesktopNav: React.FC<Props> = ({ activeSection, onNavigate }) => (
  <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-border bg-sidebar h-screen sticky top-0 overflow-y-auto">
    <div className="px-5 pt-6 pb-4 border-b border-border">
      <h2 className="font-serif text-lg tracking-tight">Vizzhy</h2>
      <p className="text-xs text-muted-foreground mt-0.5 font-sans">PatientOS</p>
    </div>
    <nav className="flex-1 py-3 px-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = activeSection === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors mb-0.5 ${
              active
                ? "bg-lavender-light text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-lavender-light/50"
            }`}
          >
            <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : ""}`} />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  </aside>
);

export default DesktopNav;
