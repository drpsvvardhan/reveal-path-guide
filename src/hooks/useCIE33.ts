import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useViewAs } from "@/context/ViewAsContext";
import { useAuth } from "@/context/AuthContext";
import type { IntakeState } from "@shared/cie33/engine";

export function useCIE33() {
  const { effectiveUserId } = useViewAs();
  const { user } = useAuth();
  const [state, setState] = useState<IntakeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scope = useRef(effectiveUserId);
  scope.current = effectiveUserId;
  const inFlight = useRef(false);
  const retry = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const readOnly = !!effectiveUserId && effectiveUserId !== user?.id;
  const invoke = useCallback(
    async (body: Record<string, unknown>) => {
      const uid = effectiveUserId;
      if (!uid) return null;
      const { data, error: invokeError } = await supabase.functions.invoke(
        "cie-v33",
        { body: { ...body, user_id: uid } },
      );
      if (scope.current !== uid) return null;
      if (invokeError || data?.error) {
        let message = data?.message;
        if (!message && invokeError?.context instanceof Response) {
          try {
            message = (await invokeError.context.json()).message;
          } catch {
            /* transport error */
          }
        }
        throw new Error(
          message || "Your intake could not be loaded or saved. Please retry.",
        );
      }
      setState(data.state as IntakeState | null);
      return data.state as IntakeState | null;
    },
    [effectiveUserId],
  );
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      return await invoke({ action: "read" });
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [invoke]);
  useEffect(() => {
    setState(null);
    retry.current = null;
    void reload();
  }, [reload]);
  const command = useCallback(
    async (body: Record<string, unknown>) => {
      if (readOnly || inFlight.current) return null;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      const bound =
        body.action === "start"
          ? body
          : {
              ...body,
              session_id: state?.id,
              expected_revision: state?.revision,
              expected_hash: state?.stateHash,
            };
      const fingerprint = JSON.stringify(bound);
      if (retry.current?.fingerprint !== fingerprint)
        retry.current = { fingerprint, requestId: crypto.randomUUID() };
      try {
        const next = await invoke({
          ...bound,
          request_id: retry.current.requestId,
        });
        retry.current = null;
        return next;
      } catch (e) {
        setError((e as Error).message);
        return null;
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [invoke, readOnly, state],
  );
  return { state, loading, busy, error, readOnly, command, reload };
}
