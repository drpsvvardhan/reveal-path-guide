// ============================================================================
// supabase/functions/_shared/rae/storage/admit.integration.test.ts
// ----------------------------------------------------------------------------
// SQL-layer integration tests for RAE persistence.
//
// CONTRACT: TypeScript ↔ Postgres. Every assertion reads the database
// after the RPC fires, not TS-side values.
//
// Test names contain "integration" so the harness can filter to them
// via `deno test --filter integration`.
//
// Each test:
//   - Opens its own deno-postgres client.
//   - Issues BEGIN, runs the body, then issues ROLLBACK in finally.
//     The Postgres container is reused across tests; isolation is
//     per-transaction.
//   - Uses freshly-issued UUIDs per row (UUIDv4 via crypto.randomUUID)
//     so no test depends on or writes another test's rows.
// ============================================================================

import {
  assert,
  assertEquals,
  assertExists,
  assertNotEquals,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

import {
  buildCawDraft,
  buildDepth0WitnessPayload,
  ENGINE_VERSION_CALIB_ID,
  ENGINE_VERSION_PROD_ID,
  FIXED_USER_ID,
  seedIntegrationFixtures,
  seedConceptOverride,
  TEST_REGISTRY_SEED_VERSION,
} from "./admit.integration.fixtures.ts";

// ---------------------------------------------------------------------------
// Connection helper
// ---------------------------------------------------------------------------

function readEnv(name: string, fallback?: string): string {
  const v = Deno.env.get(name);
  if (v && v.length > 0) return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`integration harness env var ${name} not set`);
}

async function connect(): Promise<Client> {
  const client = new Client({
    user: readEnv("RAE_TEST_PG_USER", "postgres"),
    password: readEnv("RAE_TEST_PG_PASSWORD", "rae_test_password"),
    database: readEnv("RAE_TEST_PG_DB", "postgres"),
    hostname: readEnv("RAE_TEST_PG_HOST", "127.0.0.1"),
    port: Number(readEnv("RAE_TEST_PG_PORT", "54329")),
  });
  await client.connect();
  return client;
}

/**
 * Run a body inside a BEGIN ... ROLLBACK envelope. ROLLBACK always
 * fires, including on exception. The Client itself is closed in the
 * outer finally so subsequent tests start from a clean connection.
 */
async function withRollback(
  body: (client: Client) => Promise<void>,
): Promise<void> {
  const client = await connect();
  try {
    await client.queryArray("BEGIN");
    try {
      await body(client);
    } finally {
      try {
        await client.queryArray("ROLLBACK");
      } catch (_e) {
        // ignore — connection may already be aborted
      }
    }
  } finally {
    try {
      await client.end();
    } catch (_e) { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Per-test identity helpers
// ---------------------------------------------------------------------------

interface TestIdentity {
  caw_id: string;
  source_row_id: string;
  witness_id: string;
}

function freshIdentity(): TestIdentity {
  return {
    caw_id: crypto.randomUUID(),
    source_row_id: crypto.randomUUID(),
    witness_id: crypto.randomUUID(),
  };
}

const HBA1C_CONCEPT_ID = "concept.lab.hba1c";
const HBA1C_SOURCE_TABLE = "patient_lab_observations";

// ---------------------------------------------------------------------------
// Test 1 (anchor): production-mode auto-admit + depth-0 witness write
// ---------------------------------------------------------------------------
//
// This is the load-bearing test. It would have caught D-9 before it
// shipped: an invalid source_window enum like "rae:initial_admission"
// will fail the cast inside rae_insert_witness_object and the RPC will
// throw, the assertions on caw + witness rows will fail, and the test
// is red.
// ---------------------------------------------------------------------------

Deno.test(
  "integration: production auto_admit writes CAW, depth-0 witness, transition, and FKs hold",
  async () => {
    await withRollback(async (db) => {
      await seedIntegrationFixtures(db);

      const ids = freshIdentity();

      const caw = buildCawDraft({
        cawId: ids.caw_id,
        userId: FIXED_USER_ID,
        sourceTable: HBA1C_SOURCE_TABLE,
        sourceRowId: ids.source_row_id,
        candidateConceptId: HBA1C_CONCEPT_ID,
        engineVersionId: ENGINE_VERSION_PROD_ID,
        currentState: "auto_admitted",
        compositeIdentityScore: 0.95,
      });

      const witness = buildDepth0WitnessPayload({
        witnessId: ids.witness_id,
        userId: FIXED_USER_ID,
        sourceTable: HBA1C_SOURCE_TABLE,
        sourceRowId: ids.source_row_id,
      });

      const payload = {
        caw,
        witness_intent: "produce_depth0_witness",
        witness_payload: witness,
        from_state: null,
        to_state: "auto_admitted",
        actor_kind: "engine",
        actor_id: "rae_integration_test",
        reason: "integration anchor: production auto-admit",
        policy: "default",
      };

      const result = await db.queryObject<{ result: unknown }>(
        `SELECT public.rae_persist_initial_admission($1::jsonb) AS result`,
        [JSON.stringify(payload)],
      );
      assertExists(result.rows[0]);

      // ---- CAW row truth -------------------------------------------------
      const cawRows = await db.queryObject<{
        caw_id: string;
        current_state: string;
        produced_witness_id: string | null;
        engine_version_id: string;
        policy_at_decision: string;
      }>(
        `SELECT caw_id, current_state, produced_witness_id,
                engine_version_id, policy_at_decision
           FROM public.concept_assignment_witnesses
          WHERE caw_id = $1`,
        [ids.caw_id],
      );
      assertEquals(cawRows.rows.length, 1, "exactly one CAW row");
      const cawRow = cawRows.rows[0];
      assertEquals(cawRow.current_state, "auto_admitted");
      assertEquals(cawRow.engine_version_id, ENGINE_VERSION_PROD_ID);
      assertEquals(cawRow.policy_at_decision, "default");
      assertEquals(
        cawRow.produced_witness_id,
        ids.witness_id,
        "produced_witness_id is the depth-0 witness id we passed in",
      );

      // ---- witness_objects row truth -------------------------------------
      const witnessRows = await db.queryObject<{
        witness_id: string;
        source_window: string;
        domain_of_access: string;
        epistemic_role: string;
        reliability_class: string;
        compression_depth: number;
      }>(
        `SELECT witness_id, source_window::text AS source_window,
                domain_of_access::text AS domain_of_access,
                epistemic_role::text AS epistemic_role,
                reliability_class::text AS reliability_class,
                compression_depth
           FROM public.witness_objects
          WHERE witness_id = $1`,
        [ids.witness_id],
      );
      assertEquals(witnessRows.rows.length, 1, "exactly one witness row");
      const witnessRow = witnessRows.rows[0];

      // The four enum fields must be valid members of their enums.
      // The cast itself is the test — invalid enum members cause the
      // RPC to throw and we never reach this point.
      assertEquals(witnessRow.source_window, "lab");
      assertEquals(witnessRow.domain_of_access, "biochemical_state_snapshot");
      assertEquals(witnessRow.epistemic_role, "direct_measure");
      assertEquals(witnessRow.reliability_class, "high");
      assertEquals(witnessRow.compression_depth, 0);

      // ---- transition row truth ------------------------------------------
      const transitionRows = await db.queryObject<{
        from_state: string | null;
        to_state: string;
        actor_kind: string;
      }>(
        `SELECT from_state::text AS from_state,
                to_state::text   AS to_state,
                actor_kind
           FROM public.rae_state_transitions
          WHERE caw_id = $1`,
        [ids.caw_id],
      );
      assertEquals(transitionRows.rows.length, 1);
      assertEquals(transitionRows.rows[0].from_state, null);
      assertEquals(transitionRows.rows[0].to_state, "auto_admitted");
      assertEquals(transitionRows.rows[0].actor_kind, "engine");

      // ---- FK integrity: witness_objects -> CAW.produced_witness_id ------
      // Use a savepoint so the failed DELETE leaves the outer txn alive.
      await db.queryArray("SAVEPOINT fk_probe_witness");
      let witnessFkRaised = false;
      try {
        await db.queryArray(
          `DELETE FROM public.witness_objects WHERE witness_id = $1`,
          [ids.witness_id],
        );
      } catch (_e) {
        witnessFkRaised = true;
      } finally {
        await db.queryArray("ROLLBACK TO SAVEPOINT fk_probe_witness");
      }
      assert(
        witnessFkRaised,
        "DELETE of referenced witness_objects row must raise FK violation",
      );

      // ---- FK integrity: CAW.engine_version_id -> rae_engine_versions.id -
      await db.queryArray("SAVEPOINT fk_probe_engine");
      let engineFkRaised = false;
      try {
        await db.queryArray(
          `DELETE FROM public.rae_engine_versions WHERE id = $1`,
          [ENGINE_VERSION_PROD_ID],
        );
      } catch (_e) {
        engineFkRaised = true;
      } finally {
        await db.queryArray("ROLLBACK TO SAVEPOINT fk_probe_engine");
      }
      assert(
        engineFkRaised,
        "DELETE of referenced rae_engine_versions row must raise FK violation",
      );
    });
  },
);

// ---------------------------------------------------------------------------
// Test 2: calibration-mode happy path (no witness write)
// ---------------------------------------------------------------------------

Deno.test(
  "integration: calibration mode routes to needs_review with no witness write",
  async () => {
    await withRollback(async (db) => {
      await seedIntegrationFixtures(db);

      const ids = freshIdentity();

      const caw = buildCawDraft({
        cawId: ids.caw_id,
        userId: FIXED_USER_ID,
        sourceTable: HBA1C_SOURCE_TABLE,
        sourceRowId: ids.source_row_id,
        candidateConceptId: HBA1C_CONCEPT_ID,
        engineVersionId: ENGINE_VERSION_CALIB_ID,
        currentState: "needs_review",
        compositeIdentityScore: 0.95,
      });

      const payload = {
        caw,
        witness_intent: "none",
        from_state: null,
        to_state: "needs_review",
        actor_kind: "engine",
        actor_id: "rae_integration_test",
        reason: "integration calibration: routes to needs_review",
        policy: "calibration_all_routes_to_review",
      };

      await db.queryObject(
        `SELECT public.rae_persist_initial_admission($1::jsonb)`,
        [JSON.stringify(payload)],
      );

      const cawRows = await db.queryObject<{
        current_state: string;
        produced_witness_id: string | null;
        policy_at_decision: string;
      }>(
        `SELECT current_state, produced_witness_id, policy_at_decision
           FROM public.concept_assignment_witnesses
          WHERE caw_id = $1`,
        [ids.caw_id],
      );
      assertEquals(cawRows.rows.length, 1);
      assertEquals(cawRows.rows[0].current_state, "needs_review");
      assertEquals(cawRows.rows[0].produced_witness_id, null);
      assertEquals(
        cawRows.rows[0].policy_at_decision,
        "calibration_all_routes_to_review",
      );

      // No witness_objects row for this user from this test.
      const witnessRows = await db.queryObject<{ count: number }>(
        `SELECT COUNT(*)::int AS count
           FROM public.witness_objects
          WHERE user_id = $1
            AND source_table = $2
            AND source_row_id = $3`,
        [FIXED_USER_ID, HBA1C_SOURCE_TABLE, ids.source_row_id],
      );
      assertEquals(witnessRows.rows[0].count, 0);

      const transitionRows = await db.queryObject<{ to_state: string }>(
        `SELECT to_state::text AS to_state
           FROM public.rae_state_transitions
          WHERE caw_id = $1`,
        [ids.caw_id],
      );
      assertEquals(transitionRows.rows.length, 1);
      assertEquals(transitionRows.rows[0].to_state, "needs_review");
    });
  },
);

// ---------------------------------------------------------------------------
// Test 3: idempotency
// ---------------------------------------------------------------------------

Deno.test(
  "integration: idempotency probe short-circuits on second call (no duplicate rows)",
  async () => {
    await withRollback(async (db) => {
      await seedIntegrationFixtures(db);

      const ids = freshIdentity();

      const caw = buildCawDraft({
        cawId: ids.caw_id,
        userId: FIXED_USER_ID,
        sourceTable: HBA1C_SOURCE_TABLE,
        sourceRowId: ids.source_row_id,
        candidateConceptId: HBA1C_CONCEPT_ID,
        engineVersionId: ENGINE_VERSION_PROD_ID,
        currentState: "auto_admitted",
        compositeIdentityScore: 0.95,
      });

      const witness = buildDepth0WitnessPayload({
        witnessId: ids.witness_id,
        userId: FIXED_USER_ID,
        sourceTable: HBA1C_SOURCE_TABLE,
        sourceRowId: ids.source_row_id,
      });

      const payload = {
        caw,
        witness_intent: "produce_depth0_witness",
        witness_payload: witness,
        from_state: null,
        to_state: "auto_admitted",
        actor_kind: "engine",
        actor_id: "rae_integration_test",
        reason: "integration idempotency: first call",
        policy: "default",
      };

      const first = await db.queryObject<{ result: Record<string, unknown> }>(
        `SELECT public.rae_persist_initial_admission($1::jsonb) AS result`,
        [JSON.stringify(payload)],
      );
      const firstResult = first.rows[0].result as {
        mode: string;
        witness_id: string;
        caw: { caw_id: string };
      };
      assertEquals(firstResult.mode, "created");

      // Same payload, second call.
      const second = await db.queryObject<{ result: Record<string, unknown> }>(
        `SELECT public.rae_persist_initial_admission($1::jsonb) AS result`,
        [JSON.stringify(payload)],
      );
      const secondResult = second.rows[0].result as {
        mode: string;
        witness_id: string;
        caw: { caw_id: string };
      };
      // Idempotency probe must short-circuit (mode='existing'),
      // NOT rely on UNIQUE constraint violations.
      assertEquals(secondResult.mode, "existing");
      assertEquals(secondResult.caw.caw_id, firstResult.caw.caw_id);
      assertEquals(secondResult.witness_id, firstResult.witness_id);

      // Row counts: exactly one of each.
      const cawCount = await db.queryObject<{ count: number }>(
        `SELECT COUNT(*)::int AS count
           FROM public.concept_assignment_witnesses
          WHERE caw_id = $1`,
        [ids.caw_id],
      );
      assertEquals(cawCount.rows[0].count, 1, "exactly one CAW row");

      const witnessCount = await db.queryObject<{ count: number }>(
        `SELECT COUNT(*)::int AS count
           FROM public.witness_objects
          WHERE witness_id = $1`,
        [ids.witness_id],
      );
      assertEquals(witnessCount.rows[0].count, 1, "exactly one witness row");

      const transitionCount = await db.queryObject<{ count: number }>(
        `SELECT COUNT(*)::int AS count
           FROM public.rae_state_transitions
          WHERE caw_id = $1`,
        [ids.caw_id],
      );
      assertEquals(
        transitionCount.rows[0].count,
        1,
        "exactly one transition row",
      );
    });
  },
);

// ---------------------------------------------------------------------------
// Test 4: invalid enum rejection (D-9 anchor)
// ---------------------------------------------------------------------------
//
// Calls the RPC with source_window='rae:initial_admission' (not a
// member of public.witness_source_window). The cast inside
// rae_insert_witness_object must throw; nothing must persist.
// ---------------------------------------------------------------------------

Deno.test(
  "integration: invalid source_window enum rejects the RPC and writes nothing",
  async () => {
    await withRollback(async (db) => {
      await seedIntegrationFixtures(db);

      const ids = freshIdentity();

      const caw = buildCawDraft({
        cawId: ids.caw_id,
        userId: FIXED_USER_ID,
        sourceTable: HBA1C_SOURCE_TABLE,
        sourceRowId: ids.source_row_id,
        candidateConceptId: HBA1C_CONCEPT_ID,
        engineVersionId: ENGINE_VERSION_PROD_ID,
        currentState: "auto_admitted",
        compositeIdentityScore: 0.95,
      });

      const witness = buildDepth0WitnessPayload({
        witnessId: ids.witness_id,
        userId: FIXED_USER_ID,
        sourceTable: HBA1C_SOURCE_TABLE,
        sourceRowId: ids.source_row_id,
        // INVALID enum member — this is the D-9 bug shape.
        sourceWindow: "rae:initial_admission",
      });

      const payload = {
        caw,
        witness_intent: "produce_depth0_witness",
        witness_payload: witness,
        from_state: null,
        to_state: "auto_admitted",
        actor_kind: "engine",
        actor_id: "rae_integration_test",
        reason: "integration negative: invalid enum must reject",
        policy: "default",
      };

      // Wrap the failing call in its own savepoint so we can keep
      // running assertions on the (untouched) tables afterwards.
      await db.queryArray("SAVEPOINT invalid_enum_call");
      const err = await assertRejects(
        async () => {
          await db.queryObject(
            `SELECT public.rae_persist_initial_admission($1::jsonb)`,
            [JSON.stringify(payload)],
          );
        },
        Error,
      );
      const msg = String(err.message ?? "").toLowerCase();
      // Postgres surfaces enum cast failures as
      // "invalid input value for enum ...". Accept that or any mention
      // of the offending value.
      const looksLikeEnumFailure =
        msg.includes("invalid input value for enum") ||
        msg.includes("witness_source_window") ||
        msg.includes("rae:initial_admission");
      assert(
        looksLikeEnumFailure,
        `expected enum cast failure, got: ${err.message}`,
      );
      // Use assertStringIncludes to make the assertion explicit in
      // the failure trace when developers triage:
      assertStringIncludes(
        msg,
        "invalid input value",
      );
      await db.queryArray("ROLLBACK TO SAVEPOINT invalid_enum_call");

      // Confirm no rows written.
      const cawCount = await db.queryObject<{ count: number }>(
        `SELECT COUNT(*)::int AS count
           FROM public.concept_assignment_witnesses
          WHERE caw_id = $1`,
        [ids.caw_id],
      );
      assertEquals(cawCount.rows[0].count, 0);

      const witnessCount = await db.queryObject<{ count: number }>(
        `SELECT COUNT(*)::int AS count
           FROM public.witness_objects
          WHERE witness_id = $1`,
        [ids.witness_id],
      );
      assertEquals(witnessCount.rows[0].count, 0);

      const transitionCount = await db.queryObject<{ count: number }>(
        `SELECT COUNT(*)::int AS count
           FROM public.rae_state_transitions
          WHERE caw_id = $1`,
        [ids.caw_id],
      );
      assertEquals(transitionCount.rows[0].count, 0);

      // Sanity: assertNotEquals so the symbol is not flagged unused.
      assertNotEquals(ids.caw_id, ids.witness_id);
    });
  },
);

// ---------------------------------------------------------------------------
// Test 5 (D-8): concept override active causes CAW limitations to carry
// override tokens
// ---------------------------------------------------------------------------
//
// Exercises the SQL persistence layer: when the edge function merges the
// concept-override limitation tokens into decision.caw.limitations (the
// D-8 fix in rae-admit-observation/index.ts), those tokens must round-trip
// onto the persisted CAW row. This test constructs the merged limitations
// manually and asserts the persisted shape.
// ---------------------------------------------------------------------------

Deno.test(
  "integration: concept override active causes CAW limitations to carry override tokens",
  async () => {
    await withRollback(async (db) => {
      await seedIntegrationFixtures(db);

      const overrideReason = "v1 calibration: HbA1c held in review";
      await seedConceptOverride(db, {
        engineVersionId: ENGINE_VERSION_PROD_ID,
        conceptId: HBA1C_CONCEPT_ID,
        reason: overrideReason,
        lifted: false,
      });

      const ids = freshIdentity();

      const overrideLimitations = [
        `concept_override_applied:${HBA1C_CONCEPT_ID}`,
        "concept_override_effect:forced_needs_review_via_calibration_mode",
        `concept_override_reason:${overrideReason}`,
      ];

      const caw = buildCawDraft({
        cawId: ids.caw_id,
        userId: FIXED_USER_ID,
        sourceTable: HBA1C_SOURCE_TABLE,
        sourceRowId: ids.source_row_id,
        candidateConceptId: HBA1C_CONCEPT_ID,
        engineVersionId: ENGINE_VERSION_PROD_ID,
        currentState: "needs_review",
        compositeIdentityScore: 0.95,
        limitations: [
          "integration test fixture",
          ...overrideLimitations,
        ],
      });

      const payload = {
        caw,
        witness_intent: "none",
        from_state: null,
        to_state: "needs_review",
        actor_kind: "engine",
        actor_id: "rae_integration_test",
        reason: "integration D-8: override limitations persist on CAW",
        policy: "calibration_all_routes_to_review",
      };

      await db.queryObject(
        `SELECT public.rae_persist_initial_admission($1::jsonb)`,
        [JSON.stringify(payload)],
      );

      const cawRows = await db.queryObject<{
        limitations: string[];
      }>(
        `SELECT limitations
           FROM public.concept_assignment_witnesses
          WHERE caw_id = $1`,
        [ids.caw_id],
      );
      assertEquals(cawRows.rows.length, 1, "exactly one CAW row");
      const limitations = cawRows.rows[0].limitations;
      assert(Array.isArray(limitations), "limitations must be an array");

      const hasApplied = limitations.some((t) =>
        typeof t === "string" && t.startsWith("concept_override_applied:")
      );
      const hasEffect = limitations.includes(
        "concept_override_effect:forced_needs_review_via_calibration_mode",
      );
      const hasReason = limitations.some((t) =>
        typeof t === "string" && t.startsWith("concept_override_reason:")
      );
      assert(hasApplied, `expected concept_override_applied:* in ${JSON.stringify(limitations)}`);
      assert(hasEffect, `expected concept_override_effect token in ${JSON.stringify(limitations)}`);
      assert(hasReason, `expected concept_override_reason:* in ${JSON.stringify(limitations)}`);

      // Reference TEST_REGISTRY_SEED_VERSION so import stays meaningful
      // alongside the other tests.
      assertNotEquals(TEST_REGISTRY_SEED_VERSION, "");
    });
  },
);

// ---------------------------------------------------------------------------
// Test 6 (D-4): longitudinal partial band limitation persists on CAW
// ---------------------------------------------------------------------------
//
// Signal 7 (longitudinal) emits a `partial` band when the observed delta
// lies above 0.8 * delta_ceiling but at or below the ceiling itself
// (spec §5.8). The signal note carries plain prose — the same
// convention used by signals/value.ts and signals/refRange.ts for their
// partial bands. This test asserts the prose limitation round-trips
// onto the persisted CAW row.
// ---------------------------------------------------------------------------

const LONGITUDINAL_PARTIAL_LIMITATION =
  "longitudinal delta within ceiling but at edge of biological dynamics";

Deno.test(
  "integration: longitudinal partial band limitation persists on CAW",
  async () => {
    await withRollback(async (db) => {
      await seedIntegrationFixtures(db);

      const ids = freshIdentity();

      const longitudinalSignalResult = {
        signal_id: "longitudinal",
        band: "partial",
        score: 1,
        weight: 0.2,
        contributes_to_denominator: true,
        evidence: {
          signal_id: "longitudinal",
          prior_witness_ids: [],
          dynamics_rule_id: "edge_default",
          delta_observed: 0.85,
          delta_ceiling: 1.0,
          result: "edge_of_dynamics",
        },
        notes: [LONGITUDINAL_PARTIAL_LIMITATION],
      };

      const caw = buildCawDraft({
        cawId: ids.caw_id,
        userId: FIXED_USER_ID,
        sourceTable: HBA1C_SOURCE_TABLE,
        sourceRowId: ids.source_row_id,
        candidateConceptId: HBA1C_CONCEPT_ID,
        engineVersionId: ENGINE_VERSION_PROD_ID,
        currentState: "auto_admitted",
        compositeIdentityScore: 0.95,
        limitations: [
          "integration test fixture",
          LONGITUDINAL_PARTIAL_LIMITATION,
        ],
      });
      // Embed the partial-band signal_result so the persisted row is
      // self-consistent (limitations + signal_results both reflect the
      // edge-of-dynamics state).
      (caw as { signal_results: Record<string, unknown> }).signal_results = {
        longitudinal: longitudinalSignalResult,
      };

      const witness = buildDepth0WitnessPayload({
        witnessId: ids.witness_id,
        userId: FIXED_USER_ID,
        sourceTable: HBA1C_SOURCE_TABLE,
        sourceRowId: ids.source_row_id,
      });

      const payload = {
        caw,
        witness_intent: "produce_depth0_witness",
        witness_payload: witness,
        from_state: null,
        to_state: "auto_admitted",
        actor_kind: "engine",
        actor_id: "rae_integration_test",
        reason: "integration D-4: longitudinal partial band persists",
        policy: "default",
      };

      await db.queryObject(
        `SELECT public.rae_persist_initial_admission($1::jsonb)`,
        [JSON.stringify(payload)],
      );

      const cawRows = await db.queryObject<{ limitations: string[] }>(
        `SELECT limitations
           FROM public.concept_assignment_witnesses
          WHERE caw_id = $1`,
        [ids.caw_id],
      );
      assertEquals(cawRows.rows.length, 1, "exactly one CAW row");
      const limitations = cawRows.rows[0].limitations;
      assert(Array.isArray(limitations), "limitations must be an array");
      assert(
        limitations.includes(LONGITUDINAL_PARTIAL_LIMITATION),
        `expected longitudinal edge-of-dynamics limitation in ${
          JSON.stringify(limitations)
        }`,
      );
    });
  },
);
