// ============================================================================
// Trusted admission context
// ----------------------------------------------------------------------------
// The context an admission decision is computed against is read from the
// patient's own admitted data with service credentials. It is never accepted
// from the request body, because a request body is not evidence.
//
// Two properties this file exists to guarantee:
//
//   1. IT USES THE TRUSTED SUBSTRATE. Biomarkers and safety flags come from
//      `loadPatientContext` (witness_objects + published CIE 3.3 evidence) and
//      the shared `derivePatientGuards` rules — the same ones simulate-what-if
//      uses. No ad-hoc reads of raw observation tables, no invented columns,
//      no keyword-derived diagnoses.
//
//   2. A FAILED READ IS "UNKNOWN", NEVER "CLEAR". If the context cannot be
//      read, `available` is false. The policy then refuses to auto-activate
//      anything that changes the body, while observation-only tracking still
//      proceeds — because tracking needs no clinical clearance.
//
// Conditions that are absent from structured sources stay UNKNOWN. Absence is
// never reported as exclusion, and nothing here is clinically validated.
// ============================================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { loadPatientContext } from "../contextLoader.ts";
import { derivePatientGuards } from "../aae/patientGuards.ts";
import type { AdmissionContext } from "./actionPolicy.ts";


export interface LoadedAdmissionContext extends AdmissionContext {
  /** Fingerprint of everything the decision was computed from (for CAS). */
  fingerprint: string;
  sources: {
    lab_observations: number;
    inbody_observations: number;
    fibroscan_observations: number;
    cie_domain_scores: number;
    cie_gate_scores: number;
    cie33_sessions_inspected: number;
  };
  /** Human-readable reason the context could not be read, when it could not. */
  unavailable_reason: string | null;
}

/**
 * CIE 3.3 safety state, read from the live session rows — including sessions
 * that are still in progress. A positive sentinel that has not been resolved
 * holds the relevant interventions even if no assessment has been completed.
 */
async function readCie33SafetyState(
  service: SupabaseClient,
  userId: string,
): Promise<{ hold: boolean; recheckPending: boolean; inspected: number }> {
  const { data, error } = await service
    .from("cie33_sessions")
    .select("state")
    .eq("user_id", userId);
  if (error) throw new Error(`cie33_sessions unreadable: ${error.message}`);
  const rows = (data ?? []) as { state: Record<string, unknown> | null }[];
  let hold = false;
  let recheckPending = false;
  for (const row of rows) {
    const safety = String((row.state ?? {})["safety"] ?? "");
    if (safety === "handoff_required") hold = true;
    if (safety === "recheck_required") recheckPending = true;
  }
  return { hold, recheckPending, inspected: rows.length };
}

export async function loadAdmissionContext(
  service: SupabaseClient,
  userId: string,
  options: { isViewAs?: boolean } = {},
): Promise<LoadedAdmissionContext> {
  const empty: LoadedAdmissionContext = {
    biomarkers: [],
    flags: [],
    available: false,
    cieSafetyHold: false,
    cieRecheckPending: false,
    isViewAs: options.isViewAs ?? false,
    fingerprint: "unavailable",
    sources: {
      lab_observations: 0,
      inbody_observations: 0,
      fibroscan_observations: 0,
      cie_domain_scores: 0,
      cie_gate_scores: 0,
      cie33_sessions_inspected: 0,
    },
    unavailable_reason: null,
  };

  try {
    const before = await service.rpc("simulator_admission_fingerprint", { p_user_id: userId });
    if (before.error || typeof before.data !== "string") throw new Error("Admission snapshot unavailable");
    const cie33 = await readCie33SafetyState(service, userId);
    empty.cieSafetyHold = cie33.hold;
    empty.cieRecheckPending = cie33.recheckPending;
    const terrain = await loadPatientContext(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, userId,
    );
    const after = await service.rpc("simulator_admission_fingerprint", { p_user_id: userId });
    if (after.error || after.data !== before.data) throw new Error("Admission context changed during assessment");

    const { biomarkers, flags } = derivePatientGuards(terrain);
    const sources = {
      lab_observations: terrain.labs?.observations?.length ?? 0,
      inbody_observations: terrain.inbody?.observations?.length ?? 0,
      fibroscan_observations: (terrain as any).fibroscan?.observations?.length ?? 0,
      cie_domain_scores: terrain.cie?.domain_scores?.length ?? 0,
      cie_gate_scores: terrain.cie?.gate_scores?.length ?? 0,
      cie33_sessions_inspected: cie33.inspected,
    };

    const fingerprint = before.data;

    return {
      biomarkers: [...biomarkers],
      flags: [...flags],
      available: true,
      cieSafetyHold: cie33.hold,
      cieRecheckPending: cie33.recheckPending,
      isViewAs: options.isViewAs ?? false,
      fingerprint,
      sources,
      unavailable_reason: null,
    };
  } catch (e) {
    // Unknown is not clearance. The policy treats this as "we cannot check".
    const reason = e instanceof Error ? e.message : String(e);
    console.error("[loadAdmissionContext] context unreadable:", reason);
    return { ...empty, unavailable_reason: reason };
  }
}
