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
  if (error || !data) return null;
  return deriveLatestBiologicalTimestamp(data);
}
