import { useViewAs } from "@/context/ViewAsContext";
import { AlertTriangle, LogOut } from "lucide-react";

function formatRemaining(ms: number | null): string {
  if (ms === null) return "—";
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

/**
 * Persistent amber banner shown while an admin is impersonating another user.
 * Mount once near the top of the app shell.
 */
export default function ViewAsSessionBanner() {
  const { viewingUserId, timeRemainingMs, exitViewAs, isViewingAs } = useViewAs();

  if (!isViewingAs || !viewingUserId) return null;

  const expiringSoon = timeRemainingMs !== null && timeRemainingMs < 5 * 60 * 1000;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full border-b px-4 py-2 flex items-center justify-between gap-3 text-xs font-sans ${
        expiringSoon
          ? "bg-destructive/10 border-destructive/30 text-destructive"
          : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium">View-as session active</span>
        <span className="opacity-70 truncate hidden sm:inline">
          target: <code className="font-mono">{viewingUserId.slice(0, 8)}…</code>
        </span>
        <span className="opacity-90">
          expires in <span className="font-mono font-semibold">{formatRemaining(timeRemainingMs)}</span>
        </span>
      </div>
      <button
        onClick={() => exitViewAs("admin clicked exit in banner")}
        className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-foreground/5 transition-colors shrink-0"
      >
        <LogOut className="h-3 w-3" />
        Exit
      </button>
    </div>
  );
}
