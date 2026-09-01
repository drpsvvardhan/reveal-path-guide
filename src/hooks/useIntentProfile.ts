// ============================================================================
// src/hooks/useIntentProfile.ts
// ----------------------------------------------------------------------------
// Intent Passport read/write. Reads follow the effective user (view-as
// admins see the target patient's priorities); writes are always the
// authenticated user's own row — RLS enforces both.
//
// Zero truth authority: this data shapes presentation only.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUser } from "@/lib/session";

// patient_intent_profiles postdates the generated client types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

export interface IntentProfileAnswers {
  think_about_most: string;
  want_to_understand: string;
  unexplained_result: string;
  ninety_day_change: string;
  doctors_missing: string;
}

export interface IntentProfile extends IntentProfileAnswers {
  version: number;
  updated_at: string;
}

export const INTENT_QUESTIONS: Array<{
  key: keyof IntentProfileAnswers;
  label: string;
}> = [
  { key: "think_about_most", label: "What are the health questions you think about most?" },
  { key: "want_to_understand", label: "What would you most like to understand about your body?" },
  { key: "unexplained_result", label: "Is there a test or result nobody has explained clearly enough?" },
  { key: "ninety_day_change", label: "What would you most like to change over the next 3 months?" },
  { key: "doctors_missing", label: "Is there anything you worry your doctors may be missing?" },
];

export function useIntentProfile(effectiveUserId: string | null | undefined) {
  const [profile, setProfile] = useState<IntentProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!effectiveUserId) {
      setLoaded(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await sb
          .from("patient_intent_profiles")
          .select(
            "version, updated_at, think_about_most, want_to_understand, unexplained_result, ninety_day_change, doctors_missing"
          )
          .eq("user_id", effectiveUserId)
          .maybeSingle();
        if (cancelled) return;
        setProfile(error || !data ? null : (data as IntentProfile));
        setLoaded(true);
      } catch {
        if (!cancelled) {
          setProfile(null);
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveUserId]);

  const save = useCallback(
    async (answers: IntentProfileAnswers): Promise<boolean> => {
      setSaving(true);
      try {
        const currentUser = await getUser();
        const uid = currentUser?.id;
        if (!uid) return false;
        const { data, error } = await sb
          .from("patient_intent_profiles")
          .upsert(
            {
              user_id: uid,
              ...answers,
              version: (profile?.version ?? 0) + 1,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          )
          .select(
            "version, updated_at, think_about_most, want_to_understand, unexplained_result, ninety_day_change, doctors_missing"
          )
          .maybeSingle();
        if (error) return false;
        if (data) setProfile(data as IntentProfile);
        return true;
      } catch {
        return false;
      } finally {
        setSaving(false);
      }
    },
    [profile?.version]
  );

  return { profile, loaded, saving, save };
}
