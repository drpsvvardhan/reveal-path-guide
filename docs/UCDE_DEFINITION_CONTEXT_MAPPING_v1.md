# UCDE Definition Context Mapping v1

**Status:** Phase A deliverable — architectural mapping only. No code
changes accompany this document. Phase B (selector + composer wiring)
is gated on founder approval of this mapping.

**Constitutional binding.** Concepts are primary; rendering surfaces are
views over a unified patient-state. The hover composer, the narrative
engine, ask-anything system prompts, and future grounding consumers
should all read from one selector. This document defines that selector's
shape and the source-of-truth wiring behind each field.

---

## A.1 Concept inventory

Each row names: stable concept id, where it appears in the rendered
surface, the actual source-of-truth context/hook in the codebase that
computes the patient-visible data, the fields/types needed to render a
patient-grounded contextual sentence, and a status flag.

Status legend:
- `present` — data exists today, fully addressable from existing
  contexts.
- `partial` — some grounding data exists, but the specific shape needed
  by a tooltip is not directly exposed and must be derived in the
  selector from existing fields.
- `absent` — no source of truth exists today; selector exposes `null`
  and the composer falls back to a Vizzhy-only definition.

### 1. `axis`

- **Surfaces.** `TerrainRadar` (visualised on the Body / Terrain
  pages); narrative prose mentioning named axes ("BRI", "META",
  "SBO", etc.) inside `ThesisSection`, `TerrainPortraitHero`.
- **Source of truth.** `TerrainRenderContext.activeRender
  .clinician_summary.axis_breakdown[]` (clinician-facing rows) plus
  `useCIEAssessment().gateScores` and the live computation in
  `TerrainRadar` that maps gate scores to the seven coordinates per
  the terrain radar mapping rule.
- **Fields needed for grounding.**
  - `axes: Array<{ id: string; label: string; value: number; status:
    "attention" | "coherent" | "monitor" | null }>` — the seven named
    coordinates and their current values.
- **Status.** `partial`. The seven axes exist conceptually and are
  rendered, but no single context exposes them as a normalized
  `{id,label,value,status}` array. The selector must derive this from
  `TerrainRenderContext.clinician_summary.axis_breakdown` (label +
  status) joined with the gate-score-to-axis mapping used by
  `TerrainRadar` (numeric value). To reach `present`, the substrate
  would need either (a) `TerrainRender` to persist the axis values
  alongside the breakdown, or (b) `CIEAssessmentContext` to expose a
  `terrainAxes[]` derived view. **Do not change either in this
  prompt.**

### 2. `terrain`

- **Surfaces.** `TerrainPortraitHero` ("Your Terrain"), the radar
  visualization, headings throughout the Body chapter.
- **Source of truth.** `TerrainRenderContext.activeRender
  .patient_portrait` (prose) and the same axis set used for
  concept #1.
- **Fields needed.**
  - `terrainOverallStatus: "coherent" | "mixed" | "needs-attention"
    | null` — derived from the distribution of axis statuses.
  - `terrainAxesSummary: string | null` — one short clause naming
    which axes are coherent vs. need attention (e.g., "BRI and SBO
    coherent, META needs attention").
- **Status.** `partial`. No `terrain.overall_score` field exists in
  the manifest or `TerrainRender`. The selector must compute the
  overall status and summary string from the axis array (#1). To
  reach `present`, `TerrainRender` would need to persist a single
  rolled-up status. **Do not add it.**

### 3. `cluster`

- **Surfaces.** `ClusterCard`, `ClusterPatternCard`, `CoherenceMap`,
  the "What we've noticed" page, narrative prose with `{cluster:<id>}`
  attribution markers.
- **Source of truth.** `useClusters()` returning `ClusterRow[]`, plus
  the aggregation helpers in `src/lib/clusterAggregations.ts`
  (`tierDistribution`, `averageCoherence`, `totalTensions`).
- **Fields needed.**
  - `clusterCount: number | null` — total active clusters.
  - `clusterTierBreakdown: Record<ClusterTier, number> | null` —
    how many in robust / supported / developing / tentative /
    emerging.
- **Status.** `present`. `useClusters` already returns the list and
  `tierDistribution` already computes the breakdown — the selector
  composes them; no new computation.

### 4. `gate`

- **Surfaces.** Gate chips in `JourneySection`, the radar's
  underlying values, clinical handoff panel.
- **Source of truth.** `useCIEAssessment().gateScores` keyed by
  `gate_id`, each row exposing `gate_name`, `score`, `traffic_light`.
- **Fields needed.**
  - `gates: Array<{ id: string; name: string; score: number;
    trafficLight: "green" | "amber" | "red" | string }> | null` — the
    flat list, source-of-truth-shaped.
  - `gatesAttention: Array<{ id: string; name: string }> | null` —
    convenience subset where `trafficLight !== "green"` for the
    common "you have N gates needing attention" tooltip.
- **Status.** `present`. `gateScores` is already a `Record<string,
  CIEGateScore>` — selector flattens to an array.

### 5. `coherence`

- **Surfaces.** Narrative prose in `ThesisSection`, the
  `CoherenceMap` view, cluster cards (where coherence_strength is
  a confidence dimension).
- **Source of truth.** `useClusters()` → per-row
  `confidence_dimensions.coherence_strength`; `averageCoherence()` in
  aggregations.
- **Fields needed.**
  - `coherenceAverage: number | null` — mean coherence across active
    clusters (0..1).
  - `coherenceLabel: "high" | "mixed" | "low" | null` — banded
    interpretation derived from the average.
- **Status.** `present`. Average is already computable from
  aggregation helpers; banding is local to the selector.

### 6. `contradiction`

- **Surfaces.** `DerivedPatternsContext` exposes patterns where
  `category === "contradiction"`; surfaced inside `NoticedSection`
  and the question queue.
- **Source of truth.** `useDerivedPatterns().patterns` filtered to
  `category === "contradiction"`. Cluster `tensions_held[]` is the
  parallel source within the cluster graph (different shape, same
  conceptual class).
- **Fields needed.**
  - `contradictions: Array<{ id: string; title: string; severity:
    PatternSeverity }> | null` — top contradictions from
    `derived_patterns`.
  - `tensionCount: number | null` — total `tensions_held` across all
    active clusters (already produced by `totalTensions()`).
- **Status.** `present`. Both pieces exist. Open question A.5#3
  flags whether the tooltip should prefer the pattern view, the
  cluster-tension view, or both — both render here for completeness
  pending founder ruling.

### 7. `scar`

- **Surfaces.** Used colloquially in narrative prose (e.g., references
  to long-term physiological imprint), but no structured field.
- **Source of truth.** None.
- **Fields needed (if it existed).** A typed list of "biological
  scars" with onset window and reversibility band.
- **Status.** `absent`. The selector exposes `scars: null`. To reach
  `present`, the substrate would need a new persisted concept
  (probably as a derived pattern category or a dedicated cluster
  kind) — **out of scope for this prompt.** The composer's fallback
  template handles the null gracefully.

### 8. `plasticity`

- **Surfaces.** Mentioned in narrative prose and in the
  `Reversibility` section (the four bands: weeks / months / slow /
  permanent are an oblique read on plasticity).
- **Source of truth.** Closest proxy is
  `manifest.reversibility` (`weeks[]`, `months[]`, `slow[]`,
  `permanent[]`). There is no first-class plasticity score.
- **Fields needed (if it existed).** A 0..1 plasticity index and a
  named horizon.
- **Status.** `absent` as a first-class field; `partial` as a derived
  read on `reversibility`. Selector exposes `plasticityProxy:
  { weeksCount, monthsCount, slowCount, permanentCount } | null`
  drawn from `manifest.reversibility`, and `plasticityIndex: null`
  as the explicit-null first-class slot. The composer's template
  decides whether to use the proxy or fall back to a Vizzhy-only
  string.

### 9. `reversibility` (added — likely patient curiosity term)

- **Surfaces.** `ReversibilitySection`, `ReversibilityTimeline`
  visual, narrative.
- **Source of truth.** `manifest.reversibility` (existing field on
  `PatientRevealManifest`).
- **Fields needed.**
  - `reversibility: { weeksCount: number; monthsCount: number;
    slowCount: number; permanentCount: number } | null` — small
    counts so the template can compose "X items reversible in
    weeks, Y in months…".
- **Status.** `present`.

### 10. `confidence` (added — patient curiosity term, not "confidence
breakdown" UI)

- **Surfaces.** `ConfidenceSection`, `ConfidenceGradient` visual,
  cluster confidence tiers.
- **Source of truth.** `manifest.confidenceBreakdown` (manifest
  field) plus `useClusters()` for the per-cluster
  `confidence_score` / `confidence_tier`.
- **Fields needed.**
  - `confidence: { confidentCount: number; investigatingCount:
    number; retestCount: number } | null` — direct from manifest.
  - `clusterRobustCount: number | null` — convenience read from
    `clusterTierBreakdown.robust + clusterTierBreakdown.supported`.
- **Status.** `present`.

---

## A.2 Selector shape

The selector returns one stable interface. Every absent source is
represented by an explicit `null` (never a synthetic default).

```ts
// src/types/definitionContext.ts (Phase B)

import type { ClusterTier } from "@/types/clusters";
import type { PatternSeverity } from "@/types/manifest";

export interface DefinitionContext {
  // 1. axis — derived from TerrainRenderContext.clinician_summary +
  //    gate-to-axis mapping used by TerrainRadar
  axes: Array<{
    id: string;
    label: string;
    value: number;
    status: "attention" | "coherent" | "monitor" | null;
  }> | null;

  // 2. terrain — derived from the axes array above
  terrainOverallStatus: "coherent" | "mixed" | "needs-attention" | null;
  terrainAxesSummary: string | null;

  // 3. cluster — useClusters() + tierDistribution()
  clusterCount: number | null;
  clusterTierBreakdown: Record<ClusterTier, number> | null;

  // 4. gate — useCIEAssessment().gateScores flattened
  gates: Array<{
    id: string;
    name: string;
    score: number;
    trafficLight: string;
  }> | null;
  gatesAttention: Array<{ id: string; name: string }> | null;

  // 5. coherence — averageCoherence() banded
  coherenceAverage: number | null;
  coherenceLabel: "high" | "mixed" | "low" | null;

  // 6. contradiction — derived patterns + cluster tensions
  contradictions: Array<{
    id: string;
    title: string;
    severity: PatternSeverity;
  }> | null;
  tensionCount: number | null;

  // 7. scar — no source of truth today
  scars: null;

  // 8. plasticity — proxy via manifest.reversibility; first-class slot null
  plasticityIndex: null;
  plasticityProxy: {
    weeksCount: number;
    monthsCount: number;
    slowCount: number;
    permanentCount: number;
  } | null;

  // 9. reversibility — manifest.reversibility
  reversibility: {
    weeksCount: number;
    monthsCount: number;
    slowCount: number;
    permanentCount: number;
  } | null;

  // 10. confidence — manifest.confidenceBreakdown + cluster tiers
  confidence: {
    confidentCount: number;
    investigatingCount: number;
    retestCount: number;
  } | null;
  clusterRobustCount: number | null;
}
```

**Source attribution per field.**

| Field | Backed by |
| --- | --- |
| `axes` | `TerrainRenderContext.activeRender.clinician_summary.axis_breakdown` ⨝ gate-to-axis mapping in `TerrainRadar` |
| `terrainOverallStatus` | derived from `axes[].status` distribution |
| `terrainAxesSummary` | derived from `axes[]` |
| `clusterCount` | `useClusters().clusters.length` |
| `clusterTierBreakdown` | `tierDistribution(clusters)` from `clusterAggregations.ts` |
| `gates` | `useCIEAssessment().gateScores` flattened |
| `gatesAttention` | filter of `gates` where trafficLight ≠ green |
| `coherenceAverage` | `averageCoherence(clusters)` |
| `coherenceLabel` | banding of `coherenceAverage` (≥0.7 high, 0.4–0.7 mixed, <0.4 low) |
| `contradictions` | `useDerivedPatterns().patterns.filter(p => p.category === "contradiction")` |
| `tensionCount` | `totalTensions(clusters).totalTensions` |
| `scars` | no source — always `null` |
| `plasticityIndex` | no source — always `null` |
| `plasticityProxy` | `useManifest().manifest.reversibility` (counts of band arrays) |
| `reversibility` | `useManifest().manifest.reversibility` (same source as plasticityProxy; conceptually distinct field) |
| `confidence` | `useManifest().manifest.confidenceBreakdown` (counts of arrays) |
| `clusterRobustCount` | `clusterTierBreakdown.robust + clusterTierBreakdown.supported` |

---

## A.3 Composer template strategy

**Where templates live.** A single registry file keyed by concept id,
co-located with the composer:
`src/lib/definitionTemplates.ts`. One file because (a) only ~10
entries are expected initially, (b) keeping all templates in one
place makes the patient voice consistent, and (c) avoids a deep
per-concept directory tree for a small, stable set.

**Shape of a template entry.**

```ts
export interface DefinitionTemplate {
  conceptId: string;
  vizzhyDefinition: string; // 1–2 sentences, current Vizzhy voice
  patientGroundingTemplate: (ctx: DefinitionContext) => string | null;
  fallbackWhenDataNull: string; // 1 sentence, no data references
}
```

`patientGroundingTemplate` is a function rather than a string with
placeholders, because each concept reads a different combination of
selector fields and several need conditional clauses ("X axes
coherent, Y need attention"). A function keeps the logic explicit
and unit-testable without introducing a templating engine. If the
function returns `null`, the composer treats the grounding as
absent and renders only the Vizzhy definition + the
`fallbackWhenDataNull` line.

**Composition flow.**

1. Composer (the `TappableProse` successor or its current shape)
   receives `DefinitionContext` from `useDefinitionContext()`.
2. On hover/tap of a known concept word, look up the template
   entry by concept id.
3. Render `vizzhyDefinition` first (preserving current Vizzhy
   voice and tag).
4. Call `patientGroundingTemplate(ctx)`:
   - If non-null, append it as a second sentence/paragraph.
   - If null, append `fallbackWhenDataNull` instead.
5. Optional: append `· grounded in your data` to the existing
   `VIZZHY` tag **only** when `patientGroundingTemplate` returned
   a non-null string. Skip if it conflicts with the existing
   `VIZZHY` tag layout — to be evaluated visually in Phase B.

No new dependency. No string-templating engine. Plain function
composition.

---

## A.4 Verification plan (Phase B)

- **Deep-data twin.** Hover each of the 10 concepts in `view-as`
  mode on a deep-data twin (full CIE + lab observations + clusters
  + terrain render). Confirm each tooltip composes correctly: the
  Vizzhy definition renders, then the patient-grounded sentence
  uses real numbers (axis values, cluster counts, gate names).
- **Shallow-data twin.** Hover each concept on a shallow twin (CIE
  only or CIE + 1 lab). Confirm the fallback string renders for
  every concept whose backing data is null. No "your terrain reads
  null" — fallbacks read graceful.
- **Tests.** Run all existing tests on touched files in Phase B; add
  the four unit tests named in §B.4 of the parent prompt
  (selector shape on deep + shallow fixtures; composer
  interpolation on present + null inputs).
- **Screenshots.** Capture three deep-data tooltips and three
  shallow-data tooltips for founder review before merge.

---

## A.5 Open questions surfaced for founder review

1. **Axis values: live computation vs. persisted.** `TerrainRadar`
   computes axis values live from `gateScores`. The persisted
   `clinician_summary.axis_breakdown` carries label + status but no
   numeric value. The selector must derive the numeric value from
   the same gate-to-axis logic the radar uses. Two options:
   - (a) Extract that logic into `src/lib/terrainAxes.ts` (new file)
     and have both `TerrainRadar` and the selector import it. Risk:
     this is technically a refactor of an existing surface and
     conflicts with the "do not refactor" discipline. **Recommend
     the prompt explicitly authorize this single, narrow extraction
     before Phase B begins.**
   - (b) Selector duplicates the mapping logic. Risk: drift between
     the radar and the tooltip — the same axis would show different
     values in two places.
2. **Coherence banding thresholds.** I've proposed ≥0.7 high,
   0.4–0.7 mixed, <0.4 low. These are not anchored anywhere in the
   existing codebase. If founder has previously calibrated bands
   (e.g., for the cluster confidence tier system), the selector
   should adopt those constants verbatim rather than introducing
   new ones. **Please confirm or supply.**
3. **Contradictions: pattern view vs. cluster-tension view.** Two
   parallel sources expose conceptually similar information
   (`derived_patterns` with `category === "contradiction"` and
   cluster `tensions_held[]`). The selector currently exposes both,
   but the composer template for `contradiction` will need to pick
   one as primary. **Founder ruling needed.**
4. **`scar` and `plasticity` as first-class concepts.** Both are
   currently `absent` / `partial` — the selector exposes nulls and
   the composer falls back to Vizzhy-only. If these are
   load-bearing in upcoming narrative prose, the substrate work to
   make them `present` should be scoped as a separate prompt; this
   prompt is intentionally not closing those gaps.
5. **Hover trigger model.** Today `TappableProse` makes every word
   a hover target and calls `define-term` per word. The composer
   layer described here is conceptual: it assumes a known set of
   ~10 concept words gets the composed treatment, while everything
   else continues to fall through to `define-term`. **Confirm
   whether Phase B should (a) match concept words client-side and
   intercept those before the edge call, or (b) leave the edge
   path intact and only enrich the response when the term matches a
   known concept.** Option (a) is faster and lower-cost; option (b)
   keeps a single tooltip code path.

---

**Phase A ends here. Awaiting founder approval before any Phase B
code changes.**

---

## Phase B v2: resolver replaces curated registry

The curated runtime registry that shipped with the first cut of Phase B
(`KNOWN_PHRASES`, `matchPhrase`, per-concept template functions) has
been removed. Patient Reveal does not scale by writing definition
strings for every word.

What remains:
- `TappableRegion` continues to be the section-level surface that turns
  bare prose into a tappable definition target. Interaction behavior
  and visual styling are unchanged.
- `useDefinitionContext()` continues to be the substrate selector that
  composes the seven-coordinate, cluster, gate, coherence,
  contradiction, reversibility, and confidence reads into one stable
  shape.

What changed:
- Hover now calls a witness-bound resolver: the `define-term` edge
  function. The resolver receives the hovered term, the containing
  sentence, the surrounding section context, the patient id, and the
  full DefinitionContext. It returns a strict JSON envelope:
  `{ definition, grounding, citations, vizzhy_concept_mapped, cache_key, trace }`.
- Vizzhy framing is gated by `ALLOWED_VIZZHY_CONCEPTS`
  (`src/lib/allowedVizzhyConcepts.ts`, mirrored in
  `supabase/functions/define-term/system_prompt.ts`). Terms outside the
  list still get plain biological explanations, but the resolver may
  not invent new Vizzhy-named compound constructs.
- A non-blocking ontology leakage guard scans the model output for
  invented branded constructs and records them in `trace.ontology_leakage_*`.
- Caching is correctness-first: the cache key includes a hash of the
  patient's DefinitionContext, so cache entries naturally invalidate
  when the patient's state changes. Two layers exist client-side: a
  hot in-memory cache and a sessionStorage cache. The edge function
  also keeps a 24h server-side memo keyed by the same shape.
- Each Patient Reveal section issues a small background prefetch on
  mount via `usePrefetchDefinitions` so the most-likely-hovered terms
  are warm by the time the patient reaches them. Ask Anything does
  not prefetch.
- The 23 founder-authored definitions are preserved as **eval gold
  only** in `docs/UCDE_DEFINITION_RESOLVER_EVAL_v1.md`. They are not
  loaded as runtime few-shot context. `scripts/eval-define-term.ts`
  reads that file, calls the deployed resolver against a synthetic
  DefinitionContext, and writes
  `docs/UCDE_DEFINITION_RESOLVER_EVAL_REPORT_latest.md`. If voice
  drift or ontology leakage fails on more than 4 of 23 terms the
  harness exits non-zero.

### Binding sentence

The hover is a view of the resolver, not a parallel system. Concepts
are primary; surface forms — the words a patient hovers on — are
resolved against Vizzhy's existing ontology with patient state composed
in at runtime. The platform scales by exposing more of the ontology to
the resolver, not by writing more definition strings.
