# Deploy and verify the clinician review workflow (after reconciliation)

No implementation changes. This plan is purely the deployment and verification sequence to run once your merge commit (parents 3740479 and 8320e1d) lands in this project.

## Preconditions I check first

- The synced commit contains both parents, and `drizzle/migrations/0002_patient_review_notice_invoker_security.sql` is byte-identical to the applied version (hash `e7371fc1…38c0`), with its journal entry and snapshot untouched.
- The pending consistency migration is present as `0003_clinician_review_consistency.sql` with a journal entry whose snapshot lineage follows 0002.
- The `acceptedAt` timestamp fix and the column-level notice privacy test are both still in the tree.

If any of these is off, I stop and report it instead of applying anything.

## Sequence

1. **Apply migration 0003** through this project's tracked managed workflow. 0000-0002 stay applied and untouched.
2. **Deploy functions**: `clinician-authorization`, `cie33-safety-review`, `cie-v33`, plus the shared evidence/context consumers (`cie-score-assessment`, `generate-terrain-render`, `generate-narrative`, `generate-ask-anything-context`, `patient-chat`, `generate-action-plan`, `generate-clusters`, `simulate-what-if`).
3. **Checks on the merged tree**: full test suite, app typecheck, production build, and `deno check` on the two review functions.
4. **Fresh security scan** — I report the actual findings verbatim, and I will not call the project security clean. The documented dependency audit (12 affected nodes: 10 high, 1 moderate, 1 low) is reported as-is against `docs/validation/CIE33_DEPENDENCY_REVIEW.md`. No dependency upgrades.
5. **Live verification on throwaway synthetic accounts** (one clinician, two patients, one admin): safety hold; queue refused before a grant; self-grant and self-review refused; grant scoped to one patient; cross-patient detail and submit refused; keep-hold; permit with the original answer retained and a fresh safety question issued; duplicate lost-response retry replaying the stored review; stale revision rejected; private notes unreadable by the patient while the notice is readable; fresh positive answer restoring the hold; revocation ending access; revocation-versus-commit timing checked against the locking added in 0003 by firing a revoke and a submit concurrently.
6. **Cleanup** limited to those exact accounts by ID, synthetic email pattern and creation window, with counts verified afterwards. Real accounts, the real completed v3.3 intake and the 25 legacy CIE 2.2 intakes stay untouched.
7. **Publish the frontend** only after the backend checks and live verification pass.
8. **Record actual results** in `docs/CIE33_ROLLOUT.md` and `roadmap.md`: migration IDs, deployed functions, real test counts, scan findings including the dependency audit, live check outcomes, cleanup counts, and setup instructions for granting authority. Clinical validity stays recorded as not established; no clinician ratings or study results.

## What I will not do

- No changes to PR #5's retry, authorization or UI implementations.
- No re-application, editing or renumbering of migrations 0000-0002.
- No authority grants or reviews on real accounts.
- No claim of clinical validation or of a clean security posture.

I'll hold here until you say the reconciliation commit is in.
