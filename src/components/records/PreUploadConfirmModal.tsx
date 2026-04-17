import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, FileText, X } from "lucide-react";

interface PreUploadConfirmModalProps {
  open: boolean;
  fileName: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Asks the user to confirm a lab/fibroscan upload belongs to THEM before any
 * extraction runs. Uploading someone else's report would contaminate the
 * patient's biological model and terrain reading, so this is intentionally
 * a hard, explicit gate — not a checkbox.
 */
const PreUploadConfirmModal: React.FC<PreUploadConfirmModalProps> = ({
  open,
  fileName,
  onConfirm,
  onCancel,
}) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-xl"
          >
            <button
              type="button"
              onClick={onCancel}
              aria-label="Cancel upload"
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="p-6 space-y-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 border border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-700" />
                </div>
                <div className="flex-1">
                  <h2 className="font-serif text-lg text-foreground">
                    Is this report yours?
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground font-sans">
                    Before we read it, please confirm this report belongs to
                    you.
                  </p>
                </div>
              </div>

              {fileName && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-sans text-foreground">
                    {fileName}
                  </span>
                </div>
              )}

              <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-xs font-sans text-amber-900 leading-relaxed">
                <strong className="font-semibold">Why this matters:</strong>{" "}
                uploading another person&rsquo;s lab report will contaminate
                your biological model and terrain reading. Every observation
                we extract is treated as <em>your</em> data and feeds your
                clusters, narrative, and clinician handoff.
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-sans text-foreground hover:bg-muted/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-sans font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Yes, this is mine — extract it
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PreUploadConfirmModal;
