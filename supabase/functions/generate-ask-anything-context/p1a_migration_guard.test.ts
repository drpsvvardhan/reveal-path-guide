// ============================================================================
// supabase/functions/generate-ask-anything-context/p1a_migration_guard.test.ts
// ----------------------------------------------------------------------------
// Static regression guard for the P1a witness-native migration of
// generate-ask-anything-context. Modeled on patient-chat and
// generate-action-plan guard tests.
//
// These tests read index.ts as text and assert structural properties.
// They do NOT execute the edge function. The goal is to catch regressions
// at CI time if a future commit reintroduces raw-observation access,
// breaks the witness-native contract, alters the question-generation
// system prompt, or weakens cache-key shape.
//
// Run from the repo root:
//   deno test --allow-read supabase/functions/generate-ask-anything-context/p1a_migration_guard.test.ts
// ============================================================================

import { assert } from "jsr:@std/assert@1.0.0";

const INDEX_PATH = new URL("./index.ts", import.meta.url).pathname;
const indexSource: string = await Deno.readTextFile(INDEX_PATH);

// ---------------------------------------------------------------------------
// GUARD 1 — no raw read of patient_lab_observations
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(ask-anything-context): no raw patient_lab_observations read", () => {
  assert(
    !indexSource.includes(`.from("patient_lab_observations")`) &&
      !indexSource.includes(`.from('patient_lab_observations')`),
    `Regression: raw patient_lab_observations read found. Use loadPatientContext.`
  );
});

// ---------------------------------------------------------------------------
// GUARD 2 — no raw read of cie_gate_scores
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(ask-anything-context): no raw cie_gate_scores read", () => {
  assert(
    !indexSource.includes(`.from("cie_gate_scores")`) &&
      !indexSource.includes(`.from('cie_gate_scores')`),
    `Regression: raw cie_gate_scores read found. Gate scores must flow via loadPatientContext.`
  );
});

// ---------------------------------------------------------------------------
// GUARD 3 — no raw read of derived_patterns
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(ask-anything-context): no raw derived_patterns read", () => {
  assert(
    !indexSource.includes(`.from("derived_patterns")`) &&
      !indexSource.includes(`.from('derived_patterns')`),
    `Regression: raw derived_patterns read found. Patterns must flow via loadPatientContext.`
  );
});

// ---------------------------------------------------------------------------
// GUARD 4 — no raw read of profiles
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(ask-anything-context): no raw profiles read", () => {
  assert(
    !indexSource.includes(`.from("profiles")`) &&
      !indexSource.includes(`.from('profiles')`),
    `Regression: raw profiles read found. Profile must flow via loadPatientContext.`
  );
});

// ---------------------------------------------------------------------------
// GUARD 5 — loadPatientContext is imported AND called
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(ask-anything-context): imports and calls loadPatientContext", () => {
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
// GUARD 6 — terrain_renders read preserved
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(ask-anything-context): terrain_renders read preserved", () => {
  assert(
    indexSource.includes(`.from("terrain_renders")`) ||
      indexSource.includes(`.from('terrain_renders')`),
    `Regression: terrain_renders fetch must be preserved — it sources patient_portrait, clinician_summary, version.`
  );
});

// ---------------------------------------------------------------------------
// GUARD 7 — QUESTION_SYSTEM_PROMPT contains required tokens verbatim
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(ask-anything-context): QUESTION_SYSTEM_PROMPT preserves required tokens", () => {
  const required = [
    "Vizzhy",
    "second person",
    "under 25 words",
    "optimize",
    "biohack",
    "wellness",
    "holistic",
    "journey",
    "Return JSON",
  ];
  const missing = required.filter((tok) => !indexSource.includes(tok));
  assert(
    missing.length === 0,
    `Regression: QUESTION_SYSTEM_PROMPT must preserve safety/voice tokens verbatim. Missing: [${missing.join(", ")}]`
  );
});

// ---------------------------------------------------------------------------
// GUARD 8 — BIOMARKER_SIGNIFICANCE and ANCHOR_NAMES constants present
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(ask-anything-context): significance and anchor constants present", () => {
  const hasSignificance = /\bBIOMARKER_SIGNIFICANCE\b/.test(indexSource);
  const hasAnchorNames = /\bANCHOR_NAMES\b/.test(indexSource);
  const hasGetSignificance = /\bgetSignificance\s*\(/.test(indexSource);
  const hasIsAnchor = /\bisAnchor\s*\(/.test(indexSource);
  assert(
    hasSignificance && hasAnchorNames && hasGetSignificance && hasIsAnchor,
    `Regression: bucketing primitives must be preserved. ` +
      `BIOMARKER_SIGNIFICANCE=${hasSignificance}, ANCHOR_NAMES=${hasAnchorNames}, ` +
      `getSignificance=${hasGetSignificance}, isAnchor=${hasIsAnchor}`
  );
});

// ---------------------------------------------------------------------------
// GUARD 9 — cache key shape preserved (user_id :: assessment/none :: terrainVersion)
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(ask-anything-context): cache key shape preserved", () => {
  const hasCacheKey = indexSource.includes(
    '`${user_id}::${effectiveAssessmentId || "none"}::${terrainVersion}`'
  );
  assert(
    hasCacheKey,
    `Regression: cache key shape must remain "${"${user_id}"}::${"${assessment|none}"}::${"${terrainVersion}"}".`
  );
});

// ---------------------------------------------------------------------------
// GUARD 10 — response envelope keys preserved
// ---------------------------------------------------------------------------
Deno.test("P1a-guard(ask-anything-context): response envelope keys preserved", () => {
  const required = [
    "biomarker_chips",
    "flagged",
    "notable",
    "anchor",
    "suggested_questions",
    "terrain_version",
  ];
  const missing = required.filter((k) => !indexSource.includes(k));
  assert(
    missing.length === 0,
    `Regression: response envelope keys must remain. Missing: [${missing.join(", ")}]`
  );
});

// ============================================================================
// END
// ============================================================================