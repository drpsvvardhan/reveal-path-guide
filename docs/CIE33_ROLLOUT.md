# Patient Reveal: CIE 3.3 Foundation

## Assessment

CIE 3.3 is a stronger foundation for acquiring a person's account than the existing CIE 2.2 scoring flow. It binds each response to an exact question, source role, time window and acquisition contract, preserves missingness, and supports corrections without rewriting the original evidence. These are useful properties for grounding a longitudinal BioTwin.

The supplied package does **not** establish clinical validity, diagnostic accuracy, psychometric validity or improved health outcomes. Its own reference implementation declares a narrowed conformance profile. It contains 11 registered concepts, four locked sentinels, and no production persistence/authenticated transport. All **44 supplied reference tests passed** before application adaptation.

This change implements a **Vizzhy Foundation profile**, not the complete future CIE/agent/omics platform. The profile has 32 core questions, three conditional exposure/medication follow-ups, and two explicitly consented personal-context questions. Identity/source/consent are established at the start. English self-report is supported; proxy reporting, translated instruments, diagnostic scales and automated clinical escalation are outside this release.

Source archive and local adaptations are recorded in `supabase/functions/_shared/cie33/reference/PROVENANCE.md`. The two supplied ZIP copies were byte-identical. The user-supplied treatises and archive are not published in this repository.

## What replaces CIE 2.2

- New intake and retake entry points use CIE 3.3. The legacy acquisition provider is removed from the active page.
- Existing CIE 2.2 assessments, answers and computed scores remain in place, identified by `instrument_version = '2.2.0'`. They are available as history and are never reclassified as v3.3 witnesses.
- New CIE 3.3 assessments use the existing assessment ID contract so terrain/action-plan foreign keys remain valid. Their testimony is stored separately, without fabricated domain/gate scores or numerical certainty.
- The old scorer explicitly rejects v3.3. Processing and terrain regeneration no longer call that scorer for v3.3.
- Confirmed v3.3 evidence replaces legacy CIE scores in the current reasoning context. Narrative, terrain, chat, question suggestions, clustering, action-sequence explanation and What-if generation receive the versioned source evidence. Existing numerical intervention rules do not acquire invented inputs.
- A working correction preserves the last confirmed publication until the patient confirms the revised account. The earlier answer and witness remain in history. The terrain cache includes the new evidence hash.

## Persistence and access

`cie-v33` authenticates the JWT with the existing `auth.getUser` helper. Mutations are restricted to the authenticated patient; an administrator's time-bounded view-as session can inspect but cannot impersonate self-report. No browser-supplied patient ID, prompt, witness, timestamp or score is accepted as authoritative.

The server issues and validates the question, strictly validates the answer value, compiles/commits the witness, and executes one service-only **SECURITY INVOKER** transaction. `cie33_sessions` stores working and last-confirmed state; `cie33_events` stores command receipts and appended lineage. The transaction enforces durable idempotency, owner binding, version/hash comparison and append-only previous entries. Concurrent or stale answers cannot overwrite newer evidence. Authenticated clients receive only owner-scoped SELECT access; canonical writes and metadata forgery are denied.

The existing `witness_objects` registry remains the legacy/measurement substrate. CIE 3.3 has its own pinned registry (`3.3.0-vizzhy-foundation.1`) and committed witness envelopes. Its witness IDs resolve through the saved session/events, and are admitted to chat's citation allowlist only after source and hash verification. They are not converted to the legacy witness table's numeric confidence representation.

Explicit negative answers require the patient to confirm that they can report their own experience for the question's time window. This is not independent evidence of biological absence. Unknown, not recalled, declined, not applicable and temporarily unable stay distinct. Acquisition-only states are not patient answer choices. Exact text is preserved.

A positive locked immediate-safety response stops ordinary routing and displays a direct handoff message. A patient cannot self-clear that hold or silently create a replacement open session. No emergency service or clinician is automatically contacted. This release has no clinician clearance endpoint; an operational care-team handoff workflow must be supplied separately before relying on it for clinical triage. A missing safety answer is recorded as insufficient coverage, never clearance.

The general emergency wording follows [NIMH's urgent-help guidance](https://www.nimh.nih.gov/health/publications/depression); the UI uses local emergency services rather than assuming a country-specific number. The questionnaire is not an emergency response service.

## Verification

- Supplied reference suite: **44 passed** (unmodified archive).
- New application tests: **26 passed** — engine semantics, time/choice/value binding, missingness, safety hold, conditional consent, corrections, PostgreSQL transaction/idempotency/RLS, evidence admission, UI consent, lost-acknowledgment retry and resume.
- Full application suite after integration: **329 passed, one existing failure**, `src/lib/ppe/comparator.test.ts`, “POSSIBLE_SIGNAL when direction matches but overlap is high.” The same failure existed before this change; it was not altered here.
- Production Vite build passed. Application TypeScript check passed. Deno checked the new engine and evidence modules.
- PostgreSQL tests run the exact migration in PGlite against a minimal fixture of the pre-existing assessment/auth contract; these are not a claim that the complete production migration history has been replayed.
- Live authenticated Edge round trip on `qvkekmdzgjgfaiyboozo` (2026-09-18): two isolated synthetic accounts, no real patient record touched. Executed against the deployed `cie-v33`: consent/start, 34 answered questions including one explicit `unknown` missingness answer, duplicate retry with a reused `request_id` (same revision returned, no second entry), pause, resume, review/finish, and two corrections that superseded the prior `nicotine` witnesses while retaining them in history. A second synthetic account answered the locked immediate-safety sentinel positively and entered `safety_hold`; a subsequent `start` returned the held session with no next question and could not self-clear. Unauthenticated call returned 401. Cross-patient read of another subject's session returned `state: null`.
- Live consumer checks on the same backend: `generate-ask-anything-context` returned 200 with suggestions grounded only in v3.3 witnesses; `patient-chat` returned 200 with prose derived from the confirmed intake and witness-only grounding refs; `generate-terrain-render` returned 200 (`voice_validation_status: passed`, version 1) from v3.3 evidence with no fabricated v2.2 domain/gate scores. Legacy inventory after the migration: 25 `2.2.0` assessments unchanged.
- Browser visual inspection could not connect to the local preview (`ERR_BLOCKED_BY_CLIENT`). React DOM interaction tests passed. An isolated synthetic visual fixture is included for reviewer use; it does not call the live backend.
- Managed security scan after deployment: no new findings (two pre-existing `SECURITY DEFINER` advisories, previously dismissed, unchanged).
- Closed out (2026-09-18): `generate-ask-anything-context` no longer exposes internal identifiers in `suggested_questions`. The question prompt now forbids IDs, hashes, field names and citation/template markers outright, and a deterministic final-output guard (`supabase/functions/_shared/patientQuestionGuard.ts`) validates each value as a non-empty string, drops any question containing a UUID, bare hex fragment, internal field name or template marker, collapses duplicates, and substitutes readable safe fallbacks instead of emitting mangled text. The guard is also applied when serving cached payloads, so responses cached before the fix cannot reach a patient. Witness grounding, evidence refs and returned `used_refs` are unchanged internally; authentication, target-user resolution and isolation are untouched, and no medical claim was added. Regression coverage: `tests/cie33/patient-question-guard.test.ts` asserts the real leaked shapes observed live (`witness_id c9df00a7`, full witness UUID, `observation_id`, `state_hash`, `assessment_id`, `{cluster:...}`, `<placeholder>`, `registry_seed_version`, `sha256`, `user_id`) are rejected and that normal patient questions pass unchanged. Function redeployed; one authenticated live call on the synthetic intake returned four clean grounded suggestions with zero identifier hits (repeat call through the cache path also clean).
- Synthetic verification identities removed (2026-09-18) through the managed data path, matched on both ID and email and on creation after `2026-09-18T05:14:36Z`: `cie33-synth-a@example.com` / `bdcf69e1-…` and `cie33-synth-b@example.com` / `b82fb77a-…`, together with their sessions, event lineage, assessments, derived rows, terrain render, chat/validation rows and profiles. No usable synthetic sign-in or fake patient record remains; only this written summary. Post-cleanup counts: 0 synthetic users, 25 legacy `2.2.0` assessments intact, 15 real accounts and 15 profiles intact, and one unrelated real-patient v3.3 session preserved.
- `package-lock.json` reconciled for the `drizzle-kit` / `drizzle-orm` / `postgres` entries added by the managed migration tooling (`npm install --package-lock-only`). Chosen dependencies and `package.json` are unchanged (`drizzle-kit 0.31.10`, `drizzle-orm 0.45.2`, `postgres 3.4.9`); `npm ci` resolves cleanly again, so the documented reproduce path remains valid. Post-closeout checks: `tests/cie33` **33 passed**, `tsc -p tsconfig.app.json --noEmit` clean, production build clean.


Reproduce:

```sh
npm ci
npx vitest run tests/cie33
npx tsc -p tsconfig.app.json --noEmit
npm run build
# Optional local visual review, synthetic data only:
npx vite --config tests/cie33/browser/vite.config.ts
# Open http://127.0.0.1:5173/tests/cie33/browser/index.html
```

The lockfile was reconciled because the baseline `npm ci` failed on missing dependency entries. PGlite 0.5.8 is an exact development dependency used only for database tests.

## Deployment result (Lovable-managed path)

Target: Patient Reveal, Lovable project `14971e66-0cd0-4af1-ab6e-16805aa9af66`; Supabase project **`qvkekmdzgjgfaiyboozo`**. The separate `igjpoyxdigtnyscoleug` project is not a deployment target. The earlier external-access blocker no longer applies: this project's backend is Lovable-managed, and the migration and function deployments were executed from inside the project. No external Supabase credentials were used.

Completed on 2026-09-18, in this order:

1. **Migration applied.** The additive migration `supabase/migrations/20260918031800_cie_v33_patient_intake.sql` was applied through the managed tracked workflow as `drizzle/migrations/0000_cie_v33_patient_intake.sql`: `cie_assessments.instrument_version` (constrained to `2.2.0` / `3.3.0`), `cie33_sessions`, append-only `cie33_events`, owner-scoped RLS, the `cie33_guard_assessment` trigger and the service-only `cie33_commit` routine. Generated Supabase types were refreshed. Existing CIE 2.2 assessments, answers and scores were untouched.
2. **Functions deployed.** `cie-v33`, `cie-score-assessment`, `generate-terrain-render`, `generate-narrative`, `generate-ask-anything-context`, `patient-chat`, `generate-action-plan`, `generate-clusters`, `simulate-what-if` — all deployed successfully. Existing authentication is preserved; `cie-v33` verifies the JWT via the shared `auth.getUser` helper.
3. **Live verification passed.** See the live round-trip and consumer entries under Verification.
4. **Frontend released** from the same commit, after the backend checks passed.

Rollback is a coordinated application/function rollback. Preserve the additive v3.3 tables and event history; do not delete or reinterpret patient answers to roll back a UI. An older loader must not silently treat a v3.3 assessment as scored v2.2.

At the initial rollout above, clinical/psychometric validity was not established and a clinician disposition workflow was absent. The follow-up below records the subsequent work separately from those historical deployment results.

## Clinician workflow follow-up — release verification pending

### Reconciliation of parallel managed changes

Lovable's branch `8320e1d0a862c42265827f72ef2b81b84cc9fdc5` applied `0002_patient_review_notice_invoker_security.sql` while GitHub PR #5 introduced a different migration numbered `0002`. Production's migration ledger confirms that the notice security migration was applied. Its exact file and snapshot are preserved; the still-pending consistency migration is renumbered to `0003_clinician_review_consistency.sql`, after the applied journal entry. Both branches are retained as merge ancestry.

The integrated UI retains PR #5's permission-aware navigation and owner-only notice endpoint, which already cover the parallel branch's route and notice work. The parallel branch's timestamp fix is retained: review screens use the server-accepted answer time. Its earlier reported live rehearsal and scan do not substitute for live verification of the final merged code and consistency migration.

Reconciliation verification: **399 tests passed across 34 files**. The suite now applies the exact production notice-security migration before the pending consistency migration, and verifies direct column-level privacy, cross-patient notice isolation and server-accepted timestamps. The preserved security migration's SHA-256 matches the production ledger (`e7371fc10df5e3f67a90ebcc8ba77719cdfcc82a408471e37f4304dd452338c0`); the live notice view reports `security_invoker=on`.

The clinician workflow started in commit `a180d024`. The initial managed authority migration exists in production, but the interrupted build did not establish that the complete UI/function release or its live checks finished. Do not treat the historical security-scan and live-test results above as verification of this follow-up.

The completed code provides:

- `/admin/clinician-authority`: administrators authorize an existing clinician account for one named patient after recording a human credential-review reference and attestation. Authority has an expiry and can be revoked; grants and revocations are audited. Administrative access alone does not permit clinical review, and self-review is denied.
- `/clinician/safety-review`: assigned clinicians inspect the exact safety question, answer, time and preserved history. A disposition requires an encounter time, assessment/contact documentation, rationale and patient instructions. It can retain the hold or permit questionnaire resumption. Resumption is not risk exclusion, medical clearance or treatment approval.
- A permitted patient receives a fresh safety question. The original answer remains in history; a positive or missing fresh response reinstates the hold. Only the patient can answer. Clinician assessment and rationale remain private; the patient notice exposes only the designated patient instructions and disposition.
- A forward consistency migration coordinates revocation with review commits, binds the same authorization and review identifiers across records, and supports durable retries. Existing migration history and patient testimony are preserved.
- Publication explicitly rejects an outstanding safety recheck, even if an inconsistent state reaches the evidence boundary.

### Operational setup

After deployment is verified, a clinical operations lead must establish actual queue ownership, service hours, escalation/backup arrangements and how patients contact their care team. An authorized administrator can then open **Clinical review authority**, select the existing clinician and patient accounts, record the credential verification, and set the expiry. The clinician signs in with their own account and opens **Paused intakes for review**. No actual clinician authorization has been created by this implementation task. The application does not automatically contact a clinician or emergency service.

### Clinical assessment and study package

[Clinical validation protocol](validation/CIE33_CLINICAL_VALIDATION.md), [37-item review matrix](validation/CIE33_ITEM_REVIEW.csv), [source audit](validation/CIE33_SOURCE_AUDIT.json) and [blank study forms](validation/CIE33_STUDY_FORMS.csv) are merged in PR #4. The source audit verifies 32 core, three conditional and two opt-in questions, with four sentinels. The package records a desk assessment and proposed panel, cognitive-interview and paired-information study methods. **Clinical validity remains NOT_ESTABLISHED: no human panel ratings, participant data or clinical outcomes were produced.**

### Comparator correction

The old failing test mislabeled a low-overlap fixture as high overlap. Its original data have overlap `7/15` and consistency `0.8`, meeting the existing `SIGNAL_DETECTED` rule. The original case is now an explicit regression, alongside a true high-overlap fixture, exact policy boundaries and client/edge parity checks. Both production comparator implementations and their thresholds are unchanged. This fixes test evidence; it does not clinically calibrate the policy.

### Verified so far and remaining release gate

- Recovered implementation at `a180d024`: full suite **375/375 passed** and application TypeScript check passed locally.
- Completed follow-up: full suite **397/397 passed across 34 files**, application TypeScript check passed, and production build passed. This includes the actual HTTP handler with mocked authentication/database transport, PostgreSQL/RLS tests against the forward migration, and UI interaction tests. PGlite cannot reproduce independent concurrent database connections; live revocation/commit scheduling remains a deployment verification item.
- Independent source review verified the 37-item inventory and blank human-review fields; comparator tests **16/16 passed**.
- Read-only production metadata inspection: all five CIE/clinical authority tables have RLS enabled; all three grant/revoke/review routines are `SECURITY INVOKER`, executable only by `service_role` and the database owner. There are zero clinician grants and zero clinical reviews; all 25 legacy CIE 2.2 assessments remain present. This targeted inspection is not a substitute for the requested fresh managed security scan.
- Fresh `npm audit --omit=dev`: **12 affected package nodes (10 high, one moderate, one low)** in the pre-existing lockfile. The [dependency review](validation/CIE33_DEPENDENCY_REVIEW.md) records code applicability and available update targets. No exploit path was established for the inspected Router/WebSocket/Lodash usage, but findings remain open; this is not a clean audit. Dependency remediation is separate from the clinician feature and managed security scan.
- Before release: apply the forward migration through the tracked managed workflow; deploy `clinician-authorization`, `cie33-safety-review`, `cie-v33` and all shared evidence consumers; run the fresh managed security scan; verify authorized/unauthorized synthetic HTTP flows including retry, revocation, expiry, hold/recheck and patient-notice privacy; remove only the exact new synthetic identities/records; publish the frontend after those checks pass. Record actual outcomes here. A queued Lovable request is not proof of deployment.
