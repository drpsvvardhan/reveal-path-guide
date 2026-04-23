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

import {
  type WitnessSignalRegistryEntry,
  type WitnessSourceWindow,
  type WitnessDomainOfAccess,
  type WitnessEpistemicRole,
  type WitnessReliabilityClass,
  type CompressionDepth,
} from "../_shared/witness.ts";

import {
  type RegistryAccessor,
  makeRegistryAccessor,
} from "../_shared/witnessify_impl.ts";

/**
 * A minimal subset of the Supabase client we use. Typed loosely to avoid
 * version-coupling on supabase-js. The caller passes a real SupabaseClient
 * and TypeScript will accept it.
 */
export interface SupabaseQueryClient {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => Promise<{
        data: unknown[] | null;
        error: { message: string } | null;
      }>;
    };
  };
}

/**
 * Raw row shape returned by SELECT * FROM witness_signal_registry WHERE ...
 * We intentionally restate the column names here rather than import a
 * generated type because the Supabase Deno edge function doesn't have
 * auto-generated types.
 */
interface RegistryRowRaw {
  source_window: string;
  signal: string;
  domain_of_access: string;
  epistemic_role: string;
  reliability_class: string;
  compression_depth: number;
  label: string;
  unit: string | null;
  description: string | null;
  default_limitations: string[];
  default_confidence_basis: string;
  default_confidence_value: number;
  default_validity_window_seconds: number | null;
  ontology_version: string | null;
  ontology_concept_id: string | null;
  registry_seed_version: string;
}

/**
 * Load all registry entries for a given seed version and return a
 * RegistryAccessor. Throws on query error or on zero rows (which almost
 * certainly indicates a wrong seed version or an unseeded database).
 *
 * The load is O(rows) and typically completes in 100-300ms on the edge.
 */
export async function loadRegistryFromSupabase(
  sb: SupabaseQueryClient,
  registrySeedVersion: string
): Promise<{ accessor: RegistryAccessor; row_count: number }> {
  const { data, error } = await sb
    .from("witness_signal_registry")
    .select(
      "source_window, signal, domain_of_access, epistemic_role, reliability_class, " +
        "compression_depth, label, unit, description, default_limitations, " +
        "default_confidence_basis, default_confidence_value, " +
        "default_validity_window_seconds, ontology_version, ontology_concept_id, " +
        "registry_seed_version"
    )
    .eq("registry_seed_version", registrySeedVersion);

  if (error) {
    throw new Error(
      `Failed to load registry from Supabase: ${error.message}`
    );
  }
  if (!data || data.length === 0) {
    throw new Error(
      `Registry empty for seed version '${registrySeedVersion}'. ` +
        `Either the seed migration has not been applied, or the version string is wrong.`
    );
  }

  const entries: WitnessSignalRegistryEntry[] = (data as RegistryRowRaw[]).map(
    (r) => ({
      source_window: r.source_window as WitnessSourceWindow,
      signal: r.signal,
      domain_of_access: r.domain_of_access as WitnessDomainOfAccess,
      epistemic_role: r.epistemic_role as WitnessEpistemicRole,
      reliability_class: r.reliability_class as WitnessReliabilityClass,
      compression_depth: r.compression_depth as CompressionDepth,
      label: r.label,
      unit: r.unit,
      description: r.description,
      default_limitations: r.default_limitations,
      default_confidence_basis: r.default_confidence_basis,
      default_confidence_value: r.default_confidence_value,
      default_validity_window_seconds: r.default_validity_window_seconds,
      ontology_version: r.ontology_version,
      ontology_concept_id: r.ontology_concept_id,
      registry_seed_version: r.registry_seed_version,
    })
  );

  return { accessor: makeRegistryAccessor(entries), row_count: entries.length };
}

// ============================================================================
// END
// ============================================================================
