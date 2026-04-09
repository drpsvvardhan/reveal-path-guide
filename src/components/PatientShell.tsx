import React, { useState, useRef } from "react";
import { useManifest } from "@/context/ManifestContext";
import DesktopNav from "@/components/navigation/DesktopNav";
import MobileNav from "@/components/navigation/MobileNav";
import ManifestSwitcher from "@/components/ManifestSwitcher";
import JourneySection from "@/components/sections/JourneySection";
import ThesisSection from "@/components/sections/ThesisSection";
import HelpingFeedingSection from "@/components/sections/HelpingFeedingSection";
import SymptomBridgesSection from "@/components/sections/SymptomBridgesSection";
import ReversibilitySection from "@/components/sections/ReversibilitySection";
import ActionSection from "@/components/sections/ActionSection";
import AskSection from "@/components/sections/AskSection";
import ConfidenceSection from "@/components/sections/ConfidenceSection";
import CareMapSection from "@/components/sections/CareMapSection";
import CareTeamSection from "@/components/sections/CareTeamSection";
import { navItems } from "@/components/navigation/navItems";

const sections: Record<string, React.FC> = {
  journey: JourneySection,
  thesis: ThesisSection,
  "helping-feeding": HelpingFeedingSection,
  symptoms: SymptomBridgesSection,
  reversibility: ReversibilitySection,
  actions: ActionSection,
  ask: AskSection,
  confidence: ConfidenceSection,
  "care-map": CareMapSection,
  "care-team": CareTeamSection,
};

const PatientShell: React.FC = () => {
  const { manifest } = useManifest();
  const [activeSection, setActiveSection] = useState("journey");
  const mainRef = useRef<HTMLDivElement>(null);

  const handleNavigate = (id: string) => {
    setActiveSection(id);
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const ActiveComponent = sections[activeSection] ?? JourneySection;
  const activeNav = navItems.find((n) => n.id === activeSection);

  return (
    <div className="flex h-screen overflow-hidden">
      <DesktopNav activeSection={activeSection} onNavigate={handleNavigate} />

      <main ref={mainRef} className="flex-1 overflow-y-auto pb-24 md:pb-8">
        {/* Patient header bar */}
        <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-sm border-b border-border px-6 py-3 md:px-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-sans">
                {manifest.patient.firstName}, {manifest.patient.age} · {manifest.patient.sex}
              </p>
              <h2 className="font-serif text-base md:text-lg text-foreground">
                {activeNav?.label ?? "Journey"}
              </h2>
            </div>
            <div className="md:hidden">
              <p className="text-xs text-muted-foreground font-sans font-medium tracking-wider">Vizzhy</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-8 md:px-10 md:py-10 max-w-3xl">
          <ActiveComponent />
        </div>
      </main>

      <MobileNav activeSection={activeSection} onNavigate={handleNavigate} />
      <ManifestSwitcher />
    </div>
  );
};

export default PatientShell;
