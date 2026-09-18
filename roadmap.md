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
