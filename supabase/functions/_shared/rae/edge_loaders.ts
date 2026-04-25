// ============================================================================
// supabase/functions/_shared/rae/edge_loaders.ts
// ----------------------------------------------------------------------------
// Read-only engine-binding loader for the RAE edge function.
//
// Controlling spec:
//   docs/RAE_EDGE_FUNCTION_WIRING_DESIGN_v1.md §3 + §11.
//
// Closed read surface (this module's only DB access):
//   - rae_engine_versions             (SELECT by engine_version_id)
//   - rae_signal_config               (SELECT by engine_version_id, optional candidate_concept_id)
//   - rae_engine_concept_overrides    (SELECT by engine_version_id, candidate_concept_id)
//   - witness_signal_registry         (SELECT by source_window, signal, registry_seed_version)
//                                       — RAE is a *decision layer* over existing
//                                         biological witnesses; the four witness
//                                         ontology fields (source_window,
//                                         domain_of_access, epistemic_role,
//                                         reliability_class) for the depth-0
//                                         RAE admission witness MUST come from
//                                         the same P1a registry that
//                                         witnessify-observations consumes.
//
// Hard prohibitions enforced by static-scan test:
//   - No writes (.insert/.update/.delete/.upsert)
//   - No raw SQL strings (INSERT INTO / UPDATE … SET / DELETE FROM / etc.)
//   - No reads from any P1a reasoning surface
//   - No reads from any patient/clinical table
//   - No reads from witness_objects or concept_assignment_witnesses
//   - No imports from witnessify_impl or any reasoning edge function
//
// All required-but-missing data raises RegistryGapError. The orchestrator
// then surfaces this as the typed error documented in the edge function
// wiring design (mapped to HTTP 422 registry_gap by the future caller).
// ============================================================================

import {
  RegistryGapError,
  type SignalConfig,
} from "./orchestrator.ts";
import {
  SIGNAL_IDS,
  type EngineVersionConfig,
  type SignalId,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Minimal Supabase client surface this module is allowed to use. Only
// .from(table).select(columns).<filters>... patterns are exercised. This
// module never calls .insert/.update/.delete/.upsert/.rpc, never reads
// auth/storage/realtime, and never builds raw SQL strings.
// ---------------------------------------------------------------------------

export interface DbResponse<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

export interface DbFilterChain<T> {
  eq(column: string, value: string): DbFilterChain<T>;
  is(column: string, value: null | boolean): DbFilterChain<T>;
  maybeSingle(): Promise<DbResponse<T>>;
  // Exposed so the SignalConfig loader can read the full set of seven rows.
  // Returns the full array (not single row).
  resolve(): Promise<DbResponse<T[]>>;
}

export interface DbTable {
  select(columns: string): DbFilterChain<unknown>;
}

export interface ReadOnlyDbClient {
  from(
    table:
      | "rae_engine_versions"
      | "rae_signal_config"
      | "rae_engine_concept_overrides"
      | "witness_signal_registry",
  ): DbTable;
}

// ---------------------------------------------------------------------------
// Row shapes (what we read from the DB). These mirror the table schemas.
// ---------------------------------------------------------------------------

interface RaeEngineVersionRow {
  id: string;
  semver: string;
  registry_seed_version: string;
  ontology_version: string;
  threshold_admission: number | string;
  threshold_rejection_floor: number | string;
  calibration_mode: boolean;
}

interface RaeSignalConfigRow {
  signal_id: string;
  candidate_concept_id: string;
  weight: number | string;
  parameters: Record<string, unknown> | null;
}

interface RaeEngineConceptOverrideRow {
  engine_version_id: string;
  candidate_concept_id: string;
  lifted: boolean;
  reason: string | null;
}

interface WitnessSignalRegistryRow {
  source_window: string;
  signal: string;
  domain_of_access: string;
  epistemic_role: string;
  reliability_class: string;
  compression_depth: number;
  registry_seed_version: string;
}

// The wildcard row used in rae_signal_config to mean "applies to every
// candidate_concept_id under this engine_version_id". Concept-specific rows
// override the wildcard per signal_id.
const SIGNAL_CONFIG_WILDCARD = "*";

// ---------------------------------------------------------------------------
// Public result shape.
// ---------------------------------------------------------------------------

export interface EngineBinding {
  engine_version: EngineVersionConfig;
  signal_config: SignalConfig;
  /**
   * Optional concept-scoped admission override row. The edge function may
   * apply this (e.g. forcing needs_review for calibration). Absent when
   * no override row exists for (engine_version_id, candidate_concept_id)
   * or when the override row is `lifted = true`.
   */
  concept_override: {
    engine_version_id: string;
    candidate_concept_id: string;
    reason: string | null;
  } | null;
}

export interface LoadEngineBindingInput {
  engine_version_id: string;
  /**
   * When provided, signal-config rows scoped to this concept override the
   * wildcard rows per signal_id, and the concept-override row (if any)
   * is fetched.
   */
  candidate_concept_id?: string;
}

// ---------------------------------------------------------------------------
// Public entry point.
// ---------------------------------------------------------------------------

export async function loadEngineBinding(
  client: ReadOnlyDbClient,
  input: LoadEngineBindingInput,
): Promise<EngineBinding> {
  if (!input || !input.engine_version_id) {
    throw new RegistryGapError(
      "loadEngineBinding: engine_version_id is required",
    );
  }
  const engineVersion = await loadEngineVersion(client, input.engine_version_id);
  const signalConfig = await loadSignalConfig(
    client,
    input.engine_version_id,
    input.candidate_concept_id ?? null,
  );
  const conceptOverride = input.candidate_concept_id
    ? await loadConceptOverride(
        client,
        input.engine_version_id,
        input.candidate_concept_id,
      )
    : null;

  return {
    engine_version: engineVersion,
    signal_config: signalConfig,
    concept_override: conceptOverride,
  };
}

// ---------------------------------------------------------------------------
// EngineVersion loader.
// ---------------------------------------------------------------------------

async function loadEngineVersion(
  client: ReadOnlyDbClient,
  engineVersionId: string,
): Promise<EngineVersionConfig> {
  const { data, error } = await client
    .from("rae_engine_versions")
    .select(
      "id, semver, registry_seed_version, ontology_version, threshold_admission, threshold_rejection_floor, calibration_mode",
    )
    .eq("id", engineVersionId)
    .maybeSingle() as DbResponse<RaeEngineVersionRow>;

  if (error) {
    throw new RegistryGapError(
      `rae_engine_versions read failed for ${engineVersionId}: ${error.message}`,
    );
  }
  if (!data) {
    throw new RegistryGapError(
      `rae_engine_versions row missing for engine_version_id=${engineVersionId}`,
    );
  }

  const thresholdAdmission = toFiniteNumber(data.threshold_admission);
  const thresholdRejection = toFiniteNumber(data.threshold_rejection_floor);
  if (thresholdAdmission === null) {
    throw new RegistryGapError(
      `rae_engine_versions.threshold_admission missing or non-finite for ${engineVersionId}`,
    );
  }
  if (thresholdRejection === null) {
    throw new RegistryGapError(
      `rae_engine_versions.threshold_rejection_floor missing or non-finite for ${engineVersionId}`,
    );
  }
  if (!data.semver || !data.registry_seed_version || !data.ontology_version) {
    throw new RegistryGapError(
      `rae_engine_versions row for ${engineVersionId} missing semver / registry_seed_version / ontology_version`,
    );
  }

  return {
    engine_version_id: data.id,
    semver: data.semver,
    registry_seed_version: data.registry_seed_version,
    ontology_version: data.ontology_version,
    threshold_admission: thresholdAdmission,
    threshold_rejection_floor: thresholdRejection,
    calibration_mode: !!data.calibration_mode,
  };
}

// ---------------------------------------------------------------------------
// SignalConfig loader.
//
// Reads all rae_signal_config rows for the engine version, then folds:
//   1. wildcard rows (candidate_concept_id = SIGNAL_CONFIG_WILDCARD) form
//      the base layer
//   2. concept-scoped rows (candidate_concept_id = input concept) override
//      the wildcard row per signal_id
//
// Every one of the seven SIGNAL_IDS must end up with a finite weight,
// otherwise RegistryGapError. Per-signal optional parameters
// (fuzzy_ceiling, edge_tolerance, tolerance, min_history) are read from
// the row's parameters jsonb when present.
// ---------------------------------------------------------------------------

async function loadSignalConfig(
  client: ReadOnlyDbClient,
  engineVersionId: string,
  candidateConceptId: string | null,
): Promise<SignalConfig> {
  const { data, error } = await client
    .from("rae_signal_config")
    .select("signal_id, candidate_concept_id, weight, parameters")
    .eq("engine_version_id", engineVersionId)
    .resolve() as DbResponse<RaeSignalConfigRow[]>;

  if (error) {
    throw new RegistryGapError(
      `rae_signal_config read failed for engine_version_id=${engineVersionId}: ${error.message}`,
    );
  }
  if (!data || data.length === 0) {
    throw new RegistryGapError(
      `rae_signal_config has no rows for engine_version_id=${engineVersionId}`,
    );
  }

  // Fold by signal_id, preferring concept-scoped rows.
  const folded = new Map<string, RaeSignalConfigRow>();
  for (const row of data) {
    if (row.candidate_concept_id === SIGNAL_CONFIG_WILDCARD) {
      if (!folded.has(row.signal_id)) folded.set(row.signal_id, row);
    }
  }
  if (candidateConceptId) {
    for (const row of data) {
      if (row.candidate_concept_id === candidateConceptId) {
        folded.set(row.signal_id, row);
      }
    }
  }

  const cfg: Partial<Record<SignalId, { weight: number; [k: string]: unknown }>> =
    {};
  for (const id of SIGNAL_IDS) {
    const row = folded.get(id);
    if (!row) {
      throw new RegistryGapError(
        `rae_signal_config missing signal_id=${id} for engine_version_id=${engineVersionId}` +
          (candidateConceptId
            ? ` (candidate_concept_id=${candidateConceptId})`
            : ""),
      );
    }
    const weight = toFiniteNumber(row.weight);
    if (weight === null) {
      throw new RegistryGapError(
        `rae_signal_config.${id}.weight missing or non-finite for engine_version_id=${engineVersionId}`,
      );
    }
    const params = row.parameters && typeof row.parameters === "object"
      ? row.parameters
      : {};
    cfg[id] = { weight, ...lift(id, params) };
  }

  // Final shape-check via orchestrator's own discipline: every SIGNAL_ID
  // must have a finite weight. (validateSignalConfig in orchestrator.ts
  // re-runs this; we duplicate the guarantee here so loader failures are
  // reported with loader-side context.)
  return cfg as SignalConfig;
}

/**
 * Pulls the recognised optional parameters per signal_id out of the
 * row's `parameters` jsonb. Unknown keys are dropped to keep the
 * SignalConfig shape disciplined.
 */
function lift(
  id: SignalId,
  params: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const num = (k: string) => {
    const v = params[k];
    if (typeof v === "number" && isFinite(v)) out[k] = v;
    else if (typeof v === "string") {
      const n = Number(v);
      if (isFinite(n)) out[k] = n;
    }
  };
  switch (id) {
    case "lexical":
      num("fuzzy_ceiling");
      break;
    case "value":
      num("edge_tolerance");
      break;
    case "ref_range":
      num("tolerance");
      break;
    case "longitudinal":
      num("min_history");
      break;
    case "unit":
    case "method":
    case "panel":
      // No recognised optional params today.
      break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Concept-override loader.
//
// Returns null when no row exists or the row has been lifted. The edge
// function decides what to do with a present override (typically: force
// the admission decision through needs_review under
// calibration_all_routes_to_review policy).
// ---------------------------------------------------------------------------

async function loadConceptOverride(
  client: ReadOnlyDbClient,
  engineVersionId: string,
  candidateConceptId: string,
): Promise<EngineBinding["concept_override"]> {
  const { data, error } = await client
    .from("rae_engine_concept_overrides")
    .select("engine_version_id, candidate_concept_id, lifted, reason")
    .eq("engine_version_id", engineVersionId)
    .eq("candidate_concept_id", candidateConceptId)
    .is("lifted", false)
    .maybeSingle() as DbResponse<RaeEngineConceptOverrideRow>;

  if (error) {
    // Override-table read errors are surfaced as RegistryGapError so the
    // caller cannot silently proceed with an unknown override state.
    throw new RegistryGapError(
      `rae_engine_concept_overrides read failed for ${engineVersionId}/${candidateConceptId}: ${error.message}`,
    );
  }
  if (!data) return null;

  return {
    engine_version_id: data.engine_version_id,
    candidate_concept_id: data.candidate_concept_id,
    reason: data.reason ?? null,
  };
}

// ---------------------------------------------------------------------------
// Witness-signal-registry loader.
//
// RAE is a decision layer over existing biological witnesses; it does NOT
// own a witness ontology. The four witness ontology fields
// (source_window, domain_of_access, epistemic_role, reliability_class) for
// the depth-0 RAE admission witness must come from the same
// witness_signal_registry P1a witnessify-observations uses.
//
// Lookup key is (source_window, signal, registry_seed_version). The caller
// derives source_window + signal from the source observation (e.g.
// patient_lab_observations + ontology concept).
//
// On miss: RegistryGapError with the same shape used everywhere else in
// this module. Never falls back to lab defaults; never invents enum values.
// ---------------------------------------------------------------------------

export interface RegistryWitnessFields {
  source_window: string;
  signal: string;
  domain_of_access: string;
  epistemic_role: string;
  reliability_class: string;
  compression_depth: number;
  registry_seed_version: string;
}

export interface LoadRegistryWitnessFieldsInput {
  source_window: string;
  signal: string;
  registry_seed_version: string;
}

export async function loadRegistryWitnessFields(
  client: ReadOnlyDbClient,
  input: LoadRegistryWitnessFieldsInput,
): Promise<RegistryWitnessFields> {
  if (!input || !input.source_window || !input.signal || !input.registry_seed_version) {
    throw new RegistryGapError(
      "loadRegistryWitnessFields: source_window, signal, and registry_seed_version are required",
    );
  }

  const { data, error } = await client
    .from("witness_signal_registry")
    .select(
      "source_window, signal, domain_of_access, epistemic_role, reliability_class, compression_depth, registry_seed_version",
    )
    .eq("source_window", input.source_window)
    .eq("signal", input.signal)
    .eq("registry_seed_version", input.registry_seed_version)
    .maybeSingle() as DbResponse<WitnessSignalRegistryRow>;

  if (error) {
    throw new RegistryGapError(
      `witness_signal_registry read failed for ${input.source_window}:${input.signal} ` +
        `(seed=${input.registry_seed_version}): ${error.message}`,
    );
  }
  if (!data) {
    throw new RegistryGapError(
      `witness_signal_registry has no row for source_window=${input.source_window}, ` +
        `signal=${input.signal}, registry_seed_version=${input.registry_seed_version}. ` +
        `RAE will not invent ontology fields; seed the registry row before admitting this concept.`,
    );
  }

  return {
    source_window: data.source_window,
    signal: data.signal,
    domain_of_access: data.domain_of_access,
    epistemic_role: data.epistemic_role,
    reliability_class: data.reliability_class,
    compression_depth: data.compression_depth,
    registry_seed_version: data.registry_seed_version,
  };
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function toFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (isFinite(n)) return n;
  }
  return null;
}
