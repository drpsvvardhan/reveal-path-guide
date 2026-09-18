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

Still outstanding, unchanged by this rollout: clinical/psychometric validity is not established, and this release has no clinician clearance endpoint — an operational care-team handoff workflow must be supplied separately before relying on the safety hold for clinical triage.

## Clinician review of a safety hold (2026-09-18)

A safety hold still cannot be cleared by the patient, and nothing about this workflow is a clinical validation claim. What it adds is a documented, audited path for a named clinician to permit a paused questionnaire to continue.

### How authority works

- An administrator grants authority for **one patient at a time**, with a credential-review reference, a written attestation of who verified that credential, and an expiry of at most 365 days. Grants are revocable, and every grant and revocation is recorded in `clinician_authorization_audit`.
- An administrator cannot grant authority to their own account, and nobody can review their own intake. Holding the admin role is not review authority.
- No real account was granted authority during this rollout. Setup: sign in as an administrator, open **Account menu → Clinical review authority** (`/admin/clinician-authority`), and record the clinician, the patient, the credential reference, the attestation and the expiry. Clinicians who hold at least one live grant then see **Paused intakes for review** (`/clinician/safety-review`).

### What a review can and cannot do

- Dispositions are `keep_hold` or `permit_resumption`. Both require the encounter time, an assessment note, a rationale and follow-up instructions for the patient, and both are written to the immutable, attributed `cie33_safety_reviews` table.
- `permit_resumption` is permission to continue the questionnaire. It is not a finding that there is no risk. The patient's original positive answer is retained forever; a fresh, linked safety question is issued and only the patient can answer it. A fresh positive — or leaving it unanswered — restores the hold.
- Patients read only the notice written for them (disposition, encounter time, instructions) through `cie33_safety_review_notices`. Assessment notes, rationale and clinician identity are not granted to patients at column level, so a direct query is refused.
- Writes go through the service-only `cie33_submit_safety_review` routine: row lock, compare-and-set on revision and state hash, authority recheck, and idempotent replay of a retried request ID.

### Evidence

Migrations `drizzle/migrations/0001_clinician_review_authority.sql` and `0002_patient_review_notice_invoker_security.sql`. Functions deployed: `clinician-authorization`, `cie33-safety-review`, `cie-v33`.

Tests: `npx vitest run` — 381 passed (engine review semantics 9, PostgreSQL/RLS/transaction 19, clinician screen 5). Typecheck and build clean. Security scan shows no new findings; the previous Security Definer View error was resolved by migration 0002.

Live rehearsal on three throwaway synthetic accounts (patient, second patient, clinician) confirmed: hold on a positive answer; queue refused before a grant (403) and after revocation (403); self-grant refused; another patient's intake refused for both detail and submit; keep-hold recorded; permit recorded with the fresh question issued and the original answer retained; a retried request ID replayed the recorded review instead of conflicting; a stale revision rejected (409); fresh positive answer restored the hold; grant and revocation both present in the audit trail; patient could read the notice but not the private notes. All rehearsal accounts and their data were then deleted. One real completed v3.3 intake and 26 assessments remain untouched.

Outstanding: clinical and psychometric validity remain unestablished, and the workflow assumes an out-of-band clinical encounter — the app does not contact anyone on the patient's behalf.
