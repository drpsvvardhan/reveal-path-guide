import React from "react";
import { motion } from "framer-motion";

interface PatientSectionLayoutProps {
  eyebrow?: string;
  title: string;
  intro?: string;
  heroVisual?: React.ReactNode;
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
  children,
  aside,
  asideSticky = false,
  actionBar,
}) => {
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-6xl mx-auto"
    >
      {/* HERO AREA */}
      <header className="relative pb-10 md:pb-14 lg:pb-16">
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 60% at 0% 50%, hsl(var(--secondary) / 0.04) 0%, transparent 60%)",
          }}
        />
        <div className="relative">
          {eyebrow && (
            <p className="text-[11px] font-sans font-medium uppercase tracking-[0.22em] text-secondary mb-5">
              {eyebrow}
            </p>
          )}
          <div className={heroVisual ? "grid lg:grid-cols-[minmax(0,1fr)_auto] gap-10 lg:gap-16 items-center" : ""}>
            <div className="max-w-2xl">
              <h1
                className="font-serif text-foreground leading-[1.08] tracking-[-0.02em]"
                style={{
                  fontSize: "clamp(2rem, 4.5vw, 3.75rem)",
                  fontWeight: 400,
                }}
              >
                {title}
              </h1>
              {intro && (
                <p className="mt-6 md:mt-8 text-lg md:text-xl text-muted-foreground leading-[1.55] max-w-xl font-sans font-light">
                  {intro}
                </p>
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
      {actionBar && <div className="pb-6 border-b border-border/40 mb-8">{actionBar}</div>}

      {/* CONTENT GRID */}
      <div
        className={
          aside
            ? "grid gap-8 lg:gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]"
            : "max-w-3xl"
        }
      >
        <main className="min-w-0 space-y-6">{children}</main>

        {aside && (
          <aside
            className={`min-w-0 ${asideSticky ? "lg:sticky lg:top-6 lg:self-start" : ""}`}
          >
            {aside}
          </aside>
        )}
      </div>
    </motion.section>
  );
};

export default PatientSectionLayout;
