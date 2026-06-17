import {
  type WitnessSignalRegistryEntry,
  type WitnessSourceWindow,
  type WitnessDomainOfAccess,
  type WitnessEpistemicRole,
  type WitnessReliabilityClass,
  type CompressionDepth,
} from "./witness.ts";

import {
  type RegistryAccessor,
  makeRegistryAccessor,
} from "./witnessify_impl.ts";

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
    throw new Error(`Failed to load registry from backend: ${error.message}`);
  }
  if (!data || data.length === 0) {
    throw new Error(`Registry empty for seed version '${registrySeedVersion}'.`);
  }

  const entries: WitnessSignalRegistryEntry[] = (data as RegistryRowRaw[]).map((r) => ({
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
  }));

  return { accessor: makeRegistryAccessor(entries), row_count: entries.length };
}