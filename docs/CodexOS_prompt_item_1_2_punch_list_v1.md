# CodexOS prompt — Item 1.2: Patient surface punch-list (six items) v1

## Context

Per Vizzhy Trajectory Correction v2 item 1.2 — six tonal/render
mismatches on the patient surface that registered during Claude's
walkthrough audit on Vishnu Vardhan (shallow-end) and Vishnu PSVV
(deep-end) twins. Each is a small inconsistency that does not block
launch but will register on Harsha's walkthrough and slightly weaken
the confidence-as-first-class-object discipline the platform commits
to.

## Doctrinal anchor

- **Law 8 (Compression Without Collapse):** *"No 'clean narratives'
  that hide complexity. Truth > clarity."* The Journey tile saying
  *severity high* while the underlying tier is *tentative/emerging*
  is a small collapse that misrepresents confidence.
- **Layer 6 (Patient Reveal):** *"Never expose substrate complexity
  unless it helps understanding."* Duplicated lines and count
  mismatches expose substrate noise that doesn't earn its place on
  the surface.

## Scope lock

Six render/string fixes on the existing patient surface. No
architectural changes. No visual styling changes. No new features.
No changes to the substrate (witness layer, RAE, cluster generation,
narrative engine).

**Out of scope:**
- Modifying any reasoning surface (cluster generator, narrative
  engine, terrain render, action plan).
- Modifying any database schema, RLS policy, or migration.
- Modifying the `DefinitionContext` selector.
- Modifying the `TappableRegion` interceptor.
- Modifying any RAE / RBGS / witness substrate code.
- Adding new tests beyond verification of these specific fixes.
- Refactoring the components touched.

## The six items

### Item A — Journey tile severity/tier mismatch

**Where:** The "What we've noticed" drill-down tile on the Journey
page reads `"7 patterns detected, highest severity: high"`.

**Problem:** The underlying cluster data shows tier breakdown of
*1 developing, 4 tentative, 2 emerging* (zero robust, zero supported).
The phrase *severity high* contradicts the tier labels and creates a
tonal jolt the rest of the platform doesn't earn.

**Fix:** Change the tile copy to render the actual confidence tier,
not severity. Proposed string:

```
"7 patterns noticed; highest tier: developing"
```

Or, if the tile string is already a template, expose `highest_tier`
from the cluster aggregation helper instead of `highest_severity`.
Match the language used on the *What we've noticed* page itself
(robust / supported / developing / tentative / emerging).

**Verification:** Journey tile reads tier, not severity. Wording
matches the *What we've noticed* page's tier labels exactly.

### Item B — Ask-anything biomarker-in-scope counter

**Where:** Right-hand reasoning trace panel on the *Ask anything*
page. The counter reads `"0 biomarkers in scope"` even after the
LLM response cites multiple specific biomarkers (e.g., ApoB 101,
TMAO 8.3, hs-CRP 0.3, Lp-PLA2, insulin, HbA1c).

**Problem:** The response and the trace panel disagree. Either the
trace is correct and the response is using values it shouldn't have
seen (constitutional violation of Law 2 *Witness Truth*), or the
response is grounded and the trace counter isn't being populated.
The latter is far more likely.

**Fix:** Investigate which case applies. If the biomarker scope
fetch is async and rendering before completion, await it before
rendering the panel. If the counter is populated but reading the
wrong field, repair the field reference. If biomarkers truly aren't
in scope but the LLM is citing them anyway, flag as a separate
finding (this would be a Law 2 violation requiring escalation, not
a render fix).

**Verification:** Trace panel counter matches the actual count of
biomarkers cited in the visible response. Reasoning trace fields
*Loading your biomarker context...* dismisses after the response
renders.

### Item C — Care Map "active supplements" label mismatch

**Where:** Care Map page right-hand sidebar. Label reads `"ACTIVE
SUPPLEMENTS: 0"` while the page tracks an 82% adherence figure.

**Problem:** If 0 supplements are active, what is being adhered to?
The label and the adherence figure don't refer to the same thing.
Likely the items being tracked are action plan items (walking,
hydration), not supplements.

**Fix:** Rename the label to match what's actually being tracked.
Proposed strings:

- If items are action plan items: `"ACTIVE PROTOCOL ITEMS"` or
  `"ACTIVE INTERVENTIONS"`.
- If supplements are part of a broader protocol: `"ACTIVE PROTOCOL"`
  with sub-counts.

Match whatever the underlying data model actually carries. Do not
fabricate a count.

**Verification:** Label accurately describes the data structure
behind the adherence figure. No contradiction between label and
adherence percentage.

### Item D — Duplicated Barrier line on terrain radar sidebar

**Where:** Deep-data twin (Vishnu PSVV), `What's happening in your
body` page, right-hand `Biological terrain` sidebar. The sidebar
renders BRAIN, BARRIER, BARRIER (twice), FUEL, TISSUE, LONGEVITY.

**Problem:** Render bug. Barrier appears twice. The expected list
is the six axes (BRAIN, BARRIER, FUEL, TISSUE, LONGEVITY, RISK) or
whatever the canonical axis set is for this twin's render.

**Fix:** Investigate the radar sidebar's data source. Likely either
(a) the underlying axis list contains a duplicate that should be
deduplicated at the source, or (b) the render iterates over the
list with a key collision that double-renders. If (a), fix at the
data source. If (b), fix the render with stable unique keys.

**Verification:** Each axis appears exactly once on the sidebar.
The set matches the canonical six (or whichever set the deep-data
twin's terrain render produces).

### Item E — Cluster count mismatch on "What we've noticed"

**Where:** *What we've noticed* page, deep-data twin. Two sources
disagree on cluster counts:

- The page-summary string: *"Across your findings: 0 supported, 0
  developing, 8 emerging"*
- The right rail tier breakdown: *"0 robust, 0 supported, 1
  developing, 4 tentative, 2 emerging"*

**Problem:** *8 emerging* vs *2 emerging* is a clear count mismatch.
The two strings are computing the same number from different
sources or with different filters.

**Fix:** Identify which count is correct (the right-rail tier
breakdown is sourced from `tierDistribution()` per the doctrine; that
is canonical). Reconcile the page-summary string to read from the
same source. The summary should also include the *tentative* tier,
which is missing from the current summary string.

**Verification:** Page-summary string and right-rail tier breakdown
reconcile. Both reference the same underlying counts. All five
tiers (robust, supported, developing, tentative, emerging) appear in
the page-summary if non-zero.

### Item F — Coherence audit defaulting to 1.00

**Where:** Medical Records cluster expansion view, *Confidence Audit*
section. Five dimensions: Breadth, Depth, Time, Coherence,
Completeness. Coherence consistently shows 1.00 across multiple
clusters.

**Problem:** Either Coherence is genuinely 1.00 (no cross-layer
disagreements in any cluster, which is unlikely for a deep-data twin
with 8 tentative-tier clusters), or the dimension is defaulting to
1.00 when the underlying cross-layer contradiction count is null,
zero, or unmeasured.

**Fix:** Investigate the coherence computation. If the dimension is
defaulting to 1.00 when contradiction-density is unmeasured, change
the default to `null` and have the UI render *"not yet measured"* or
similar honest framing rather than *1.00*. If it is correctly 1.00
because contradictions are genuinely zero, no fix needed — but in
that case verify against the cluster's actual `tensions_held[]`
arrays to confirm.

This item may surface a deeper finding (coherence computation logic
may need calibration). If so, fix the default-to-null behavior in
this prompt and surface the calibration question as a separate
finding for founder review. Do not silently change the coherence
formula.

**Verification:** Coherence either renders a real computed value
that varies by cluster, or renders honestly as *unmeasured* when
the underlying data isn't there. Does not default to 1.00 across
all clusters.

## Run before declaring complete

For each of the six items:

1. `npm run typecheck` (or whatever's configured) clean.
2. All existing tests pass.
3. Visual sanity check in view-as mode on Vishnu Vardhan
   (shallow-end) and Vishnu PSVV (deep-end). Confirm each fix
   renders correctly on both twins where applicable.
4. Take one before/after screenshot per item showing the fix lands
   correctly.

Send screenshots and verification per item before merging.

If any item surfaces an unexpected deeper issue (especially Items B
and F, which touch real reasoning logic), do not silently expand
scope. Surface as a finding for founder review.

## Discipline

- Do not modify any reasoning surface or substrate code.
- Do not change visual styling.
- Do not refactor surrounding code.
- Do not introduce new dependencies.
- Treat each item as independent — if one surfaces a blocker, the
  others continue.
- Match existing string conventions and language register where
  possible. The platform speaks adult patient register; do not
  introduce different voice.
- If a fix requires adding new data fields, stop and escalate — do
  not fabricate or infer values.

## Binding sentence

Six small fixes on the patient surface, each anchored to Law 8
(Compression Without Collapse) and Layer 6's "never expose substrate
complexity unless it helps understanding." The fixes are tonal and
render-level. The substrate is unchanged. The surface becomes more
honest about what the substrate computes, not different.
