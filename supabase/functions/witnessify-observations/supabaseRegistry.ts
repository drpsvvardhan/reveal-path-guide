// ============================================================================
// supabase/functions/witnessify-observations/supabaseRegistry.ts
// ----------------------------------------------------------------------------
// Supabase-backed implementation of RegistryAccessor.
//
// Loads all registry entries for a given seed version at function start
// and wraps them in the interface expected by witnessify_impl.ts.
//
// Why load everything:
//   - The full P1a registry is ~554 rows (~650KB SQL, much smaller as
//     Postgres rows).
//   - A typical backfill processes hundreds to thousands of observations.
//     Per-row registry lookup round-trips would dominate function time.
//   - Loading once + Map-backed get() is microseconds per lookup.
//
// Seed version scoping:
//   - Callers pass the expected seed version. Only rows matching are loaded.
//   - Prevents accidental mixing of seed versions in one backfill run.
// ============================================================================

export { loadRegistryFromSupabase } from "../_shared/witnessRegistry.ts";
export type { SupabaseQueryClient } from "../_shared/witnessRegistry.ts";

// ============================================================================
// END
// ============================================================================
