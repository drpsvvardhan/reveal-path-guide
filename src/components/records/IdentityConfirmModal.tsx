import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, X, Loader2 } from "lucide-react";

export type IdentityConfirmKind = "unknown" | "mismatch";

export interface IdentityConfirmRequest {
  uploadId: string;
  kind: IdentityConfirmKind;
  extractedName: string | null;
  accountName: string | null;
  score: number | null;
  /** Which processor produced this — controls which function to re-invoke on confirm. */
  processor: "process-lab-pdf" | "process-fibroscan";
  storagePath?: string;
}

interface Props {
  request: IdentityConfirmRequest | null;
  onConfirm: (req: IdentityConfirmRequest, confirmedName: string) => Promise<void>;
  onReject: (req: IdentityConfirmRequest) => Promise<void>;
  onClose: () => void;
}

const IdentityConfirmModal: React.FC<Props> = ({ request, onConfirm, onReject, onClose }) => {
  const [typedName, setTypedName] = useState("");
  const [busy, setBusy] = useState<"confirm" | "reject" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!request) return null;

  const isMismatch = request.kind === "mismatch";
  const requireType = isMismatch;
  const accountName = request.accountName ?? "your account";
  const extracted = request.extractedName ?? "the name on this report";

  const handleConfirm = async () => {
    setErr(null);
    const name = requireType ? typedName.trim() : (request.extractedName ?? request.accountName ?? "").trim();
    if (requireType) {
      if (name.length < 2) { setErr("Please type your full name to confirm."); return; }
      // Loose check: typed name should resemble account name (share at least one token, case-insensitive).
      const acct = (request.accountName ?? "").toLowerCase().split(/\s+/).filter(Boolean);
      const typed = name.toLowerCase().split(/\s+/).filter(Boolean);
      const overlap = typed.some((t) => acct.includes(t));
      if (!overlap) { setErr(`This must match the name on your account (${accountName}).`); return; }
    }
    try {
      setBusy("confirm");
      await onConfirm(request, name);
    } catch (e: any) {
      setErr(e?.message ?? "Could not confirm. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async () => {
    setErr(null);
    try {
      setBusy("reject");
      await onReject(request);
    } catch (e: any) {
      setErr(e?.message ?? "Could not reject. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4"
        >
          <div className="flex items-start gap-3">
            <div className={`shrink-0 rounded-full p-2 ${isMismatch ? "bg-orange-50 text-orange-600" : "bg-amber-50 text-amber-600"}`}>
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-foreground">
                {isMismatch ? "This report doesn't look like yours" : "Confirm this report is yours"}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {isMismatch
                  ? `The report says it's for "${extracted}", but your account is "${accountName}". For patient safety, we need explicit confirmation before adding it.`
                  : `The report says it's for "${extracted}". Your account is "${accountName}". Is this you?`}
              </p>
            </div>
            {!busy && (
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {requireType && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Type your full account name to confirm
              </label>
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={accountName}
                disabled={!!busy}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                By typing your name you confirm this report belongs to you and accept it being added to your account.
              </p>
            </div>
          )}

          {err && (
            <div className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded px-3 py-2">
              {err}
            </div>
          )}

          <div className="flex items-center gap-2 justify-end pt-2">
            <button
              onClick={handleReject}
              disabled={!!busy}
              className="text-xs px-3 py-2 rounded-md border border-border text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
            >
              {busy === "reject" ? (<span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" />Rejecting…</span>) : "No, not me"}
            </button>
            <button
              onClick={handleConfirm}
              disabled={!!busy}
              className="text-xs px-3 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-colors disabled:opacity-50"
            >
              {busy === "confirm"
                ? (<span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" />Confirming…</span>)
                : (isMismatch ? "Yes, this is mine — add it" : "Yes, this is me")}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default IdentityConfirmModal;
