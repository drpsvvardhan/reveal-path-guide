import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * ViewAsContext v2.0 — server-minted, audited, time-bounded sessions.
 *
 * Changes from v1:
 *   - Cannot switch "viewing user" purely in client state. Must mint a
 *     server session via admin-view-as-mint edge function.
 *   - Session requires a reason (≥10 chars) and gets a server-set expiry (≤4h).
 *   - Session expiry is tracked in context and triggers automatic exit.
 *   - All operations logged to admin_view_as_audit server-side.
 *
 * Usage:
 *   const { viewingUserId, enterViewAs, exitViewAs, sessionExpiresAt } = useViewAs();
 */

type ViewAsSession = {
  session_id: string;
  target_user_id: string;
  granted_at: string;
  expires_at: string;
};

type ProfileSummary = {
  user_id: string;
  first_name: string | null;
  display_name: string | null;
  age: number | null;
  sex: string | null;
};

type ViewAsState = {
  viewingUserId: string | null;
  sessionId: string | null;
  sessionExpiresAt: string | null;
  isAdmin: boolean;
  isLoading: boolean;
  enterViewAs: (targetUserId: string, reason: string, durationMinutes?: number) => Promise<void>;
  exitViewAs: (reason?: string) => Promise<void>;
  timeRemainingMs: number | null;
  // ---- Legacy compatibility shim (v1 API) ----
  /** Effective user id for data fetching: target if viewing-as, else self. */
  effectiveUserId: string | null;
  /** Whether an active view-as session exists. */
  isViewingAs: boolean;
  /** Profiles available to admins for impersonation. */
  allProfiles: ProfileSummary[];
  /**
   * Legacy switch: prompts for a reason and mints a session.
   * Prefer `enterViewAs(id, reason, minutes)` for new code.
   */
  viewAs: (userId: string) => Promise<void>;
  /** Legacy reset: revokes the active session. */
  resetViewAs: () => Promise<void>;
};

const ViewAsContext = createContext<ViewAsState | null>(null);

const SESSION_STORAGE_KEY = "reveal_path.view_as_session";

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ViewAsSession | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [allProfiles, setAllProfiles] = useState<ProfileSummary[]>([]);

  // Tick every second so time-remaining renders update, and we can detect expiry
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  // On mount + on auth changes: re-evaluate admin status and any persisted view-as session.
  // CRITICAL: a persisted session from a previous login must NEVER leak into a new login.
  useEffect(() => {
    let cancelled = false;

    const evaluate = async (currentAuthUserId: string | null) => {
      if (!currentAuthUserId) {
        // Logged out — wipe everything
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        if (!cancelled) {
          setAuthUserId(null);
          setIsAdmin(false);
          setAllProfiles([]);
          setSession(null);
          setIsLoading(false);
        }
        return;
      }

      if (!cancelled) setAuthUserId(currentAuthUserId);

      const { data: role } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", currentAuthUserId).eq("role", "admin").maybeSingle();
      const adminFlag = Boolean(role);
      if (cancelled) return;
      setIsAdmin(adminFlag);

      // Non-admins can never have a view-as session — purge any stale storage.
      if (!adminFlag) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        setSession(null);
        setAllProfiles([]);
        setIsLoading(false);
        return;
      }

      // Admin profile picker support
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, display_name, age, sex")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (profiles) setAllProfiles(profiles as ProfileSummary[]);

      // Restore session ONLY if it belongs to this admin (server validates ownership).
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as ViewAsSession & { admin_user_id?: string };
          // Reject sessions belonging to a different admin account
          if (parsed.admin_user_id && parsed.admin_user_id !== currentAuthUserId) {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
          } else {
            const supabaseUrl = (supabase as any).supabaseUrl ?? import.meta.env.VITE_SUPABASE_URL;
            const { data: authData } = await supabase.auth.getSession();
            const token = authData.session?.access_token;
            if (token) {
              const res = await fetch(
                `${supabaseUrl}/functions/v1/admin-view-as-mint?target_user_id=${encodeURIComponent(parsed.target_user_id)}`,
                { method: "GET", headers: { Authorization: `Bearer ${token}` } },
              );
              if (res.ok) {
                const { session: serverSession } = await res.json();
                if (serverSession && new Date(serverSession.expires_at).getTime() > Date.now()) {
                  if (!cancelled) {
                    setSession({
                      session_id: serverSession.id,
                      target_user_id: parsed.target_user_id,
                      granted_at: serverSession.granted_at,
                      expires_at: serverSession.expires_at,
                    });
                  }
                } else {
                  sessionStorage.removeItem(SESSION_STORAGE_KEY);
                }
              } else {
                // Server rejected — clear local
                sessionStorage.removeItem(SESSION_STORAGE_KEY);
              }
            }
          }
        } catch {
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }

      if (!cancelled) setIsLoading(false);
    };

    // Initial check
    supabase.auth.getUser().then(({ data }) => evaluate(data.user?.id ?? null));

    // React to auth changes (login / logout / token refresh switching users)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, authSession) => {
      const newUid = authSession?.user?.id ?? null;
      // If the signed-in user changed, drop any persisted view-as state immediately.
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      setSession(null);
      evaluate(newUid);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Auto-expire: if current time passes expires_at, drop the session
  useEffect(() => {
    if (!session) return;
    if (new Date(session.expires_at).getTime() <= now) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      setSession(null);
      toast.info("View-as session expired", {
        description: "Your impersonation session has ended. Mint a new one if you need to continue.",
      });
    }
  }, [now, session]);

  const enterViewAs = useCallback(async (
    targetUserId: string,
    reason: string,
    durationMinutes = 60,
  ) => {
    if (!isAdmin) {
      toast.error("Not permitted", { description: "Admin role required for view-as" });
      return;
    }
    if (reason.trim().length < 10) {
      toast.error("Reason too short", {
        description: "Provide a reason of at least 10 characters (logged for audit)",
      });
      return;
    }

    try {
      const supabaseUrl = (supabase as any).supabaseUrl ?? import.meta.env.VITE_SUPABASE_URL;
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(`${supabaseUrl}/functions/v1/admin-view-as-mint`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ target_user_id: targetUserId, reason, duration_minutes: durationMinutes }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.message ?? payload.error ?? `HTTP ${res.status}`);
      }

      const newSession: ViewAsSession = {
        session_id: payload.session_id,
        target_user_id: targetUserId,
        granted_at: payload.granted_at,
        expires_at: payload.expires_at,
      };
      setSession(newSession);
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
      toast.success("View-as session started", {
        description: `Expires in ${payload.duration_minutes} minutes. Every data access is logged.`,
      });
    } catch (e: any) {
      toast.error("Failed to start session", { description: e?.message });
    }
  }, [isAdmin]);

  const exitViewAs = useCallback(async (reason = "admin exited view-as") => {
    if (!session) return;
    try {
      const supabaseUrl = (supabase as any).supabaseUrl ?? import.meta.env.VITE_SUPABASE_URL;
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      if (token) {
        await fetch(`${supabaseUrl}/functions/v1/admin-view-as-mint/${session.session_id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ reason }),
        });
      }
    } catch (e) {
      console.warn("[ViewAs] revoke call failed, clearing local state anyway", e);
    } finally {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      setSession(null);
    }
  }, [session]);

  const timeRemainingMs = session
    ? Math.max(0, new Date(session.expires_at).getTime() - now)
    : null;

  const viewingUserId = session?.target_user_id ?? null;
  const isViewingAs = !!session;

  // Legacy shim: prompt for a reason, then mint a session.
  const viewAs = useCallback(async (userId: string) => {
    const reason = typeof window !== "undefined"
      ? window.prompt("Reason for viewing as this patient (min 10 chars, audit-logged):")
      : null;
    if (!reason) return;
    await enterViewAs(userId, reason, 60);
  }, [enterViewAs]);

  const resetViewAs = useCallback(async () => {
    await exitViewAs();
  }, [exitViewAs]);

  const value: ViewAsState = {
    viewingUserId,
    sessionId: session?.session_id ?? null,
    sessionExpiresAt: session?.expires_at ?? null,
    isAdmin,
    isLoading,
    enterViewAs,
    exitViewAs,
    timeRemainingMs,
    // Legacy compatibility
    effectiveUserId: viewingUserId ?? authUserId,
    isViewingAs,
    allProfiles,
    viewAs,
    resetViewAs,
  };

  return <ViewAsContext.Provider value={value}>{children}</ViewAsContext.Provider>;
}

export function useViewAs() {
  const ctx = useContext(ViewAsContext);
  if (!ctx) throw new Error("useViewAs must be used within ViewAsProvider");
  return ctx;
}
