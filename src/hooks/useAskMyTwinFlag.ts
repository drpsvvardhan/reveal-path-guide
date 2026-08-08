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
        const { data, error } = await supabase
          .from("profiles")
          .select("ask_my_twin_release0_enabled")
          .eq("id", userId)
          .maybeSingle();
        if (cancelled) return;
        setState({
          enabled:
            !error &&
            (data as { ask_my_twin_release0_enabled?: boolean } | null)
              ?.ask_my_twin_release0_enabled === true,
          loaded: true,
        });
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
