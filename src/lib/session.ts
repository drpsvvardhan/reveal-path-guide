// ============================================================================
// session.ts — the single frontend entry point for identity/session access.
// ----------------------------------------------------------------------------
// Every component, hook and context must read the session through this module
// instead of touching `supabase.auth` directly. This keeps the identity
// provider swappable (Entra External ID / MSAL) as one file rather than a
// grep across contexts and pages.
// ============================================================================
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type { Session, User };

/** Current session, or null when signed out. */
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

/** Bearer token for authenticated calls to the API/edge functions. */
export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.access_token ?? null;
}

/** Verified current user, or null when signed out. */
export async function getUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/** Verified current user id, or null when signed out. */
export async function getUserId(): Promise<string | null> {
  return (await getUser())?.id ?? null;
}

/** Subscribe to session changes. Returns an unsubscribe function. */
export function onSessionChange(
  cb: (session: Session | null) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session ?? null);
  });
  return () => data.subscription.unsubscribe();
}

export async function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithPassword(
  email: string,
  password: string,
  emailRedirectTo: string,
) {
  return supabase.auth.signUp({ email, password, options: { emailRedirectTo } });
}

export async function signOut() {
  return supabase.auth.signOut();
}
