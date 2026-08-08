// ============================================================================
// src/hooks/useAskMyTwinFlag.ts
// ----------------------------------------------------------------------------
// Reads the Release 0 cohort flag for the effective user (view-as admins
// see what the target patient sees). Fails closed: until the flag is
// loaded — or if the read errors — the patient gets the existing journey
// experience, never a flash of an unreleased surface.
// ============================================================================

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AskMyTwinFlagState {
  enabled: boolean;
  loaded: boolean;
}

/** Minimal query surface, so tests can pass a fake client. */
export interface FlagQueryClient {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string
      ) => {
        maybeSingle: () => Promise<{
          data: { ask_my_twin_release0_enabled?: boolean } | null;
          error: unknown;
        }>;
      };
    };
  };
}

/**
 * The flag lives on profiles keyed by user_id (the auth UUID) — NOT
 * profiles.id, which is an independent gen_random_uuid() primary key.
 * effectiveUserId from the view-as context is an auth user ID, so the
 * lookup must filter on user_id or the flag silently fails closed for
 * every enabled patient.
 */
export async function fetchAskMyTwinFlag(
  client: FlagQueryClient,
  authUserId: string
): Promise<boolean> {
  const { data, error } = await client
    .from("profiles")
    .select("ask_my_twin_release0_enabled")
    .eq("user_id", authUserId)
    .maybeSingle();
  return !error && data?.ask_my_twin_release0_enabled === true;
}

export function useAskMyTwinFlag(userId: string | null | undefined): AskMyTwinFlagState {
  const [state, setState] = useState<AskMyTwinFlagState>({
    enabled: false,
    loaded: false,
  });

  useEffect(() => {
    if (!userId) {
      setState({ enabled: false, loaded: false });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const enabled = await fetchAskMyTwinFlag(
          supabase as unknown as FlagQueryClient,
          userId
        );
        if (!cancelled) setState({ enabled, loaded: true });
      } catch {
        if (!cancelled) setState({ enabled: false, loaded: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return state;
}
