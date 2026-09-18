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
- Complete Edge HTTP/live-model calls were not run against production. The local Deno endpoint check could not fetch the existing SDK from `esm.sh` because the environment refused that connection.
- Browser visual inspection could not connect to the local preview (`ERR_BLOCKED_BY_CLIENT`). React DOM interaction tests passed. An isolated synthetic visual fixture is included for reviewer use; it does not call the live backend.

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

## Deployment order and current access limit

Target: Patient Reveal, Lovable project `14971e66-0cd0-4af1-ab6e-16805aa9af66`; Supabase project **`qvkekmdzgjgfaiyboozo`**. Do not deploy this change to the separate `igjpoyxdigtnyscoleug` Supabase project.

The connected Supabase account lists only the separate project and explicitly denied the security-advisor request for Patient Reveal's project. Lovable allowed read-only schema verification. **No production schema, function, patient record or deployment was changed during implementation.** The PR is the reviewable implementation; it is not a claim of a live cutover.

Once deployment access for the actual target is available:

1. Apply `supabase/migrations/20260918031800_cie_v33_patient_intake.sql` through the project's normal migration mechanism. It was created with `supabase migration new`.
2. Deploy `cie-v33` and updated shared dependencies. Deploy `cie-score-assessment`, `generate-terrain-render`, `generate-narrative`, `generate-ask-anything-context`, `patient-chat`, `generate-action-plan`, `generate-clusters` and `simulate-what-if`; the last two depend on the changed context loader even when their entry point changes are small or absent.
3. Verify authenticated start/save/resume/correction and a synthetic confirmed-intake-to-terrain/chat round trip in the target environment. Run project security/performance advisors; these could not be run with current access.
4. Release the frontend from the same commit. The frontend depends on the new schema/function; publishing it first will break the intake.

Rollback is a coordinated application/function rollback. Preserve the additive v3.3 tables and event history; do not delete or reinterpret patient answers to roll back a UI. An older loader must not silently treat a v3.3 assessment as scored v2.2.
