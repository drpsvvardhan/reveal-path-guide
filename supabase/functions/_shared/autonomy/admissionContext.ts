// ============================================================================
// Trusted admission context
// ----------------------------------------------------------------------------
// The context an admission decision is computed against is read from the
// patient's own stored data with service credentials. It is never accepted
// from the request body, because a request body is not evidence.
//
// Limitation, stated plainly: the condition flags below are derived by keyword
// scan over this person's stored clusters and profile. They are a conservative
// screen, not a clinical assessment, and are not clinically validated.
// ============================================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import type { AdmissionContext } from "./actionPolicy.ts";

const FLAG_KEYWORDS: [string, RegExp][] = [
  ["cardiac_risk", /\b(cardiac|coronary|atheroscler\w*|heart failure|arrhythm\w*|angina|myocardial)\b/i],
  ["low_hrv", /\b(hrv|autonomic (?:load|dysregulation)|poor recovery|sympathetic dominan\w*)\b/i],
  ["ed_history", /\b(disordered eating|eating disorder|anorexi\w*|bulimi\w*|binge eating)\b/i],
  ["ckd", /\b(chronic kidney|ckd|renal impair\w*|reduced egfr)\b/i],
  ["pregnancy", /\b(pregnan\w*|gestation\w*|postpartum)\b/i],
  ["underweight", /\b(underweight|low body mass|sarcopeni\w*)\b/i],
];

export interface LoadedAdmissionContext extends AdmissionContext {
  sources: { lab_observations: number; domain_scores: number; clusters: number };
}

export async function loadAdmissionContext(
  service: SupabaseClient,
  userId: string,
  options: { isViewAs?: boolean } = {},
): Promise<LoadedAdmissionContext> {
  const [obsRes, domainRes, clusterRes] = await Promise.all([
    service
      .from("patient_lab_observations")
      .select("canonical_concept_id, raw_name")
      .eq("user_id", userId)
      .limit(1000),
    service.from("cie_domain_scores").select("domain").eq("user_id", userId).limit(200),
    service.from("clusters").select("*").eq("user_id", userId).limit(50),
  ]);

  const biomarkers = new Set<string>();
  for (const row of (obsRes.data ?? []) as Record<string, string | null>[]) {
    if (row.canonical_concept_id) biomarkers.add(row.canonical_concept_id);
    if (row.raw_name) biomarkers.add(row.raw_name);
  }
  for (const row of (domainRes.data ?? []) as Record<string, string | null>[]) {
    if (row.domain) biomarkers.add(row.domain);
  }

  const clusterRows = (clusterRes.data ?? []) as Record<string, unknown>[];
  const haystack = JSON.stringify(clusterRows);
  const flags = new Set<string>();
  for (const [flag, pattern] of FLAG_KEYWORDS) {
    if (pattern.test(haystack)) flags.add(flag);
  }

  return {
    biomarkers: [...biomarkers],
    flags: [...flags],
    isViewAs: options.isViewAs ?? false,
    sources: {
      lab_observations: (obsRes.data ?? []).length,
      domain_scores: (domainRes.data ?? []).length,
      clusters: clusterRows.length,
    },
  };
}
