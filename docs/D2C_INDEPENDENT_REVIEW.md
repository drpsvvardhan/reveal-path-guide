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

Managed migration/function deployment and signed-in live checks remain pending;
record their actual outcome in the release closeout. A successful build is not evidence of clinical
validation, and this review does not close unrelated security findings.
