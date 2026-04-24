// ============================================================================
// supabase/functions/generate-clusters/contextLoader.test.ts
// ----------------------------------------------------------------------------
// P1a — Artifact 6 — Option M Regression Gate
//
// Verifies the five ship-gate properties stated in P1A_STATE_SNAPSHOT.md § 11:
//
//   P-1: every observation in PatientTerrainContext has a witness_id
//   P-2: every witness_id cited is present in witness_objects
//   P-3: no signal appears in context that isn't in witness_signal_registry
//        for the active seed version
//   P-4: cluster generation (via index.ts) completes without errors
//   P-5: the witnesses available for the test user feed the graph,
//        not the raw rows that didn't witnessify
//
// This test is an integration test, not a unit test. It requires:
//   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
//   - A test user with witnessified data (VV-001 by default)
//   - The full P1a stack live (schema, registry, 184+ witnesses)
//
// Run from repo root:
//   deno test --allow-env --allow-net \
//     supabase/functions/generate-clusters/contextLoader.test.ts
//
// It can also run in CI as a pre-deploy gate. If any property fails,
// the cutover should not proceed.
// ============================================================================

import { assert, assertEquals } from "jsr:@std/assert@1.0.0";

import { loadPatientContext } from "../_shared/contextLoader.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// FIXTURES
// ============================================================================

const TEST_USER_ID =
  Deno.env.get("WITNESS_TEST_USER_ID") ??
  "d75365ce-c45e-48a0-8d30-dab491e17346"; // VV-001

const ACTIVE_REGISTRY_SEED_VERSION =
  Deno.env.get("ACTIVE_REGISTRY_SEED_VERSION") ?? "p1a_initial";

function requireEnv(): { url: string; key: string } {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to run " +
        "the Option M regression gate. Set these in the environment or " +
        "a .env file loaded before deno test runs."
    );
  }
  return { url, key };
}

// Shared context loaded once so we don't pay the roundtrip five times.
let _ctx: Awaited<ReturnType<typeof loadPatientContext>> | null = null;
let _registrySignals: Set<string> | null = null;
let _dbWitnessIds: Set<string> | null = null;

async function loadContextOnce(): Promise<Awaited<ReturnType<typeof loadPatientContext>>> {
  if (_ctx) return _ctx;
  const { url, key } = requireEnv();
  _ctx = await loadPatientContext(url, key, TEST_USER_ID);
  return _ctx;
}

async function loadRegistrySignalsOnce(): Promise<Set<string>> {
  if (_registrySignals) return _registrySignals;
  const { url, key } = requireEnv();
  const sb = createClient(url, key);
  const { data, error } = await sb
    .from("witness_signal_registry")
    .select("source_window, signal")
    .eq("registry_seed_version", ACTIVE_REGISTRY_SEED_VERSION);
  if (error) throw new Error(`registry load: ${error.message}`);
  _registrySignals = new Set(
    (data ?? []).map((r: { source_window: string; signal: string }) => r.signal)
  );
  return _registrySignals;
}

async function loadDbWitnessIdsOnce(): Promise<Set<string>> {
  if (_dbWitnessIds) return _dbWitnessIds;
  const { url, key } = requireEnv();
  const sb = createClient(url, key);
  const { data, error } = await sb
    .from("witness_objects")
    .select("witness_id")
    .eq("user_id", TEST_USER_ID)
    .eq("registry_seed_version", ACTIVE_REGISTRY_SEED_VERSION);
  if (error) throw new Error(`witness ids load: ${error.message}`);
  _dbWitnessIds = new Set(
    (data ?? []).map((r: { witness_id: string }) => r.witness_id)
  );
  return _dbWitnessIds;
}

// ============================================================================
// GATE P-1: every observation in context has a witness_id
// ============================================================================

Deno.test({
  name: "P-1: every observation in PatientTerrainContext has a witness_id",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
  const ctx = await loadContextOnce();
  const missing: string[] = [];

  // labs
  for (const o of ctx.labs.observations) {
    if (!o.observation_id || typeof o.observation_id !== "string") {
      missing.push(`labs.observations canonical=${o.canonical_name} date=${o.collection_date}`);
    }
  }
  // inbody
  for (const o of ctx.inbody.observations) {
    if (!o.observation_id || typeof o.observation_id !== "string") {
      missing.push(`inbody.observations canonical=${o.canonical_name} date=${o.collection_date}`);
    }
  }
  // fibroscan
  for (const o of ctx.fibroscan.observations) {
    if (!o.observation_id || typeof o.observation_id !== "string") {
      missing.push(`fibroscan.observations canonical=${o.canonical_name} date=${o.collection_date}`);
    }
  }
  // CIE
  for (const d of ctx.cie.domain_scores) {
    if (!d.witness_id) missing.push(`cie.domain_score ${d.domain_id}`);
  }
  for (const g of ctx.cie.gate_scores) {
    if (!g.witness_id) missing.push(`cie.gate_score ${g.gate_id}`);
  }
  for (const r of ctx.cie.sample_responses) {
    if (!r.response_id) missing.push(`cie.sample_response ${r.question_id}`);
  }

  assertEquals(
    missing.length,
    0,
    `P-1 violations (${missing.length}): ${missing.slice(0, 5).join("; ")}${missing.length > 5 ? "..." : ""}`
  );
  },
});

// ============================================================================
// GATE P-2: every witness_id cited is present in witness_objects
// ============================================================================

Deno.test({
  name: "P-2: every witness_id cited in context is present in witness_objects",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
  const ctx = await loadContextOnce();
  const dbIds = await loadDbWitnessIdsOnce();

  const citedIds = new Set<string>();
  for (const o of ctx.labs.observations) citedIds.add(o.observation_id);
  for (const o of ctx.inbody.observations) citedIds.add(o.observation_id);
  for (const o of ctx.fibroscan.observations) citedIds.add(o.observation_id);
  for (const d of ctx.cie.domain_scores) citedIds.add(d.witness_id);
  for (const g of ctx.cie.gate_scores) citedIds.add(g.witness_id);
  for (const r of ctx.cie.sample_responses) citedIds.add(r.response_id);

  const unresolved: string[] = [];
  for (const id of citedIds) {
    if (!dbIds.has(id)) unresolved.push(id);
  }

  assertEquals(
    unresolved.length,
    0,
    `P-2 violations: ${unresolved.length} witness_ids cited but not in witness_objects. ` +
      `First few: ${unresolved.slice(0, 3).join(", ")}`
  );
  },
});

// ============================================================================
// GATE P-3: no signal in context that isn't in the active registry
// ============================================================================

Deno.test({
  name: "P-3: no signal in context that isn't in witness_signal_registry for active seed",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
  const ctx = await loadContextOnce();
  const registrySignals = await loadRegistrySignalsOnce();

  // For CIE witnesses, reconstruct the signal from domain/gate/question IDs.
  const citedSignals = new Set<string>();
  for (const d of ctx.cie.domain_scores) citedSignals.add(`cie.domain_score.${d.domain_id}`);
  for (const g of ctx.cie.gate_scores) citedSignals.add(`cie.gate_score.${g.gate_id}`);
  for (const r of ctx.cie.sample_responses) citedSignals.add(`cie.response.${r.question_id}`);
  for (const o of ctx.labs.observations) citedSignals.add(`lab.${o.canonical_name}`);
  for (const o of ctx.inbody.observations) citedSignals.add(`inbody.${o.canonical_name}`);
  for (const o of ctx.fibroscan.observations) citedSignals.add(`fibroscan.${o.canonical_name}`);

  const unknownSignals: string[] = [];
  for (const s of citedSignals) {
    if (!registrySignals.has(s)) unknownSignals.push(s);
  }

  assertEquals(
    unknownSignals.length,
    0,
    `P-3 violations: ${unknownSignals.length} signals in context not in registry. ` +
      `First few: ${unknownSignals.slice(0, 5).join(", ")}`
  );
  },
});

// ============================================================================
// GATE P-4: cluster generation completes without errors for the test user
// ============================================================================

Deno.test("P-4: cluster generation via /generate-clusters endpoint succeeds", async () => {
  const { url, key } = requireEnv();
  const resp = await fetch(`${url}/functions/v1/generate-clusters`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ patient_id: TEST_USER_ID }),
  });

  assert(
    resp.ok,
    `P-4 violation: generate-clusters returned ${resp.status} ${resp.statusText}`
  );

  const body = await resp.json();
  assert(
    body.ok === true || body.success === true || Array.isArray(body.clusters),
    `P-4 violation: response shape does not indicate success. ` +
      `Body: ${JSON.stringify(body).slice(0, 200)}...`
  );
});

// ============================================================================
// GATE P-5: witness counts match expected profile
// ============================================================================
// This gate is looser than the others because "the right number of witnesses"
// depends on the test user's actual data. For VV-001 specifically, we know:
//   - 184 witnesses total at p1a_initial
//   - Distribution: depth_0=150, depth_1=25, depth_2=9
// Other users will have different counts. For cross-user portability the
// assertion is "witness_provenance reflects real witnesses, not zero".

Deno.test("P-5: witness_provenance shows witnesses are actually feeding the graph", async () => {
  const ctx = await loadContextOnce();
  const prov = ctx.witness_provenance;

  assertEquals(prov.registry_seed_version, ACTIVE_REGISTRY_SEED_VERSION);

  assert(
    prov.total_witnesses > 0,
    `P-5 violation: zero witnesses for user ${TEST_USER_ID}. ` +
      `Either backfill has not run or the user has no data.`
  );

  assertEquals(
    prov.total_witnesses,
    prov.depth_0_count + prov.depth_1_count + prov.depth_2_count,
    "P-5: depth counts should sum to total_witnesses"
  );

  // At least some source_windows should have witnesses.
  const totalFromWindows = Object.values(prov.source_window_counts).reduce(
    (a, b) => a + b,
    0
  );
  assertEquals(
    totalFromWindows,
    prov.total_witnesses,
    "P-5: source_window_counts should sum to total_witnesses"
  );
});

// ============================================================================
// Informational: print the witness_provenance summary for the test user.
// ============================================================================

Deno.test("info: print witness_provenance summary", async () => {
  const ctx = await loadContextOnce();
  console.log("\n=== witness_provenance for test user ===");
  console.log(JSON.stringify(ctx.witness_provenance, null, 2));
  console.log("\n=== context.labs.observations.length:", ctx.labs.observations.length);
  console.log("=== context.inbody.observations.length:", ctx.inbody.observations.length);
  console.log("=== context.fibroscan.observations.length:", ctx.fibroscan.observations.length);
  console.log("=== context.cie.domain_scores.length:", ctx.cie.domain_scores.length);
  console.log("=== context.cie.gate_scores.length:", ctx.cie.gate_scores.length);
  console.log("=== context.cie.sample_responses.length:", ctx.cie.sample_responses.length);
});

// ============================================================================
// END OF contextLoader.test.ts
// ============================================================================
