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
