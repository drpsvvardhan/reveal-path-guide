// ============================================================================
// supabase/functions/_shared/rae/storage/admit.integration.fixtures.ts
// ----------------------------------------------------------------------------
// Minimal seed required by the SQL-layer integration tests.
//
// SCOPE:
//   - Only what tests in admit.integration.test.ts need.
//   - Does NOT seed the full P1A registry. The harness applies the
//     'p1a_initial' seed migration independently; this fixture uses
//     registry_seed_version='seed_test_v1' to stay orthogonal.
//
// All inserts ride the caller's transaction; nothing here COMMITs.
// Tests own their own ROLLBACK.
// ============================================================================

import type {
  Client,
  Transaction,
} from "https://deno.land/x/postgres@v0.19.3/mod.ts";

/** Anything that can issue parameterized queries — Client or Transaction. */
export interface SqlExecutor {
  queryObject<T>(query: string, args?: unknown[]): Promise<{ rows: T[] }>;
  queryArray(query: string, args?: unknown[]): Promise<{ rows: unknown[][] }>;
}

export const FIXED_USER_ID = "11111111-1111-4111-8111-111111111111";
export const FIXED_PROFILE_ID = "22222222-2222-4222-8222-222222222222";

export const ENGINE_VERSION_PROD_ID = "33333333-3333-4333-8333-333333333333";
export const ENGINE_VERSION_CALIB_ID = "44444444-4444-4444-8444-444444444444";

export const TEST_REGISTRY_SEED_VERSION = "seed_test_v1";
export const TEST_ONTOLOGY_VERSION = "ontology_test_v1";
export const TEST_SEMVER_PROD = "rae_test_v1";
export const TEST_SEMVER_CALIB = "rae_test_v1_calibration";

export const SEVEN_SIGNAL_IDS = [
  "lexical",
  "unit",
  "value",
  "method",
  "ref_range",
  "panel",
  "longitudinal",
] as const;

/**
 * Seed the minimal fixture set inside the caller's transaction.
 * Uses ON CONFLICT DO NOTHING so it is safe to call once per test
 * (the rows live only for the duration of the surrounding transaction
 * and disappear on ROLLBACK).
 */
export async function seedIntegrationFixtures(sql: SqlExecutor): Promise<void> {
  // 1. auth.users row.
  await sql.queryArray(
    `INSERT INTO auth.users (id, email)
     VALUES ($1, 'rae-integration@test.local')
     ON CONFLICT (id) DO NOTHING`,
    [FIXED_USER_ID],
  );

  // 2. profiles row tied to that user.
  await sql.queryArray(
    `INSERT INTO public.profiles (id, user_id, display_name)
     VALUES ($1, $2, 'rae-integration')
     ON CONFLICT (user_id) DO NOTHING`,
    [FIXED_PROFILE_ID, FIXED_USER_ID],
  );

  // 3. Production engine version (calibration_mode = false).
  await sql.queryArray(
    `INSERT INTO public.rae_engine_versions
       (id, semver, registry_seed_version, ontology_version,
        threshold_admission, threshold_rejection_floor, calibration_mode)
     VALUES ($1, $2, $3, $4, 0.85, 0.40, false)
     ON CONFLICT (semver) DO NOTHING`,
    [
      ENGINE_VERSION_PROD_ID,
      TEST_SEMVER_PROD,
      TEST_REGISTRY_SEED_VERSION,
      TEST_ONTOLOGY_VERSION,
    ],
  );

  // 4. Calibration engine version (calibration_mode = true).
  await sql.queryArray(
    `INSERT INTO public.rae_engine_versions
       (id, semver, registry_seed_version, ontology_version,
        threshold_admission, threshold_rejection_floor, calibration_mode)
     VALUES ($1, $2, $3, $4, 0.85, 0.40, true)
     ON CONFLICT (semver) DO NOTHING`,
    [
      ENGINE_VERSION_CALIB_ID,
      TEST_SEMVER_CALIB,
      TEST_REGISTRY_SEED_VERSION,
      TEST_ONTOLOGY_VERSION,
    ],
  );

  // 5. All seven rae_signal_config rows for the production engine,
  //    weight = 1.0, wildcard candidate_concept_id.
  for (const signalId of SEVEN_SIGNAL_IDS) {
    await sql.queryArray(
      `INSERT INTO public.rae_signal_config
         (engine_version_id, candidate_concept_id, signal_id, weight)
       VALUES ($1, '*', $2, 1.0)
       ON CONFLICT (engine_version_id, candidate_concept_id, signal_id) DO NOTHING`,
      [ENGINE_VERSION_PROD_ID, signalId],
    );
  }

  // 6. One witness_signal_registry row for the HbA1c lab case using
  //    valid P1A enums. PK is (source_window, signal); use a
  //    test-reserved signal name so we never collide with the
  //    'p1a_initial' seed.
  await sql.queryArray(
    `INSERT INTO public.witness_signal_registry
       (source_window, signal, domain_of_access, epistemic_role,
        reliability_class, label, default_limitations,
        default_confidence_basis, default_confidence_value,
        compression_depth, ontology_version, registry_seed_version)
     VALUES (
       'lab'::public.witness_source_window,
       'lab.rae_test_hba1c',
       'biochemical_state_snapshot'::public.witness_domain_of_access,
       'direct_measure'::public.witness_epistemic_role,
       'high'::public.witness_reliability_class,
       'HbA1c (rae integration test fixture)',
       ARRAY['integration test fixture'],
       'integration test fixture seeded for the rae harness',
       0.95,
       0,
       $1,
       $2
     )
     ON CONFLICT (source_window, signal) DO NOTHING`,
    [TEST_ONTOLOGY_VERSION, TEST_REGISTRY_SEED_VERSION],
  );
}

/**
 * Build a fully-formed depth-0 witness payload matching the
 * rae_insert_witness_object jsonb contract. Pure: no I/O.
 */
export interface BuildWitnessPayloadOpts {
  witnessId: string;
  userId: string;
  sourceTable: string;
  sourceRowId: string;
  /** Override source_window for negative tests (e.g. invalid enum). */
  sourceWindow?: string;
  signal?: string;
  domainOfAccess?: string;
  epistemicRole?: string;
  reliabilityClass?: string;
  observedValue?: unknown;
  observedUnit?: string;
  registrySeedVersion?: string;
}

export function buildDepth0WitnessPayload(
  opts: BuildWitnessPayloadOpts,
): Record<string, unknown> {
  return {
    witness_id: opts.witnessId,
    user_id: opts.userId,
    source_table: opts.sourceTable,
    source_row_id: opts.sourceRowId,
    ancestry_witness_ids: [],
    source_window: opts.sourceWindow ?? "lab",
    signal: opts.signal ?? "lab.rae_test_hba1c",
    domain_of_access: opts.domainOfAccess ?? "biochemical_state_snapshot",
    epistemic_role: opts.epistemicRole ?? "direct_measure",
    reliability_class: opts.reliabilityClass ?? "high",
    compression_depth: 0,
    observed_value: opts.observedValue ?? { numeric: 5.6 },
    observed_unit: opts.observedUnit ?? "%",
    testimony:
      "HbA1c integration fixture; depth-0 lab witness for rae harness coverage",
    limitations: ["integration test fixture"],
    confidence_value: 0.95,
    confidence_basis:
      "integration test fixture; deterministic depth-0 lab payload for rae harness",
    biological_timestamp: "2026-01-01T00:00:00Z",
    validity_window_seconds: 86400,
    conflict_candidates: [],
    transformation_version: "rae_integration_test_v1",
    registry_seed_version:
      opts.registrySeedVersion ?? TEST_REGISTRY_SEED_VERSION,
  };
}

/**
 * Build a CAW draft compatible with rae_persist_initial_admission's
 * payload.caw shape.
 */
export interface BuildCawDraftOpts {
  cawId: string;
  userId: string;
  sourceTable: string;
  sourceRowId: string;
  candidateConceptId: string;
  engineVersionId: string;
  currentState:
    | "auto_admitted"
    | "needs_review"
    | "rejected"
    | "human_confirmed";
  compositeIdentityScore: number;
  registrySeedVersion?: string;
  ontologyVersion?: string;
  signalResults?: unknown[];
  coherenceResult?: "pass" | "fail" | "partial" | "abstain";
  confidenceValue?: number;
  confidenceBasis?: string;
  limitations?: string[];
}

export function buildCawDraft(
  opts: BuildCawDraftOpts,
): Record<string, unknown> {
  // signal_results must be a 7-element array per caw_signal_results_seven.
  const sevenResults =
    opts.signalResults ??
    SEVEN_SIGNAL_IDS.map((id) => ({
      signal_id: id,
      score: 0.9,
      contributed: true,
    }));
  return {
    caw_id: opts.cawId,
    user_id: opts.userId,
    source_table: opts.sourceTable,
    source_row_id: opts.sourceRowId,
    candidate_concept_id: opts.candidateConceptId,
    ontology_version: opts.ontologyVersion ?? TEST_ONTOLOGY_VERSION,
    registry_seed_version:
      opts.registrySeedVersion ?? TEST_REGISTRY_SEED_VERSION,
    engine_version_id: opts.engineVersionId,
    signal_results: sevenResults,
    composite_identity_score: opts.compositeIdentityScore,
    coherence_result: opts.coherenceResult ?? "pass",
    confidence_value: opts.confidenceValue ?? 0.95,
    confidence_basis:
      opts.confidenceBasis ??
      "integration test fixture; seven signals all contributed deterministically",
    current_state: opts.currentState,
    current_state_actor_kind: "engine",
    current_state_actor_id: "rae_integration_test",
    limitations: opts.limitations ?? ["integration test fixture"],
    founder_review_flag: false,
  };
}

// Re-export postgres client types so callers can stay decoupled.
export type { Client, Transaction };

/**
 * Seed one rae_engine_concept_overrides row scoped to a given engine
 * version + candidate concept. Used by the D-8 integration test to
 * exercise concept-override-driven CAW limitation persistence.
 * Rides the caller's transaction; ROLLBACK cleans up.
 */
export interface SeedConceptOverrideOpts {
  engineVersionId: string;
  conceptId: string;
  reason: string;
  lifted?: boolean;
}

export async function seedConceptOverride(
  sql: SqlExecutor,
  opts: SeedConceptOverrideOpts,
): Promise<void> {
  await sql.queryArray(
    `INSERT INTO public.rae_engine_concept_overrides
       (engine_version_id, candidate_concept_id, reason, lifted)
     VALUES ($1, $2, $3, $4)`,
    [opts.engineVersionId, opts.conceptId, opts.reason, opts.lifted ?? false],
  );
}
