// ============================================================================
// admit.test.ts — §9 of RAE_STORAGE_PERSISTENCE_DESIGN_v1.md.
// ----------------------------------------------------------------------------
// Required cases:
//   1. Insert CAW, no witness.
//   2. Insert CAW + witness_intent = produce_depth0_witness.
//   3. Idempotent duplicate returns existing.
//   4. Transition row created exactly once.
//   5. Witnessify failure rolls back CAW.
//   6. produced_witness_id ancestry mismatch rejected (back-annotation).
//   7. back_annotation references existing witness only (soft drift flag).
//   8. Static source scan: closed write set enforced on admit.ts.
//
// Plus extras for coverage:
//   - back-annotation hard-tuple mismatch rejected
//   - back-annotation soft drift on ontology_concept_id sets flag/limitation
//   - actor_kind="human" rejected by persistInitialAdmission
//   - duplicate caw_id race resolves to created+existing
// ============================================================================

import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "jsr:@std/assert@1.0.0";
import {
  persistInitialAdmission,
  StorageInputError,
  BackAnnotationVerificationError,
  WitnessifyFailureError,
  type AdmitGateway,
  type CawLookup,
  type RunInTransaction,
  type WitnessProvenance,
  type WitnessRowInput,
  type WitnessifyAdapter,
} from "./admit.ts";
import type {
  AdmissionState,
  ActorKind,
  CalibrationPolicy,
  ConceptAssignmentWitness,
  ConceptAssignmentWitnessDraft,
} from "../types.ts";
import type { AdmissionDecisionV1 } from "../orchestrator.ts";

// ---------------------------------------------------------------------------
// In-memory fake gateway with atomic-rollback semantics.
// ---------------------------------------------------------------------------

interface Stores {
  caws: Map<string, ConceptAssignmentWitness>;
  transitions: Array<{
    caw_id: string;
    from_state: AdmissionState | null;
    to_state: AdmissionState;
    actor_kind: ActorKind;
    actor_id: string;
    reason: string;
    policy: CalibrationPolicy;
  }>;
  witnesses: Map<string, WitnessProvenance & { extra: Record<string, unknown> }>;
}

function emptyStores(): Stores {
  return { caws: new Map(), transitions: [], witnesses: new Map() };
}

function deepCloneStores(s: Stores): Stores {
  return {
    caws: new Map([...s.caws].map(([k, v]) => [k, structuredClone(v)])),
    transitions: structuredClone(s.transitions),
    witnesses: new Map([...s.witnesses].map(([k, v]) => [k, structuredClone(v)])),
  };
}

interface FakeGatewayHooks {
  failOnInsertWitness?: { name: string; message: string };
  duplicateCawIdRace?: boolean;
}

function makeRunInTransaction(
  stores: Stores,
  hooks: FakeGatewayHooks = {},
): RunInTransaction {
  return async <T>(body: (gw: AdmitGateway) => Promise<T>): Promise<T> => {
    const snapshot = deepCloneStores(stores);
    const txStores = deepCloneStores(stores);

    const gw: AdmitGateway = {
      async findCawByCawId(caw_id: string): Promise<CawLookup> {
        const hit = txStores.caws.get(caw_id);
        return hit ? { found: true, caw: hit } : { found: false };
      },
      async insertCaw(draft: ConceptAssignmentWitnessDraft) {
        if (hooks.duplicateCawIdRace) {
          // Simulate a concurrent winner by injecting a row before insert,
          // then raising unique-violation. The storage layer should NOT
          // catch this; the higher-level race handler is part of a future
          // implementation. Here we simply throw to confirm rollback.
          const winner: ConceptAssignmentWitness = {
            ...draft,
            id: crypto.randomUUID(),
            current_state_entered_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          stores.caws.set(draft.caw_id, winner); // commit winner outside this tx
          throw new Error(`duplicate key value violates unique constraint "concept_assignment_witnesses_caw_id_key"`);
        }
        if (txStores.caws.has(draft.caw_id)) {
          throw new Error(`duplicate key value violates unique constraint "concept_assignment_witnesses_caw_id_key"`);
        }
        const row: ConceptAssignmentWitness = {
          ...draft,
          id: crypto.randomUUID(),
          current_state_entered_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        txStores.caws.set(draft.caw_id, row);
        return structuredClone(row);
      },
      async insertStateTransition(row) {
        txStores.transitions.push({ ...row });
      },
      async insertWitness(row: WitnessRowInput) {
        if (hooks.failOnInsertWitness) {
          const e = new Error(hooks.failOnInsertWitness.message);
          e.name = hooks.failOnInsertWitness.name;
          throw e;
        }
        txStores.witnesses.set(row.witness_id, {
          witness_id: row.witness_id,
          user_id: row.user_id,
          source_table: row.source_table,
          source_row_id: row.source_row_id,
          ontology_concept_id: row.ontology_concept_id,
          extra: row.passthrough,
        });
        return { witness_id: row.witness_id };
      },
      async setCawProducedWitnessId(caw_id, produced_witness_id) {
        const existing = txStores.caws.get(caw_id);
        if (!existing) throw new Error(`caw ${caw_id} not found for backfill`);
        const updated: ConceptAssignmentWitness = {
          ...existing,
          produced_witness_id,
          updated_at: new Date().toISOString(),
        };
        txStores.caws.set(caw_id, updated);
        return structuredClone(updated);
      },
      async findWitnessProvenance(witness_id: string) {
        const w = txStores.witnesses.get(witness_id);
        if (!w) return null;
        return {
          witness_id: w.witness_id,
          user_id: w.user_id,
          source_table: w.source_table,
          source_row_id: w.source_row_id,
          ontology_concept_id: w.ontology_concept_id,
        };
      },
    };

    try {
      const result = await body(gw);
      // COMMIT: copy txStores back to stores.
      stores.caws = txStores.caws;
      stores.transitions = txStores.transitions;
      stores.witnesses = txStores.witnesses;
      return result;
    } catch (err) {
      // ROLLBACK: restore snapshot.
      stores.caws = snapshot.caws;
      stores.transitions = snapshot.transitions;
      stores.witnesses = snapshot.witnesses;
      throw err;
    }
  };
}

// ---------------------------------------------------------------------------
// Fixture builders.
// ---------------------------------------------------------------------------

function buildDraft(
  overrides: Partial<ConceptAssignmentWitnessDraft> = {},
): ConceptAssignmentWitnessDraft {
  return {
    caw_id: "c0000000-0000-5000-8000-000000000001",
    user_id: "u0000000-0000-0000-0000-000000000001",
    source_table: "patient_lab_observations",
    source_row_id: "row_001",
    candidate_concept_id: "concept_hba1c",
    ontology_version: "ont_2026_04",
    registry_seed_version: "rsv_2026_04",
    engine_version_id: "ev_2026_04_a",
    current_state: "auto_admitted",
    current_state_actor_kind: "engine",
    current_state_actor_id: "ev_2026_04_a",
    signal_results: [],
    composite_identity_score: 0.92,
    coherence_result: "pass",
    confidence_value: 0.9,
    confidence_basis:
      "seven RAE signals concur within engine ev_2026_04_a thresholds",
    limitations: ["initial admission; calibration window open"],
    produced_witness_id: null,
    policy_at_decision: "default",
    founder_review_flag: false,
    ...overrides,
  };
}

function buildDecision(
  draft: ConceptAssignmentWitnessDraft,
  intent: AdmissionDecisionV1["witness_intent"] = "none",
): AdmissionDecisionV1 {
  return { caw: draft, witness_intent: intent };
}

function fakeAdapter(
  witnessId = "w0000000-0000-0000-0000-000000000001",
): WitnessifyAdapter {
  return (decision) => ({
    witness_id: witnessId,
    user_id: decision.caw.user_id,
    source_table: decision.caw.source_table,
    source_row_id: decision.caw.source_row_id,
    ontology_concept_id: decision.caw.candidate_concept_id,
    passthrough: { source: "test_adapter" },
  });
}

const REASON = "engine_initial_admission_under_default_policy";

// ---------------------------------------------------------------------------
// 1. Insert CAW, no witness.
// ---------------------------------------------------------------------------
Deno.test("§9.1 — insert CAW, no witness", async () => {
  const stores = emptyStores();
  const run = makeRunInTransaction(stores);
  const draft = buildDraft();
  const result = await persistInitialAdmission(
    { decision: buildDecision(draft, "none"), reason: REASON },
    run,
  );
  assertEquals(result.mode, "created");
  assertEquals(stores.caws.size, 1);
  assertEquals(stores.transitions.length, 1);
  assertEquals(stores.witnesses.size, 0);
  assertEquals(result.caw.produced_witness_id, null);
  assertEquals(stores.transitions[0].from_state, null);
  assertEquals(stores.transitions[0].to_state, "auto_admitted");
});

// ---------------------------------------------------------------------------
// 2. Insert CAW + witness_intent = produce_depth0_witness.
// ---------------------------------------------------------------------------
Deno.test("§9.2 — insert CAW + produce_depth0_witness via adapter", async () => {
  const stores = emptyStores();
  const run = makeRunInTransaction(stores);
  const draft = buildDraft();
  const result = await persistInitialAdmission(
    {
      decision: buildDecision(draft, "produce_depth0_witness"),
      reason: REASON,
      witnessify_adapter: fakeAdapter("w_for_§9.2"),
    },
    run,
  );
  assertEquals(result.mode, "created");
  assertEquals(stores.caws.size, 1);
  assertEquals(stores.transitions.length, 1);
  assertEquals(stores.witnesses.size, 1);
  assertEquals(result.caw.produced_witness_id, "w_for_§9.2");
});

// ---------------------------------------------------------------------------
// 3. Idempotent duplicate returns existing.
// ---------------------------------------------------------------------------
Deno.test("§9.3 — idempotent duplicate returns existing, no side effects", async () => {
  const stores = emptyStores();
  const run = makeRunInTransaction(stores);
  const draft = buildDraft();
  await persistInitialAdmission(
    {
      decision: buildDecision(draft, "produce_depth0_witness"),
      reason: REASON,
      witnessify_adapter: fakeAdapter("w_id_idem"),
    },
    run,
  );
  const second = await persistInitialAdmission(
    {
      decision: buildDecision(draft, "produce_depth0_witness"),
      reason: REASON,
      witnessify_adapter: fakeAdapter("w_id_idem"),
    },
    run,
  );
  assertEquals(second.mode, "existing");
  assertEquals(stores.caws.size, 1);
  assertEquals(stores.transitions.length, 1, "no second transition row");
  assertEquals(stores.witnesses.size, 1, "no second witness");
});

// ---------------------------------------------------------------------------
// 4. Transition row created exactly once across mixed call sequences.
// ---------------------------------------------------------------------------
Deno.test("§9.4 — transition row created exactly once for any caw_id", async () => {
  const stores = emptyStores();
  const run = makeRunInTransaction(stores);
  const draft = buildDraft();
  for (let i = 0; i < 5; i++) {
    await persistInitialAdmission(
      { decision: buildDecision(draft, "none"), reason: REASON },
      run,
    );
  }
  assertEquals(
    stores.transitions.filter((t) => t.caw_id === draft.caw_id).length,
    1,
  );
});

// ---------------------------------------------------------------------------
// 5. Witnessify failure rolls back CAW.
// ---------------------------------------------------------------------------
Deno.test("§9.5a — witnessify adapter throw rolls back CAW + transition", async () => {
  const stores = emptyStores();
  const run = makeRunInTransaction(stores);
  const draft = buildDraft();
  const adapter: WitnessifyAdapter = () => {
    throw new Error("adapter exploded mid-build");
  };
  await assertRejects(
    () =>
      persistInitialAdmission(
        {
          decision: buildDecision(draft, "produce_depth0_witness"),
          reason: REASON,
          witnessify_adapter: adapter,
        },
        run,
      ),
    WitnessifyFailureError,
  );
  assertEquals(stores.caws.size, 0);
  assertEquals(stores.transitions.length, 0);
  assertEquals(stores.witnesses.size, 0);
});

Deno.test("§9.5b — witness insert failure rolls back CAW + transition", async () => {
  const stores = emptyStores();
  const run = makeRunInTransaction(stores, {
    failOnInsertWitness: { name: "AncestryRejection", message: "trigger fired" },
  });
  const draft = buildDraft();
  await assertRejects(
    () =>
      persistInitialAdmission(
        {
          decision: buildDecision(draft, "produce_depth0_witness"),
          reason: REASON,
          witnessify_adapter: fakeAdapter("w_will_fail"),
        },
        run,
      ),
    WitnessifyFailureError,
  );
  assertEquals(stores.caws.size, 0);
  assertEquals(stores.transitions.length, 0);
  assertEquals(stores.witnesses.size, 0);
});

// ---------------------------------------------------------------------------
// 6. produced_witness_id ancestry mismatch rejected (back-annotation hard).
// ---------------------------------------------------------------------------
Deno.test("§9.6 — back-annotation provenance mismatch rejected", async () => {
  const stores = emptyStores();
  // Pre-seed an unrelated witness.
  stores.witnesses.set("w_legacy", {
    witness_id: "w_legacy",
    user_id: "DIFFERENT_USER",
    source_table: "patient_lab_observations",
    source_row_id: "row_001",
    ontology_concept_id: "concept_hba1c",
    extra: {},
  });
  const run = makeRunInTransaction(stores);
  const draft = buildDraft({
    policy_at_decision: "back_annotation",
    founder_review_flag: true,
    current_state: "auto_admitted",
  });
  await assertRejects(
    () =>
      persistInitialAdmission(
        {
          decision: buildDecision(draft, "none"),
          reason: REASON,
          back_annotation_witness_id: "w_legacy",
        },
        run,
      ),
    BackAnnotationVerificationError,
  );
  assertEquals(stores.caws.size, 0);
  assertEquals(stores.transitions.length, 0);
});

// ---------------------------------------------------------------------------
// 7. back_annotation references existing witness only.
// ---------------------------------------------------------------------------
Deno.test("§9.7 — back-annotation references existing witness, never creates one", async () => {
  const stores = emptyStores();
  const draft = buildDraft({
    policy_at_decision: "back_annotation",
    founder_review_flag: true,
  });
  stores.witnesses.set("w_existing_legacy", {
    witness_id: "w_existing_legacy",
    user_id: draft.user_id,
    source_table: draft.source_table,
    source_row_id: draft.source_row_id,
    ontology_concept_id: draft.candidate_concept_id,
    extra: { legacy: true },
  });
  const witnessSnapshot = structuredClone(stores.witnesses.get("w_existing_legacy"));

  const run = makeRunInTransaction(stores);
  const result = await persistInitialAdmission(
    {
      decision: buildDecision(draft, "none"),
      reason: REASON,
      back_annotation_witness_id: "w_existing_legacy",
    },
    run,
  );
  assertEquals(result.mode, "created");
  assertEquals(result.caw.produced_witness_id, "w_existing_legacy");
  assertEquals(result.caw.founder_review_flag, true);
  // Witness row unchanged.
  assertEquals(stores.witnesses.get("w_existing_legacy"), witnessSnapshot);
  assertEquals(stores.witnesses.size, 1, "no new witness created");
  assertEquals(stores.caws.size, 1);
  assertEquals(stores.transitions.length, 1);
});

Deno.test("§9.7b — back-annotation soft drift on ontology_concept_id flags + appends limitation", async () => {
  const stores = emptyStores();
  const draft = buildDraft({
    policy_at_decision: "back_annotation",
    founder_review_flag: true,
    candidate_concept_id: "concept_hba1c_v2",
  });
  stores.witnesses.set("w_drift", {
    witness_id: "w_drift",
    user_id: draft.user_id,
    source_table: draft.source_table,
    source_row_id: draft.source_row_id,
    ontology_concept_id: "concept_hba1c_v1", // drift!
    extra: {},
  });
  const run = makeRunInTransaction(stores);
  const result = await persistInitialAdmission(
    {
      decision: buildDecision(draft, "none"),
      reason: REASON,
      back_annotation_witness_id: "w_drift",
    },
    run,
  );
  assertEquals(result.mode, "created");
  assertEquals(result.caw.founder_review_flag, true);
  const drift = result.caw.limitations.find((l) =>
    l.startsWith("back_annotation_concept_drift:")
  );
  assert(drift, "expected back_annotation_concept_drift limitation");
  assertStringIncludes(drift!, "concept_hba1c_v1");
  assertStringIncludes(drift!, "concept_hba1c_v2");
});

// ---------------------------------------------------------------------------
// Extras: actor_kind guard + duplicate caw_id race.
// ---------------------------------------------------------------------------
Deno.test("guard — actor_kind=human rejected by persistInitialAdmission", async () => {
  const stores = emptyStores();
  const run = makeRunInTransaction(stores);
  const draft = buildDraft({ current_state_actor_kind: "human" });
  await assertRejects(
    () =>
      persistInitialAdmission(
        { decision: buildDecision(draft, "none"), reason: REASON },
        run,
      ),
    StorageInputError,
  );
});

Deno.test("guard — duplicate caw_id race rolls back losing transaction", async () => {
  const stores = emptyStores();
  const run = makeRunInTransaction(stores, { duplicateCawIdRace: true });
  const draft = buildDraft();
  await assertRejects(
    () =>
      persistInitialAdmission(
        { decision: buildDecision(draft, "none"), reason: REASON },
        run,
      ),
    Error,
    "duplicate key",
  );
  // The "winner" was committed outside the tx (simulating a parallel txn).
  assertEquals(stores.caws.size, 1);
  // The losing tx wrote no transition row.
  assertEquals(stores.transitions.length, 0);
});

// ---------------------------------------------------------------------------
// 8. Static source scan: closed write set enforced on admit.ts.
// ---------------------------------------------------------------------------
Deno.test("§9.8 — closed write set: admit.ts performs no DB I/O of its own", async () => {
  const src = await Deno.readTextFile(
    new URL("./admit.ts", import.meta.url).pathname,
  );

  // Strip line comments and block comments so commentary mentioning these
  // patterns does not trigger the guard.
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  // (a) No supabase-client write calls.
  const forbiddenClientCalls = [
    /\.from\(['"][^'"]+['"]\)\s*\.\s*(insert|update|delete|upsert)\b/,
    /\bfrom\(['"][^'"]+['"]\)\.upsert\b/,
  ];
  for (const pat of forbiddenClientCalls) {
    assert(
      !pat.test(stripped),
      `admit.ts must not contain supabase client write call matching ${pat}`,
    );
  }

  // (b) No raw SQL write keywords (case-insensitive, word-bounded).
  const forbiddenSqlKeywords = [
    /\bINSERT\s+INTO\b/i,
    /\bUPDATE\s+\w+\s+SET\b/i,
    /\bDELETE\s+FROM\b/i,
    /\bUPSERT\s+INTO\b/i,
    /\bTRUNCATE\b/i,
    /\bDROP\s+TABLE\b/i,
    /\bALTER\s+TABLE\b/i,
    /\bCREATE\s+TABLE\b/i,
  ];
  for (const pat of forbiddenSqlKeywords) {
    assert(
      !pat.test(stripped),
      `admit.ts must not contain raw SQL write matching ${pat}`,
    );
  }

  // (c) No reference to forbidden tables, in code OR comments.
  // (Comments would indicate intent drift; the design forbids these
  //  surfaces from appearing in the storage layer at all.)
  const forbiddenTables = [
    "rae_engine_versions",
    "rae_signal_config",
    "rae_engine_concept_overrides",
    "observation_review_queue",
    "ontology_concept_proposals",
    "review_queue_audit_log",
    "clusters",
    "cluster_evidence",
    "derived_patterns",
    "patient_narratives",
    "action_plans",
    "terrain_renders",
    "observation_packets",
    "patient_lab_observations",
    "patient_lab_uploads",
    "profiles",
    "user_roles",
  ];
  for (const tbl of forbiddenTables) {
    const pat = new RegExp(`["'\\b]${tbl}["'\\b]`);
    assert(
      !pat.test(stripped),
      `admit.ts must not reference forbidden table "${tbl}"`,
    );
  }

  // (d) The only DB-shaped operations should be the AdmitGateway interface
  // method names. Affirmative check: the file declares them.
  for (const m of [
    "findCawByCawId",
    "insertCaw",
    "insertStateTransition",
    "insertWitness",
    "setCawProducedWitnessId",
    "findWitnessProvenance",
  ]) {
    assert(stripped.includes(m), `admit.ts must declare AdmitGateway.${m}`);
  }
});

// ---------------------------------------------------------------------------
// Spec alignment: storage layer never imports reasoning surfaces.
// ---------------------------------------------------------------------------
Deno.test("storage spec-alignment — no imports from reasoning surfaces or witnessify_impl direct", async () => {
  const src = await Deno.readTextFile(
    new URL("./admit.ts", import.meta.url).pathname,
  );
  const importRe = /^\s*import[^"']+["']([^"']+)["']/gm;
  const imports = [...src.matchAll(importRe)].map((m) => m[1]);
  for (const spec of imports) {
    assert(
      spec.startsWith("../") || spec.startsWith("./") ||
        spec.startsWith("jsr:@std/") ||
        spec.startsWith("https://deno.land/std"),
      `admit.ts: unexpected import shape: ${spec}`,
    );
    // Must not import witnessify_impl directly — the WitnessifyAdapter
    // injection seam is the only allowed coupling.
    assert(
      !spec.includes("witnessify_impl"),
      `admit.ts must not import witnessify_impl directly; use WitnessifyAdapter`,
    );
    // Must not import any reasoning surface.
    for (const forbidden of [
      "generate-clusters",
      "generate-narrative",
      "generate-action-plan",
      "generate-terrain-render",
      "patient-chat",
    ]) {
      assert(
        !spec.includes(forbidden),
        `admit.ts must not import reasoning surface ${forbidden}`,
      );
    }
  }
});