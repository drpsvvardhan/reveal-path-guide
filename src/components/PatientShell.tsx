import React, { useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useManifest } from "@/context/ManifestContext";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";
import { NavigationProvider } from "@/context/NavigationContext";
import { LogOut, ChevronDown, Users, ArrowLeft, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import DesktopNav from "@/components/navigation/DesktopNav";
import MobileNav from "@/components/navigation/MobileNav";
import ManifestSwitcher from "@/components/ManifestSwitcher";
import ViewAsSessionBanner from "@/components/ViewAsSessionBanner";
import EnterViewAsDialog from "@/components/EnterViewAsDialog";
import TodayBar from "@/components/TodayBar";
import QuickActions from "@/components/QuickActions";
import WeeklySnapshot from "@/components/WeeklySnapshot";
import JourneySection from "@/components/sections/JourneySection";
import ThesisSection from "@/components/sections/ThesisSection";
import HelpingFeedingSection from "@/components/sections/HelpingFeedingSection";

import ReversibilitySection from "@/components/sections/ReversibilitySection";
import ActionSection from "@/components/sections/ActionSection";
import RecordsSection from "@/components/sections/RecordsSection";
import AskSection from "@/components/sections/AskSection";
import ConfidenceSection from "@/components/sections/ConfidenceSection";
import CareMapSection from "@/components/sections/CareMapSection";
import CareTeamSection from "@/components/sections/CareTeamSection";
import QueueSection from "@/components/sections/QueueSection";
import NoticedSection from "@/components/sections/NoticedSection";
import IntakeResultsSection from "@/components/sections/IntakeResultsSection";
import { navItems } from "@/components/navigation/navItems";

const sections: Record<string, React.FC> = {
  journey: JourneySection,
  thesis: ThesisSection,
  "helping-feeding": HelpingFeedingSection,
  
  reversibility: ReversibilitySection,
  actions: ActionSection,
  records: RecordsSection,
  ask: AskSection,
  queue: QueueSection,
  terrain: IntakeResultsSection,
  noticed: NoticedSection,
  confidence: ConfidenceSection,
  "care-map": CareMapSection,
  "care-team": CareTeamSection,
};

const PatientShell: React.FC = () => {
  const { manifest } = useManifest();
  const { signOut, user } = useAuth();
  const { isAdmin, isViewingAs, allProfiles, resetViewAs, effectiveUserId } = useViewAs();
  const [activeSection, setActiveSection] = useState("journey");
  const [profileOpen, setProfileOpen] = useState(false);
  const [viewAsDialogOpen, setViewAsDialogOpen] = useState(false);
  const [viewAsTarget, setViewAsTarget] = useState<string | undefined>(undefined);
  const mainRef = useRef<HTMLDivElement>(null);

  const handleNavigate = (id: string) => {
    setActiveSection(id);
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const ActiveComponent = sections[activeSection] ?? JourneySection;
  const activeNav = navItems.find((n) => n.id === activeSection);

  return (
    <NavigationProvider onNavigate={handleNavigate}>
    <div className="flex h-screen overflow-hidden flex-col safe-area-px">
      <ViewAsSessionBanner />
      <div className="flex flex-1 overflow-hidden">
      <DesktopNav activeSection={activeSection} onNavigate={handleNavigate} />

      <main ref={mainRef} className="flex-1 overflow-y-auto pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">

        <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-sm border-b border-border px-4 py-3 md:px-10 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-sans">
                {manifest.patient.firstName}{manifest.patient.age ? `, ${manifest.patient.age}` : ""}{manifest.patient.sex ? ` · ${manifest.patient.sex}` : ""}
              </p>
              <h2 className="font-serif text-base md:text-lg">
                {activeNav?.label ?? "Journey"}
              </h2>
            </div>
            <div className="relative">
              <button
                onClick={() => setProfileOpen((o) => !o)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 min-h-[44px] hover:bg-muted/60 transition-colors"
              >
                <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-xs font-sans font-semibold text-primary shrink-0">
                  {(manifest.patient.firstName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-sans font-medium text-foreground leading-tight truncate max-w-[140px]">
                    {manifest.patient.firstName || user?.email?.split("@")[0] || "User"}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-sans leading-tight truncate max-w-[140px]">
                    {isViewingAs ? "View-as mode" : user?.email ?? ""}
                  </p>
                </div>
                <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
              </button>

              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg border border-border bg-card shadow-lg py-1 max-h-[400px] overflow-y-auto">
                    <div className="px-3 py-2 border-b border-border">
                      <p className="text-[10px] text-muted-foreground font-sans">Signed in as</p>
                      <p className="text-xs font-sans text-foreground truncate">{user?.email}</p>
                    </div>

                    {/* Admin: start audited view-as session */}
                    {isAdmin && (
                      <div className="border-b border-border py-1">
                        <p className="px-3 py-1 text-[10px] text-muted-foreground font-sans uppercase tracking-wider">Admin</p>
                        {isViewingAs && (
                          <button
                            onClick={() => { resetViewAs(); setProfileOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-sans text-foreground hover:bg-muted/60 transition-colors"
                          >
                            <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground" />
                            Exit view-as
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setViewAsTarget(undefined);
                            setProfileOpen(false);
                            setViewAsDialogOpen(true);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-sans text-foreground hover:bg-muted/60 transition-colors"
                        >
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          Start view-as session…
                        </button>
                        <Link
                          to="/admin/profiles"
                          onClick={() => setProfileOpen(false)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-sans text-foreground hover:bg-muted/60 transition-colors"
                        >
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          All profiles
                        </Link>
                      </div>
                    )}

                    <Link
                      to="/account"
                      onClick={() => setProfileOpen(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-sans text-foreground hover:bg-muted/60 transition-colors"
                    >
                      <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                      Account settings
                    </Link>
                    <button
                      onClick={() => { setProfileOpen(false); signOut(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-sans text-foreground hover:bg-muted/60 transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {activeSection === "journey" && (
          <div className="px-4 pt-6 md:px-10 max-w-3xl space-y-4">
            <TodayBar />
            <QuickActions onNavigate={handleNavigate} />
            <WeeklySnapshot />
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            className="px-4 py-6 md:px-10 lg:px-16 md:py-10"
          >
            <ActiveComponent />
          </motion.div>
        </AnimatePresence>
      </main>

      <MobileNav activeSection={activeSection} onNavigate={handleNavigate} />
      <ManifestSwitcher />
      </div>
      <EnterViewAsDialog
        open={viewAsDialogOpen}
        onOpenChange={setViewAsDialogOpen}
        defaultTargetUserId={viewAsTarget}
      />
    </div>
    </NavigationProvider>
  );
};

export default PatientShell;
