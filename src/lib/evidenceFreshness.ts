// ============================================================================
// src/lib/evidenceFreshness.ts
// ----------------------------------------------------------------------------
// "Evidence available through" for the patient UI — same governed
// definition the Answer Receipt uses (witnessFreshness.ts: active registry
// seed + shared derivation), scoped EXPLICITLY to the effective user.
//
// The explicit user_id filter is not redundant with RLS: admins hold a
// read-all policy on witness_objects, so in view-as mode an unscoped
// "newest witness" query could surface another patient's date and corrupt
// the freshness claim. Scoping in the query makes the claim correct for
// every caller, not just callers RLS happens to restrict.
// ============================================================================

import {
  ACTIVE_REGISTRY_SEED_VERSION,
  deriveLatestBiologicalTimestamp,
} from "@shared/witnessFreshness";

/** Minimal query surface, so tests can pass a fake client. */
export interface FreshnessQueryClient {
  functions?: { invoke: (name: string, options: { body: Record<string, unknown> }) => Promise<{ data: { latest_capture_at?: string | null } | null; error: unknown }> };

  from: (table: string) => {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string
      ) => {
        eq: (
          col: string,
          val: string
        ) => {
          order: (
            col: string,
            opts: { ascending: boolean }
          ) => {
            limit: (n: number) => Promise<{
              data: Array<{ biological_timestamp: string | null }> | null;
              error: unknown;
            }>;
          };
        };
      };
    };
  };
}

export async function fetchLatestEvidenceDate(
  client: FreshnessQueryClient,
  targetUserId: string
): Promise<string | null> {
  const { data, error } = await client
    .from("witness_objects")
    .select("biological_timestamp")
    .eq("user_id", targetUserId)
    .eq("registry_seed_version", ACTIVE_REGISTRY_SEED_VERSION)
    .order("biological_timestamp", { ascending: false })
    .limit(1);
  const legacy = error || !data ? null : deriveLatestBiologicalTimestamp(data);
  // CIE 3.3 is independently versioned; obtain its confirmed capture clock from
  // the authenticated service so view-as authorization stays server enforced.
  let cieCapture: string | null = null;
  try {
    const result = await client.functions?.invoke("cie-v33", { body: { action: "freshness", user_id: targetUserId } });
    if (!result?.error) cieCapture = result?.data?.latest_capture_at ?? null;
  } catch { /* A failed source cannot contribute a freshness claim. */ }
  return deriveLatestBiologicalTimestamp([legacy, cieCapture].filter(Boolean).map(biological_timestamp => ({ biological_timestamp })));

}
