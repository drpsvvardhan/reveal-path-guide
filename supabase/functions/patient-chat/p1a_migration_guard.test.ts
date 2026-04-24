// ============================================================================
// supabase/functions/patient-chat/p1a_migration_guard.test.ts
// ----------------------------------------------------------------------------
// Static regression guard for the P1a-complete patient-chat migration.
//
// These tests read the current index.ts file as text and assert structural
// properties about it. They do NOT execute the edge function. The goal is
// to catch regressions at CI time if a future commit reintroduces raw-
// observation access, breaks the witness-native contract, strips the
// safety-critical system-prompt rules, or weakens the userId enforcement.
//
// Run from the repo root:
//   deno test --allow-read supabase/functions/patient-chat/p1a_migration_guard.test.ts
//
// Expected: 8 tests, all pass.
//
// If a test fails, the file has regressed. Do not disable a failing
// assertion without a constitutional justification documented in the P1a
// state snapshot.
// ============================================================================

import { assert } from "jsr:@std/assert@1.0.0";

const INDEX_PATH = new URL("./index.ts", import.meta.url).pathname;

// Read once, reuse across all tests.
const indexSource: string = await Deno.readTextFile(INDEX_PATH);

// ============================================================================
// GUARD 1 — no raw read of patient_lab_observations via double-quoted literal
// ============================================================================

Deno.test("P1a-guard: index.ts does not contain .from(\"patient_lab_observations\")", () => {
  const forbidden = `.from("patient_lab_observations")`;
  assert(
    !indexSource.includes(forbidden),
    `Regression: index.ts contains ${forbidden}. ` +
      `P1a forbids direct reads from patient_lab_observations from reasoning ` +
      `surfaces. Use loadPatientContext instead.`
  );
});

// ============================================================================
// GUARD 2 — no raw read of patient_lab_observations via single-quoted literal
// ============================================================================

Deno.test("P1a-guard: index.ts does not contain .from('patient_lab_observations')", () => {
  const forbidden = `.from('patient_lab_observations')`;
  assert(
    !indexSource.includes(forbidden),
    `Regression: index.ts contains ${forbidden}. ` +
      `P1a forbids direct reads from patient_lab_observations from reasoning ` +
      `surfaces. Use loadPatientContext instead.`
  );
});

// ============================================================================
// GUARD 3 — loadPatientContext is imported or called
// ============================================================================

Deno.test("P1a-guard: index.ts imports or calls loadPatientContext", () => {
  const hasImport = /import\s*\{[^}]*\bloadPatientContext\b[^}]*\}\s*from/.test(
    indexSource
  );
  const hasCall = /\bloadPatientContext\s*\(/.test(indexSource);
  assert(
    hasImport && hasCall,
    `Regression: index.ts must both IMPORT and CALL loadPatientContext. ` +
      `Found import=${hasImport}, call=${hasCall}. ` +
      `P1a requires patient-chat to read its patient context through the ` +
      `governed context loader.`
  );
});

// ============================================================================
// GUARD 4 — prompt includes witness / provenance language
// ============================================================================
// We accept any of several canonical phrases that indicate the prompt is
// built around witness-backed reasoning. This guard prevents a regression
// where someone strips the constitutional grounding language from the
// system prompt while leaving the code structure intact.

Deno.test("P1a-guard: system prompt includes witness/provenance language", () => {
  const witnessPatterns = [
    "witness-backed",
    "witness-derived",
    "admitted witness",
    "witness_id",
    "witness-native",
    "witness evidence",
    "witness layer",
  ];
  const matched = witnessPatterns.filter((p) => indexSource.includes(p));
  assert(
    matched.length >= 2,
    `Regression: prompt does not contain sufficient witness/provenance ` +
      `language. Expected at least 2 of [${witnessPatterns.join(", ")}]. ` +
      `Found ${matched.length}: [${matched.join(", ")}]. ` +
      `P1a requires the prompt to name witness-based grounding explicitly ` +
      `so the LLM's reasoning is constrained to governed evidence.`
  );
});

// ============================================================================
// GUARD 5 — queueExtractedQuestions call is preserved
// ============================================================================

Deno.test("P1a-guard: index.ts still contains queueExtractedQuestions", () => {
  assert(
    indexSource.includes("queueExtractedQuestions"),
    `Regression: index.ts no longer references queueExtractedQuestions. ` +
      `This was preserved behavior during migration — doctor-question ` +
      `queueing must continue to work.`
  );
});

// ============================================================================
// GUARD 6 — TransformStream capture-and-queue is preserved
// ============================================================================

Deno.test("P1a-guard: index.ts still contains TransformStream", () => {
  assert(
    indexSource.includes("TransformStream"),
    `Regression: index.ts no longer uses TransformStream. ` +
      `The capture-and-queue transform that awaits the queue insert in ` +
      `flush() is required so Deno Deploy does not terminate the worker ` +
      `before the doctor-question insert completes.`
  );
});

// ============================================================================
// GUARD 7 — structural dose-refusal language is preserved
// ============================================================================
// Per CodexOS P1a-complete review (23 April 2026): the medication/supplement
// dose-refusal section is the most concrete hard-refusal protection in the
// whole system prompt. The P1a migration must not compress or paraphrase it.
// These two phrases are load-bearing — they mark the rule as structural
// (not subject to reinterpretation) and absolute (no numerical dose framing
// under any circumstance). If either phrase is missing, the migration has
// regressed a safety boundary.

Deno.test("P1a-guard: system prompt preserves structural dose-refusal language", () => {
  const phrase1 = "This rule is **structural, not interpretive**";
  const phrase2 = "No numbers about how much, ever";

  const hasPhrase1 = indexSource.includes(phrase1);
  const hasPhrase2 = indexSource.includes(phrase2);

  assert(
    hasPhrase1 && hasPhrase2,
    `Regression: dose-refusal safety language is missing.\n` +
      `  "${phrase1}" → ${hasPhrase1 ? "present" : "MISSING"}\n` +
      `  "${phrase2}" → ${hasPhrase2 ? "present" : "MISSING"}\n` +
      `These phrases anchor the structural refusal of numerical dose ` +
      `framing across all substances. They must be preserved verbatim. ` +
      `If the wording is being edited for any reason, the change must be ` +
      `reviewed as a safety-prompt change, not a migration change.`
  );
});

// ============================================================================
// GUARD 8 — absent-userId enforcement
// ============================================================================
// Per CodexOS P1a-complete review (23 April 2026): if userId is absent,
// patient-chat must not produce patient-specific "From your data" claims.
// The migration enforces this by rejecting the request with 400. A future
// commit that relaxes this — allowing a manifest-only fallback path that
// still interpolates patient-specific manifest fields into the prompt —
// re-opens the pre-twin reasoning surface that P1a-complete closes.
//
// This guard asserts that somewhere in index.ts there is:
//   1. A check for absent userId (!userId or userId == null/undefined)
//   2. A 400 status response in proximity
//
// The heuristic is structural — we look for the pattern rather than an
// exact string — so the enforcement can be refactored (e.g. moved to a
// helper) without breaking the guard, as long as the enforcement itself
// remains.

Deno.test("P1a-guard: absent-userId is rejected with 400 (no manifest-only fallback)", () => {
  // Look for a conditional check against missing userId.
  const hasUserIdCheck =
    /if\s*\(\s*!\s*userId\s*\)/.test(indexSource) ||
    /if\s*\(\s*userId\s*==\s*null\s*\)/.test(indexSource) ||
    /if\s*\(\s*userId\s*===\s*undefined\s*\)/.test(indexSource) ||
    /if\s*\(\s*userId\s*===\s*null\s*\)/.test(indexSource);

  // Look for a 400 status in the file (the rejection response).
  const hasFourHundred = /status:\s*400/.test(indexSource);

  // Look for language indicating patient-specific reasoning is not allowed
  // without userId — this is the guard against someone flipping the check
  // to silently degrade to manifest-only mode.
  const hasEnforcementLanguage =
    indexSource.includes("requires a userId") ||
    indexSource.includes("userId is required") ||
    indexSource.includes("without witness grounding") ||
    indexSource.includes("forbidden under P1a");

  assert(
    hasUserIdCheck && hasFourHundred && hasEnforcementLanguage,
    `Regression: absent-userId enforcement is missing or weakened.\n` +
      `  userId conditional check → ${hasUserIdCheck ? "present" : "MISSING"}\n` +
      `  400 status response     → ${hasFourHundred ? "present" : "MISSING"}\n` +
      `  enforcement rationale    → ${hasEnforcementLanguage ? "present" : "MISSING"}\n` +
      `P1a requires that patient-chat never produce patient-specific ` +
      `reasoning without a governed witness context. The correct behavior ` +
      `when userId is absent is to reject with 400, not silently degrade ` +
      `to manifest-only mode.`
  );
});

// ============================================================================
// GUARD 9 — identity binding (authenticated session must match requested userId)
// ============================================================================
// Per CodexOS P1a-complete second review (23 April 2026): before this guard,
// userId was a free parameter in the request body. Any authenticated caller
// could pass any UUID and receive that user's governed witness context and
// manifest-interpolated prompt. That is a patient-data privacy leak
// independent of the witness-layer discipline.
//
// The fix binds userId to the bearer token on the request: getUser() is
// called to resolve the token's user, and that user's id must equal the
// requested userId. On mismatch, absent token, or invalid token, the
// handler returns 401.
//
// This guard asserts the structural presence of the binding:
//   1. The Authorization header is read
//   2. getUser() is invoked
//   3. There is a comparison between the authenticated id and userId
//   4. A 401 status response exists in the file
//
// Like guard 8, this is heuristic — the enforcement can be refactored
// (moved to a helper, renamed) without breaking the guard, as long as the
// enforcement itself remains.
//
// If at any point patient-chat begins supporting clinician impersonation
// / view-as flows, this guard's 3rd check (id === userId) should be
// replaced by a more general "the session is permitted to access this
// userId" check. Such a change must be reviewed as a security change, not
// a refactor.

Deno.test("P1a-guard: authenticated session must match requested userId", () => {
  // Look for Authorization header read.
  const readsAuthHeader =
    /req\.headers\.get\(\s*["']Authorization["']\s*\)/.test(indexSource) ||
    indexSource.includes("getAuthHeader"); // tolerate helper extraction

  // Look for a getUser invocation on an auth client.
  const callsGetUser = /\.auth\.getUser\s*\(/.test(indexSource);

  // Look for a strict equality check between an authenticated user id and
  // the request userId. The pattern is intentionally loose so the
  // enforcement can be written in either direction.
  const hasIdMatch =
    /authData\.user\.id\s*!==\s*userId/.test(indexSource) ||
    /authData\.user\.id\s*===\s*userId/.test(indexSource) ||
    /user\.id\s*!==\s*userId/.test(indexSource) ||
    /user\.id\s*===\s*userId/.test(indexSource);

  // Look for a 401 status response somewhere in the file.
  const hasFourOhOne = /status:\s*401/.test(indexSource);

  assert(
    readsAuthHeader && callsGetUser && hasIdMatch && hasFourOhOne,
    `Regression: identity binding is missing or weakened.\n` +
      `  Reads Authorization header → ${readsAuthHeader ? "present" : "MISSING"}\n` +
      `  Calls auth.getUser()        → ${callsGetUser ? "present" : "MISSING"}\n` +
      `  Compares auth id to userId  → ${hasIdMatch ? "present" : "MISSING"}\n` +
      `  Returns 401 on mismatch     → ${hasFourOhOne ? "present" : "MISSING"}\n` +
      `patient-chat must bind the requested userId to the authenticated ` +
      `bearer token. A free userId parameter allows any authenticated ` +
      `caller to request any patient's witness context — a privacy leak ` +
      `independent of the witness-layer discipline. If impersonation / ` +
      `view-as is ever introduced, the id-match check is replaced by a ` +
      `permission check, not removed.`
  );
});

// ============================================================================
// END OF p1a_migration_guard.test.ts
// ============================================================================
