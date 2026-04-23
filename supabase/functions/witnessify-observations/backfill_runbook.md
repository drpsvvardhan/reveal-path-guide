# witnessify-observations — Operational Runbook

*P1a Artifact 5. Version 1.0. 20 Apr 2026.*

This function transforms historical raw observations into WitnessObjects.
It is safe to re-run. It is idempotent via the Pattern Z unique index
(`witness_objects_provenance_seed_uniq`).

## What it does, in one paragraph

Reads rows from `patient_lab_observations` (which holds lab, InBody, and
FibroScan) and the four CIE tables, scoped to a list of `user_ids`. Calls
`witnessify_impl` on each observation and each full CIE assessment.
Inserts produced WitnessObjects into `witness_objects` with
`ON CONFLICT DO NOTHING` so re-running is free. Returns a structured
report of what was scanned, produced, inserted, skipped, and flagged.

## Preconditions

Before first invocation, confirm:

1. **Schema is live:** `witness_signal_registry`, `witness_objects`, and
   `observation_packets` exist and all 15 check constraints are present.

2. **Registry is seeded:** 554 rows in `witness_signal_registry` with
   `registry_seed_version = 'p1a_initial'`.

3. **Uniqueness migration applied:** the partial unique index
   `witness_objects_provenance_seed_uniq` exists on `witness_objects`.
   Verify with:
   ```sql
   SELECT indexname FROM pg_indexes
   WHERE tablename = 'witness_objects'
     AND indexname = 'witness_objects_provenance_seed_uniq';
   ```
   Expected: one row.

4. **Function deployed:** `witnessify-observations` is listed in
   `supabase functions list` (or visible in the Lovable functions UI).

## Invocation shape

```http
POST /functions/v1/witnessify-observations
Authorization: Bearer <SERVICE_ROLE_KEY>
Content-Type: application/json

{
  "user_ids": ["d75365ce-c45e-48a0-8d30-dab491e17346"],
  "source_windows": ["lab", "inbody", "fibroscan", "cie"],
  "dry_run": true
}
```

### Body fields

- `user_ids` (required, string[]) — UUIDs to process. Processing is
  per-user; a failure on one user does not affect others.
- `source_windows` (optional, string[]) — defaults to all four.
  Values: `"lab"`, `"inbody"`, `"fibroscan"`, `"cie"`.
- `dry_run` (required, boolean) — if `true`, everything runs **except** the
  final INSERT. Use for first run to inspect what would be produced.
- `registry_seed_version` (optional, string) — defaults to `"p1a_initial"`.
  Specify explicitly after the first seed-version bump.

## First-run procedure — VV-001 dry run

**Step 1. Dry run, VV-001 only, all source windows.**

```bash
curl -X POST \
  "$SUPABASE_URL/functions/v1/witnessify-observations" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_ids": ["d75365ce-c45e-48a0-8d30-dab491e17346"],
    "dry_run": true
  }'
```

**Step 2. Inspect the report.**

Expected shape of success response:

```json
{
  "ok": true,
  "dry_run": true,
  "registry_seed_version": "p1a_initial",
  "registry_rows_loaded": 554,
  "elapsed_ms": 1234,
  "report": {
    "per_user": [
      {
        "user_id": "d75365ce-c45e-48a0-8d30-dab491e17346",
        "lab_observations_scanned": 42,
        "inbody_observations_scanned": 12,
        "fibroscan_observations_scanned": 0,
        "cie_assessments_scanned": 1,
        "witnesses_produced": 410,
        "witnesses_inserted": 0,
        "duplicates_skipped": 0,
        "registry_misses": [...],
        "validation_failures": [...],
        "soft_warnings": [...],
        "error_detail": null
      }
    ],
    "totals": { ... }
  }
}
```

**Step 3. Read the report carefully before proceeding.**

Things to verify:

- `witnesses_produced` should be roughly the sum of:
  (direct observations with `canonical_concept_id` set)
  + (CIE responses per completed assessment)
  + (CIE domain scores per assessment)
  + (CIE gate scores per assessment)

- `registry_misses` should be small in volume and explicable. Common
  expected misses:
  - Direct observation rows without `canonical_concept_id` (unmapped
    observations in `observation_review_queue`) — `signal` will be
    `<no-canonical-concept-id>`.
  - InBody metrics where the frontend key is present but no ontology
    concept exists (the 20 keys flagged by the registry-build warning).

- `validation_failures` should be empty or near-empty. Any entry here
  indicates a data-quality issue that merits a look.

- `soft_warnings` may include `domain_ancestry_partial` or
  `gate_ancestry_partial` entries. These are informational: the witness
  was produced with a narrower ancestry than the caller originally
  intended, usually because CIE evolved between the original assessment
  and the current registry seed.

**Step 4. Live run.**

Once the dry-run report looks right, re-invoke with `dry_run: false`:

```bash
curl -X POST ... -d '{
  "user_ids": ["d75365ce-c45e-48a0-8d30-dab491e17346"],
  "dry_run": false
}'
```

`witnesses_inserted` should equal `witnesses_produced`. `duplicates_skipped`
should be 0 on first run.

**Step 5. Verify in database.**

```sql
SELECT
  compression_depth,
  count(*) AS n
FROM witness_objects
WHERE user_id = 'd75365ce-c45e-48a0-8d30-dab491e17346'
  AND registry_seed_version = 'p1a_initial'
GROUP BY 1
ORDER BY 1;
```

Expected: 3 rows, one per depth (0/1/2). Depth 0 should dominate.

## Re-running (idempotency)

Running the function a second time with identical arguments:

- Re-scans the same raw rows.
- Re-builds the same witnesses (same UUIDs are NOT guaranteed — each run
  generates fresh UUIDs; idempotency is at the provenance-tuple level,
  not the witness_id level).
- Inserts via upsert. The Pattern Z unique index on
  `(user_id, source_table, source_row_id, registry_seed_version)` catches
  all duplicates.
- `duplicates_skipped` will equal `witnesses_produced` on a no-op re-run.

**Safe to re-run at any time. No cleanup required.**

## Scaling up

After VV-001 succeeds, expand by adding user_ids:

```json
{
  "user_ids": [
    "<VV-001-uuid>",
    "<KF-001-uuid>",
    "<RS-001-uuid>",
    "<SM-001-uuid>",
    "<HV-001-uuid>",
    "<VP-001-uuid>"
  ],
  "dry_run": false
}
```

One HTTP call processes all six. Users are processed sequentially; expect
roughly `O(rows × users)` time.

For a full-system backfill, invoke with all user_ids at once. Edge
functions in Supabase have a request time budget — if you're at tens of
thousands of users, split into multiple requests and track progress
externally. For the 5-to-30-BioTwin range you're in, a single call works.

## Failure modes and recovery

### Fatal error response

```json
{ "ok": false, "error": "<message>", "elapsed_ms": ... }
```

Nothing was inserted. Read the error. Common causes:

- Registry not seeded → apply the seed migration.
- Network / connection error → retry.
- Unexpected schema drift → diagnose which query failed; the error
  message identifies the table.

### Per-user error (non-fatal)

The response is `ok: true` but some `per_user` entries have
`error_detail` set and `witnesses_inserted: 0` for that user.

- Read `error_detail`. Usually a CIE scoring edge case (e.g., a CIE
  assessment with `status = 'in_progress'` that slipped through the
  status filter, or an orphan domain score without contributing
  responses).
- Fix the data or skip that assessment by using the `user_ids` filter to
  exclude it.
- Other users' results are unaffected.

### Partial witness produced

You may see `witnesses_produced > 0` alongside entries in
`validation_failures` and/or `registry_misses`. This is **normal and
expected** in a historical backfill.

- Registry misses are not failures — they are structured evidence of what
  the current registry doesn't cover. Use the list to decide whether
  to expand the ontology (and bump the registry seed version) or accept
  them as unwitnessable.
- Validation failures indicate specific rows where the observation value
  or testimony didn't meet the constitutional standard. Usually
  recoverable by data cleanup, not by function changes.

## What this function does NOT do

- **Live intake.** For live intake (e.g., immediately after a new CIE
  submission), call `witnessify_impl` directly from the intake flow's
  edge function — not via this backfill endpoint.
- **Trajectory witnesses.** Each observation produces one witness.
  Trajectory reasoning is P1b.
- **Intervention witnesses.** Training, diet, meds — not P1a.
- **Protocol witnesses.** Recurring-event adherence — not P1a.
- **Packet materialization.** `observation_packets` is optional per
  CodexOS guidance; this function writes directly to `witness_objects`
  without materializing packets first.
- **Cluster regeneration.** After backfill, `generate-clusters` still
  reads from raw tables. The cutover happens in Artifact 6.

## Backlog captured during Artifact 5

- **20 InBody keys without ontology concepts** (from
  `inbodyToTerrainMap.ts`). Expected to surface as registry misses for
  InBody backfill. Resolve via `p1a_inbody_extension_v1` ontology bump.

- **Unmapped observations in `observation_review_queue`.** Show up as
  `signal: '<no-canonical-concept-id>'` misses. These should be
  resolved by curating the review queue (not by witnessify).

- **CIE evolution drift.** If CIE questions have been added since the
  current registry seed, backfill will report
  `cie.response.<question_id>` misses. When this volume becomes
  meaningful, bump the registry with a new seed version and re-run
  backfill (idempotent — only new witnesses land).

## End of runbook
