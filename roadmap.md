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
- [ ] Open defect: generate-ask-anything-context can echo raw witness_id values into patient-facing suggestions
