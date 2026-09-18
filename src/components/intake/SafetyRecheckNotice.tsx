import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shown to the patient after a clinician with active authority permitted their
 * paused intake to continue. The clinician's private notes are never exposed —
 * only the follow-up instructions written for the patient. The patient still
 * answers the safety question themselves; nobody answers it for them.
 */
const SafetyRecheckNotice: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [notice, setNotice] = useState<{
    encounter_at: string;
    patient_instructions: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("cie33_safety_review_notices")
        .select("encounter_at, patient_instructions")
        .eq("session_id", sessionId)
        .eq("disposition", "permit_resumption")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active && data) setNotice(data);
    })();
    return () => {
      active = false;
    };
  }, [sessionId]);

  return (
    <div className="mb-4 space-y-2 rounded-xl border border-border p-5">
      <p className="font-medium">
        A clinician has reviewed your paused questionnaire and you can continue.
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        This means you may carry on with the questions. It does not mean a
        clinician decided you are not at risk, and it is not treatment approval.
        We are asking you the safety question once more, in your own words — your
        earlier answer is kept exactly as you gave it.
      </p>
      {notice && (
        <p className="text-sm leading-relaxed">
          From your clinician ({new Date(notice.encounter_at).toLocaleString()}):{" "}
          {notice.patient_instructions}
        </p>
      )}
      <p className="text-sm leading-relaxed text-muted-foreground">
        If you are in immediate danger or might harm yourself or someone else,
        contact local emergency services or go to the nearest emergency
        department now.
      </p>
    </div>
  );
};

export default SafetyRecheckNotice;
