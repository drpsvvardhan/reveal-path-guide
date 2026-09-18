# Independent review of patient autonomy and protected authority

Patient Reveal is a patient-led D2C BioTwin. Patients retain reading, questioning,
data contributions and corrections, observation logging, eligible everyday plans,
and the ability to stop participation. Clinical and evidence authority must come
from its recorded source. A treatment hold must not become a blanket access hold.

## Baseline examined

The first implementation commit was `7b2f4a71821cd5bb1822a139c99c3bea5ee81fe6`.
Its migration was not applied during this review. All attack checks below ran
locally with synthetic inputs; no real patient's record was changed.

`tests/d2c-independent-review.test.ts` reproduced four defects out of six checks:

- The ordinary sleep-window template was held because a generic exercise-duration
  limit was applied to time allocated for sleep.
- A numeric field accepted a valid prefix followed by arbitrary text.
- An unrelated intervention title inherited a valid template's permission.
- A client-supplied confidence score was labelled as well-supported evidence.

`tests/d2c-independent-permissions.test.ts` applies the historical table migrations
and the legacy policy names found in the live database. It reproduced two defects
out of six checks: an authenticated patient could attach an observation to another
patient's experiment, both by insertion and by reassignment. Owner reads and
self-reporting worked; direct experiment phase writes and parent deletion were
correctly denied.

Code review additionally identified missing/error-swallowing admission-context
queries, insufficient CIE/source/context binding at activation, and incomplete UI
integration. These findings were sent to the implementation pass before deployment.

## Release verification

Local review completed on 2026-09-18 before managed deployment:

- The complete test suite passed 485 tests across 41 files. Seven additional
  permission/property-ordering/recheck regressions then passed in a focused
  40-test run (492 test cases now present).
- SQL tests execute the actual pending migration in PGlite with legacy policy
  names and real PostgreSQL roles. They cover all four reported authority writes,
  preserved owner reads/logging/dismissal, cross-patient parent assignment,
  parent deletion, stale protocol/current-context rejection, CIE handoff and
  observation-only exception, idempotent stopping and independent cycle identity.
- A normal sleep template, JSONB round-trip, strict numeric parsing, unsupported
  title, confidence forgery, and current CIE recheck are covered independently.
- App typecheck and production build passed. The production build retains its
  existing large-chunk warning.
- Independent review fixed the initially reproduced defects, a JSON-key-order
  mismatch, current-source/context transaction races, a replication-count bypass,
  inaccessible draft controls, and TypeScript narrowing failures.
- Live baseline before deployment remained 15 users, 4 reports, 443 statements,
  39 suggestions, 4 experiments and 0 protocols. No real patient row was changed.

## Managed release, executed 2026-09-18

From merged main `0adddccc271e8ea512ca609e46d4b0d477f0df55` (reviewed implementation
`32e69f3afd02f305469832a6d6bf60cc949079c4`), inside this project's managed backend only.

- Final checks before release: 492 tests across 41 files passed, app typecheck and
  production build passed, and `deno check` passed on all six changed functions after two
  type assertions in `design-experiment-protocol` were widened through `unknown`.
- The reviewed pending SQL was applied as the next ordered managed migration,
  `drizzle/migrations/0005_patient_autonomy_authority.sql`. Migrations 0000–0004, their
  journal entries and all existing rows were preserved.
- Deployed: `design-experiment-protocol`, `start-experiment-phase`,
  `compare-experiment-phases`, `simulate-what-if`, `import-biotwin-report`,
  `admin-import-biotwin`, `compare-experiment-checkpoint`.
- Signed-in live verification with two temporary accounts passed 72 of 73 checks. The single
  failure was a test fixture rejected by an existing statement check constraint; patient
  writes to that table are refused at the grant level for every row, which the run confirmed.
  Full detail is in `docs/PATIENT_AUTONOMY.md`.
- Cleanup removed only those two accounts and their rows. Post-cleanup counts match the
  pre-release baseline exactly: 15 users, 4 reports, 443 statements, 39 suggestions,
  4 experiments, 0 protocols, 0 submissions, 26 CIE assessments, 15 profiles. No real
  patient row was changed and no real clinician grant was created.
- Fresh managed security scan: no critical findings. The earlier protected-write findings now
  read as fail-closed. Still open: `celf_feature_map` readable by any signed-in user, two
  previously dismissed SECURITY DEFINER execute warnings, and authenticated read exposure of
  the RAE engine configuration tables and `witness_signal_registry`.
- The documented dependency audit (12 affected nodes: 10 high, 1 moderate, 1 low) remains
  open in the unchanged lockfile.

A successful build and a passing live run are not evidence of clinical validation. Human
clinical validity remains **NOT_ESTABLISHED**, and this release closes no unrelated security
finding.


## Independent post-release closeout

The public custom domain served `/assets/index-DMUQCd7c.js`, whose SHA-256 is
`149e70d4c11cf9132baf38a8f778aa949e9e68c9e5502d0777f9626a73af66e7`.
The served bundle contains the saved-content download, checked activation controls,
and patient-selectable plan catalogue. This confirms the published frontend,
not only the preview.

The single fixture failure above was resolved independently against the live
managed PostgreSQL database. A valid synthetic statement with
`clinical_authority='patient_facing'` was inserted in a rollback-only subtransaction.
Under the authenticated role and its synthetic owner identity, the statement was
readable and changing truth/authority was denied. The fixture was then rolled back.
The database returned PASS, with the original 4 reports and 443 statements still
present. This supplements the 72 successful signed-in HTTP checks; it does not
claim a rerun of the entire HTTP harness. See `scripts/verify-autonomy-statement.sql`.

Independent live permission inspection also confirmed all twelve examined
protected columns deny patient updates, their tables deny patient insert/delete,
and all four admission/comparison/graduation RPCs deny authenticated execution
while permitting the service role. Owner report/statement/submission reads,
observation insert/correction and suggestion dismissal remain granted. No broad
ALL policy remains on the four reported tables.

The managed migration preserves the reviewed executable SQL, adding an idempotent
trigger replacement. Regression tests now load the actual managed 0005 migration.
The two Deno compatibility changes are type assertions only. No further runtime
change or production data modification was needed for this closeout.
