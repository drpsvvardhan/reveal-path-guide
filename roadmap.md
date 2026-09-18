# Roadmap

- [x] export-celf-bundle v1.7 in place + redeployed
- [x] VV-001 witness reset: 184 deleted, function redeployed, backfill run twice (184 inserted / 184 skipped)
- [x] CIE v3.3 rolled out on the Lovable-managed backend (external Supabase account was never a valid deploy path)
  - [x] Migration applied via tracked workflow; CIE 2.2 history preserved (25 legacy assessments intact)
  - [x] 9 functions deployed: cie-v33 + 8 consumers of the changed shared context
  - [x] Live synthetic intake verified: consent/start, missingness, duplicate retry, pause/resume, finish, correction with prior publication retained, safety hold, cross-patient isolation
  - [x] Live consumers verified from v3.3 evidence only: ask-anything-context, patient-chat, terrain render
  - [x] tests/cie33 26 passed; full suite 329 passed with the known pre-existing ppe/comparator failure; typecheck + build clean; security scan clean
  - [x] Frontend published from the same commit
- [x] Closed: generate-ask-anything-context identifier leak — prompt hardened + deterministic output guard (cached responses included), 33 tests, redeployed, live call clean
- [x] Closed: package-lock.json reconciled for drizzle-kit/drizzle-orm/postgres (npm ci path valid again; dependencies unchanged)
- [x] Closed: two temporary rollout accounts and their synthetic data removed (25 legacy CIE 2.2 assessments and all real patients preserved)
- [x] Clinical desk assessment and 37-item validation protocol merged in PR #4; human ratings and study forms remain blank
- [x] PPE comparator test fixture corrected with overlap/consistency boundary and client/edge parity coverage; production thresholds unchanged
- [x] Clinician review implementation completed: routes/navigation, patient-only instructions, fresh recheck, consistent audit IDs, authorization locking and durable retries; full suite 397 passed, typecheck/build passed
- [x] Clinician review release executed: consistency migration applied as managed 0004, 9 functions deployed, 26/26 live synthetic checks passed incl. concurrent revoke/commit ordering, 16 synthetic accounts removed, frontend published
- [ ] Review two new managed scan warnings: authenticated read exposure of RAE engine configuration tables and witness_signal_registry
- [x] Reconciled managed migration collision: preserved applied notice security migration 0002, moved pending consistency migration to 0003, retained both branch histories; 399 tests passed
- [ ] Resolve dependency audit findings separately: 12 affected package nodes in existing lockfile; static applicability and update targets recorded in docs/validation/CIE33_DEPENDENCY_REVIEW.md
- [ ] Human clinical panel, patient comprehension study and paired clinical-information pilot; clinical validity remains NOT_ESTABLISHED

## Patient autonomy pass (tests/docs only, Sep 18)
- [ ] tests/autonomy/ handler + policy + import regression tests
- [ ] docs/PATIENT_AUTONOMY.md D2C principle and actual limits
- Runtime/SQL fixes are owned externally; no deploy/publish/apply in this pass.

## Patient autonomy release (Sep 18, 2026)
- [x] tests/autonomy/ handler + policy + import regression tests (72 tests) and docs/PATIENT_AUTONOMY.md
- [x] Full suite 492 passed across 41 files; app typecheck and production build clean; deno check clean on all six changed functions
- [x] Managed migration 0005_patient_autonomy_authority applied after 0004 with journal/snapshot; 0000–0004 untouched; existing rows intact
- [x] Deployed design-experiment-protocol, start-experiment-phase, compare-experiment-phases, simulate-what-if, import-biotwin-report, admin-import-biotwin, compare-experiment-checkpoint
- [x] Live signed-in synthetic verification 72/73 (one test-fixture failure, not a product defect); both temporary accounts and all their rows removed; baseline counts restored
- [x] Managed security scan: no critical findings; the protected-write findings now read fail-closed
- [ ] Open: celf_feature_map is readable by any signed-in user (reference mapping data; confirm intent)
- [ ] Open: two SECURITY DEFINER execute warnings previously dismissed by the user
- [ ] Open: authenticated read exposure of RAE engine configuration tables and witness_signal_registry
- [ ] Open: dependency audit — 12 affected package nodes (10 high, 1 moderate, 1 low) in the unchanged lockfile
- [ ] Human clinical validity remains NOT_ESTABLISHED


## Upload extraction + clinician walkthrough (Sep 18, 2026)
- [x] Duplicate-upload guard fixed so a file that produced no results can be re-read
- [x] process-lab-pdf and process-fibroscan deployed with the fix
- [x] Root cause of the hanging spinner: DB check constraints rejected the
      identity-confirmation statuses the processors write. Migration
      `0006_allow_upload_identity_confirmation_states.sql` widened
      `patient_lab_uploads_status_check` and
      `patient_lab_uploads_name_match_status_check`; types regenerated.
- [x] Both real lab PDFs processed live on the owner account: Nov 20 2025 panel
      99 values read (9 new), Dec 23 2025 heart panel 21 values read (4 new).
      The two stuck `processing` rows were removed.
- [x] New "What each file gave us" page (`ExtractionSection`): per-file values
      the Twin reasons with vs. read-but-unrecognised, paged read so a full
      history is not truncated, markers deduped per draw.
- [ ] Only 105 of 1028 extracted markers carry a canonical concept binding —
      ontology coverage is the real extraction gap to close next.
- [x] Lab evidence now affects action safety in one direction only: `_shared/aae/labReassessment.ts` raises concerns or sustains existing restrictions, has no clearance output, treats missing/stale/conflicting data as concerns, and attaches an explanation plus resolution path. Wired into `simulate-what-if` (flags additive only), recorded per card in `simulator_what_if_cards.lab_concerns` (migration 0007), 8 regression tests passing, function deployed.
- [ ] Clinician review walkthrough (authorize, review, hold + fresh sentinel, revoke) — blocked: need the clinician account email; no real grant will be created without it
- [ ] Clinician review walkthrough on the real account: authorize clinician Vishnu Vardhan, submit review, confirm hold + fresh sentinel, revoke grant

Patient autonomy post-release verification: the public custom-domain bundle was
confirmed independently. The one live-test fixture failure was covered by a
corrected rollback-only PostgreSQL owner-read/protected-write probe, which passed
without retaining test data. Twelve protected column permissions and four
service-only RPCs were independently checked. Existing dependency/security
backlog and NOT_ESTABLISHED clinical validity are unchanged. See
`docs/D2C_INDEPENDENT_REVIEW.md` for evidence and limits.
