// ============================================================================
// supabase/functions/generate-action-plan/p1a_migration_guard.test.ts
// ----------------------------------------------------------------------------
// Static regression guard for the P1a witness-native migration of
// generate-action-plan. Modeled on patient-chat/p1a_migration_guard.test.ts.
//
// These tests read the current index.ts file as text and assert structural
// properties about it. They do NOT execute the edge function. The goal is
// to catch regressions at CI time if a future commit reintroduces raw-
// observation access, breaks the witness-native contract, strips the
// safety-critical prompt rules, or weakens the cluster-citation grammar.
//
// Run from the repo root:
//   deno test --allow-read supabase/functions/generate-action-plan/p1a_migration_guard.test.ts
// ============================================================================

import { assert } from "jsr:@std/assert@1.0.0";

const INDEX_PATH = new URL("./index.ts", import.meta.url).pathname;
const indexSource: string = await Deno.readTextFile(INDEX_PATH);

// ---------------------------------------------------------------------------
// GUARD 1 — no raw read of patient_lab_observations (double-quoted)
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(action-plan): no .from(\"patient_lab_observations\")", () => {
  assert(
    !indexSource.includes(`.from("patient_lab_observations")`),
    `Regression: raw patient_lab_observations read found. Use loadPatientContext.`
  );
});

// ---------------------------------------------------------------------------
// GUARD 2 — no raw read of patient_lab_observations (single-quoted)
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(action-plan): no .from('patient_lab_observations')", () => {
  assert(
    !indexSource.includes(`.from('patient_lab_observations')`),
    `Regression: raw patient_lab_observations read found. Use loadPatientContext.`
  );
});

// ---------------------------------------------------------------------------
// GUARD 3 — no raw read of cie_gate_scores
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(action-plan): no raw cie_gate_scores read", () => {
  assert(
    !indexSource.includes(`.from("cie_gate_scores")`) &&
      !indexSource.includes(`.from('cie_gate_scores')`),
    `Regression: raw cie_gate_scores read found. Gate scores must flow via loadPatientContext.`
  );
});

// ---------------------------------------------------------------------------
// GUARD 4 — no raw read of cie_domain_scores
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(action-plan): no raw cie_domain_scores read", () => {
  assert(
    !indexSource.includes(`.from("cie_domain_scores")`) &&
      !indexSource.includes(`.from('cie_domain_scores')`),
    `Regression: raw cie_domain_scores read found. Domain scores must flow via loadPatientContext.`
  );
});

// ---------------------------------------------------------------------------
// GUARD 5 — no raw read of derived_patterns
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(action-plan): no raw derived_patterns read", () => {
  assert(
    !indexSource.includes(`.from("derived_patterns")`) &&
      !indexSource.includes(`.from('derived_patterns')`),
    `Regression: raw derived_patterns read found. Patterns must flow via loadPatientContext.`
  );
});

// ---------------------------------------------------------------------------
// GUARD 6 — loadPatientContext is imported AND called
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(action-plan): imports and calls loadPatientContext", () => {
  const hasImport =
    /import\s*\{[^}]*\bloadPatientContext\b[^}]*\}\s*from\s*["']\.\.\/_shared\/contextLoader\.ts["']/
      .test(indexSource);
  const hasCall = /\bloadPatientContext\s*\(/.test(indexSource);
  assert(
    hasImport && hasCall,
    `Regression: must import loadPatientContext from ../_shared/contextLoader.ts AND call it. ` +
      `import=${hasImport}, call=${hasCall}`
  );
});

// ---------------------------------------------------------------------------
// GUARD 7 — default sequenceExplanation fallback string preserved verbatim
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(action-plan): default sequenceExplanation fallback preserved", () => {
  const fallback =
    "These actions are ordered by leverage — the first ones stabilize the foundation that makes later ones effective. Start with the top action. As it becomes habit, add the next.";
  assert(
    indexSource.includes(fallback),
    `Regression: the default sequenceExplanation fallback string was modified or removed. ` +
      `It must remain verbatim — it is the safe fallback when the LLM call fails or is skipped.`
  );
});

// ---------------------------------------------------------------------------
// GUARD 8 — cluster citation tokens preserved in prompt
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(action-plan): cluster citation tokens preserved", () => {
  const hasClusterId = indexSource.includes("{cluster:<cluster_id>}");
  const hasClusterNone = indexSource.includes("{cluster:none}");
  assert(
    hasClusterId && hasClusterNone,
    `Regression: cluster citation grammar must remain in the prompt. ` +
      `{cluster:<cluster_id>}=${hasClusterId}, {cluster:none}=${hasClusterNone}`
  );
});

// ---------------------------------------------------------------------------
// GUARD 9 — framework_v2 imports preserved
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(action-plan): framework_v2 imports preserved", () => {
  const required = [
    "TIER_VOCABULARY_LICENSES",
    "FORBIDDEN_VOCABULARY_GLOBAL",
    "parseProseAndCitations",
    "validateProseAgainstClusters",
    "stripClusterMarkers",
    "buildRetryFeedback",
  ];
  const missing = required.filter((sym) => !indexSource.includes(sym));
  assert(
    missing.length === 0 &&
      indexSource.includes(`from "../_shared/framework_v2.ts"`),
    `Regression: framework_v2 import surface incomplete. Missing: [${missing.join(", ")}]`
  );
});

// ---------------------------------------------------------------------------
// GUARD 10 — clusters fetch scoped by witnessContext.patient_id
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(action-plan): clusters scoped by witnessContext.patient_id", () => {
  // Must reference the loader-returned canonical patient_id when querying clusters.
  const scopedByWitness = /witnessContext\.patient_id/.test(indexSource);
  // Must NOT re-derive patient_id by re-querying profiles.id for the cluster scope.
  const profileDataLeak = /profileData\.id/.test(indexSource);
  assert(
    scopedByWitness && !profileDataLeak,
    `Regression: clusters must be scoped by witnessContext.patient_id, not by a ` +
      `re-queried profileData.id. ` +
      `witnessContext.patient_id=${scopedByWitness}, profileData.id leak=${profileDataLeak}`
  );
});

// ============================================================================
// END
// ============================================================================