// ============================================================================
// supabase/functions/generate-narrative/p1a_migration_guard.test.ts
// ----------------------------------------------------------------------------
// Static regression guard for the P1a witness-native migration of
// generate-narrative. Reads index.ts as text and asserts structural
// properties. Does NOT execute the edge function.
//
// Run from the repo root:
//   deno test --allow-read supabase/functions/generate-narrative/p1a_migration_guard.test.ts
// ============================================================================

import { assert } from "jsr:@std/assert@1.0.0";

const INDEX_PATH = new URL("./index.ts", import.meta.url).pathname;
const indexSource: string = await Deno.readTextFile(INDEX_PATH);

// ---------------------------------------------------------------------------
// GUARD 1 — no raw read of derived_patterns
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(narrative): no raw derived_patterns read", () => {
  assert(
    !indexSource.includes(`.from("derived_patterns")`) &&
      !indexSource.includes(`.from('derived_patterns')`),
    `Regression: raw derived_patterns read found. Use loadPatientContext.`,
  );
});

// ---------------------------------------------------------------------------
// GUARD 2 — no raw read of cie_assessments
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(narrative): no raw cie_assessments read", () => {
  assert(
    !indexSource.includes(`.from("cie_assessments")`) &&
      !indexSource.includes(`.from('cie_assessments')`),
    `Regression: raw cie_assessments read found. Use loadPatientContext.`,
  );
});

// ---------------------------------------------------------------------------
// GUARD 3 — no raw read of cie_gate_scores
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(narrative): no raw cie_gate_scores read", () => {
  assert(
    !indexSource.includes(`.from("cie_gate_scores")`) &&
      !indexSource.includes(`.from('cie_gate_scores')`),
    `Regression: raw cie_gate_scores read found. Use loadPatientContext.`,
  );
});

// ---------------------------------------------------------------------------
// GUARD 4 — no raw read of profiles
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(narrative): no raw profiles read", () => {
  assert(
    !indexSource.includes(`.from("profiles")`) &&
      !indexSource.includes(`.from('profiles')`),
    `Regression: raw profiles read found. Use loadPatientContext.`,
  );
});

// ---------------------------------------------------------------------------
// GUARD 5 — no raw read of patient_lab_observations
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(narrative): no raw patient_lab_observations read", () => {
  assert(
    !indexSource.includes(`.from("patient_lab_observations")`) &&
      !indexSource.includes(`.from('patient_lab_observations')`),
    `Regression: raw patient_lab_observations read found. Use loadPatientContext.`,
  );
});

// ---------------------------------------------------------------------------
// GUARD 6 — loadPatientContext is imported AND called
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(narrative): imports and calls loadPatientContext", () => {
  const hasImport =
    /import\s*\{[^}]*\bloadPatientContext\b[^}]*\}\s*from\s*["']\.\.\/_shared\/contextLoader\.ts["']/
      .test(indexSource);
  const hasCall = /\bloadPatientContext\s*\(/.test(indexSource);
  assert(
    hasImport && hasCall,
    `Regression: must import loadPatientContext from ../_shared/contextLoader.ts AND call it. ` +
      `import=${hasImport}, call=${hasCall}`,
  );
});

// ---------------------------------------------------------------------------
// GUARD 7 — clusters scoped by witnessContext.patient_id
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(narrative): clusters scoped by witnessContext.patient_id", () => {
  const scopedByWitness = /witnessContext\.patient_id/.test(indexSource);
  const profileIdLeak = /\.eq\(\s*["']patient_id["']\s*,\s*profileData?\.id\s*\)/.test(indexSource);
  assert(
    scopedByWitness && !profileIdLeak,
    `Regression: clusters must be scoped by witnessContext.patient_id, not profileData.id. ` +
      `witnessContext.patient_id=${scopedByWitness}, profile.id leak=${profileIdLeak}`,
  );
});

// ---------------------------------------------------------------------------
// GUARD 8 — buildNarrativeSystemPrompt content preserved
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(narrative): buildNarrativeSystemPrompt verbatim markers preserved", () => {
  const required = [
    "You are the Vizzhy Narrative Composer",
    "You are NOT a medical advisor",
    "{cluster:",
    "{cluster:none}",
    "## Tier-licensed vocabulary",
    "## Globally forbidden vocabulary",
    "## Output schema",
  ];
  for (const phrase of required) {
    assert(
      indexSource.includes(phrase),
      `Regression: buildNarrativeSystemPrompt must contain "${phrase}".`,
    );
  }
});

// ---------------------------------------------------------------------------
// GUARD 9 — FRAMEWORK_V2 interpolation preserved
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(narrative): FRAMEWORK_V2 interpolation preserved", () => {
  assert(
    /\$\{FRAMEWORK_V2\}/.test(indexSource),
    `Regression: FRAMEWORK_V2 must be interpolated into the system prompt.`,
  );
});

// ---------------------------------------------------------------------------
// GUARD 10 — framework_v2 imports preserved
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(narrative): framework_v2 imports preserved", () => {
  const required = [
    "FRAMEWORK_V2",
    "TIER_VOCABULARY_LICENSES",
    "FORBIDDEN_VOCABULARY_GLOBAL",
    "parseProseAndCitations",
    "validateProseAgainstClusters",
    "stripClusterMarkers",
    "buildRetryFeedback",
  ];
  for (const sym of required) {
    assert(
      new RegExp(`\\b${sym}\\b`).test(indexSource),
      `Regression: symbol "${sym}" from framework_v2 must remain imported/used.`,
    );
  }
  assert(
    /from\s*["']\.\.\/_shared\/framework_v2\.ts["']/.test(indexSource),
    `Regression: import path "../_shared/framework_v2.ts" must remain.`,
  );
});

// ---------------------------------------------------------------------------
// GUARD 11 — manifest.rawData.biomarkerTimeline is witness-derived
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(narrative): biomarkerTimeline is overwritten from witnessContext", () => {
  const assignsBiomarkerTimeline = /biomarkerTimeline:\s*witnessBiomarkerTimeline/.test(indexSource);
  const buildsFromLabs = /witnessContext\.labs\.observations/.test(indexSource);
  const buildsFromInbody = /witnessContext\.inbody\.observations/.test(indexSource);
  const buildsFromFibro = /witnessContext\.fibroscan\.observations/.test(indexSource);
  assert(
    assignsBiomarkerTimeline && buildsFromLabs && buildsFromInbody && buildsFromFibro,
    `Regression: manifest.rawData.biomarkerTimeline must be assembled from witnessContext labs+inbody+fibroscan. ` +
      `assigns=${assignsBiomarkerTimeline} labs=${buildsFromLabs} inbody=${buildsFromInbody} fibroscan=${buildsFromFibro}`,
  );
});

// ---------------------------------------------------------------------------
// GUARD 12 — patient_narratives insert preserved
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(narrative): patient_narratives insert preserved", () => {
  assert(
    indexSource.includes(`.from("patient_narratives")`) ||
      indexSource.includes(`.from('patient_narratives')`),
    `Regression: patient_narratives insert must remain.`,
  );
  assert(/\.insert\(/.test(indexSource), `Regression: insert call must remain.`);
});

// ---------------------------------------------------------------------------
// GUARD 13 — next_narrative_version RPC preserved
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(narrative): next_narrative_version RPC preserved", () => {
  assert(
    indexSource.includes(`"next_narrative_version"`) ||
      indexSource.includes(`'next_narrative_version'`),
    `Regression: next_narrative_version RPC call must remain.`,
  );
});

// ============================================================================
// END
// ============================================================================