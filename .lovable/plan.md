# BioTwin Clinical Evidence Report — deterministic adapter + governed UI projection

Reuse the existing governed runtime. Nothing about auth, uploads, witness governance, patient-chat, authority gates, validation or audit is rebuilt or replaced. Everything below is additive.

## What the attached report actually is

A fully structured, self-governing clinical evidence document (840 lines) with these top-level sections: `schema`, `subject`, `provenance`, `release_control`, `executive_synthesis`, `clinical_state` (4 truth buckets), `repaired_driver_hierarchy`, `measurement_and_action_plan`, `medication_status`, `genomics_and_pgx`, `omics_readiness`, `register_governance`, `contradiction_reclassification`, `coupling_and_score_governance`, `technical_integrity`, `semantic_repair_ledger`, `clinical_report_projection` (allowed/prohibited headline statements), `external_evidence`, `final_attestation`.

It carries its own truth status, its own release gates and its own prohibited statements. It must be adapted, never interpreted by an LLM.

## Verified current-state facts this plan relies on

- `witness_objects` enforces: `source_window`+`signal` FK into `witness_signal_registry`, depth/role consistency (depth 0 = direct measures only), `domain_of_access <> 'clinical_compression'`, non-empty limitations, testimony/confidence_basis length floors.
- `witness_signal_registry` currently holds exactly one seed, `p1a_initial`, covering `cie`, `lab`, `inbody`, `fibroscan`.
- The `witness_source_window` enum already contains an unused `emr` value, so no enum change (and therefore no irreversible migration) is needed.
- `contextLoader.loadPatientContext` filters witnesses to seed `p1a_initial`, so a new seed cannot contaminate current terrain reasoning.
- Routes: `/manifest-preview`, `/share/:token`, `/clinical/:token` are unauthenticated; `/`, `/account`, `/admin/*` are gated by `ProtectedRoute` / `AdminRoute`.

## Architecture

```text
report.json ──> import-biotwin-report (edge, JWT verified in code)
                   │ 1. detect + validate schema (deterministic, zod)
                   │ 2. sha256 → idempotency / version chain
                   │ 3. adapt → statements (no LLM)
                   ├──> biotwin_reports        (governed source, raw JSON preserved)
                   ├──> biotwin_statements     (evidence objects, truth status kept)
                   └──> witness_objects        (ONLY confirmed numeric measurements,
                                                seed 'biotwin_v1', source_window 'emr')

patient-chat ──> existing loadPatientContext  (unchanged)
             └──> NEW loadBiotwinPacket       (bounded, adds holds + prohibited list)

UI ──> new authenticated "Your BioTwin" section (11 panels), never on public routes
```

## Database migration (additive, rollback = drop two tables + one seed)

1. `public.biotwin_reports` — `user_id`, `upload_id` (nullable FK to `patient_lab_uploads`), `twin_id`, `schema_name`, `schema_version`, `report_type`, `semantic_repair_version`, `generated_date`, `content_sha256`, `version`, `status` (`active` | `superseded` | `rejected`), `release_control` jsonb, `executive_synthesis` jsonb, `attestation` jsonb, `raw_report` jsonb, `import_diagnostics` jsonb, timestamps. Unique `(user_id, content_sha256)` for idempotent re-import; partial unique index for one `active` row per user; trigger supersedes the prior active row on insert (same pattern as `terrain_renders`).
2. `public.biotwin_statements` — `report_id`, `user_id`, `source_id` (stable), `section`, `statement_kind`, `truth_status` (`confirmed` | `candidate` | `unknown` | `retired` | `prohibited`), `title`, `body`, `bounds` jsonb, `timepoint`, `clinical_authority` (`patient_facing` | `clinician_only` | `research_only` | `prohibited`), `requires_measurement` jsonb, `holds` text[], `provenance` jsonb, `ordinal`. Unique `(report_id, source_id)`.
3. GRANTs on both: `SELECT, INSERT, UPDATE, DELETE` to `authenticated`, `ALL` to `service_role`, **no anon grant**. RLS on; policies = own rows (`auth.uid() = user_id`), plus admin read via `has_role(auth.uid(),'admin')` and the existing `has_valid_view_as_session` pattern.
4. Seed `witness_signal_registry` rows under `registry_seed_version = 'biotwin_v1'`, `source_window = 'emr'`, one row per admitted confirmed-measurement signal, with `domain_of_access` chosen from existing allowed values (never `clinical_compression`). Rollback: delete that seed's rows.

## Adapter (deterministic, no LLM)

New `supabase/functions/_shared/biotwin/`:

- `detect.ts` — accepts only `schema.name === "Vizzhy BioTwin Clinical Evidence Report"` **and** `schema.report_type === "FINAL_CORRECTED_CLINICAL_EVIDENCE_REPORT"`; anything else is refused with a typed reason (never routed to generic extraction).
- `schema.ts` — zod schema for every consumed section, permissive on unknown extra keys, strict on the governance-critical ones (`release_control`, `clinical_state`, `clinical_report_projection`, `final_attestation`).
- `adapter.ts` — pure function `adaptBiotwinReport(json) → { report, statements[], diagnostics[] }`. Field mapping:
  - `clinical_state.confirmed_measurements_and_bounded_findings` → `truth_status: confirmed`
  - `clinical_state.candidate_or_unverified_signals` → `candidate`
  - `clinical_state.open_screening_findings` → `unknown`
  - `clinical_state.not_established_or_not_supported` → `retired`
  - `clinical_report_projection.prohibited_headline_statements` → `prohibited` (authority `prohibited`)
  - `repaired_driver_hierarchy` → `driver` statements keyed by `rank`, carrying `state`, `why_it_matters`, `what_would_change_management`
  - `measurement_and_action_plan` → `action` statements with `priority`, `timeframe`, `minimum_fields`, `specific_items`, `truth_transition` → `requires_measurement`
  - `medication_status` → `medication` statements; `historical_or_unresolved_items` and the lipid/glucose therapy lines become holds
  - `genomics_and_pgx` (incl. `pgx.hard_gates_permitted`, `patient_specific_use`) → `genomic` / `pgx` statements; a PGx hold is set whenever hard gates are not permitted
  - `omics_readiness.layers` → `omics_layer` statements
  - `contradiction_reclassification` → `contradiction` statements keyed by the file's own `source_id`
  - `semantic_repair_ledger` → `repair` statements keyed by `repair_id`
  - `external_evidence` → `external_evidence` statements keyed by `evidence_id`
  - `provenance`, `technical_integrity`, `coupling_and_score_governance` → per-statement `provenance` plus report-level diagnostics
  - `source_id` comes from the file when present, otherwise is derived deterministically as `sha256(section + ordinal + normalized title)` so re-import is stable.
- `witnessProjection.ts` — projects only statements that are confirmed **and** carry a numeric value, unit and timepoint into depth-0 witnesses through the existing `rae_insert_witness_object` RPC. Everything else stays statement-only; no bucket is flattened into another.
- `packet.ts` — `buildBiotwinPacket(userId)` returns a bounded packet (hard caps per section) containing `release_control`, allowed/prohibited headline statements, driver hierarchy, holds (medication / PGx / CGM), contradictions, outstanding measurement requirements and clinician-review status.

New edge function `import-biotwin-report`: validates the JWT in code, resolves `user_id` server-side (never from the body; admin may target another user only through an active view-as session), runs the adapter, writes report + statements + witnesses, and returns human-readable diagnostics (accepted counts per bucket, skipped items with reasons, version/idempotency verdict).

## Precedence and safety

- The imported report is authoritative. `release_control` and `clinical_report_projection` gate what may be shown or said; CIE-derived scores, hard-coded thresholds, `sampleManifest`, and generated narratives can never override it.
- The `patient-chat` change is narrow: attach the BioTwin packet as a distinct source window alongside the existing witness context, add precedence + hold rules to the system prompt, and extend the existing validator so prohibited headline statements, medication/PGx/CGM holds and "measurement required" claims are refused the same way dose claims already are. The existing `patient_chat_validation_log` audit row records BioTwin violations.
- If `release_control.patient_facing_release` is not released, patient mode shows the report's own status line and the clinician panels stay admin-only.

## UI projection — "Your BioTwin"

New nav item plus `src/components/sections/biotwin/` with one component per panel: Executive synthesis · Known / candidate / unknown state · Repaired driver hierarchy · Measurement & action plan · Medication status · Genomics & PGx · Omics readiness · Contradictions & repair ledger · Evidence & provenance · Ask your twin. A new `BioTwinContext` fetches the active report + statements for the resolved user (auth or view-as). The section only appears when an active report exists, so nothing changes for users without one.

Exposure guarantees: no BioTwin data in `sampleManifest`, `ManifestPreview`, `SharedQueue`, `ClinicalShare`, or the `get_shared_*` functions; no anon grants; the clinician bearer-token share flow is left untouched.

## Tests and fixtures

- `tests/fixtures/biotwin/` — the attached report with subject identity replaced by a synthetic person, plus: a wrong-`schema.name` file, a wrong-`report_type` file, a missing-`release_control` file, and a second version of the valid file for the re-import path.
- Vitest: adapter mapping (bucket → truth status, no cross-bucket flattening), stable `source_id` derivation, packet bounding, prohibited-headline enforcement, hold derivation.

## Acceptance tests

1. Valid report imports; statement counts per bucket match the JSON exactly; no LLM call is made during import.
2. A file with either wrong `schema.name` or wrong `report_type` is refused with a readable diagnostic and writes no rows.
3. Re-importing the identical file creates no duplicates; a modified report supersedes the prior version and leaves exactly one active row.
4. Prohibited headline statements never appear in UI or chat output; an attempt is logged in `patient_chat_validation_log`.
5. Chat answers preserve `release_control`, medication/PGx/CGM holds, contradictions, measurement requirements and clinician-review status; contradicting CIE scores or narrative text do not win.
6. Only confirmed numeric measurements exist as witnesses; candidate/unknown/retired/prohibited statements have no witness rows.
7. `/manifest-preview`, `/share/:token`, `/clinical/:token` return zero BioTwin data for a user who has an imported report; the anon role has no grant on either table.
8. Migration rollback (drop the two tables + delete the `biotwin_v1` seed) leaves the existing app fully functional.
9. Nothing is published or deployed as part of this work.

## Technical notes

- No enum values are added, so the migration is fully reversible.
- `p1a_initial` stays the active seed for existing terrain reasoning; `biotwin_v1` is read only by the BioTwin path.
- The adapter is schema-driven and contains no patient-specific identifiers, so any future subject using this schema works unchanged.