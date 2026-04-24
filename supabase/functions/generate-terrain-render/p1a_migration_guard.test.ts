// ============================================================================
// supabase/functions/generate-terrain-render/p1a_migration_guard.test.ts
// ----------------------------------------------------------------------------
// Static regression guard for the P1a witness-native migration of
// generate-terrain-render. Modeled on the patient-chat / generate-action-plan
// / generate-ask-anything-context guard tests.
//
// Reads index.ts as text and asserts structural properties. Does NOT execute
// the edge function. Catches regressions if a future commit reintroduces
// raw-observation access, breaks the dual-audience validation pipeline, or
// changes the cache/hash inputs.
//
// Run from the repo root:
//   deno test --allow-read supabase/functions/generate-terrain-render/p1a_migration_guard.test.ts
// ============================================================================

import { assert } from "jsr:@std/assert@1.0.0";

const INDEX_PATH = new URL("./index.ts", import.meta.url).pathname;
const indexSource: string = await Deno.readTextFile(INDEX_PATH);

// ---------------------------------------------------------------------------
// GUARD 1 — no raw read of patient_lab_observations
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(terrain-render): no raw patient_lab_observations read", () => {
  assert(
    !indexSource.includes(`.from("patient_lab_observations")`) &&
      !indexSource.includes(`.from('patient_lab_observations')`),
    `Regression: raw patient_lab_observations read found. Use loadPatientContext.`
  );
});

// ---------------------------------------------------------------------------
// GUARD 2 — no raw read of cie_domain_scores
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(terrain-render): no raw cie_domain_scores read", () => {
  assert(
    !indexSource.includes(`.from("cie_domain_scores")`) &&
      !indexSource.includes(`.from('cie_domain_scores')`),
    `Regression: raw cie_domain_scores read found. Domain scores must flow via loadPatientContext.`
  );
});

// ---------------------------------------------------------------------------
// GUARD 3 — no raw read of cie_gate_scores
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(terrain-render): no raw cie_gate_scores read", () => {
  assert(
    !indexSource.includes(`.from("cie_gate_scores")`) &&
      !indexSource.includes(`.from('cie_gate_scores')`),
    `Regression: raw cie_gate_scores read found. Gate scores must flow via loadPatientContext.`
  );
});

// ---------------------------------------------------------------------------
// GUARD 4 — no raw read of cie_responses
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(terrain-render): no raw cie_responses read", () => {
  assert(
    !indexSource.includes(`.from("cie_responses")`) &&
      !indexSource.includes(`.from('cie_responses')`),
    `Regression: raw cie_responses read found. Sample responses must flow via loadPatientContext.`
  );
});

// ---------------------------------------------------------------------------
// GUARD 5 — loadPatientContext is imported AND called
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(terrain-render): imports and calls loadPatientContext", () => {
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
// GUARD 6 — clusters scoped by witnessContext.patient_id (not profile.id)
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(terrain-render): clusters scoped by witnessContext.patient_id", () => {
  const scopedByWitness = /witnessContext\.patient_id/.test(indexSource);
  // profile.id was the legacy cluster scope key; ensure it's not used for the cluster query
  const profileIdLeak = /\.eq\(\s*["']patient_id["']\s*,\s*profile\.id\s*\)/.test(indexSource);
  assert(
    scopedByWitness && !profileIdLeak,
    `Regression: clusters must be scoped by witnessContext.patient_id, not profile.id. ` +
      `witnessContext.patient_id=${scopedByWitness}, profile.id leak=${profileIdLeak}`
  );
});

// ---------------------------------------------------------------------------
// GUARD 7 — buildTerrainSystemPrompt still referenced
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(terrain-render): buildTerrainSystemPrompt referenced", () => {
  assert(
    /\bbuildTerrainSystemPrompt\s*\(/.test(indexSource),
    `Regression: buildTerrainSystemPrompt must still be invoked.`
  );
});

// ---------------------------------------------------------------------------
// GUARD 8 — composeUserMessage still referenced
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(terrain-render): composeUserMessage referenced", () => {
  assert(
    /\bcomposeUserMessage\s*\(/.test(indexSource),
    `Regression: composeUserMessage must still be invoked.`
  );
});

// ---------------------------------------------------------------------------
// GUARD 9 — validateTerrainRender still referenced
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(terrain-render): validateTerrainRender referenced", () => {
  assert(
    /\bvalidateTerrainRender\s*\(/.test(indexSource),
    `Regression: structural validator validateTerrainRender must still be invoked.`
  );
});

// ---------------------------------------------------------------------------
// GUARD 10 — extract*Prose helpers still referenced
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(terrain-render): extractPatientPortraitProse and extractClinicianSummaryProse referenced", () => {
  const hasPatient = /\bextractPatientPortraitProse\s*\(/.test(indexSource);
  const hasClinician = /\bextractClinicianSummaryProse\s*\(/.test(indexSource);
  assert(
    hasPatient && hasClinician,
    `Regression: prose extractors must remain. patient=${hasPatient}, clinician=${hasClinician}`
  );
});

// ---------------------------------------------------------------------------
// GUARD 11 — validateProseAgainstClustersWithAudience used for both audiences
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(terrain-render): validateProseAgainstClustersWithAudience invoked for patient and clinician", () => {
  const callsForPatient = /validateProseAgainstClustersWithAudience\([^)]*['"]patient['"]\s*\)/.test(indexSource);
  const callsForClinician = /validateProseAgainstClustersWithAudience\([^)]*['"]clinician['"]\s*\)/.test(indexSource);
  assert(
    callsForPatient && callsForClinician,
    `Regression: dual-audience voice validation must be invoked for both 'patient' and 'clinician'. ` +
      `patient=${callsForPatient}, clinician=${callsForClinician}`
  );
});

// ---------------------------------------------------------------------------
// GUARD 12 — buildRetryFeedbackWithSections still referenced
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(terrain-render): buildRetryFeedbackWithSections referenced", () => {
  assert(
    /\bbuildRetryFeedbackWithSections\s*\(/.test(indexSource),
    `Regression: dual-audience retry feedback builder must remain.`
  );
});

// ---------------------------------------------------------------------------
// GUARD 13 — marker-stripping helpers still referenced
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(terrain-render): stripMarkersFromPortrait and stripMarkersFromClinicianSummary referenced", () => {
  const hasPortrait = /\bstripMarkersFromPortrait\s*\(/.test(indexSource);
  const hasClinician = /\bstripMarkersFromClinicianSummary\s*\(/.test(indexSource);
  assert(
    hasPortrait && hasClinician,
    `Regression: cluster-marker stripping must remain on both audiences. portrait=${hasPortrait}, clinician=${hasClinician}`
  );
});

// ---------------------------------------------------------------------------
// GUARD 14 — MAX_VOICE_RETRIES = 3 preserved
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(terrain-render): MAX_VOICE_RETRIES = 3 preserved", () => {
  assert(
    /MAX_VOICE_RETRIES\s*=\s*3\b/.test(indexSource),
    `Regression: MAX_VOICE_RETRIES must remain = 3.`
  );
});

// ---------------------------------------------------------------------------
// GUARD 15 — failed_with_warnings fallback preserved
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(terrain-render): failed_with_warnings fallback preserved", () => {
  assert(
    indexSource.includes(`"failed_with_warnings"`),
    `Regression: failed_with_warnings fallback status must remain.`
  );
});

// ---------------------------------------------------------------------------
// GUARD 16 — inputData hash inputs include lab_count and cluster_count
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(terrain-render): inputData includes lab_count and cluster_count", () => {
  const hasLabCount = /\blab_count:\s*labObs\.length\b/.test(indexSource);
  const hasClusterCount = /\bcluster_count:\s*clusters\.length\b/.test(indexSource);
  assert(
    hasLabCount && hasClusterCount,
    `Regression: cache/hash inputs must include lab_count and cluster_count. ` +
      `lab_count=${hasLabCount}, cluster_count=${hasClusterCount}`
  );
});

// ---------------------------------------------------------------------------
// GUARD 17 — next_terrain_render_version RPC preserved
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(terrain-render): next_terrain_render_version RPC preserved", () => {
  assert(
    indexSource.includes(`"next_terrain_render_version"`),
    `Regression: next_terrain_render_version RPC call must remain.`
  );
});

// ============================================================================
// END
// ============================================================================