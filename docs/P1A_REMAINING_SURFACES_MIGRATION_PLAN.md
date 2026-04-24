# P1a Remaining Surfaces — Migration Plan

**Status:** PLAN ONLY. No code, SQL, schema, UI, RAE, or trajectory-witness work in this document.
**Goal:** Bring the four remaining reasoning surfaces onto the same witness-native context
contract that `patient-chat` already satisfies, so that P1a can be declared complete.

**Core rule (non-negotiable):**
Every reasoning surface must consume `PatientTerrainContext` (the structure returned by
`loadPatientContext`) or witness-derived context only. **No reasoning surface may read
`patient_lab_observations` directly.** The only legacy tables a reasoning surface may still
touch outside the loader are: `clusters` / `cluster_evidence` (governed derived objects),
`profiles` (identity), and the surface's own write target (`action_plans`,
`patient_narratives`, `terrain_renders`). Everything else must come through the loader.

**Reference implementation:** `supabase/functions/patient-chat/index.ts`
(loader call at lines 1129–1133; cluster fetch at 1136–1143; guard test suite at
`supabase/functions/patient-chat/p1a_migration_guard.test.ts`, 9 green).

The loader's public contract — `loadPatientContext(supabaseUrl, serviceRoleKey, userId)
→ PatientTerrainContext` — is defined in `supabase/functions/patient-chat/contextLoader.ts`
(rewritten Artifact 6, 23 April 2026). That contract is the single source of truth for
everything below.

---

## What the loader already gives every surface

`PatientTerrainContext` exposes, all witness-derived and seed-scoped
(`ACTIVE_REGISTRY_SEED_VERSION = "p1a_initial"`):

- `patient_id` — canonical `profiles.id` (FK target for `clusters.patient_id`).
- `profile` — `display_name`, `age`, `sex`.
- `cie.domain_scores[]`, `cie.gate_scores[]`, `cie.sample_responses[]` — each row
  carries the `witness_id` of the witness that testifies to it.
- `labs.observations[]` — replaces every direct read of
  `patient_lab_observations` (serum / panel labs). Each row exposes
  `observation_id` (= witness_id), `canonical_name`, `value`, `unit`, `flag`,
  `collection_date`, `ref_low`, `ref_high`, `source`.
- `inbody.observations[]` — InBody body-composition signals.
- `fibroscan.observations[]` — FibroScan signals.
- `narrative.latest` — most recent `patient_narratives` row (legacy-flagged).
- `prior_patterns.patterns[]` — active `derived_patterns` (legacy-flagged).
- `witness_provenance` — `registry_seed_version`, total / depth-0 / depth-1 / depth-2
  counts, `source_window_counts`. Required for any "constitutional coverage" telemetry.

Anything a surface previously synthesized from a raw table is already present in this
structure. Migration is a substitution exercise, not a redesign.

---

## Surface 1 — `generate-action-plan`

### 1.1 Current raw / pre-witness dependencies

File: `supabase/functions/generate-action-plan/index.ts`, lines 401–415.

- `profiles` — read for `id` (kept; identity).
- `cie_gate_scores` — raw read, `limit(50)`.
- `cie_domain_scores` — raw read, `limit(100)`.
- **`patient_lab_observations` — raw read, `limit(1000)`. ❌ Forbidden under P1a.**
- `derived_patterns` — raw read (`rule_id`, `severity`, status `active`).
- `clusters` — raw read scoped by `profileData.id` (kept; governed derived object).

### 1.2 What reasoning context it currently constructs

- `gateScores: Record<gate_id, row>` — latest gate row per `gate_id`.
- `domainScores: Record<domain_id, row>` — latest domain row per `domain_id`.
- `biomarkers: Record<normalizeBiomarkerName(canonical_name), { value, unit }>` —
  built by iterating obs rows in date-desc order and keeping the first per analyte
  (lines 429–434).
- `patterns` — passed through from `derived_patterns`.
- `clusters` + `clusterTierMap` — used for cluster-cited LLM voice validation
  (lines 444–449, 517–520).

These four objects are bundled into `PatientData` (lines 436–441) and consumed by
the **deterministic** `matchInterventions` / `coordinateImpactScore` /
`templateWhy` pipeline (lines 451–505) and then by the cluster-grounded LLM
sequence-explanation loop (lines 507–597).

### 1.3 Exact required replacement using `loadPatientContext`

Replace the 5-way `Promise.all` (lines 407–415) with:

1. One `loadPatientContext(supabaseUrl, serviceRoleKey, user_id)` call.
2. A single `clusters` fetch scoped by `witnessContext.patient_id`
   (mirrors `patient-chat/index.ts` lines 1136–1143). The existing
   `cluster_id, claim, cluster_kind, confidence_tier, confidence_score` projection
   is sufficient for `matchInterventions` and the LLM voice loop.

Re-derive the existing in-memory shapes from the context:

- `gateScores[gate_id]` ← walk `witnessContext.cie.gate_scores` (already deduped at
  loader level; preserve "first wins" semantics by iterating in returned order).
- `domainScores[domain_id]` ← walk `witnessContext.cie.domain_scores` the same way.
- `biomarkers[normalizeBiomarkerName(canonical_name)] = { value, unit }` ← iterate
  `witnessContext.labs.observations` AND `witnessContext.inbody.observations` AND
  `witnessContext.fibroscan.observations`. Today's code reads `patient_lab_observations`
  which physically holds all three; the loader splits them, so the migration must
  visit all three buckets to preserve today's marker coverage. Keep the
  date-descending "first wins" rule by passing the loader output through the
  same iteration order it already returns.
- `patterns` ← `witnessContext.prior_patterns.patterns` (`rule_id`, `severity`).

`PatientData` shape and every downstream call site (`matchInterventions`,
`coordinateImpactScore`, `templateWhy`, `categoryCounts` dedup, retest schedule
builder) **must remain byte-identical** in their inputs.

### 1.4 Output behavior that must remain unchanged

- `today_actions[]` content, ordering, `coordinates`, `gates`, `retest_weeks`,
  `retest_markers`, `category`, `sequence_priority`.
- `retest_schedule[]` grouping by weeks, marker set membership, and the exact
  rationale string at line 504.
- The default `sequenceExplanation` fallback string (line 508) **verbatim**.
- `voice_validation_status` and `voice_validation_warnings` semantics
  (`"passed"` / `"failed_with_warnings"` / `null`).
- `next_action_plan_version` RPC call and `action_plans` insert payload
  (lines 599–610) — unchanged.
- HTTP response envelope — unchanged.

### 1.5 Safety / prompt text that must be preserved verbatim

- `buildNarrativeSystemPrompt` is **not** in this file (it lives in
  `generate-narrative`). For action-plan, the strings to preserve are:
  - The base prompt at lines 530–540 starting with `"You are explaining to a
    patient why these actions are ordered this way…"` including the
    `{cluster:<cluster_id>}` and `{cluster:none}` citation rules.
  - `tierVocabSummary` construction (line 522–524) — must continue to use
    `TIER_VOCABULARY_LICENSES` from `_shared/framework_v2.ts`.
  - The `FORBIDDEN_VOCABULARY_GLOBAL.slice(0, 10)` clause (line 537).
  - Retry feedback path via `buildRetryFeedback(lastViolations)` (line 540).
  - Cluster-context injection (`clusterContext` at lines 518–520).
- The cluster-cited voice validation loop (lines 568–586) including
  `parseProseAndCitations`, `validateProseAgainstClusters`, `stripClusterMarkers`,
  `MAX_RETRIES = 3`, and the "use it anyway on last attempt" fallback semantics
  must be preserved unchanged.

### 1.6 Regression guards needed

Create `supabase/functions/generate-action-plan/p1a_migration_guard.test.ts`,
modeled on the existing `patient-chat/p1a_migration_guard.test.ts`:

1. `index.ts` does **not** contain `.from("patient_lab_observations")`.
2. `index.ts` does **not** contain `.from('patient_lab_observations')`.
3. `index.ts` does **not** contain `.from("cie_gate_scores")`,
   `.from("cie_domain_scores")`, or `.from("derived_patterns")`
   (these now flow via the loader).
4. `index.ts` imports `loadPatientContext` from `../_shared/contextLoader.ts`.
5. `index.ts` calls `loadPatientContext(` at least once.
6. `index.ts` retains the literal default `sequenceExplanation` fallback string.
7. `index.ts` retains the `{cluster:<cluster_id>}` and `{cluster:none}` citation
   tokens in the prompt body.
8. `index.ts` still imports `TIER_VOCABULARY_LICENSES`,
   `FORBIDDEN_VOCABULARY_GLOBAL`, `parseProseAndCitations`,
   `validateProseAgainstClusters`, `stripClusterMarkers`, `buildRetryFeedback`
   from `_shared/framework_v2.ts`.
9. The cluster fetch is scoped by the loader-returned `patient_id`, not by a
   freshly re-queried `profiles.id`.

---

## Surface 2 — `generate-narrative`

### 2.1 Current raw / pre-witness dependencies

File: `supabase/functions/generate-narrative/index.ts`, lines 547–598.

- `profiles` — read for `id, first_name, age, sex` (identity; kept).
- `derived_patterns` — raw read, status `active`, severity-ordered.
- `cie_assessments` — raw read for latest complete `id`.
- `clusters` — raw read scoped by `profileData.id` (kept; governed derived object).
- `cie_gate_scores` — raw read scoped by `assessment_id`.
- **No direct read of `patient_lab_observations`.** Lab signal enters via the
  upstream-built `manifest.rawData.biomarkerTimeline` (line 581).

The hidden raw-read in this surface lives **upstream of the function** in whatever
code constructs `manifest`. Inside the function the constraint is satisfied today
only by accident — there is no enforcement.

### 2.2 What reasoning context it currently constructs

- `manifest.patient` is patched with `profileData` fields (lines 554–561).
- `patternList` ← `derived_patterns` rows.
- `gateScoresList` ← `cie_gate_scores` rows for the latest complete assessment.
- `clusters` + `clusterTierMap` (lines 582–588) feed `buildNarrativeSystemPrompt`
  (line 601) and the per-section voice validator.
- `composeUserMessage(manifest, patternList, gateScoresList)` (line 602) packages
  everything for the LLM.

### 2.3 Exact required replacement using `loadPatientContext`

1. Call `loadPatientContext(supabaseUrl, serviceRoleKey, userId)` once, before any
   other DB call.
2. Derive every consumed value from the context object:
   - `manifest.patient.firstName / age / sex` ← `witnessContext.profile`.
   - `patternList` ← `witnessContext.prior_patterns.patterns`. Sort by severity to
     preserve today's `order("severity", { ascending: true })` semantics.
   - `gateScoresList` ← `witnessContext.cie.gate_scores` (already projected to
     `gate_id, gate_name, score, traffic_light, contributing_domains`).
   - The lab arm of `composeUserMessage` (whatever it reads from
     `manifest.rawData.biomarkerTimeline`) **must be re-pointed at**
     `witnessContext.labs.observations` + `witnessContext.inbody.observations` +
     `witnessContext.fibroscan.observations`. This is the structural witness-native
     replacement for the upstream raw-lab smuggling path. The exact mapping
     (manifest field → loader field) is a code-time concern; the contract here is
     that no biomarker value reaches the LLM that did not originate from a witness
     in `witnessContext`.
3. Keep one direct read for `clusters` scoped by `witnessContext.patient_id`
   (mirrors `patient-chat`).
4. `cie_assessments.id` lookup is replaced by `witnessContext.cie.has_assessment`
   plus the per-domain / per-gate witness rows the loader already returned.

### 2.4 Output behavior that must remain unchanged

- `patient_narratives` insert payload (`narrative` JSON shape, `model_used`,
  `version`, `status = 'active'`, `voice_validation_status`,
  `voice_validation_warnings`, `input_biomarker_count`, `input_pattern_count`,
  `generation_ms`).
- The seven narrative sections the engine produces today (per
  `mem://features/narrative-synthesis`): `patientThesis`, `layerFindings`,
  `helpingVsFeeding`, and the four others. Field names, casing, schema.
- Versioning via `next_narrative_version` and the
  `supersede_previous_active_narrative` trigger semantics.
- Retry / structural-validation loop behavior.
- HTTP response envelope.

### 2.5 Safety / prompt text that must be preserved verbatim

- The entire `buildNarrativeSystemPrompt` body (lines 23–~140), specifically:
  - The opening identity paragraph (lines 31–33): "You are the Vizzhy Narrative
    Composer…", "You are NOT a medical advisor…".
  - The `${FRAMEWORK_V2}` interpolation.
  - The `## Cluster sourcing rules` section (lines 37–41) including the
    `{cluster:<cluster_id>}` and `{cluster:none}` token rules and the
    "use {cluster:none} sparingly" guidance.
  - The `## Active clusters for this patient` block and its JSON projection
    (`id, claim, cluster_kind, confidence_tier, confidence_score,
    coherence_signals, missing_evidence, tensions_held`).
  - The `## Tier-licensed vocabulary` block built from
    `TIER_VOCABULARY_LICENSES`, including `required_hedging` when present.
  - The `## Globally forbidden vocabulary` block built from
    `FORBIDDEN_VOCABULARY_GLOBAL`.
  - The `## Output schema` JSON contract (every field name, every comment).
- The `composeUserMessage` template (data layout the LLM has been tuned against).
- Imports from `_shared/framework_v2.ts` — unchanged.

### 2.6 Regression guards needed

Create `supabase/functions/generate-narrative/p1a_migration_guard.test.ts`:

1. No `.from("patient_lab_observations")` / `.from('patient_lab_observations')`.
2. No `.from("cie_gate_scores")`, `.from("cie_domain_scores")`,
   `.from("cie_assessments")`, `.from("derived_patterns")` (all via loader).
3. `loadPatientContext` is imported and called.
4. `buildNarrativeSystemPrompt` source still contains the literal strings
   "You are the Vizzhy Narrative Composer", "You are NOT a medical advisor",
   "{cluster:<cluster_id>}", "{cluster:none}", "## Tier-licensed vocabulary",
   "## Globally forbidden vocabulary", "## Output schema".
5. `${FRAMEWORK_V2}` interpolation is still present in the prompt body.
6. The cluster fetch is scoped by `witnessContext.patient_id`.
7. Imports from `_shared/framework_v2.ts` cover the full set used today
   (`FRAMEWORK_V2`, `TIER_VOCABULARY_LICENSES`, `FORBIDDEN_VOCABULARY_GLOBAL`,
   `parseProseAndCitations`, `validateProseAgainstClusters`,
   `stripClusterMarkers`, `buildRetryFeedback`).

---

## Surface 3 — `generate-ask-anything-context`

### 3.1 Current raw / pre-witness dependencies

File: `supabase/functions/generate-ask-anything-context/index.ts`, lines 113–162.

- `terrain_renders` — read for active `patient_portrait, clinician_summary,
  version, assessment_id` (kept; this is the surface's seed input, not a raw
  observation read).
- **`patient_lab_observations` — raw read, `limit(200)`. ❌ Forbidden under P1a.**
- `cie_gate_scores` — raw read scoped by `assessment_id` and `user_id`.
- `derived_patterns` — raw read, `limit(20)`.
- `profiles` — read for `first_name, age, sex` (identity; kept, but redundant once
  loader runs).

Then: `seenLabs` Map dedupe (lines 170–177), significance scoring via
`BIOMARKER_SIGNIFICANCE` (lines 14–58), anchor classification via `ANCHOR_NAMES`
(lines 69–77), into `flagged / notable / anchor` buckets (lines 180–onward) used
to seed the `QUESTION_SYSTEM_PROMPT` LLM call (lines 79–90).

### 3.2 What reasoning context it currently constructs

- A deduped, latest-per-`canonical_name`, significance-ranked, anchor-tagged
  view of the patient's last 200 lab rows.
- The active `cie_gate_scores` set for the resolved assessment.
- Active `derived_patterns` (top 20 by severity).
- Profile basics.
- Hourly cache keyed `${user_id}::${assessment_id||"none"}::${terrainVersion}`
  (lines 11, 127–133).

### 3.3 Exact required replacement using `loadPatientContext`

1. Keep the `terrain_renders` fetch (lines 114–121) — it is the surface's seed
   input and is not a raw observation read.
2. Keep the in-memory cache and its key shape (line 127) — purely a perf concern.
3. Replace the 4-way `Promise.all` (lines 136–162) with a single
   `loadPatientContext` call. Then derive:
   - `labs` for downstream dedupe ← `witnessContext.labs.observations`
     **plus** `witnessContext.inbody.observations` **plus**
     `witnessContext.fibroscan.observations` (the legacy query selected from a
     single physical table that held all three; the loader splits them and the
     migration must re-merge to keep today's coverage).
   - `gates` ← `witnessContext.cie.gate_scores`. The current `assessment_id`
     filter becomes a no-op because the loader already scopes to the patient's
     witness set; if multi-assessment scoping is required for this surface, that
     is a follow-up, not a P1a item.
   - `patterns` ← `witnessContext.prior_patterns.patterns` (sorted by severity,
     sliced to 20).
   - `profile` ← `witnessContext.profile`.
4. The downstream dedupe / significance / anchor / bucketing logic
   (lines 170–onward) is unchanged in shape; only its input array changes from
   "raw obs rows" to "loader obs rows", which already share `canonical_name`,
   `display_name`, `value`, `unit`, `flag`, `ref_low`, `ref_high`,
   `collection_date`, `source`.

### 3.4 Output behavior that must remain unchanged

- The 4-question LLM output shape: `{ "questions": [q1, q2, q3, q4] }`.
- Question count (exactly 4) and the four thematic slots
  (most-concerning / trajectory / what's working / next steps).
- The cache hit/miss behavior for the current key shape.
- HTTP response envelope.

### 3.5 Safety / prompt text that must be preserved verbatim

- `QUESTION_SYSTEM_PROMPT` (lines 79–90) **verbatim**, including:
  - "You are the question generation layer for Vizzhy…"
  - All seven bullet rules (second person, reference findings by name and
    number, specific/grounded/curious, four thematic coverage slots, Vizzhy
    framework voice / no biotype / no wellness-app vocab / n=1, under 25 words,
    forbidden words list `optimize / biohack / wellness / holistic / journey`).
  - The `Return JSON: { "questions": [...] }` final line.
- `BIOMARKER_SIGNIFICANCE` table (lines 14–58) and `ANCHOR_NAMES` list
  (lines 69–72) — unchanged.
- `getSignificance` and `isAnchor` semantics — unchanged.

### 3.6 Regression guards needed

Create `supabase/functions/generate-ask-anything-context/p1a_migration_guard.test.ts`:

1. No `.from("patient_lab_observations")` / `.from('patient_lab_observations')`.
2. No `.from("cie_gate_scores")`, `.from("derived_patterns")`.
3. `loadPatientContext` is imported and called.
4. `terrain_renders` read is preserved (it's the seed input).
5. `QUESTION_SYSTEM_PROMPT` literal contains the strings "Vizzhy",
   "second person", "under 25 words", "optimize", "biohack", "wellness",
   "holistic", "journey", and `Return JSON: { "questions"`.
6. `BIOMARKER_SIGNIFICANCE` and `ANCHOR_NAMES` constants are still present.
7. The cache key still has the form `${user_id}::${…}::${terrainVersion}`.

---

## Surface 4 — `generate-terrain-render`

### 4.1 Current raw / pre-witness dependencies

File: `supabase/functions/generate-terrain-render/index.ts`, lines 538–588.

- `profiles` — read for `id, first_name, age, sex` (identity; kept).
- `cie_assessments` — raw read for latest complete OR by `assessment_id`.
- `cie_domain_scores` — raw read scoped by `assessment_id`.
- `cie_gate_scores` — raw read scoped by `assessment_id`.
- `cie_responses` — raw read scoped by `assessment_id` (`question_id, domain_id,
  raw_response, score`).
- **`patient_lab_observations` — raw read, last 180 days, `limit(50)`.
  ❌ Forbidden under P1a.**
- `clusters` — raw read scoped by `profile.id` (kept).

### 4.2 What reasoning context it currently constructs

- `domainScores`, `gateScores`, `responses`, `labObs`, `clusters`
  (lines 584–588).
- `clusterTierMap` (lines 591–594).
- `inputData` for cache hashing (lines 597–604) — includes
  `lab_count: labObs.length` and `cluster_count: clusters.length`.
- `composeUserMessage(profile, domainScores, gateScores, responses, labObs)`
  (line 630) — the LLM's data payload.
- `buildTerrainSystemPrompt(clusters)` (line 629) — the LLM's system prompt.

### 4.3 Exact required replacement using `loadPatientContext`

1. Resolve assessment selection. The legacy code supports both "latest complete"
   and explicit `assessment_id` (lines 546–569). The loader does not honor an
   explicit `assessment_id` argument. For P1a parity:
   - When the request omits `assessment_id`, call `loadPatientContext` directly
     and read `witnessContext.cie.*`.
   - When the request supplies `assessment_id`, retain a minimal `cie_assessments`
     existence check for that id (identity / authorization), then **still** drive
     reasoning off `witnessContext.cie.*`. Cross-assessment context is out of
     scope for P1a; document this constraint.
2. Replace the 5-way `Promise.all` (lines 572–582) with one `loadPatientContext`
   call plus the existing `clusters` fetch scoped by `witnessContext.patient_id`.
3. Derive:
   - `domainScores` ← `witnessContext.cie.domain_scores`.
   - `gateScores` ← `witnessContext.cie.gate_scores`.
   - `responses` ← `witnessContext.cie.sample_responses` (note: this is a
     **sample**, capped by `CIE_RESPONSE_SAMPLE_CAP = 50` in the loader, which
     matches the spirit of today's downstream usage; if the renderer requires
     all responses, that is a loader-contract change, not a surface change, and
     therefore out of scope for P1a).
   - `labObs` ← `witnessContext.labs.observations` ∪
     `witnessContext.inbody.observations` ∪
     `witnessContext.fibroscan.observations`. The 180-day window filter must be
     re-applied client-side after the loader returns, to preserve the existing
     temporal scope of the LLM payload.

### 4.4 Output behavior that must remain unchanged

- `terrain_renders` insert payload (`patient_portrait`, `clinician_summary`,
  `status`, `version`, `assessment_id`, `voice_validation_status`,
  `voice_validation_warnings`, `generation_input_hash`).
- `computeInputHash` cache-hit semantics (lines 597–626). Migration must keep
  `lab_count` and `cluster_count` in `inputData` so cache keys remain stable
  *for the same underlying terrain*. (Counts may shift because the loader
  dedupes / scopes differently — that is acceptable; what must not change is
  the **shape** of `inputData`.)
- Version bumping via `next_terrain_render_version` and the
  `supersede_previous_active_terrain_render` trigger.
- Dual-audience voice validation flow (patient_portrait + clinician_summary)
  including `MAX_VOICE_RETRIES = 3`, structural validation,
  `failed_with_warnings` fallback, marker stripping.
- HTTP response envelope (`{ success, cached?, id, version }`).

### 4.5 Safety / prompt text that must be preserved verbatim

- `buildTerrainSystemPrompt(clusters)` body — unchanged.
- `composeUserMessage` template — unchanged in field names and ordering, even as
  inputs migrate.
- `validateTerrainRender` structural validator — unchanged.
- `extractPatientPortraitProse` / `extractClinicianSummaryProse` — unchanged.
- `validateProseAgainstClustersWithAudience` calls for both `'patient'` and
  `'clinician'` audiences — unchanged.
- `buildRetryFeedbackWithSections` retry payload — unchanged.
- `stripMarkersFromPortrait` / `stripMarkersFromClinicianSummary` — unchanged.
- The "use it anyway after retries" fallback semantics
  (lines 703–708) — unchanged.

### 4.6 Regression guards needed

Create `supabase/functions/generate-terrain-render/p1a_migration_guard.test.ts`:

1. No `.from("patient_lab_observations")` / `.from('patient_lab_observations')`.
2. No `.from("cie_domain_scores")`, `.from("cie_gate_scores")`,
   `.from("cie_responses")`.
3. `loadPatientContext` is imported and called.
4. The `clusters` fetch is scoped by `witnessContext.patient_id`.
5. `buildTerrainSystemPrompt`, `composeUserMessage`, `validateTerrainRender`,
   `extractPatientPortraitProse`, `extractClinicianSummaryProse`,
   `validateProseAgainstClustersWithAudience`,
   `buildRetryFeedbackWithSections`, `stripMarkersFromPortrait`,
   `stripMarkersFromClinicianSummary` are all still referenced.
6. `MAX_VOICE_RETRIES = 3` literal preserved.
7. `inputData` for `computeInputHash` still includes `lab_count` and
   `cluster_count` keys.
8. `next_terrain_render_version` RPC call preserved.

---

## Cross-cutting items (apply to all four surfaces)

### Loader location

The loader currently lives at
`supabase/functions/patient-chat/contextLoader.ts` (note the file's own header
still references `generate-clusters/contextLoader.ts` — its prior home).
It is already imported by `generate-clusters` and `patient-chat`.

**Decision required before any surface migrates** (no code change in this plan;
pick one and document):

- **Option A (preferred):** move the loader to
  `supabase/functions/_shared/contextLoader.ts` and update the two existing
  importers. Every remaining surface then imports from `_shared`. This matches
  how `framework_v2.ts`, `clusterPrompts.ts`, `ontology.ts`, and `witness.ts`
  are already organized.
- **Option B:** keep the loader where it is and have all surfaces import from
  `../patient-chat/contextLoader.ts`. Avoids the move; couples reasoning
  surfaces to a peer function's directory.

Either choice is compatible with this plan. The guard tests must reflect the
chosen import path.

### Profile read collapse

Three of four surfaces currently re-query `profiles` for identity fields. After
migration the loader already returns `profile.display_name / age / sex` plus
`patient_id`. Surfaces that today read `first_name` specifically
(`generate-narrative`, `generate-ask-anything-context`,
`generate-terrain-render`) must either:

- accept `display_name` as the substitute (preferred — matches the loader
  contract and `patient-chat` precedent), or
- retain a single thin `profiles.first_name` read alongside the loader call.
  Either is compliant; the **forbidden** outcome is reading `profiles` *plus*
  re-reading any witness-eligible table.

### Witness coverage telemetry

Every migrated surface should log `witness_provenance.registry_seed_version`,
`total_witnesses`, and `source_window_counts` once per request, mirroring the
precedent set by `patient-chat` and `generate-clusters`. This is structural
telemetry, not a feature, and is required for Option M ship-gate property
P-3 ("no signal appears in context that isn't in
`witness_signal_registry` for the seed version").

### Legacy fields explicitly out of scope

`narrative.latest` and `prior_patterns.patterns` remain sourced from
`patient_narratives` and `derived_patterns` respectively (loader source comment,
`contextLoader.ts` lines 19–22). P1a does not migrate those two reads to the
witness layer. Surfaces that consume them inherit the legacy provenance until a
future seed version absorbs them.

---

## Migration order

Order is chosen to minimize blast radius and to surface contract issues against
the simplest consumer first.

1. **Loader location decision** (Option A vs B above). One-line policy choice.
   Blocks every subsequent step.
2. **`generate-action-plan`.** Smallest reasoning surface, deterministic core,
   single LLM call, well-bounded prompt. If the loader contract is wrong for
   any reason, it surfaces here cheapest.
3. **`generate-ask-anything-context`.** Read-only reasoning surface (no DB write
   beyond cache). Exercises the lab dedupe / significance / anchor pipeline
   end-to-end against witness-derived rows. Validates that
   `labs.observations + inbody.observations + fibroscan.observations` is a
   faithful drop-in for the legacy `patient_lab_observations limit(200)` read.
4. **`generate-terrain-render`.** Larger payload, dual-audience voice
   validation, cache hashing, version bumping. Migrating after #3 means the
   lab-merge pattern is already proven.
5. **`generate-narrative`.** Highest-stakes prompt and the seven-section output
   schema. Migrate last because (a) it has the longest verbatim-preserved prompt
   body, (b) it depends on whatever upstream code builds `manifest`, which must
   be re-pointed at the loader output as part of this step, and (c) failures
   here are the most user-visible.

After each step: deploy the function, then run its new
`p1a_migration_guard.test.ts` plus the existing
`patient-chat/p1a_migration_guard.test.ts` (must remain green).

P1a is declared complete only when all five guard suites
(`patient-chat` + the four added here) pass and each migrated surface has been
observed once in production logs emitting `witness_provenance` telemetry with
`registry_seed_version = "p1a_initial"`.

---

P1a is not complete until all four remaining surfaces pass structural and runtime witness-native guards.