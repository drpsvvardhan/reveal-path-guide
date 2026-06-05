import React from "react";
import { motion } from "framer-motion";
import FlowLine from "@/components/visuals/FlowLine";
import TappableRegion from "@/components/terrain/TappableRegion";

interface PatientSectionLayoutProps {
  eyebrow?: string;
  title: string;
  intro?: string;
  heroVisual?: React.ReactNode;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  aside?: React.ReactNode;
  asideSticky?: boolean;
  actionBar?: React.ReactNode;
}

const PatientSectionLayout: React.FC<PatientSectionLayoutProps> = ({
  eyebrow,
  title,
  intro,
  heroVisual,
  headerExtra,
  children,
  aside,
  asideSticky = false,
  actionBar,
}) => {
  return (
    <TappableRegion>
    <motion.section
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-[1360px] mx-auto min-w-0"
    >
      {/* HERO AREA */}
      <header className="relative pb-6 md:pb-12 lg:pb-14">
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 50% 50% at 0% 50%, hsl(var(--muted) / 0.15) 0%, transparent 60%)",
          }}
        />
        <FlowLine variant="hero" className="absolute inset-0 w-full h-full text-signature" />
        <div className="relative">
          {eyebrow && (
            <p className="text-eyebrow text-muted-foreground mb-3">
              {eyebrow}
            </p>
          )}
          <div className={heroVisual ? "grid xl:grid-cols-[minmax(0,1fr)_auto] gap-6 xl:gap-14 items-center min-w-0" : "min-w-0"}>
            <div className="max-w-2xl min-w-0">
              <h1
                className="font-serif text-foreground leading-[1.12] tracking-[-0.015em] break-words"
                style={{
                  fontSize: "clamp(1.5rem, 5vw, 2.5rem)",
                  fontWeight: 500,
                }}
              >
                {title}
              </h1>
              {headerExtra && <div className="mt-2">{headerExtra}</div>}
              {intro && (
                <div className="mt-5 md:mt-6 max-w-xl">
                  <p
                    className="text-base md:text-lg text-muted-foreground leading-relaxed font-sans font-light"
                  >
                    {intro}
                  </p>
                </div>
              )}
            </div>
            {heroVisual && (
              <div className="flex items-center justify-center lg:justify-end shrink-0">
                {heroVisual}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ACTION BAR */}
      {actionBar && <div className="pb-5 border-b border-border/40 mb-7">{actionBar}</div>}

      {/* CONTENT GRID */}
      <div
        className={
          aside
            ? "grid gap-7 lg:gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]"
            : "max-w-3xl"
        }
      >
        <main className="min-w-0 space-y-5">{children}</main>

        {aside && (
          <aside
            className={`min-w-0 ${asideSticky ? "xl:sticky xl:top-6 xl:self-start" : ""}`}
          >
            {aside}
          </aside>
        )}
      </div>
    </motion.section>
    </TappableRegion>
  );
};

export default PatientSectionLayout;
