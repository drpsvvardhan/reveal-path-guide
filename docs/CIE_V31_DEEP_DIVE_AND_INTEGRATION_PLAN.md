# CIE v3.1 — Deep-Dive Analysis and Patient Reveal Integration Plan

Inputs analyzed:

1. **Treatise** — `CIE_v3_1_BioTwin_Subjective_Sensing_Treatise_rc1.docx` (v3.1.0-rc.1, 2026-08-22): four parts — version delta, doctrine, 359-record question catalog, and the compiler/implementation manual.
2. **OKComputer demo** — `OKComputer_CIE_vs_Traditional_Data_Capture.zip`: a working single-page React prototype of the v3.1 capture experience, including a real (small) client-side engine at `app/src/cie/{types,bank,engine}.ts`.
3. **This repository** — Patient Reveal, the deployed CIE v2.2 (Generation I) surface with its Supabase backend, witness layer (P1a), and BioTwin export plane.

---

## 1. What the treatise actually specifies

The core decision: CIE stops being a questionnaire that produces scores and becomes **the human sensing port of the BioTwin Evidence Acquisition OS**. The unit of capture changes from "answer → score" to "answer → witnessed, typed, provenance-aware evidence object." Everything else follows from that shift.

The governing job, verbatim: *"Compile subjective testimony into typed, temporal, provenance-aware evidence that can update — but never overrule by itself — the BioTwin."*

### The constitutional laws (release-blocking)

1. **No claim without provenance** — every claim carries source, capture method, reference window, question/instrument version.
2. **No state mutation without trace** — corrections append revisions; never silent overwrite.
3. **No negative without an observation-capability statement** — "not asked ≠ no", exactly as "not callable ≠ reference" in WGS. Every explicit negative carries method, scope, and a bounded window.
4. **No contradiction collapse** — discordant claims stay visible until explicitly resolved; no averaging, no latest-wins.
5. **No scar erasure** — resolved events stay in longitudinal memory.
6. **Absence is not normality** — missing evidence is typed missingness, never a neutral 50, never "no".
7. **Safety is lexicographically first** — safety signals bypass scoring and routing competition entirely.
8. **Language is not truth** — LLMs may propose candidates and phrase output; deterministic contracts and human confirmation decide state changes.
9. **Questioning must earn its burden** — every question declares its output object, routing consequence, or decision use.

### The key contracts (Part IV)

- **`WitnessEnvelope<TPayload, TSubstrate>`** — one universal ABI shared by CIE, labs, genomics, wearables, imaging, records. Discriminated union: a `present` state carries a payload; any of 7 missingness kinds (`not_asked, unknown, not_recalled, declined, not_applicable, temporarily_unable, source_unavailable`) carries **no payload** — a missing witness cannot fabricate a value.
- **`CIERawAnswer`** — immutable raw answer envelope (17 response primitives), "never reduced to a number at ingestion." Invalidity is a validation record, distinct from missingness.
- **Question contract** — versioned `QuestionDefinition` with ordered mode-typed screens, output mappings, route rules, and a per-question **Question Sensor Datasheet** (construct, recall horizon, valid-negative semantics, confounders, reliability, burden, refresh policy — "Subjective Analytical Validity").
- **Registries as single generated authority** — `CIE3-MISSINGNESS@1.0.0`, `CIE3-COVERAGE@1.0.0`, `CIE3-INTERACTION-MODE@1.0.0` (12 modes), `CIE3-RESPONSE-PRIMITIVE@1.0.0` (17), `CIE3-QUESTION-PRIORITY@1.0.0` (6 tiers), `CIE3-ROUTING-DSL@1.0.0` (17 predicate ops), `CIE3-QUESTION-CATALOG@3.1.0` (359 records). TS types, JSON Schema, Postgres CHECKs, and UI control registries are *generated*; hand-edited drift is release-blocking.
- **Deterministic compiler** — 14-step pipeline, 25 release-blocking invariants, byte-equivalent replay under pinned versions, `CIECompilationBundle` output (witnesses, contradictions, hypotheses, observation debt, evidence requests, coverage, safety state, readiness, route trace, manifest patch, integrity hashes).
- **Router** — lexicographic tiers (safety → minimum safe biography → material contradiction → decision-linked uncertainty → longitudinal change → enrichment); numeric utility comparison only *within* a tier; complete route trace with excluded candidates and reasons.
- **Observation Debt** — unresolved-but-decision-relevant evidence becomes a first-class object with waiver semantics and a reactivation guard ("not a completeness deficit, a surveillance mandate, or permission to keep asking").
- **PatientManifest integration** — append-only, hash-chained commits (`parentManifestHash` → rebase, never overwrite); projections (patient narrative, physician brief, terrain domains, legacy CIE 2.2) are versioned, reversible, and never replace the witness index.
- **Five entry products, one substrate** — Foundation (24–36 tasks), Adaptive Resolution (0–45), Event Capture (4–12), Sample Context Capsule (60–120 s, LIMS-bound), Longitudinal Sensing (3–7).

### The lesson that motivates all of it

Generation I missed smoking/nicotine/cannabis entirely and reduced alcohol to one binary (A1Q3) because *the ontology only permitted questions that mapped to one of 25 domain scores*. The fix is structural: **constitutional spines** (substances, movement, intervention memory, life events, family, function, goals, environment, reproductive stage, explicit missingness…) that every twin must address, with terrain domains demoted to derived projection lenses. Regression tests must make it impossible for a spine to silently disappear again.

---

## 2. What the OKComputer demo actually contains

The zip is a compiling, playable prototype — not just marketing. The valuable parts:

- **`src/cie/types.ts`** — a faithful miniature of the v3.1 contracts: 5-kind `MissingKind`, 10 interaction modes, 18-kind `EvidenceKind` vocabulary, `Provenance` (question id+version, window, source, acquisition mode, latency), `ObservationCapability` (method/scope/window/limitations), categorical `EvidenceQuality` with a calibration declaration, `Answer.revisedFrom` (flipped/softened/hardened/corrected).
- **`src/cie/bank.ts`** — a 20-card working subset of the catalog (setup, goal, safety preflight, energy/sleep baseline, movement spine, substance kernel + alcohol/nicotine loops, intervention loop, life-event grammar, readiness + capacity, revisit, trajectory delta) with per-card `whyAsked`, windows, and allowed missingness.
- **`src/cie/engine.ts`** — a deterministic client-side compiler (`compile`: answer → typed Evidence objects, including bounded-negative handling for "none" answers), a branching router (`routeAfter`: substance selections insert episode loops; sleep-fragmentation × restored-waking discordance inserts a neutral revisit card and emits an open Contradiction), a reducer with safety interrupts and revision preservation, `exportBundle`, and a `coverageMatrix` ("coverage, not wellness").
- **`SwipeDeck.tsx` / `Witness.tsx`** — a 9-mode card renderer where swipe is restricted to instinct cards (right/left/up/down = yes/no/unsure/decline), typed-missingness footer on every card, latency capture, post-commit "witness receipt" reveal with delayed domain disclosure, and a live evidence ledger.
- **`Research.tsx`** — the positioning essay (7 capture channels, 13-entry prior-art timeline, 8-row conventional-vs-CIE delta, competitive landscape) — reusable copy, demo-grade citations.

Assessment: the demo's data shapes are consistent with the treatise but *simplified* (5 missingness kinds instead of 7, no ABAC envelope, no content hashes, in-memory only, `Math.random()` ids, one hardcoded contradiction rule). It is the right **seed for the card engine and the compiler skeleton**, not for the storage or governance layers.

---

## 3. Where Patient Reveal stands against the spec

Patient Reveal **is the "Generation I" system the treatise dissects** — and it has already independently built several v3.1 prerequisites. Honest scorecard:

### Already aligned (keep and build on)

| v3.1 requirement | Existing implementation |
|---|---|
| One-card swipe cadence, latency capture, anti-priming reveal | `src/components/intake/IntakeQuestionCard.tsx` (framer-motion deck, ±110 px threshold, `response_latency_ms`, domain revealed post-answer) |
| Revision preservation (T1/T2, flipped/softened/hardened) | `reconsideration_events` + `computeDeltaType` in `src/context/IntakeContext.tsx` |
| Witness substrate with testimony, limitations, ancestry, registry gating | P1a: `_shared/witness.ts`, `witness_objects`, `witness_signal_registry`, `scripts/build-witness-registry.ts`, ancestry-integrity trigger |
| Reasoning surfaces read witnesses only, never raw tables | `_shared/contextLoader.ts` + per-function `p1a_migration_guard.test.ts` static scans |
| Alternate capture source → same tables → same witness projection | Factory import pattern: `_shared/cieFactoryImport.ts` + `admin-import-cie` ("identical path to a natively-taken assessment") |
| Scoring-authority doctrine with tests | Factory finals copied verbatim, never re-scored (`tests/cie-factory-import.test.ts`) |
| Versioned assessments, staleness-driven regeneration | `next_cie_version` RPC; `TerrainRenderContext` auto-regen incl. the back-dated-import fix |
| Deterministic release compiling with golden fixtures | BioTwin release compiler CI (Peter v18 fixture), CELF export provenance stamps |
| Contradiction/admission machinery (for labs) | RAE: 7 signals, 4 admission states, concept-assignment witnesses |

### Direct violations of v3.1 doctrine (the work)

1. **Neutral-50 exists** — `NEUTRAL_POLARITY` in `_shared/cieScoring.ts` scores "diagnostic awareness" questions at 50, and the factory import path can store 50 when an authoritative score is absent. The treatise names this exact defect. *(Legal as a frozen legacy projection; illegal as canonical evidence.)*
2. **No typed missingness** — skipped/unknown/declined are not distinguishable states anywhere in `cie_responses`.
3. **No observation capability** — a "no" answer is just a low/high score; no bounded-negative semantics.
4. **Score-centric ontology** — 25 domains × score maps define what can exist; the substance/movement/intervention/life-event spines are absent or thin (the A1Q3-class problem is live here).
5. **`cie_responses` is mutated in place** — reconsideration UPDATEs `raw_response` (T1 kept in side columns); the raw answer log is not append-only.
6. **Threshold routing, not tiered routing** — deep-dive triggers on `domain<60 OR question<40`; no safety tier, no contradiction tier, no route trace.
7. **Triple-source question bank** — semantics duplicated across `src/lib/cieSeedData.ts` (client), `_shared/cieScoring.ts` (server), and the registry seed SQL; the factory-vocabulary drift bug came from exactly this.
8. **No contradiction objects for testimony** — RAE covers lab admission; nothing detects or preserves testimony–testimony or testimony–measurement discordance.
9. **No Observation Debt / evidence requests** — `patient_question_queue` exists but is not debt-driven.

---

## 4. The plan

Strategy: **substrate first, exactly as the treatise's Phase 0–9 ladder orders it**, adapted to what this repo already has. Do not port the 359-card catalog into the current deck; do not rewrite the v2.2 engine. Build the v3 substrate beside it, wrap the legacy, prove five loops, then cut over. The OKComputer engine is the seed for Phases 3–5's client and compiler; the treatise contracts govern everything it doesn't cover (7-kind missingness, ABAC, hashes, storage).

### M0 — Freeze and reproduce Generation I *(mostly done; close the gaps)*

- Tag the current bank/score maps/gates as `CIE_2.2.0` artifacts (they are already centralized in `cieSeedData.ts` / `cieScoring.ts`; add a content hash).
- Add the **Peter Legacy Blind-Spot fixture**: assert the import path emits `smoking.missingness = not_asked` and `sleep_history.coverage = partial` — and *never* invents nicotine or shift-work history. Extend `tests/cie-factory-import.test.ts`.
- Add a **spine-presence regression test**: a constitutional-spine manifest that CI checks against the active question bank, so a spine can never silently vanish in a refactor again.

*Gate: any historical output reproducible; invented-fixture claims = 0.*

### M1 — Canonical registry + WitnessEnvelope ABI *(the load-bearing milestone)*

- Create `supabase/functions/_shared/cie3/registry/canonical-registry.ts` (or YAML + a small generator, per the treatise's package layout): the **single authority** for `MissingnessKind` (7), `CoverageStatus` (5), `InteractionMode` (12), `ResponsePrimitive` (17), `PredicateOp` (17), `QualityLevel`, priority tiers (6), safety dispositions (4 — `no_active_cie_safety_signal_detected`, never "clear"), witness substrates, source kinds.
- Generate from it: TS types (client + edge via the existing `@shared` alias), Postgres CHECK fragments for migrations, and the UI mode registry. Add a codegen-drift CI check modeled on the existing `generate-witness-registry.yml` workflow.
- Define `WitnessEnvelopeCore<TPayload>` in `_shared/cie3/contracts/` honoring the discriminated union (`present` + payload XOR missingness + no payload) and `assertNegativeClaimInvariant` (adequate opportunity, non-empty scope, bounded window, concept match).
- New tables (append-only by role policy, mirroring the `witness_objects` pattern):
  - `cie3_raw_answers` — immutable `CIERawAnswer` rows; unique `(session_id, idempotency_key)` and `(session_id, client_sequence)`; corrections insert with `supersedes_answer_id`. **This resolves the `cie_responses` mutation problem for the new engine without touching the legacy table.**
  - `cie3_sessions` (product, purpose, question-set/routing/compiler versions, `state_hash`).
  - `cie3_witnesses` — either a new table with the DB CHECKs from the spec (`present ⇔ payload NOT NULL`; `negative ⇒ observation_capability NOT NULL`) or an extension of `witness_objects`; recommendation: **new table**, with a projection into `witness_signal_registry`-gated `witness_objects` for consumption by `contextLoader`, so P1a ship-gates stay intact.
  - `cie3_route_log`, `cie3_contradictions`, `cie3_observation_debt`.

*Gate: registry conformance fixtures pass across TS, SQL, and UI; zero enum drift.*

### M2 — Legacy 2.2 wrapper

- `_shared/cie3/legacyWrapper.ts`: wrap every existing `cie_responses` row as a `legacy_question_response` witness (`collection_instrument = "CIE_2.2.0"`, original token, mapped score, domain, layer, latency, reconsideration) — deterministic, replayable, provenance-complete.
- Compile typed observations **only where old wording supports the meaning**: A1Q3 yields a bounded ">2 drinks/day" threshold claim, never weekly volume or "no use". Neutral-50 rows wrap with limitation `legacy_factory_missing_score_default`, never as a v3 "normal".
- Domain/gate scores become labeled `legacy_projection` objects. Nothing in the existing UI changes.

*Gate: wrapper invents zero typed facts; golden test on a real (consented/synthetic) v2.2 assessment.*

### M3 — Five exemplar semantic loops + deterministic compiler

- Port and harden the OKComputer engine into `_shared/cie3/compiler/` (pure modules, vitest-importable exactly like `cieScoring.ts` today): `validate-answer`, `emit-witnesses`, `assemble-events`, `detect-contradictions`, `derive-observation-debt`, `derive-readiness`, `invariants`. Replace `Math.random()` ids with injected id/clock providers so replay is byte-equivalent.
- Author the five loops as versioned `QuestionDefinition`s with content hashes and minimal Question Sensor Datasheets: **nicotine exposure, sleep trajectory, intervention trial, life event, goal/readiness/capacity** (the demo bank already covers all five in prototype form; upgrade to the 7-kind missingness and add `not_asked` bookkeeping).
- Implement the compiler invariants as an `assertCompilerInvariants` gate that quarantines the compilation on violation (error codes from §12.4), plus property tests: non-present ⇒ no payload; every negative has capability; supersession acyclic; permutation-invariant assembly.
- Edge function `cie3-compile-answer` (idempotency-key + `If-Match: stateHash` semantics, 409 `SESSION_STATE_CONFLICT`).

*Gate: raw answer → witness → compiled object → projection is reversible and golden-tested for all five loops; identical inputs ⇒ identical output hashes.*

### M4 — Mode-aware card engine in Patient Reveal

- Evolve `IntakeQuestionCard` toward the demo's `SwipeDeck`: mode-typed rendering from the M1 registry, swipe **restricted to instinct mode** (up = unsure, down = decline — typed missingness as gestures), visible-button equivalents for every gesture, typed-missingness footer on every card, quantify stepper, loop/event builders, safety mode with calm non-scored takeover, revisit mode for contradictions.
- Keep everything the current deck does well: haptics, latency via `performance.now()`, ghost deck, delayed domain reveal, long-press step-back (now emitting supersede rows into `cie3_raw_answers` instead of UPDATEs).
- Add the post-commit **witness receipt** (the demo's `Reveal`): show the person the typed evidence object their answer produced, with provenance and "why we asked" — this is the single most differentiating UX moment in the demo and costs little.
- Wire as a new onboarding/intake path behind a flag (`useCie3Flag`, mirroring `useAskMyTwinFlag`); v2.2 deck remains default until M6 passes.

*Gate: every mode has accessible non-gesture controls; typed output; no hidden score map in the client.*

### M5 — Router, contradictions, Observation Debt

- Implement `selectNextScreen` with lexicographic tiers and the within-tier utility (`U = wI·I + wD·D + wC·C + wL·L − wB·B − wP·P − wR·R` as a versioned ordinal policy table — no fabricated probabilities), full `RouteDecision` trace into `cie3_route_log`.
- Contradiction detection as deterministic rules over concept/time/context overlap (`direct_conflict, temporal_change, vocabulary_mismatch, source_disagreement, perception_measurement_discordance, context_dependent, apparent_only`) — seeded from the demo's sleep-discordance rule, extended to testimony-vs-lab/wearable pairs the witness layer already holds.
- **Observation Debt → `patient_question_queue`**: this is the natural integration — open debts with `decisionImpact ≥ material` surface as queue items; waivers respect the reactivation guard (declined topics never silently re-ask). The existing queue UI needs only a new item source.
- Safety preflight as a deterministic protocol object (no LLM in the path), disposition vocabulary from the registry; do not ship any safety item without an owned response workflow — until then the safety card routes to static locality-reviewed guidance exactly as the demo does.

*Gate: router explains every selection and exclusion; safety lexicographically first in tests; waived debt cannot silently reactivate.*

### M6 — Shadow run and cutover

- Run v2.2 and v3.1 side by side (new intakes answer the v3 Foundation deck; the legacy wrapper keeps v2.2 projections rendering). Compare per the dual-run protocol: spine coverage, burden, signals found by only one system, unknown/declined rates, contradiction preservation — **not** score agreement ("V3 intentionally represents a different artifact").
- Terrain integration: `generate-terrain-render`'s `loadPatientContext` consumes cie3 witnesses through the registry-gated projection (new seed version, bump `ACTIVE_REGISTRY_SEED_VERSION` in `_shared/witnessFreshness.ts`); terrain domains become a **derived projection lens** computed from typed evidence, with the legacy 25-domain scores rendered as a labeled historical view. `TerrainRenderContext` staleness helpers gain a cie3-session timestamp source (same class of fix as the back-dated-import regen).
- CELF export gains the compilation bundle (witnesses, contradictions, coverage, debt) alongside the existing `cie_domain_*`/`cie_gate_*` observations, additive-only per CELF versioning rules.

*Gate: no safety regression; equal-or-better decision-relevant coverage at lower or justified burden; rollback loses no testimony.*

### Deferred (explicitly out of near-term scope)

- **Sample Context Capsule** (Phase 8) — requires LIMS collection-event binding this repo doesn't have; keep the payload contract in the registry so nothing blocks it later.
- **Cross-modal Evidence Router** (Phase 9) — CIE emits `EvidenceRequest` proposals only; wiring EHR/wearable/omic actions comes after M6.
- **Full 359-card catalog** — load module-by-module after the five exemplar loops prove the pipeline; the catalog is a library, not an administered count.
- **Personal Perception Calibration Profile** — research-governed; prohibited as a person-level reliability score.

### Refinements to the OKComputer demo itself (as the seed is ported)

1. Upgrade `MissingKind` 5 → 7 (`not_asked`, `source_unavailable`) and add `AnswerValidationRecord` separation.
2. Replace `uid()`/`now()` with injected providers; make `exportBundle` hash-stable for replay tests.
3. Move the Autobiography view's hardcoded alcohol↔sleep synthesis into a deterministic, labeled compiler rule (or drop it — an unlabeled in-view heuristic is exactly the "hidden truth map" the spec forbids).
4. Attach `ObservationCapability` to every explicit-negative path (the demo does this for SAF-001/SUB-002/MOV-001/LIF-001 — generalize it into the compiler rather than per-card switch arms).
5. Give every card a datasheet stub so "questioning must earn its burden" is enforceable at authoring time.

---

## 5. Sequencing and risk

- **Biggest structural risk**: enum/contract drift across client, edge functions, and SQL — the repo has already been bitten by this (factory vocabulary). M1's generated registry is therefore first, before any UI work.
- **Biggest product risk**: burden. The Foundation budget is 24–36 cognitive tasks; the five-loop deck must be tuned against real completion data before catalog expansion.
- **Biggest safety constraint**: no safety question ships without an owned response operation. Until one exists, the safety preflight stays limited to the static-guidance pattern.
- **What we never do**: re-score or relabel historical v2.2 sessions; convert missing to 50/"no"/"normal"; collapse contradictions; let an LLM write canonical state; show cross-version score trends without a validated bridge.

The end state: one witness substrate under five entry products, the swipe deck as *one instrument inside CIE* rather than CIE itself, 25 terrain domains as derived lenses, and every answer traceable from rendered prompt to hash-bound manifest commit — replayable later, byte for byte.
