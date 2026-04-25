# `/manifest-preview` — Patient Manifest Preview Tool

A self-contained, client-only tool for validating and previewing patient
manifest JSON against the renderer schema. Useful for QA-ing manifests
produced by upstream pipelines before they're surfaced to patients.

- **Route:** `/manifest-preview`
- **Auth:** none (public, client-only)
- **Backend:** none — no data is sent to any server

---

## Purpose

Reviewers, clinicians, and engineers often need to inspect a manifest
blob without wiring it into the full patient app. This page provides:

- Schema validation with friendly, grouped error messages
- A data-driven section renderer with graceful fallbacks for missing
  fields (no hardcoded patient assumptions)
- A bundled sample manifest for fast smoke-testing the renderer
- A diff view comparing the current manifest against the bundled sample
- Local persistence of the last valid manifest in `localStorage`

---

## How to use

### Load the bundled sample
Click **Load sample manifest** to populate the input with a fully
exercised mock manifest. Every supported section is filled in so you
can see each renderer at once.

### Upload a `.json` file
Click **Upload .json** and pick a manifest file from disk. Files larger
than 2 MB are rejected to keep the previewer responsive.

### Paste JSON directly
Paste any manifest JSON into the textarea, then click
**Validate & preview**. The size hint below the textarea shows byte
count, line count, and percentage of the 2 MB upload cap.

---

## How validation works

The previewer uses a Zod schema (`src/lib/manifestSchema.ts`) that
mirrors the production `PatientRevealManifest` shape:

- **Required:** `patient.firstName`, `patient.age`, `patient.sex`
- **Optional but typed:** `schema_version` (must match `\d+\.\d+\.\d+`),
  `todayBar`, `weeklySnapshot`, `studyOverview`, `patientThesis`,
  `layerFindings`, `helpingVsFeeding`, `symptomBridges`,
  `reversibility`, `confidenceBreakdown`, `careMap`, `patientJourney`
- Unknown top-level keys pass through untouched

### `patientJourney` shape

Optional top-level field that drives the **Patient journey** timeline
section.

```ts
patientJourney?: {
  currentPhase?: string;       // shown as a highlighted card at the top
  nextStep?: string;           // shown next to currentPhase
  timeline?: Array<{
    dateLabel: string;         // required, free-form (e.g. "Day 12", "Mar 4")
    title: string;             // required, short event headline
    description?: string;
    status?: "complete" | "current" | "upcoming";
    icon?: string;             // optional emoji or short glyph
  }>;
}
```

If none of `timeline`, `currentPhase`, or `nextStep` are provided, the
section falls back to the standard `EmptyHint` card.

**Timeline ordering is caller-owned.** The previewer renders events in
the exact order they appear in the `timeline` array — it does not sort
by `dateLabel`, `status`, or any other field. If you want chronological
order, sort the array before handing the manifest to the previewer.

**Per-event field rules.** Within `timeline[]`:

- `title` is required.
- `dateLabel` is optional. When missing or blank, the previewer renders
  the italic fallback "Date not provided" in its place.
- `status` is optional; allowed values are `complete`, `current`, or
  `upcoming`. When omitted, no status badge is rendered and the
  timeline dot stays neutral.
- `icon` is optional and capped at 8 characters.
- `description` is optional.

On validation failure, errors are grouped by their top-level field
(`patient`, `careMap`, etc.) so you can scan section-by-section. A
required-field checklist is shown in **both** success and error states,
and remains accurate while you edit the JSON in the error state via a
loose JSON parse.

### Warnings vs errors

The previewer also runs a **non-blocking lint pass** on every
successfully validated manifest. Warnings appear in an amber alert
directly below the "Manifest is valid" banner and are **guidance, not
blockers** — the manifest still validates, still persists to
`localStorage`, and still renders every section. Warnings flag things
the schema can't catch but that visibly degrade the preview, e.g.:

- `patientJourney.timeline` is provided but neither `currentPhase`
  nor `nextStep` is set
- A `patientJourney.timeline[]` event is missing `dateLabel`
- A `patientJourney.timeline[]` event is missing `status`

Treat warnings as todo items for the upstream pipeline; the
previewer never blocks on them.

---

## What stays local

Everything. The page does not call any backend, edge function, or
third-party API. Specifically:

- Pasted/uploaded JSON never leaves the browser
- The last valid manifest is cached in `localStorage` under the key
  `manifest-preview:last-valid-v1` and restored on next visit
- **Reset to empty** clears both the input and the cached manifest;
  the action prompts for confirmation when stored data exists

---

## Export, copy, and print

| Action | What it does |
|---|---|
| **Export JSON** | Downloads the validated manifest as `manifest-<firstName>-<timestamp>.json` |
| **Copy JSON** | Writes the validated, formatted manifest to the clipboard |
| **Download sample** | Downloads the bundled sample as `sample-manifest.json` |
| **Print / Save PDF** | Opens the browser print dialog with a preview-only layout (controls hidden via `body.manifest-print-mode` + `@media print` rules in `src/index.css`). Use the OS "Save as PDF" destination to export a PDF. |

---

## Diff vs sample

After a successful validation, click **Diff vs sample** to compare the
current manifest against the bundled sample. Diffs are:

- Grouped by top-level field
- Searchable via the search input (matches paths or values)
- Capped at **100 entries** with a truncation notice for safety on
  large manifests

If the current manifest differs from the sample, a **Reset to sample**
button appears as a one-click way to revert.

---

## Manual QA checklist

No e2e framework runs in CI for this surface yet. Before shipping
changes to `/manifest-preview`, walk through this checklist manually:

1. Visit `/manifest-preview` in a fresh browser profile (no
   `localStorage`). Empty state is shown.
2. Click **Load sample manifest**. Preview renders all sections, the
   "Manifest is valid" alert appears, and the section nav shows
   9/9 present.
3. Click **Diff vs sample**. Panel opens; reports "Identical".
4. Edit the textarea (e.g. change `patient.firstName`). Click
   **Validate & preview**. Diff panel now shows one `~` entry under
   the `patient` group.
5. Type a substring of the changed field name into the diff search.
   Only matching rows remain.
6. Delete `patient.age` from the textarea and click
   **Validate & preview**. Validation fails; required-field
   checklist shows `patient.age` as missing; errors are grouped under
   `patient`.
7. Reload the page. The last valid manifest is restored from
   `localStorage` with a "Restored last valid manifest" alert.
8. Click **Reset to empty**. Confirm the prompt. Input clears,
   `localStorage` is cleared, and the empty state returns.
9. Click **Print / Save PDF**. The print dialog opens with the
   input column hidden and only the rendered preview visible.
10. Click **Download sample** and **Export JSON** (after re-loading
    the sample). Both produce valid downloadable JSON files.
11. Scroll to the **Patient journey** section. Verify the status
    legend (Complete / Current / Upcoming) renders above the
    timeline, the current-phase and next-step cards appear at the
    top, and event dots are color-coded by status. Then delete
    `patientJourney.currentPhase` and `patientJourney.nextStep`
    from the JSON, click **Validate & preview**, and confirm the
    "Current journey phase not provided" fallback row appears in
    their place.
12. In the JSON, swap two adjacent entries inside
    `patientJourney.timeline` and click **Validate & preview**.
    Verify the rendered timeline reflects the new order exactly —
    the previewer must not reorder events.
13. In one event, delete `dateLabel` (or set it to `""`) and delete
    `status`. Click **Validate & preview**. Verify the event still
    renders, the date area shows the italic "Date not provided"
    fallback, no status badge appears, and the timeline dot stays
    neutral.

---

## File map

| File | Role |
|---|---|
| `src/pages/ManifestPreview.tsx` | Page shell, state machine, all controls |
| `src/lib/manifestSchema.ts` | Zod schema + friendly issue mapping |
| `src/lib/sampleManifestPreview.ts` | Bundled fully-populated sample |
| `src/lib/manifestDiff.ts` | Recursive JSON diff engine |
| `src/components/manifest-preview/SectionRenderer.tsx` | Per-section renderers + section meta |
| `src/components/manifest-preview/EmptyHint.tsx` | Missing-field fallback card |
| `src/index.css` | `@media print` rules for the print/PDF view |

The previewer is fully decoupled from Lovable Cloud, auth, RAE,
migrations, and edge functions.