import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface OnboardingLayoutProps {
  stepNumber: number;
  totalSteps: number;
  eyebrow: string;
  title: string;
  intro?: string;
  hideHeader?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({
  stepNumber,
  totalSteps,
  eyebrow,
  title,
  intro,
  hideHeader,
  children,
  footer,
}) => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar with brand and progress */}
      <header className="shrink-0 border-b border-border/40">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-16 py-4 flex items-center justify-between">
          <div>
            <p className="font-serif text-xl text-foreground leading-none">Vizzhy</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mt-0.5">
              PatientOS
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em]">
              Step {stepNumber} of {totalSteps}
            </p>
            <div className="flex gap-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 w-8 rounded-full transition-colors ${
                    i < stepNumber ? "bg-secondary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 flex items-center justify-center py-10 px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={stepNumber}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full max-w-2xl"
          >
            {/* Hero area */}
            {!hideHeader && (
              <div className="mb-10">
                <p className="text-[11px] font-sans font-medium uppercase tracking-[0.22em] text-secondary mb-4">
                  {eyebrow}
                </p>
                <h1
                  className="font-serif text-foreground leading-[1.08] tracking-[-0.02em]"
                  style={{
                    fontSize: "clamp(2rem, 4.5vw, 3.25rem)",
                    fontWeight: 400,
                  }}
                >
                  {title}
                </h1>
                {intro && (
                  <p className="mt-6 text-lg text-muted-foreground leading-[1.55] font-sans font-light max-w-xl">
                    {intro}
                  </p>
                )}
              </div>
            )}

            {/* Step content */}
            <div>{children}</div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer with action bar */}
      {footer && (
        <footer className="shrink-0 border-t border-border/40 bg-card/30">
          <div className="max-w-[1280px] mx-auto px-6 md:px-10 lg:px-16 py-5 flex items-center justify-between gap-4">
            {footer}
          </div>
        </footer>
      )}
    </div>
  );
};

export default OnboardingLayout;
