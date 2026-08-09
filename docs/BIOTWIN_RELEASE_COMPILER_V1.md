# BioTwin Release Compiler v1 — Founding Cohort

## Purpose

Release real Twins without converting provenance perfection into an infinite global blocker.

The compiler is a **pure deterministic projection**:

`RUNTIME_TWIN_FINAL v18 + Founding Cohort Release Decision -> FINAL_CORRECTED_CLINICAL_EVIDENCE_REPORT`

The output is intentionally the schema already consumed by `import-biotwin-report`; Release 0 is not redesigned.

## Authority order

1. `observations.canonicalClaims[claimId]` — biological truth authority.
2. `observations.clinicalReveal` — title/summary projection only; it may never override a canonical claim state or statement.
3. `driverHierarchy`, `measurementPlan`, `contradictions` — optional release projections, filtered by the decision and by the prohibition scan.
4. All other v18 roots are invisible to compiler v1.

The compiler never traverses the 40k-line Twin looking for prose to summarize.

## Founding Cohort doctrine

Complete provenance is not a prerequisite for bounded explanatory release. Remaining provenance debt is explicit, risk-ranked, and carried forward. The following remain hard failures:

- identity/version mismatch;
- a released claim missing its canonical statement/state or an accepting release review;
- prohibited/scar text leaking into renderable release assertions;
- an autonomous medication/dose/PGx or decision-grade authority request;
- a measurement-plan leaf marked as an action.

Instrument serial number, sequencer barcode, source-file digest, and similar lineage debt are **not global blockers by default**. They become blocking only when the release authority rejects a load-bearing claim or the missing lineage changes identity, assay comparability, or the value itself.

## Truth mapping

- `MEASURED` -> confirmed finding.
- `DERIVED` / `DERIVED_REPORTED_OUTPUT` -> confirmed/non-hypothesis finding **with an explicit bound that it is derived, not directly measured**.
- `HYPOTHESIS` -> candidate/unverified.
- `RAW_GAP` / `UNKNOWN` -> open/unknown.
- `RETRACTED` / `SUPERSEDED` / `NOT_SUPPORTED` -> retired/not-supported.

The original `source_truth_class` is carried into each compiled finding.

## Release authority

Compiler v1 always emits:

- patient-facing: permitted for released findings only;
- medication/treatment decision: hold, clinician only;
- decision-grade multiomics: hold;
- PGx dose/action: hold.

The release decision cannot elevate these authorities.

## Peter Golden Fixture

The golden fixture is a compact **release-facing projection of the frozen Peter v18 bytes**, not a second Twin and not a hand-authored scientific rewrite. It retains only the exact v18 fields the compiler is allowed to read.

Frozen source SHA-256:

`e4b9ef8eb9c0a11b04646ccafed25aa1f55119e5cd35246b535e830e99ac9d67`

Golden negative requirements include:

- old sleep aggregate `5.01 h / 65.8%` cannot enter a renderable assertion;
- sleep cannot become a deficit/driver;
- vascular protein abundance cannot become established vascular activity;
- APOE cannot become a quantified ApoB driver;
- clock outputs cannot become one biological age or a patient-local aging slope.

## Factory sequence

1. Freeze exact `RUNTIME_TWIN_FINAL v18` bytes and hash them.
2. Author/review one `FOUNDING_COHORT_RELEASE_DECISION_v1` against that hash.
3. Compile deterministically.
4. Run the existing clinical-evidence detector + adapter.
5. Import with `import-biotwin-report`.
6. Run Ask My Twin adversarial smoke questions and inspect receipts.
7. Release the person; repair provenance prospectively without rewriting history.
