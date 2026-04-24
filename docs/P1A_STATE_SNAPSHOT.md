# P1a — Witness Layer State Snapshot

*Committed to `docs/P1A_STATE_SNAPSHOT.md`. Version 1.0. 23 April 2026.*

This document is the canonical record of what P1a built, why it exists,
what's shipped, what's live, and what's on the backlog. It is written
to be readable without any prior chat context — any future operator
(human or Claude) should be able to orient themselves to the witness
layer from this document alone.

---

## 1. What P1a is

P1a is the **witness layer scaffolding** for Vizzhy's non-ergodic
biological intelligence platform. It introduces three new Postgres
tables, one registry seed, a pure transformation module, an idempotent
backfill edge function, and a constitutional contract between raw
observations and the reasoning modules that consume them.

**P1a does not change user-visible behavior on its own.** It is a
substrate layer: it makes future intelligence *lawful* without
necessarily making the current system *smarter*. The behavioral
cutover — when the cluster graph begins consuming witness objects
instead of raw observation rows — is Artifact 6, scheduled after this
document.

**P1a is non-ergodic because**: it treats every observation as the
testimony of a specific subject at a specific time under specific
conditions. A lab value is not a population statistic; it is a sentence
about Vishnu Vardhan's hepatic flux on a given Tuesday. The witness
layer encodes that sentence structurally so downstream reasoning
cannot treat it as a population sample by accident.

---

## 2. Why P1a exists

Before P1a, Reveal Path read raw observation rows (labs, InBody,
FibroScan, CIE responses) directly from the ingestion tables and fed
them to LLM reasoning modules. Three problems compounded:

1. **No epistemic discipline.** Every observation was treated as a
   single kind of thing — a value-with-unit-and-timestamp — regardless
   of whether it was a direct biochemical measurement, a patient
   self-report, or a score derived by compressing other values.

2. **No ancestry.** CIE gate scores (compressed labels) appeared
   alongside CIE responses (source self-reports) as if they were
   independent pieces of evidence. Downstream reasoning double-counted
   compression stacks routinely.

3. **No contract.** Any observation could be consumed by any reasoner.
   New ingestion paths (sensors, omics, EMR) would land in whatever
   shape they arrived in, and reasoning modules would have to
   reverse-engineer their meaning.

P1a closes all three. Every observation that enters the reasoning
surface does so as a **WitnessObject** with mandatory metadata:
`domain_of_access`, `epistemic_role`, `compression_depth`,
`ancestry_witness_ids`, `limitations`, and `confidence_basis`. These
fields are not cosmetic — they are encoded as schema check
constraints, and violations cannot be committed.

---

## 3. Constitutional invariants

The four constitutional invariants governing P1a are stated here in
the form downstream code must respect:

**Invariant 1 — one manifest, one truth.** A patient has exactly one
coherent testimony at any moment in the system. Multiple reasoning
modules consuming witnesses must see the same witness objects,
tagged with the same registry seed version.

**Invariant 2 — structured screens never call the LLM.** Any screen
that renders witness data renders from the database. No prompt-based
narration of witnesses on the fly. LLM narration is allowed for
unstructured surfaces (chat, ask-anything) but these must consume
witnesses, not raw observations.

**Invariant 3 — evidence one click away.** Every claim a reasoner
makes must cite a witness_id. A user seeing "your HbA1c trend is X"
must be able to click through to the specific witnesses supporting
the claim. This means reasoners cannot aggregate across witnesses
without preserving provenance.

**Invariant 4 — readiness before recommendation.** Before a
recommendation is surfaced to the user, the system must have a
witness of the patient's readiness to receive it. Absence of a
readiness witness means the recommendation is withheld, not guessed.

These invariants govern design decisions in P1a and bind forward:
any subsequent artifact that proposes to violate one of these must
be justified against the invariant, not against the code.

---

## 4. Artifacts shipped

| # | Name | Path | Purpose |
|---|---|---|---|
| 1 | Witness layer schema | `supabase/migrations/20260420000000_p1a_witness_layer_schema.sql` | Three tables, four enums, fifteen check constraints, trigger, view, RLS |
| 2 | Witness contracts | `supabase/functions/_shared/witness.ts` | Canonical types, WitnessObject interface, validateWitness, error classes |
| 3 | Build script + GitHub workflow | `scripts/build-witness-registry.ts` + `.github/workflows/generate-witness-registry.yml` | Deterministic registry seed SQL generator, byte-reproducible |
| 4 | Registry seed | `supabase/migrations/20260420000100_p1a_witness_registry_seed.sql` | 554 canonical signal contracts |
| 5 | Witnessify implementation + tests | `supabase/functions/_shared/witnessify_impl.ts` + `witnessify_impl.test.ts` | Pure transformation, 12 tests, deterministic UUIDv5 IDs |
| 6 | Uniqueness migration (fixed) | `supabase/migrations/20260421010000_p1a_witness_uniqueness_constraint_fix.sql` | Non-partial unique index enabling Pattern Z idempotency |
| 7 | Backfill edge function | `supabase/functions/witnessify-observations/` (three files) | Idempotent backfill for historical observations |
| 8 | Versioned ontology input | `ontology/biomarker_ontology.json` | Source of truth for biomarker concepts; regenerates registry |

### Cross-references

- **CLARITY methodology** (Canon #000) gates all of these. Every
  artifact was designed against six-protocol review before code was
  written.
- **Doctrine of Generative Reality** names the seven native primitives
  (coherence, contradiction, scar, compensation, bottleneck,
  trajectory, unknowns) that P1a's witness layer supplies to
  downstream reasoning. P1a produces source witnesses (depth 0) and
  some simple compressions (CIE domain + gate, depth 1 and 2). Richer
  primitives — trajectories, interventions, protocols — are P1b/P1c.

---

## 5. Schema state

### Tables created

- `public.witness_signal_registry` — the canonical contract per signal
- `public.observation_packets` — pre-witness form (reserved in P1a, not populated)
- `public.witness_objects` — the validated testimony itself

### Enums

- `public.witness_source_window` (12 values)
- `public.witness_domain_of_access` (18 values, one of which —
  `clinical_compression` — is reserved out of P1a via schema check
  constraint on both tables)
- `public.witness_epistemic_role` (7 values)
- `public.witness_reliability_class` (4 values)

### Check constraints on `witness_objects` (8 non-trivial ones)

- `witness_objects_ancestry_depth_consistency` — depth 0 forbids ancestry, depths 1+ require it
- `witness_objects_compression_depth_range` — must be 0, 1, or 2
- `witness_objects_confidence_basis_meaningful` — ≥ 20 chars
- `witness_objects_confidence_value_range` — ∈ [0, 1]
- `witness_objects_depth_role_consistency` — depth and role must agree
- `witness_objects_limitations_nonempty` — ≥ 1 limitation, no blank strings
- `witness_objects_no_clinical_compression_in_p1a` — P1a reservation
- `witness_objects_testimony_not_trivial` — ≥ 20 chars
- (plus `witness_objects_has_source` — must declare either packet or row provenance)

### Trigger

- `enforce_witness_ancestry_integrity` — prevents self-reference and
  cross-user ancestry in `witness_objects.ancestry_witness_ids`

### Indexes

- `witness_objects_provenance_seed_uniq` — non-partial unique on
  `(user_id, source_table, source_row_id, registry_seed_version)`
- Secondary indexes: `idx_wo_user_domain`, `idx_wo_user_epistemic`,
  `idx_wo_user_depth`, `idx_wo_ancestry` (GIN), plus FK indexes

### View

- `v_witness_coverage` — admin inspection of witness counts by user,
  source window, domain, role, and depth

---

## 6. Registry state

**Current seed version:** `p1a_initial`
**Total rows:** 554
**Ontology version:** `celf-ontology-v1.0` (173 concepts)
**CIE seed version:** 2.2.0 (25 domains, 9 gates, 325 response signals)

### Breakdown

| Block | Prefix | Count |
|---|---|---|
| CIE responses (depth 0, self_report) | `cie.response.*` | 325 |
| CIE domain scores (depth 1, derived_score) | `cie.domain_score.*` | 25 |
| CIE gate scores (depth 2, compressed_label) | `cie.gate_score.*` | 9 |
| Lab ontology (depth 0, direct_measure) | `lab.*` | 173 |
| InBody ontology (depth 0, direct_measure) | `inbody.*` | 19 |
| FibroScan ontology (depth 0, direct_measure) | `fibroscan.*` | 3 |

### Compression depth distribution

- Depth 0: 520 (source witnesses)
- Depth 1: 25 (first-level compressions)
- Depth 2: 9 (second-level compressions)

### Invariants verified at apply-time

- Zero rows use `clinical_compression` domain (P1a reservation intact)
- Every row has `registry_seed_version = 'p1a_initial'`
- Every row has non-empty `default_limitations` (min 3 items)
- Every row has `default_confidence_basis` ≥ 20 chars

---

## 7. Live witness state (as of this snapshot)

**User:** VV-001 (user_id `d75365ce-c45e-48a0-8d30-dab491e17346`,
Vishnu Vardhan's test identity)
**Witnesses in database:** 184

| Depth | Source window | Count |
|---|---|---|
| 0 | cie | 85 |
| 0 | inbody | 19 |
| 0 | lab | 46 |
| 1 | cie | 25 |
| 2 | cie | 9 |

### Idempotency proven

Invoking `witnessify-observations` a second time with identical body
returns `witnesses_produced: 184, witnesses_inserted: 0,
duplicates_skipped: 184, error_detail: null`. Pattern Z works.

---

## 8. Fix log — incidents and their resolutions

Two notable incidents occurred during P1a build. Both are documented
here so future operators can understand the design decisions those
fixes encoded.

### Fix 1 — partial unique index (23 April 2026)

**Symptom:** First live backfill run errored with
`"there is no unique or exclusion constraint matching the ON CONFLICT
specification"`. Zero witnesses inserted.

**Root cause:** The original uniqueness migration
(`20260421000000_p1a_witness_uniqueness_constraint.sql`) created a
*partial* unique index with `WHERE source_row_id IS NOT NULL`.
PostgREST's `.upsert({ onConflict })` API does not bind to partial
indexes — it requires a full unique index or constraint on the
conflict target columns.

**Fix:** `20260421010000_p1a_witness_uniqueness_constraint_fix.sql`
drops the partial index and recreates it as non-partial. The
tradeoff — rows with NULL source_row_id may now duplicate — is
acceptable because P1a does not materialize packet-derived witnesses.
When P1b introduces packets, a separate unique index on
`(user_id, derived_from_packet_id, registry_seed_version)` will be
added.

**Lesson encoded forward:** unique indexes backing `ON CONFLICT`
must be non-partial. Any future migration creating a conflict-target
index must obey this rule.

### Fix 2 — random-UUID ancestry dangling (23 April 2026)

**Symptom:** First backfill run succeeded (184 inserted). Second run
errored with `"witness_ancestry_missing: witness <id> declares 3
ancestor(s) that do not exist"`. Zero witnesses inserted; Pattern Z
idempotency was broken at the ancestry layer.

**Root cause:** `witnessify_impl.ts` generated witness_ids via
`crypto.randomUUID()`. Each backfill run produced fresh UUIDs. On the
second run, depth-0 witnesses got NEW UUIDs; depth-1 witnesses
declared ancestry referring to those NEW UUIDs. But `ON CONFLICT DO
NOTHING` skipped the depth-0 inserts — the old rows stayed in the DB
with their ORIGINAL UUIDs. When the depth-1 INSERT fired, its ancestry
array pointed to witnesses that didn't exist in the table. The
`enforce_witness_ancestry_integrity` trigger rejected the whole batch.

**Fix:** witness_ids are now derived via UUIDv5 of the provenance
tuple `(user_id, source_table, source_row_id, registry_seed_version)`
with a fixed namespace UUID `2ba3766b-632d-4222-a8f0-152f464cdcd1`.
Same input → same UUID, always. Ancestry pointers stay stable across
runs. Pattern Z works at every depth.

**Namespace UUID must never change.** Changing it would re-ID every
witness in the database on the next backfill, orphaning every
ancestry pointer. It is committed as a constant in
`witnessify_impl.ts` and must be treated as immutable.

**Lesson encoded forward:** any object that is both (a) referenced
by other objects by ID and (b) written idempotently via upsert must
have a deterministic ID.

---

## 9. Known backlog

This is work that P1a surfaced but did not resolve. Items are ordered
roughly by urgency.

### 9.1 Canonicalization gap — 923 unmapped observations (VV-001 alone)

Of 1,015 raw observations for VV-001, 923 (91%) have `canonical_concept_id = NULL`. They cannot be witnessed because they have no ontology contract. This is a pre-P1a data-quality issue that P1a cleanly surfaced.

**Remediation path:** investigate via the two queries in
`backfill_runbook.md` § "Failure modes and recovery":
(a) classification method distribution
(b) ingestion-date cohort analysis.
Then either fix the canonicalization pipeline or backfill
canonicalization for historical data.

**Blocks:** expanding witnessify beyond VV-001 is premature while
this gap exists. Other users will show similar patterns. Resolve
before backfill to B (five BioTwins) or C (all users).

### 9.2 20 InBody keys without ontology concepts

The registry-build warning flagged 20 frontend InBody keys that have
no matching ontology concept. Examples: `visceral_fat_area`,
`skeletal_muscle_mass`, `ecw_tbw_ratio`, `basal_metabolic_rate`,
`body_fat_percent`, segmental lean masses, segmental ECW/TBW ratios,
phase angle asymmetry, whole-body impedances at 5kHz and 50kHz.

**Remediation path:** add these concepts to
`ontology/biomarker_ontology.json` with `source_systems: ["inbody"]`,
regenerate the registry seed as `p1a_inbody_extension_v1`, apply as a
new migration. The backfill function will then witness the previously-
unmappable InBody rows on re-run.

### 9.3 27 unknown signals in raw data

Twenty-two `lab.unknown` and five `inbody.unknown` signals appeared
as registry misses during VV-001 backfill. These rows had a
`canonical_concept_id` that did not match any registry signal —
likely valid medical concepts not yet in the ontology.

**Remediation path:** investigate the concept IDs, decide which to
add to the ontology, apply as an ontology extension.

### 9.4 Lexicographic ordering in CIE signal sort

The build script sorts signals lexicographically, so `A1D10` appears
before `A1D2` in the committed seed SQL. This is correct — the sort
is deterministic and stable — but aesthetically a natural-number
sort would be clearer.

**Remediation path:** minor polish; defer to the next seed version
bump.

### 9.5 GitHub 2FA

Banner on GitHub requires 2FA by May 20, 2026. Takes two minutes to
enable. Unrelated to P1a but worth naming because the build workflow
runs under this account.

### 9.6 GitHub Actions Node 24 upgrade

Deprecation warning on Node 20 actions. Deadline September 16, 2026.
Upgrade to `@v5` versions when the action publishers release them.

---

## 10. What P1a explicitly does NOT do

Listed here so future operators do not try to find P1a code that
doesn't exist.

- **Trajectory witnesses** (shape/slope/regime of signals over time) —
  P1b. Requires new witness types (`trajectory_witness`), new
  reasoning layer.
- **Intervention witnesses** (patient behaviors, training, diet, meds,
  protocols) — P1b. Requires the `intervention_layer` enum value to
  be activated, new data tables.
- **Protocol witnesses** (recurring commitments, adherence tracking,
  evolution decisions) — P1b. Surfaced by user feedback on the "mark
  InBody as done every 12 weeks" checkbox pattern.
- **TWCF (Time-Weighted Coherence Framework)** — the reasoning layer
  that operates over trajectories + interventions + their temporal
  relationship. P1c.
- **Live intake witnessify** — the backfill function is historical
  only. The CIE intake flow does not yet produce witnesses at
  submission time. When that flow is updated, it will call
  `witnessifyCieAssessment` directly (with
  `onRegistryMiss: 'throw'`, not 'skip_with_warning' — live intake
  wants loud failure on drift).
- **Packet materialization** — `observation_packets` is reserved but
  not populated. P1b optional.
- **Cluster graph migration** — the cluster graph still reads raw
  tables. This is Artifact 6, designed with Option M (migration-gate)
  regression testing.

---

## 11. The cutover plan for Artifact 6

Artifact 6 rewrites `_shared/contextLoader.ts` (consolidated from the
former `generate-clusters/contextLoader.ts`) to read from
`witness_objects` instead of raw tables. This is the first P1a-related
artifact that changes user-visible behavior.

**Regression approach: Option M (migration gate).**

Success is defined by a set of structural properties the new cluster
graph output must satisfy, not by matching old output row-for-row.
Properties include:

- Every cluster cites at least one witness_id as supporting evidence
- No cluster references a signal not in the registry
- Every citation is traceable to an actual witness_id in the DB
- Cluster generation completes without errors for VV-001
- The 184 witnesses available for VV-001 feed the graph cleanly

**Parallel run for diagnostic comparison only.** Old and new will be
run side-by-side for VV-001 to surface meaningful diffs (e.g., "the
old graph had a glucose cluster the new one doesn't — is that
because glucose labs are in the 923 unmapped?"). The diffs inform
the canonicalization backlog. They do not gate the cutover.

**Cutover is atomic.** Either the new contextLoader replaces the old
completely, or it doesn't. No mixed mode where some reasoners read
witnesses and others read raw rows.

---

## 12. How to extend P1a after this point

When the inevitable request arrives to add a new source type, new
CIE question, new biomarker, or new ontology concept, the steps are:

### Adding a biomarker concept
1. Edit `ontology/biomarker_ontology.json` — add the concept with
   `source_systems: [...]`
2. Commit, push
3. GitHub Actions workflow auto-runs on next invocation
4. Generate new seed with bumped version (e.g., `p1a_extension_v1`)
5. Apply as new migration
6. Re-run `witnessify-observations` for all users (idempotent)

### Adding a CIE question
1. Edit `src/lib/cieSeedData.ts`
2. Commit, push
3. Regenerate seed with bumped version
4. Apply migration
5. Live intake flow will witness the new question immediately
6. Historical assessments with the new question in them can be re-
   witnessified (partial ancestry allowed, see CIE evolution test in
   `witnessify_impl.test.ts`)

### Adding a new source type (e.g., a sensor)
1. Add new value to `witness_source_window` enum (via migration)
2. Add ontology concepts with `source_systems: ["sensor_x"]`
3. Regenerate seed
4. Write new ingestion flow that inserts raw rows
5. Update `witnessify-observations` to handle the new source_window
   (one new `processXxxObservations` function mirroring the existing
   patterns)
6. Ship

### The non-goal
Do not add a new witness type (e.g., `trajectory_witness`) by
extending P1a. That is P1b. It requires new columns, new indexes, and
new reasoning primitives. P1a is architecturally closed to new
witness *types* — only new instances of existing types via registry
extensions.

---

## 13. How to verify P1a is still healthy at any time

Run these four queries. All should return the expected values.
If any drifts, something has been modified outside the constitutional
discipline and needs investigation.

```sql
-- Q1: All three witness tables exist
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('witness_signal_registry', 'observation_packets', 'witness_objects');
-- Expected: 3

-- Q2: Registry intact
SELECT count(*) FROM witness_signal_registry
WHERE registry_seed_version = 'p1a_initial';
-- Expected: 554

-- Q3: No clinical_compression leakage
SELECT count(*) FROM witness_signal_registry
WHERE domain_of_access = 'clinical_compression';
-- Expected: 0

-- Q4: Pattern Z unique index is non-partial
SELECT indexdef FROM pg_indexes
WHERE indexname = 'witness_objects_provenance_seed_uniq';
-- Expected: indexdef does NOT contain 'WHERE'
```

Run these quarterly, or before any major architectural change.

---

## 14. What "P1a is done" means

P1a is done when:

1. All seven artifacts are shipped and the registry is live. ✅
2. A specific test user (VV-001) has their observations fully
   witnessified. ✅
3. Idempotency is proven by a second run. ✅
4. Artifact 6 (contextLoader rewrite) is shipped and passes its
   Option M regression gates. ⏳ in progress
5. Artifact 7 (boundary validator) is shipped, preventing raw-table
   reads from reasoning modules in CI. ⏳ pending

Items 1–3 completed 23 April 2026. Items 4–5 are next.

When item 5 ships, P1a enters "live" status: it is not just
scaffolding, it is the active substrate for all reasoning in Reveal
Path. The old path (reasoners reading raw tables) is closed at that
point.

---

## 15. Who to ask

Primary author of P1a design: Dr. Vishnu Vardhan, Founder and
Scientific Director, Vizzhy Bio Intelligence.

Design review methodology: CodexOS (structured review with numbered
corrections and explicit architectural justifications for each
decision).

Build method: single-author, small iterative artifacts, ship-one-then-
review, all changes committed through GitHub with auditable history.
Target: first 300 BioTwins built by the founder before handoff to
engineering team for Azure production-scale deployment.

---

## 16. Final note

The witness layer is not the intelligence of the system. It is the
floor under the intelligence. Everything built on top of it —
trajectories, interventions, protocols, TWCF, cluster reasoning,
clinical narration — will be only as sound as this floor.

The floor is now laid. The invariants are now enforced. The first
real subject (VV-001) has their testimony in constitutional form.

The rest of the system can now be built on something that refuses
to lie.

— End of snapshot —
