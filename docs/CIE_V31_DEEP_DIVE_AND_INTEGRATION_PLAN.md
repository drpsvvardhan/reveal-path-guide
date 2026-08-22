# CIE v3.1 — Deep-Dive Analysis and Patient Reveal Integration Plan

**Revision 2.** Incorporates the red-team verdict on the prototype (all code findings independently verified against source), the four doctrinal corrections, and the upstream question-compiler architecture ("finite sensing grammar + governed question composition"). Revision 1 treated the prototype's downstream compiler as the seed; this revision treats it as *half* the system and adds the missing upstream half.

Inputs analyzed:

1. **Treatise** — `CIE_v3_1_BioTwin_Subjective_Sensing_Treatise_rc1.docx` (v3.1.0-rc.1, 2026-08-22): version delta, doctrine, 359-record question catalog, compiler/implementation manual.
2. **Prototype** — `OKComputer_CIE_vs_Traditional_Data_Capture.zip`; `CIE_v3.0_codexos_2.zip` contains the same seven core source files byte-identical (`types.ts`, `bank.ts`, `engine.ts`, `SwipeDeck.tsx`, `Sensing.tsx`, `Autobiography.tsx`, `Research.tsx`) — one codebase, no delta between the two archives.
3. **This repository** — Patient Reveal, the deployed CIE v2.2 (Generation I) surface with its Supabase backend, witness layer (P1a), and BioTwin export plane.

**Verdict adopted:** the prototype is an excellent **interaction and epistemic-substrate demonstrator** — retain the visual shell (witness receipts, delayed domain reveal, typed missingness, native quantities, contradictions, revisions, dual projections). It is **not** an implementation-canonical compiler: its center is `finite card bank + hard-coded branches + question-specific compiler switch`, where the target is `finite sensing grammar + governed, effectively unbounded question composition`. Rename it accordingly ("CIE v3.1 Interaction and Epistemic Substrate Demonstrator") and never present it as the compiler.

---

## 1. What the treatise actually specifies

The core decision: CIE stops being a questionnaire that produces scores and becomes **the human sensing port of the BioTwin Evidence Acquisition OS**. The unit of capture changes from "answer → score" to "answer → witnessed, typed, provenance-aware evidence object."

The governing job, verbatim: *"Compile subjective testimony into typed, temporal, provenance-aware evidence that can update — but never overrule by itself — the BioTwin."*

### The constitutional laws (release-blocking)

1. **No claim without provenance** — source, capture method, reference window, question/instrument version on every claim.
2. **No state mutation without trace** — corrections append revisions; never silent overwrite.
3. **No negative without an observation-capability statement** — "not asked ≠ no", exactly as "not callable ≠ reference" in WGS.
4. **No contradiction collapse** — discordant claims stay visible until explicitly resolved; no averaging, no latest-wins.
5. **No scar erasure** — resolved events stay in longitudinal memory.
6. **Absence is not normality** — typed missingness, never a neutral 50, never "no".
7. **Safety is lexicographically first** — safety signals bypass scoring and routing competition.
8. **Language is not truth** — LLMs propose; deterministic contracts and human confirmation decide.
9. **Questioning must earn its burden** — every question declares its output object, routing consequence, or decision use.

### Doctrinal guardrails (adopted corrections)

- **Testimony is first-class, not supreme.** "Subjective is a source class, not a quality verdict." Human, laboratory, imaging, genomic, wearable, and record witnesses are all canonical `WitnessEnvelope` instances; none is demoted — or promoted — in advance. CIE corrects the historical devaluation of testimony; it must not replace that with testimony supremacy. Likewise, contradiction is not automatically an interesting biological signal — it may be context, temporal change, recall limits, instrument limits, or error. The invention is *preserving and interrogating* discordance, not romanticizing it.
- **Retire question counts from positioning.** 325 (75 + up to 250) and 330 (+5 UKRCC) are Generation-I history; 359 is one release's reference-record corpus, not CIE's territory; 24–36 Foundation tasks are a burden target, not a fixed instrument. No count belongs in primary product language.
- **The novelty is the constitution, not the primitives.** Typed missingness has prior art (FHIR `DataAbsentReason` distinguishes not-asked / asked-unknown / temporarily-unknown / asked-declined / not-applicable / unsupported); adaptive questionnaires, QuestionnaireResponse and Provenance resources exist. The defensible claim is scoped integration: *"In our scoped review, we did not identify a production architecture combining human-source witness capture, bounded negative semantics, contradiction preservation, biological-autobiography compilation, Observation Debt, and decision-linked cross-modal routing."* Never claim "no prior art."
- **The questions are the playbook, not the game.** "CIE must not enumerate humanity. It must define the smallest governed grammar from which any relevant human observation can be asked about and compiled." The 359 records are one compiled season — not football itself.

### The key contracts (Part IV)

- **`WitnessEnvelope<TPayload, TSubstrate>`** — one universal ABI shared by CIE, labs, genomics, wearables, imaging, records. Discriminated union: `present` carries a payload; any of 7 missingness kinds (`not_asked, unknown, not_recalled, declined, not_applicable, temporarily_unable, source_unavailable`) carries **no payload**.
- **`CIERawAnswer`** — immutable raw answer envelope (17 response primitives), "never reduced to a number at ingestion"; invalidity is a validation record, distinct from missingness.
- **Question contract** — versioned `QuestionDefinition` with ordered mode-typed screens, output mappings, route rules, and a per-question **Question Sensor Datasheet** (construct, recall horizon, valid-negative semantics, confounders, reliability, burden, refresh policy).
- **Registries as single generated authority** — missingness (7), coverage (5), interaction modes (12), response primitives (17), priority tiers (6), routing-DSL ops (17), catalog. TS, JSON Schema, Postgres CHECKs, and UI registries are *generated*; hand-edited drift is release-blocking.
- **Deterministic compiler** — 14-step pipeline, 25 release-blocking invariants, byte-equivalent replay under pinned versions, `CIECompilationBundle` output with integrity hashes.
- **Router** — lexicographic tiers (safety → minimum safe biography → material contradiction → decision-linked uncertainty → longitudinal change → enrichment); numeric utility only *within* a tier; complete route trace with excluded candidates.
- **Observation Debt** — first-class object with waiver semantics and a reactivation guard.
- **PatientManifest** — append-only, hash-chained commits; projections versioned, reversible, never replacing the witness index.
- **Five entry products, one substrate** — Foundation, Adaptive Resolution, Event Capture, Sample Context Capsule (LIMS-bound), Longitudinal Sensing.

---

## 2. The prototype: what it demonstrates and where it fails

### Genuinely right (retain)

One cognitive act → one interaction; swipe restricted mostly to felt-state cards; visible typed missingness; some bounded negatives with observation capability; latency as process metadata, not honesty scoring; the post-answer **witness receipt** (the strongest trust mechanism in the demo); contradictions displayed, not averaged; patient/clinician projections with no wellness score; the browser-only limitation disclosed.

### Confirmed defect ledger (verified line-by-line against source; blocks any port)

| Pri | Defect | Verified evidence |
|---|---|---|
| P0 | **Left swipe records the wrong answer** | `SwipeDeck.tsx` `commitSwipe`: left commits `opts[opts.length - 1].id`. `LIF-001` is ordered `yes, no, notsure`, so "NO · NOT ME" records `notsure` — and `routeAfter` then opens the life-event branch. Real semantic corruption. |
| P0 | **Answers not question-bound** | `Action {type:'answer'}` carries no card id, screen id, schema hash, idempotency key, or state version; the reducer binds to `s.queue[s.idx]`. A duplicate/stale gesture applies to the next card. |
| P0 | **Safety permits self-clearance** | Both interrupt buttons (`user_confirmed_safe_continued`, `user_directed_to_urgent_care`) merely dispatch `safetyResume`, clearing the interrupt and resuming the deck. A CIE screen must never imply clinical clearance. |
| P0 | **Negative capability not enforced** | `observationCapability` is optional on `Evidence`; ALC-006 "nothing reliable", INT-OUT "no noticeable effect", SLP-003 = 0 compile capability-free; `SAF-001` treats `v.length === 0` as "no acute red flags" — an *empty value* manufactures a bounded negative. |
| P0 | **"Deterministic" is false** | `uid()` = `Math.random()`, `now()` = wall clock; identical inputs do not produce byte-equivalent outputs. |
| P0 | **Export reversibility is false** | `exportBundle` claims "raw answers and route log are the source of truth… reversible to them" but exports neither; no route log exists in state. |
| P0 | **Contradiction lifecycle broken** | The sleep contradiction is stored `open`; `REV-001` compiles a *separate* `resolved` object and never links or closes the original — both coexist. |
| P1 | **The "compiler" is a scripted mapper** | 20 cards, one `switch(card.id)`, `if(cardId)` route branches; no Question AST, DSL interpreter, or primitive grammar. |
| P1 | **Registry names advertised, not implemented** | Modes add non-canonical `choice`/`multi` and omit `timeline`/`grid`/`narrative`/`confirmation`; missingness omits `not_asked`/`source_unavailable`; coverage uses ad-hoc states; Evidence is CIE-specific, not `WitnessEnvelope<T>`. |
| P1 | **Completion overstated** | A spine reads "covered" when *any* constituent item is answered; family history, social reachability, occupation/environment are absent entirely. "Foundation compilation complete" should read "demo path complete." |
| P1 | **Observation Debt is prose only** | No debt object (blocked decision, impact, staleness, burden, waiver, reactivation guard). |
| P1 | **Synthesis has invented provenance** | Autobiography's alcohol↔sleep "pattern candidate" is emitted with `source: 'self'`, `capturedAt: ''`, fabricated `questionId: 'synthesis'`/`'router'` — system-generated content wearing patient provenance, across non-aligned windows. |
| P1 | **Manufactured quality** | `defaultQuality` grants every structured answer `reportFidelity: 'high'` with no reason; contradictions/revisions bypass quality entirely. |
| P1 | **No tests** | No suite for gesture mapping, negative capability, routing, contradiction lifecycle, revisions, replay, or export reversibility. |

The left-swipe bug is the emblem: **gesture must be a renderer over declared response semantics, never a positional shortcut** ("right = first option, left = last option").

### The smoking problem is narrowed, not eliminated

The demo's SUB-002 asks five classes over 12 months; only alcohol and nicotine get branches (cannabis, caffeine, non-prescribed medication do not, despite the card's promise); alcohol captures quantity and effects but not frequency or recency. It cannot represent current/former/never, a heavy former smoker who quit 13 months ago, product-route distinctions, lifetime duration, quit/restart trajectory, context, or recovery. The constitutional fix is a **substance-exposure grammar primitive**:

```
agent × route × status × dose × frequency × timing × trajectory × response × recovery
```

Nicotine is one *instance* of that grammar — not the ontology. Patient Reveal's exposure loops (Plan M3) must be authored against this primitive, not as per-substance card branches.

---

## 3. Where Patient Reveal stands against the spec

Patient Reveal **is the "Generation I" system the treatise dissects** — and has independently built several v3.1 prerequisites.

### Already aligned (keep and build on)

| v3.1 requirement | Existing implementation |
|---|---|
| One-card swipe cadence, latency capture, anti-priming reveal | `src/components/intake/IntakeQuestionCard.tsx` |
| Revision preservation (T1/T2, flipped/softened/hardened) | `reconsideration_events` + `computeDeltaType` in `src/context/IntakeContext.tsx` |
| Witness substrate with testimony, limitations, ancestry, registry gating | P1a: `_shared/witness.ts`, `witness_objects`, `witness_signal_registry`, `scripts/build-witness-registry.ts` |
| Reasoning surfaces read witnesses only | `_shared/contextLoader.ts` + `p1a_migration_guard.test.ts` static scans |
| Alternate capture source → same tables → same witness projection | `_shared/cieFactoryImport.ts` + `admin-import-cie` |
| Scoring-authority doctrine with tests | Factory finals copied verbatim, never re-scored (`tests/cie-factory-import.test.ts`) |
| Versioned assessments, staleness-driven regeneration | `next_cie_version` RPC; `TerrainRenderContext` auto-regen incl. back-dated-import fix |
| Deterministic release compiling with golden fixtures | BioTwin release compiler CI (Peter v18), CELF provenance stamps |
| Contradiction/admission machinery (labs) | RAE: 7 signals, 4 admission states, concept-assignment witnesses |

### Direct violations of v3.1 doctrine (the work)

1. **Neutral-50 exists** — `NEUTRAL_POLARITY` in `_shared/cieScoring.ts`; the factory import can store 50 absent an authoritative score. Legal only as a frozen legacy projection.
2. **No typed missingness** — skipped/unknown/declined indistinguishable in `cie_responses`.
3. **No observation capability** — a "no" is just a score.
4. **Score-centric ontology** — 25 domains define what can exist; substance/movement/intervention/life-event spines absent or thin (the A1Q3-class problem is live here).
5. **`cie_responses` mutated in place** — reconsideration UPDATEs `raw_response`.
6. **Threshold routing** — `domain<60 OR question<40`; no tiers, no route trace.
7. **Triple-source question bank** — `cieSeedData.ts` / `cieScoring.ts` / registry seed SQL; the factory-vocabulary drift bug came from exactly this.
8. **No testimony contradiction objects** — RAE covers lab admission only.
9. **No Observation Debt / evidence requests** — `patient_question_queue` exists but is not debt-driven.

---

## 4. The missing upstream half: two compilers

The treatise specifies the **downstream** compiler well (`answer → witness → autobiography`). The prototype and Revision 1 of this plan both stopped there. The corrected architecture requires an **upstream** compiler too:

```
Twin state + purpose
  → Observation Debt + policy
    → QUESTION-PLAN COMPILER  (observation need → question program → interaction)
      → immutable interaction instance
        → raw answer
          → WITNESS COMPILER  (answer → witness → autobiography)
            → witness graph → twin state (loop)
```

A minimal **question program (Question AST)**:

```
Q = (purpose, source, observable, window, context, comparator, relationship,
     response, negative_contract, safety, consent, output)
```

with operators such as: observe; locate in time; quantify; compare with personal baseline; relate perturbation and response; test recurrence; describe recovery or persistence; capture functional consequence; distinguish testimony, attribution, and hypothesis; express negative/uncertain/declined/not-observed states.

**What stays finite (governed):** constitutional laws; the universal Witness ABI; missingness and coverage registries; response primitives; the Question AST grammar and its type checker; safety and consent policies; event and trajectory relations; validated instruments; negative-capability contracts; deterministic transformations; reference questions and golden fixtures.

**What becomes person-specific (generated per session):** the observation need; the next evidence action; the bound event/exposure/context/window; the Question AST instance; the rendered wording and screens; the immutable question-instance hash; the answer; the route trace; the witness; the remaining Observation Debt.

**Three generation classes:**

1. **Protocol-locked** — safety workflows and validated instruments: exact wording and sequence, never regenerated.
2. **Template-locked compositions** — approved semantic templates with person-specific bindings (events, concepts, windows, vocabulary).
3. **Novel generated candidates** — shadow/research mode only at first; may never create high-stakes negatives, safety dispositions, or canonical state changes without confirmation and review.

An LLM may propose wording; it must never invent semantics. A deterministic validator must prove the rendered interaction preserves the AST's observable, window, response vocabulary, missingness, negative capability, safety, consent, and output mapping. Under this architecture the 359 records become a **Reference Sensor Library** — locked protocols, approved templates, and regression fixtures — not the administered instrument.

---

## 5. The plan

Strategy unchanged: **substrate first**, v3 beside v2.2, wrap the legacy, prove exemplar loops, shadow-run, cut over. Two changes from Revision 1: the prototype code is a *reference*, ported only through the defect-ledger gate; and the upstream Question-Plan compiler is now a first-class milestone (M7) whose contracts shape M1 and M3 from the start.

### M0 — Freeze and reproduce Generation I *(mostly done; close the gaps)*

- Tag the current bank/score maps/gates as `CIE_2.2.0` artifacts with a content hash.
- **Peter Legacy Blind-Spot fixture**: the import path emits `smoking.missingness = not_asked`, `sleep_history.coverage = partial` — and never invents history. Extend `tests/cie-factory-import.test.ts`.
- **Spine-presence regression test**: a constitutional-spine manifest CI-checked against the active bank.
- **Claim ledger for research/marketing content**: every market/positioning claim carries `claim_id, statement, scope_and_denominator, as_of, source_class, source_url, support_status, limitations, last_verified_at`. Seed it with the fact-check corrections (see §6) — one link per paragraph of four claims is not provenance.

*Gate: historical output reproducible; invented-fixture claims = 0.*

### M1 — Canonical registry + WitnessEnvelope ABI *(load-bearing)*

- `_shared/cie3/registry/`: single generated authority for `MissingnessKind` (all **7**, including `not_asked` and `source_unavailable`), `CoverageStatus` (5 canonical states — no ad-hoc "covered"), `InteractionMode` (the canonical 12 — **no `choice`/`multi` aliases**; the demo's choice/multi cards re-home to `recall`/existing modes or the registry is formally versioned), `ResponsePrimitive` (17), `PredicateOp` (17), quality levels, priority tiers (6), safety dispositions (`no_active_cie_safety_signal_detected`, never "clear"), substrates, source kinds. Codegen to TS (client + edge via `@shared`), Postgres CHECKs, and the UI mode registry; drift-check CI modeled on `generate-witness-registry.yml`.
- `WitnessEnvelopeCore<TPayload>` with the discriminated union (`present` + payload XOR missingness + no payload) and `assertNegativeClaimInvariant` (adequate opportunity, non-empty scope, bounded window, concept match) — **enforced, not optional**: a negative that fails the invariant fails compilation.
- Append-only tables mirroring the `witness_objects` pattern: `cie3_raw_answers` (immutable; unique `(session_id, idempotency_key)` and `(session_id, client_sequence)`; corrections via `supersedes_answer_id`), `cie3_sessions` (product, purpose, pinned versions, `state_hash`), `cie3_witnesses` (DB CHECKs: present ⇔ payload; negative ⇒ capability), `cie3_route_log`, `cie3_contradictions` (with **linked lifecycle**: resolution references the contradiction it resolves), `cie3_observation_debt`, `cie3_policy_decisions`.

*Gate: registry conformance fixtures pass across TS, SQL, UI; zero enum drift.*

### M2 — Legacy 2.2 wrapper

- `_shared/cie3/legacyWrapper.ts`: every `cie_responses` row wraps as a `legacy_question_response` witness (`collection_instrument = "CIE_2.2.0"`), deterministic and provenance-complete. A1Q3 yields only a bounded ">2 drinks/day" threshold claim; neutral-50 wraps with limitation `legacy_factory_missing_score_default`; domain/gate scores become labeled `legacy_projection`. Nothing in the existing UI changes.

*Gate: wrapper invents zero typed facts; golden test on a real v2.2 assessment.*

### M3 — Exemplar semantic loops + deterministic downstream compiler

- Build `_shared/cie3/compiler/` (pure, vitest-importable) **through the defect gate** — every P0/P1 above has a named fix before any demo logic is reused:
  - injected id/clock providers (replay byte-equivalence);
  - answers bound to `(questionVersionId, screenId, schemaHash, idempotencyKey, expectedStateHash)`;
  - **concept-keyed output mappings** from `QuestionDefinition` instead of `switch(card.id)` — the compiler interprets declared semantics, so it scales to composed questions (this is the M7 seam);
  - enforced negative-capability invariant (an empty safety selection is *invalid input*, never "no red flags");
  - evidence-quality levels always carry reasons; contradictions and revisions pass through the same quality path;
  - contradiction lifecycle: detection, clarification-requested, explained/adjudicated — resolution links and closes its target;
  - export = full `CIECompilationBundle` including raw-answer ledger and route trace, hash-stable, actually reversible;
  - system-generated syntheses carry `source: derived_projection` provenance with real timestamps and the generating rule version — never patient provenance.
- Author five exemplar loops as versioned `QuestionDefinition`s with datasheets: **substance exposure (via the exposure grammar primitive — agent × route × status × dose × frequency × timing × trajectory × response × recovery, with nicotine and alcohol as instances and current/former/never + quit-trajectory representable), sleep trajectory, intervention trial, life event, goal/readiness/capacity.**
- Test suite from day one: gesture mapping, negative capability, routing, contradiction lifecycle, revisions, replay, export reversibility — the exact list the prototype lacks.
- Edge function `cie3-compile-answer` (idempotency key + `If-Match` state hash, 409 on conflict).

*Gate: raw answer → witness → object → projection reversible and golden-tested for all five loops; identical inputs ⇒ identical output hashes; every defect-ledger row has a passing regression test.*

### M4 — Mode-aware card engine in Patient Reveal

- Evolve `IntakeQuestionCard` toward the demonstrator's deck with one governing rule: **gesture is a renderer over response semantics declared on the question version** — each instinct card declares which option (if any) each direction commits; no positional defaults. Swipe restricted to instinct mode; up/down = typed missingness only where allowed; visible-button equivalents everywhere.
- Safety mode: calm non-scored takeover; the resume path records a disposition from the registry vocabulary and **never implies clearance** — "no active CIE safety signal detected" is bounded to protocol and window, wording reviewed, and no safety card ships without an owned response operation.
- Keep the current deck's strengths (haptics, latency, ghost deck, delayed reveal, long-press step-back — now emitting supersede rows, not UPDATEs). Add the **witness receipt** post-commit reveal.
- Behind a flag (`useCie3Flag`); v2.2 deck default until M6 passes.

*Gate: every mode accessible without gestures; typed output; no hidden score map; no positional gesture mapping anywhere.*

### M5 — Router, contradictions, Observation Debt

- `selectNextScreen` with lexicographic tiers, versioned ordinal within-tier utility, full `RouteDecision` trace persisted to `cie3_route_log`.
- Deterministic contradiction rules over concept/time/context overlap (`direct_conflict, temporal_change, vocabulary_mismatch, source_disagreement, perception_measurement_discordance, context_dependent, apparent_only`), seeded from the sleep-discordance rule and extended to testimony-vs-lab/wearable pairs the witness layer already holds.
- **Observation Debt as real objects** (blocked decision, impact, staleness, resolvability, burden, waiver + reactivation guard) → surfaced through `patient_question_queue`; declined topics never silently re-ask.

*Gate: router explains every selection and exclusion; safety lexicographically first in tests; waived debt cannot silently reactivate.*

### M6 — Shadow run and cutover

- v2.2 and v3.1 side by side; compare spine coverage, burden, one-system-only signals, unknown/declined rates, contradiction preservation — **not** score agreement.
- Terrain integration: `generate-terrain-render` consumes cie3 witnesses via a new registry seed version (bump `ACTIVE_REGISTRY_SEED_VERSION`); terrain domains become a derived lens; legacy 25-domain scores stay as a labeled historical view; `TerrainRenderContext` staleness helpers gain a cie3-session source.
- CELF export gains the compilation bundle, additive-only.

*Gate: no safety regression; equal-or-better decision-relevant coverage at lower or justified burden; rollback loses no testimony.*

### M7 — Upstream Question-Plan compiler *(new; contracts land in M1/M3, execution follows M5)*

- Define the **Question AST grammar** and type checker in the registry package (finite, versioned, hashed). M3's `QuestionDefinition`s are authored *as* AST instances from the start so no re-platforming is needed.
- Convert catalog records (as they are adopted) into the **Reference Sensor Library**: protocol-locked items (safety, validated instruments — exact wording, never regenerated), template-locked compositions (approved semantic templates with person-specific bindings: event names, windows, comparators), and regression fixtures.
- Build the plan compiler: `observation need (debt + purpose + policy) → Question AST → rendered interaction`, emitting an **immutable question-instance hash** stored on the raw answer.
- Deterministic render validator: proves the rendered wording preserves the AST's observable, window, vocabulary, missingness, negative contract, safety, consent, and output mapping. LLM wording proposals pass through it; semantics are never LLM-authored.
- **Shadow mode first**: generated compositions run beside the static deck without touching canonical state; novel (class-3) candidates stay in research mode and cannot create high-stakes negatives or safety dispositions without confirmation and review.

*Gate: every administered question round-trips to the same semantic AST; generated questions replay under pinned grammar/policy versions; class-3 output cannot reach canonical state ungoverned.*

### Deferred

- **Sample Context Capsule** — requires LIMS binding; keep the payload contract in the registry; when prototyped, use a *clearly synthetic* LIMS linkage.
- **Cross-modal Evidence Router** — CIE emits `EvidenceRequest` proposals only until after M6.
- **Full catalog load** — module-by-module through the Reference Sensor Library, after the exemplar loops prove the pipeline.
- **Personal Perception Calibration Profile** — research-governed; never a person-level reliability score.

---

## 6. Research-content corrections (for any reuse of the demo's landscape essay)

The landscape thesis is credible; these claims must be corrected or scoped before reuse, and tracked in the M0 claim ledger:

- **History-taking "76–88%"** — small outpatient/specialty cohorts (Hampton 66/80; Peterson 61/80; Roshan & Rao 77/98); not a universal "80% of all diagnoses" law.
- **"A PRO is a score against a population norm"** — false as a category statement; PROMIS uses T-scores, but PROs broadly are direct patient reports without clinician reinterpretation (FDA definition).
- **"PRO-PMs < 7%"** — a 2022 NQF snapshot, not current prevalence; **"29–42% portal response"** — one orthopaedic implementation, not healthcare broadly.
- **"Only 35% of PGHD reaches the EHR"** — 35% of 17 case studies at one system; ONC 2024: about two-thirds of hospitals enabled some PGHD submission (enablement ≠ use).
- **Ambient-scribe burnout 51.9% → 38.8%** — real figure, but a voluntary uncontrolled pre/post QI study (263 clinicians, six systems); association, not causation.
- **"Q Bio measures everything except testimony"** — false; Q Bio integrates histories, wearables, records. Defensible distinction: no publicly described typed missingness, bounded negatives, or contradiction semantics. Its FDA clearance covers Constellation software, not the whole Q Exam.
- **"Epic ~38%"** — stale and denominator-free; ONC 2024: 50.8% of nonfederal acute-care hospitals.
- **FHIR SDC** — initial publication 2015 (2016 ballot; current STU 4), and FHIR `DataAbsentReason` already types absent-data states — cite as prior art, not as absence of prior art.
- General posture: competitors are differentiated against by CIE's *positive architecture*, not by claiming they do "nothing" (symptom checkers can hand structured assessments to EHR workflows; Phreesia runs PRO workflows; some PGHD programs do integrate).

---

## 7. "Implementation-canonical" checklist

The system may not be called an implementation-canonical CIE compiler until **all** of the following hold:

- [ ] Identical inputs and pinned versions produce byte-equivalent outputs.
- [ ] Every answer is bound to an immutable question/screen instance (hash-addressed).
- [ ] Invalid negatives fail compilation (capability invariant enforced at compile and DB layers).
- [ ] The raw-answer ledger and route trace are exported; bundles are actually reversible.
- [ ] Contradictions and revisions have linked lifecycles (resolution closes its target).
- [ ] Completion uses canonical purpose-relative coverage states, never "any item answered = covered".
- [ ] No safety state implies clinical clearance; every safety item has an owned response operation.
- [ ] All generated questions round-trip to the same semantic AST under the versioned grammar.
- [ ] Safety, accessibility, and doctrine invariants have automated tests (unit + property + golden fixtures).
- [ ] Registries are single generated authorities; drift is CI-blocking.

---

## 8. Sequencing and risk

- **Biggest structural risk**: enum/contract drift across client, edge, SQL — the repo has been bitten (factory vocabulary), the demo repeats it (advertised-vs-implemented registries). M1 first, always.
- **Biggest architectural risk**: building M3 as another `switch(card.id)`. Concept-keyed output mappings and AST-authored questions from day one are what keep M7 from being a rewrite.
- **Biggest product risk**: burden — tune the exemplar deck against real completion data before catalog expansion.
- **Biggest safety constraint**: no safety question without an owned response operation; no resume path that reads as clearance.
- **What we never do**: re-score or relabel v2.2 history; convert missing to 50/"no"/"normal"; collapse contradictions; let an LLM author semantics or write canonical state; use positional gesture shortcuts; show cross-version score trends without a validated bridge.

The end state, restated through the corrected lens: **the questions are not the product. The finite laws, the sensing grammar, the referee, and the immutable match record are the product. Questions are the plays generated from the state of this person's match** — five entry products on one witness substrate, the swipe deck as one renderer inside CIE, 25 terrain domains as derived lenses, and every answer traceable from a hash-bound question instance to a hash-bound manifest commit, replayable byte for byte.
