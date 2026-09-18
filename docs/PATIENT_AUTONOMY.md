# Patient autonomy in Patient Reveal

## The product principle

Patient Reveal is a **patient-led, self-managed direct-to-consumer BioTwin**. The person
who owns the account is the one who acts. They can, at any time and without anybody's
permission:

- contribute and correct their own data, with provenance kept
- read everything their Twin holds about them
- ask questions and explore hypotheses
- track symptoms and sensor measures
- choose and start an eligible everyday lifestyle experiment
- share their data
- stop anything they have started, and stop participating

**Secure backend control is not physician approval.** The backend owns what may be
*executed* so that a request body cannot declare itself safe. It does not put a doctor
in front of the product.

Clinician involvement is deliberately **narrow and scoped**:

- medication and treatment changes, including doses
- a significant safety issue raised by the CIE 3.3 intake (positive sentinel handoff)

A hold blocks **the relevant action only**. Reading, asking, learning, tracking, and
unrelated plans continue. An unresolved CIE sentinel temporarily holds all new
body-changing plans until its existing handoff/recheck workflow is resolved;
reading, questions and observation-only tracking remain available. There is no global doctor gate, and a treatment hold never
makes the app or the report unavailable.

Four distinctions the system keeps explicit:

| Distinction | Meaning here |
| --- | --- |
| Discussing vs activating | Anything can be written down, saved, read and discussed. Only a canonical server-authored action can be *started*. |
| Evidence uncertainty vs clinical risk | A low-confidence hypothesis is uncertain, not dangerous. Uncertainty alone never requires a clinician. |
| Self-reported medication use vs prescribing | Recording what someone takes is information. Changing a medicine or a dose is a clinical decision. |
| Unknown vs excluded | Information that cannot be read is UNKNOWN. It is never reported as "clear". |

## How that is enforced

**Authorization boundary.** Automatic execution is only ever a *canonical action the
server itself authored* from a server-owned catalogue entry plus strictly typed, bounded
parameters (`buildCanonicalAction`). The patient chooses the plan and its parameters; the
server writes every executable word, including the safety text. Numbers are parsed
exactly — `"20 arbitrary text"` is not twenty. A field that is not part of the template
is a refusal, not an ignored extra. If stored content does not match the canonical content to what the
server would author today, it is not executable.

**Free-form proposals** are saved exactly as written, readable, editable, and never
executable. No request field — `clinician_review_required`, `admission_verdict`,
`activation_allowed`, `patient_safe`, `confidence` — changes that. Editing a proposal
re-runs the whole assessment from scratch, including nested intervention values, stop
criteria and co-interventions; an edit cannot inherit an earlier decision.

**Scope regexes explain holds. They do not authorize anything.** They decide whether the
honest wording is "this belongs with your clinician" rather than "this is your own idea,
saved as a proposal".

**Trusted context.** Admission is computed against witness-backed patient context
(`loadPatientContext`) and the shared numeric guards extracted from `simulate-what-if`
(`derivePatientGuards`), plus the live CIE 3.3 session safety state including sessions
still in progress. If a read fails, the context is `available: false` and nothing
body-changing auto-activates — while observation-only tracking still proceeds, because
watching changes nothing.

**Binding and re-check.** Every decision is bound to the exact executable content hash,
the protocol version and a context fingerprint, and is re-computed at the moment of
starting. The commit happens through a service-only transactional RPC that re-checks
phase, protocol version, actual stored row snapshots, content hash and current
context. A brief database transaction holds SHARE locks on the three context source
tables while recomputing the fingerprint, excluding concurrent source writes and
new safety holds during activation. No network/model calls run under those locks.
This can briefly delay context writes; a more granular snapshot protocol may be
needed at higher traffic.

**Stopping and pausing** are handled before any staleness or admission check, are
idempotent, and never reopen a stopped plan.

**Held source suggestions stay held.** A template id cannot launder a blocked or
safety-flagged suggestion into an executable plan, and the suggestion's *current* verdict
is re-read at start.

**Uploads.** A patient can upload their own documents immediately. The file is kept
as parsed JSON with provenance as an owner-bound, versioned submission they can read at once.
It never writes the governed report/statement tables, never projects witness objects, and
never supersedes an existing trusted active report. A file that contains an attestation,
a "released" status or a treatment approval is told plainly that this wording is kept as
part of their document but confers nothing. The trusted install path resolves its actor on
the server; there is no caller-supplied `trusted` flag.

## What is validated, and how

Regression tests in `tests/autonomy/`:

- `action-policy.test.ts` — canonical action construction and bounds; ordinary sleep
  window (480 minutes) admitted and *not* read as extreme exercise; exact numeric parsing;
  unknown fields refused; edited-text and added-co-intervention smuggling under a valid
  `template_id` not executable; held source suggestion stays held; CIE handoff holds
  body-changing plans while reading/tracking stay open; unreadable context is not
  clearance; view-as cannot activate; free-form medication change never auto-activates and
  is never deleted; low confidence alone does not require a clinician; executable identity
  unchanged by JSON property ordering and changed by any governed value.
- `admission-context.test.ts` — biomarkers and flags from the trusted substrate; CIE
  handoff and pending recheck read from live sessions, scoped to the person; terrain
  failure, injected query error and a missing table all reported as unavailable with a
  reason.
- `design-experiment-protocol-http.test.ts` — the real HTTP handler: unauthenticated
  refusal, foreign source card refused, owner resolved server-side, malformed request
  fields named, ordinary ready-made plan cleared to start, client admission/review/safety
  flags ignored, unsafe custom wording stored as a non-executable proposal, held card not
  released, unreadable context saves rather than starts, CIE handoff holds, predictions and
  terrain references taken from the verified card only.
- `start-experiment-phase-http.test.ts` — the real HTTP handler: ownership, stop works
  with no clinical context at all and is idempotent, a stopped plan never reopens, start
  binds protocol/version/content/context to the commit, content drift and missing protocol
  refused, unreadable context and CIE handoff refuse, since-held and foreign source cards
  refused, invalid transitions refused, database `STALE_PHASE`/`CONTEXT_CHANGED`/
  `REPLICATION_REQUIRED` refusals surfaced, graduation left to the database.
- `self-service-import-http.test.ts` — the real HTTP handler: upload accepted and readable
  immediately as an owner-bound submission, self-certifying wording explicitly not
  inherited, duplicates not re-stored, non-BioTwin files refused readably, malformed body
  and unauthenticated/unauthorized callers refused, and no governed report, statement or
  witness write on this path, with an existing trusted report left untouched.

Run: `npx vitest run tests/autonomy/ tests/d2c-independent-review.test.ts tests/d2c-independent-permissions.test.ts`.
Final release counts are recorded in `docs/D2C_INDEPENDENT_REVIEW.md`.

**Comparison provenance.** Cycles have a server-assigned index. Observations retain
that index when corrected. Comparison and learning rows are immutable snapshots,
one per cycle; rerunning after editing logs returns that cycle's existing snapshot.
Completed cycles can begin another cycle only after a fresh admission check. Two
separate cycles are required for the personal graduation marker. This marker is
not a diagnosis, a treatment approval, or clinical proof of causality.

## Limits, stated plainly

- **Nothing here is clinically validated.** The catalogue bounds, the numeric guards
  (eGFR < 60, HRV < 30, BMI < 18.5, troponin/CAC > 0) and the scope patterns are
  conservative product rules carried from v0.1, not validated clinical thresholds. Human
  clinical validity remains **NOT_ESTABLISHED**.
- **Conditions absent from structured data cannot be derived.** Pregnancy, a history of
  disordered eating and any diagnosis that lives only in prose are UNKNOWN, not excluded.
- **The initial catalogue is small on purpose** (walk, protein at breakfast, sleep window,
  screen curfew, twice-weekly strength, tracking-only). Anything outside it is savable and
  discussable, not executable.
- **Handler tests isolate authentication and the database transport.** SQL-level
  authority, row-level security, parent/cascade paths and locking are the responsibility of
  the accompanying migration and its own SQL tests; these tests do not prove them.
- **No clinician release exists for experiments.** The CIE 3.3 clinician resume is a safety
  handoff, not treatment authority, and the UI must not offer it as one.
