// ============================================================================
// supabase/functions/_shared/witnessFreshness.ts
// ----------------------------------------------------------------------------
// THE single semantic source for "evidence available through".
//
// Both the server runtime (contextLoader → Answer Receipt
// latest_witness_as_of) and the patient UI (Ask My Twin home freshness
// line) derive evidence freshness from this module: same active registry
// seed, same derivation rule. Freshness must never become duplicated
// business logic — if the definition changes, it changes here, once.
//
// Pure module: no Deno, no network, importable by both the edge runtime
// and the browser (via the @shared alias).
//
// Wording contract (Release 0):
//   "Twin updated <date>"              = Twin release/update date, NOT the
//                                        newest biological data in it.
//   "Evidence available through <date>" = newest ADMITTED witness evidence
//                                        available to the runtime. It may
//                                        not yet be incorporated into the
//                                        canonical Twin (fast plane vs
//                                        slow plane).
// ============================================================================

export const ACTIVE_REGISTRY_SEED_VERSION = "p1a_initial";

/**
 * Newest biological_timestamp (short ISO day) across witness rows. Returns
 * null when no row carries a valid timestamp — freshness is never
 * fabricated.
 */
export function deriveLatestBiologicalTimestamp(
  rows: Array<{ biological_timestamp: string | null }>
): string | null {
  let latest: string | null = null;
  for (const row of rows) {
    if (!row.biological_timestamp) continue;
    const day = row.biological_timestamp.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    if (latest === null || day > latest) latest = day;
  }
  return latest;
}
