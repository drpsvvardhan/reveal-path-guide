# CIE v3.2 — Deep-Dive Analysis and Patient Reveal Integration Plan

**Revision 3.** Retargeted from v3.1 to **CIE v3.2 Final** (`CIE_v3_2_BioTwin_Subjective_Sensing_and_Question_Compiler_Treatise_Final.docx`, version 3.2.0, status "Final pre-code implementation specification", source SHA-256 `2ddea88d…f314`). v3.2 supersedes v3.1 as the normative target: it absorbs the red-team verdict from Revision 2 wholesale — the upstream Question Compiler is now Part III of the treatise itself, the defect classes we identified in the prototype are now constitutional law, and the 359 records are formally demoted to a frozen Reference Sensor Library ("one compiled season, never the game").

Inputs analyzed across revisions: the v3.1 treatise (rc.1), the OKComputer prototype (`CIE_v3.0_codexos_2.zip` is byte-identical to its seven core files), the red-team verdict (all code findings verified against source), this repository, and now the v3.2 Final treatise.

---

## 1. What CIE v3.2 specifies

### The two governing jobs

v3.2 states **two inseparable jobs** where v3.1 had one:

> *"Compile a consequential human observation need into a lawful, immutable sensing interaction; then compile the resulting testimony into typed, temporal, provenance-aware evidence that can update — but never overrule by itself — the BioTwin."*

Architecture: `finite sensing grammar + governed Question Compiler + frozen reference sensor library`. The full loop: **BioTwin state → ObservationNeed → governed evidence action → QuestionPlan (when ask-human is authorized) → immutable QuestionInstance → bound AnswerEvent → universal WitnessEnvelope → autobiography graph → contradiction / Observation Debt → next best evidence.**

The document is five parts (was four): I Version Delta · II Doctrine · **III Finite Sensing Grammar (the Question Compiler — new)** · IV Reference Sensor Library · V Witness Compiler and Implementation Manual. Critically, v3.2 self-describes as **pre-code**: "it does not attest that a conformant registry, runtime, safety operation, or clinically deployed product already exists." The implemented system earns "implementation-canonical" only later, via the conformance gate (§7 below).

### Constitutional laws: 11 → 18

All v3.1 laws stand (provenance, trace, negative-capability, contradiction preservation, scar retention, absence ≠ normality, safety first, language ≠ truth, burden earned). v3.2 adds, verbatim in short form:

12. **No question without an ObservationNeed** and a valid QuestionPlan.
13. **No rendered interaction without an immutable QuestionInstance** (plan, wording, screens, schemas, locale, policy, route reason, hashes sealed before display).
14. **No semantic meaning from visual position** — swipe direction, option order, first/last position, label, color, side never define evidence meaning.
15. **No open grammar without locked sentinels** — high-consequence absence claims retain direct, protocol-reviewed observation opportunities.
16. **No generated novelty in production safety paths.**
17. **No epistemic closure from completion** — completion is bounded to purpose, time, coverage, declared limitations; *queue exhaustion is irrelevant*.
18. **No catalog may define the boundary of the human.**

Plus doctrinal honesty the verdict demanded, now in the treatise itself: testimony is "first-class, never epistemically supreme"; contradiction is "not automatically romanticized as biology"; prior art (FHIR DataAbsentReason, Provenance, SDC) is acknowledged and the novelty claim is the governed integration; the 359 count is "release metadata, not a completeness claim, product boundary, administered count, or definition of CIE."

### The Question Compiler (Part III — the new upstream half)

- **Founder's Football Theorem** — field/goals/ball/players/rules/state/play/referee/match-record mapped to acquisition purpose / session goals / ObservationNeed / evidence sources / constitutional laws + registries / witness state / QuestionInstance / deterministic validation / route-and-answer ledgers. "The grammar expands representational capacity; the acquisition contract constrains use."
- **Three layers of finite primitives**: (4.1) the constitutional sensing tuple — `source + observable + operation + time + context + response semantics + negative capability + governance + output contract` (eleven primitives); (4.2) autobiography operators — `baseline → perturbation → response → recovery/persistence → recurrence → function → intervention → residual scar`; (4.3) reusable characterization vectors — exposure (`agent, route, status, dose, frequency, timing, trajectory, response, recovery` — exactly the grammar Revision 2 specified), lived signal, intervention, event, movement/load, relationship.
- **`ObservationNeed`** — a versioned statement that a defined evidence state could materially improve a declared acquisition purpose; 8 kinds (`safety_obligation, minimum_biography, material_contradiction, decision_linked_uncertainty, event_resolution, specimen_context, longitudinal_change, enrichment`); the Question Compiler is invoked **only after `ask_human` is the authorized evidence action**.
- **`AcquisitionContract`** — purpose, respondent policy, required sentinels, required coverage, safety obligations, deferral/waiver policy, burden budget (hard maximum; overrun = "new contract or locked safety transition"), completion semantics ("Acquisition complete for {purpose} as of {time}, with {limitations}").
- **Question classes × deployment states** — `protocol_locked | template_locked | novel_candidate` × `draft | shadow | research_only | authorized_production | suspended | retired`. A novel candidate can never reach production via a model score or usage metric; promotion requires full review + datasheet + fixtures + a new immutable version, at "the smallest safe unit" — never a global flag.
- **21 canonical sensing operations** (`establish_status, identify, locate_onset/offset, quantify_amount/frequency/duration, characterize_intensity/variability/trajectory/response/recovery/recurrence/function, compare_personal_baseline, locate_context, identify_preceding_event, capture_self_attribution, confirm, reconcile, revise`).
- **`QuestionPlan` AST** — "the semantic authority for one acquisition operation. The rendered string is a projection. A client must never reconstruct semantics by parsing the string." One semantic target, ordinarily one cognitive act.
- **Locked sentinel kernel** — the non-negotiable minimum observation opportunities: respondent identity/consent, immediate safety, **nicotine lifetime + current status incl. product and route**, alcohol, other substances/misuse, active interventions/allergies/adverse responses, major baseline change, reproductive context (when applicable and consented), social/environmental safety, movement status, LIMS anchor. "'Anything else you use?' cannot establish 'never smoked.'" The router may never suppress an applicable sentinel because other answers look favorable or a model predicts the answer. **This constitutionally closes the Peter/smoking hole.**
- **Fail-closed 10-stage composition pipeline** ending in a sealed, hash-bound, respondent-bound **`QuestionInstance`** — the only interaction object a production client may render — and a **21-rule deterministic semantic validator** (QC-OBS/SRC/ISS/PUR/POL/CON/ONE/TIM/CTX/RSP/MIS/NEG/SAF/OUT/BUR/LOC/GST/DAT/DEP/HSH/REN-001), pure functions with no wall clock, network, model call, or mutable global state.
- **Semantic interaction binding** — `SEMANTIC_RESPONSE_ACTIONS` (`select_option, submit_value, submit_missingness, confirm, edit, add_item, remove_item, pause`); every gesture/button/keyboard/voice control binds to a semantic action ID; the left-swipe class of bug becomes structurally impossible.
- **`CIEAcceptedAnswerEvent`** — an answer binds to the exact instance, plan hash, screen, schema hash, semantic action, respondent binding, expected state version + hash, and idempotency key; eight enumerated server rejections; every submission is retained as an operational attempt even when rejected.
- **Canonical serialization and replay** — profile `JCS-RFC8785+CIE-ARRAY-ORDER@1`, injected logical clock and ID seed, semantic vs operational hashes, `canonical_bytes(replay(pinned_inputs)) == canonical_bytes(original_semantic_bundle)`.
- **Audit export** — 18 ledger components including rejected submission bytes under governed access; "a summary-only JSON file is not a reversible export."
- **LLM boundary** — may draft needs/plans/wording/extractions/projection text for deterministic review; may never define missingness or negative meaning, set safety state, change tier precedence, infer consent, issue a production novel question, or promote its own candidate. Open-world escape hatch: `UnmappedNarrativePayload` (verbatim text, person-confirmed, `prohibitedFromCausalPromotion: true`).
- **~25 pinned registries** in the release manifest (grammar, question-class, sensing-operation, cognitive-act, temporal-frame, prompt-template, sentinel, transform, product, missingness, coverage, interaction-mode, response-primitive, routing DSL, predicate-path, priority, three safety registries, witness substrate/kind/source, `CIE3-REFERENCE-SENSOR-LIBRARY@3.2.0`).

### Other v3.2 deltas that change implementation work

- **Person-facing missingness is a generated subset of five** (`unknown, not_recalled, declined, not_applicable, temporarily_unable`); `not_asked` and `source_unavailable` are acquisition-only and never render as response actions.
- **Safety self-clear is banned by name**: "a red-flag path contains no generic 'I am safe — continue' self-clear"; resumption requires the approved state-machine transition or authorized human disposition.
- **Completion evaluator is fail-closed and does not receive queue length as an input**; terminal states `completed | completed_with_limitations` relative to the AcquisitionContract.
- **Predicate DSL semantics hardened**: three-state evaluation (true/false/error — "never coerced to false"), versioned `CIE3-PREDICATE-PATH@1.0.0` path IDs, bounded `any_event`, AST depth ≤ 8.
- **Compiler invariants 25 → 36**; canonical scenario tests 15 → 25 (new: protocol tamper via content hash, candidate isolation, RTL gesture semantics, stale-instance race, negative-by-omission, generic-exposure insufficiency vs the nicotine sentinel, byte replay, stable contradiction root IDs with append-only revisions, restricted-context leak, reversible audit export).
- **Contradictions get a stable root ID + append-only revision events** (fixes the prototype's open/resolved coexistence class properly).
- **Compiler synthesis provenance**: derived content is `derived_projection` citing self-report witnesses, "never source:self" — the prototype's invented-provenance defect, now a release blocker.
- **Storage**: `cie_sessions` becomes an operational head over `cie_session_state_events`; ~15 append-only ledgers; `question_class`/`deployment_state` checks; new `ExposureStatusPayload` witness kind + `cie_exposure_statuses` child table.
- **API** moves to `/v3.2/…`; session creation pins grammar/registry/library versions; answer submission carries need/plan/instance IDs + hashes + respondent binding.
- **Migration phases 0–9 → 0–11**, resequenced so the upstream compiler lands *early*: Phase 2 = ObservationNeed/AcquisitionContract/QuestionPlan AST; Phase 3 = locked sentinels + deterministic renderer + immutable instances; Phase 4 = bound answer API + Witness Compiler; Phase 5 = canonical replay + audit export; Phase 6 = legacy wrapper; Phase 7 = exemplar loops (now 8, incl. movement and reconciliation); Phase 8 = client (incl. the mandatory Autobiography Review surface); Phase 9 = Reference Sensor Library migration + **triple shadow** (v2.2 assignment, v3.1 selection, v3.2 composition); Phase 10 = manifest cutover; Phase 11 = capsule + cross-modal.
- **Autobiography Review and Reconciliation** is "a mandatory lifecycle surface shared by all five products, not a sixth acquisition product" — eight strata from "what they reported" to "who may see each evidence class"; a clinician annotates or adjudicates, never overwrites testimony.
- **Research denominator rule**: exports must preserve whether a sensor was eligible, considered, displayed, answered, explicitly missing, deferred, or never observed.

---

## 2. The prototype against v3.2

**Status update (build `cfcc0ca`, verified by execution):** a rebuilt demonstrator (`OKComputer_CIE_vs_Traditional_Data_Capture1.zip`) added a real grammar layer — `src/cie/grammar.ts` (finite registries for 21 verbs, 6 frames, 17 response primitives, 5 source classes; a 21-rule deterministic `validateProgram` referee; `instantiate()` that fails closed before sealing; template-locked composers plus a free composer over all verbs) — and fixed all seven original P0 defects: gestures resolve through declared per-option `swipe` semantics with no positional fallback, answers bind to `cardId + expectedIdx + idempotencyKey` with stale/duplicate rejection logged, the safety resume carries no clearance language (`user_acknowledged_no_clearance_continued`), evidence ids are content hashes over canonical JSON, the export bundle includes raw answers and a route log with a wall-clock-excluded semantic replay hash, and contradiction resolutions link and close their open object. Its 228-assertion invariant suite passes (re-run independently). Remaining demo-scale seams: referee rule 15 conflates "source cannot observe" with "source not connected" (all non-self sources auto-fail), rule 10's one-cognitive-act check is a string heuristic, the seal's `expectedStateVersion` is empty at seal time (bound later by the router), and — as its author notes — the router still dispatches from templates: the free composer "can speak" all 21 verbs but the router does not yet generate those needs. That last seam is exactly M5's ObservationNeed-first router. The build is now a legitimate demo-scale reference for M2's composer/validator; the storage, governance, and ABAC layers remain out of its scope.

The Revision-2 assessment otherwise stands: retain the shell, never present it as the compiler. **Every originally confirmed defect maps to a named v3.2 law or release blocker** — the defect ledger is a conformance checklist rather than a judgment call:

| Verified prototype defect | v3.2 authority that now governs it |
|---|---|
| Left swipe = `opts[length-1]` corrupts LIF-001 | Law 14 (no semantic meaning from visual position); QC-GST-001; semantic interaction binding; scenario test "semantic gesture (RTL)" |
| Answer actions unbound to question | Law 13 + `CIEAcceptedAnswerEvent` exact binding; release blocker "stale-interaction binding"; stale-instance-race test |
| Safety self-clearance ("I am safe — continue") | Named ban in §16; QC-SAF-001; "no safety-positive path contains a generic self-clear action" |
| Negatives without capability (incl. empty SAF-001 value) | 7-condition negative compilation; `assertNegativeClaimInvariant`; "negative by omission" scenario test |
| `Math.random()` / wall clock | `JCS-RFC8785+CIE-ARRAY-ORDER@1`, injected clock + ID seed, byte-replay conformance equation |
| Export not reversible, no route log | 18-component audit export; "a summary-only JSON file is not a reversible export" |
| Contradiction open/resolved coexistence | Stable contradiction root ID + append-only revision events (invariant 21) |
| `switch(card.id)` scripted mapper | QuestionPlan AST + output mappings; "the rendered string is a projection" |
| Ad-hoc modes/missingness/coverage enums | ~25 pinned registries; person-facing missingness subset of five |
| "Covered" from any answered item; completion = queue end | Fail-closed completion evaluator with no queue-length input; Law 17 |
| Synthesis with `source: 'self'`, blank timestamps | "derived_projection … never source:self" release blocker; origin/producer separation invariant |
| Substance branches instead of a grammar | Layer-4.3 exposure vector + locked nicotine/alcohol/substance sentinels |

---

## 3. Where Patient Reveal stands

Unchanged from Revision 2 in substance; restated briefly. **Aligned and reusable:** the swipe deck with latency capture and anti-priming reveal (`IntakeQuestionCard.tsx`), T1/T2 reconsideration events, the P1a witness layer (`witness_objects`, registry gating, ancestry integrity, contextLoader + static-scan guards), the factory-import "alternate source → same tables → same witness projection" pattern with scoring-authority tests, versioned assessments with staleness-driven terrain regen, deterministic release compiling with golden fixtures (Peter v18), RAE admission machinery.

**Violations that are the work:** neutral-50 (`NEUTRAL_POLARITY`, factory default), no typed missingness, no observation capability, score-centric 25-domain ontology with thin/absent spines, `cie_responses` UPDATEd in place, threshold routing with no trace, the triple-source question bank (`cieSeedData.ts` / `cieScoring.ts` / registry SQL), no testimony contradiction objects, no Observation Debt. Note that v3.2's session-state-event ledger, semantic binding, and completion evaluator additionally imply: the new engine's session state must be event-sourced (the `cie_session_state_events` pattern), and no UI meaning may live only in component code.

---

## 4. The plan (Revision 3 — aligned to v3.2 Phases 0–11)

The v3.2 resequencing changes Revision 2's milestone order in one important way: **the upstream contracts (ObservationNeed, AcquisitionContract, QuestionPlan AST) come immediately after the registry, before the witness compiler and before any UI** — because the answer-binding, sentinel, and completion contracts all hang off them. What was "M7, later" is now the spine of the build.

### M0 — Freeze Generation I; honesty artifacts *(maps to Phase 0)*

- Hash + tag the v2.2 bank/score maps/gates as `CIE_2.2.0`.
- Peter Legacy Blind-Spot fixture (`smoking.missingness = not_asked`, `sleep_history.coverage = partial`; never invented history) in `tests/cie-factory-import.test.ts`; the synthetic nicotine–sleep biography stays a separately named fixture.
- Spine/sentinel-presence regression test against a constitutional manifest.
- Claim ledger for research/market content (schema per Revision 2 §6, corrections seeded).

### M1 — Canonical registries + universal Witness ABI *(Phase 1)*

- `_shared/cie3/registry/`: one generated authority covering the v3.2 registry set — missingness (7, with the **person-facing subset of 5** generated, not hand-picked), coverage, the 12 interaction modes, 17 response primitives, routing DSL + **predicate-path registry with three-state evaluation semantics**, priority tiers, the three safety registries (evaluation / risk disposition / protocol action — no "clear", no generic self-clear transition), question classes, deployment states, the 21 sensing operations, semantic response actions, witness substrates/kinds/sources. Codegen to TS + Postgres CHECKs + UI registries; drift-check CI.
- `WitnessEnvelopeCore<T>` with the present⇔payload discriminated union and `assertNegativeClaimInvariant` (enforced at compile and DB layers).
- Canonical serialization module: `JCS-RFC8785+CIE-ARRAY-ORDER@1`, injected clock/ID providers, semantic vs operational hashing.

*Gate: registry conformance fixtures pass across TS/SQL/UI; zero drift; hash-stable canonicalization round-trips.*

### M2 — Upstream contracts: ObservationNeed, AcquisitionContract, QuestionPlan AST *(Phase 2)*

- Type and persist `ObservationNeed` (8 kinds, origin union, target with `prohibitedInvisibleClaims`, temporal/context need, burden ceiling), `AcquisitionContract` (required sentinels, coverage, safety obligations, burden budget with hard maximum and overrun policy, completion template), `RespondentBinding`, and the `QuestionPlan` AST (temporal/context/negative/missingness plans, output mappings, route effects, `planContentHash`).
- Implement the **semantic validator** as pure functions with the 21 QC-* rule codes and `PlanValidationRecord` / `InstanceIssuanceValidationRecord` persistence.
- Author the **locked sentinel kernel** as protocol-locked plans first — nicotine (lifetime + current, product + route), alcohol, substances, interventions, safety preflight, respondent/consent — since the sentinels are what M5's completion evaluator and M6's exemplar loops depend on.

*Gate: golden plans validate deterministically; a novel_candidate cannot pass QC-DEP-001 into production; the nicotine sentinel cannot be satisfied by a generic exposure prompt (scenario test 23).*

### M3 — Immutable issuance + bound acquisition + Witness Compiler *(Phases 3–4)*

- `QuestionInstance` issuance service: fail-closed composition pipeline, respondent binding, semantic fingerprint match for protocol/template renders, append-only issuance with supersession events.
- **Semantic interaction binding**: `InteractionBinding` objects issued with each screen; gestures/buttons/keyboard/voice resolve to semantic action IDs server-side.
- Answer path: submission-attempt ledger (rejected bytes retained under governed access) → eight rejection checks → `CIEAcceptedAnswerEvent` (idempotency key, If-Match state hash, payload hash) → append-only `cie3_raw_answers` with `cie3_session_state_events` event-sourcing and a `cie3_sessions` materialized head.
- Witness Compiler ported from the demonstrator **through the defect gate** (all Revision-2 fixes; concept-keyed output mappings from the plan, never `switch(card.id)`; enforced negative conditions; quality with reasons; `derived_projection` provenance for synthesis; contradiction root IDs + append-only revisions).
- Bridge to the existing witness layer: cie3 witnesses project into registry-gated `witness_objects` (new seed version; bump `ACTIVE_REGISTRY_SEED_VERSION`) so `contextLoader`/terrain consume them without violating P1a ship-gates.

*Gate: end-to-end — need → plan → instance → answer → witness — replayable byte-equivalently; every defect-ledger row has a passing regression test.*

### M4 — Canonical replay + audit export *(Phase 5)*

- `cie3-replay` (pinned registry manifest, logical clock, ID namespace) and the audit-export ledger set (contracts, needs, plans + validation records, instances + bindings, attempts + accepted answers, route traces, compilation runs, witnesses, contradictions, debt, safety, policy, projections, manifest commits).
- Conformance equation in CI: `canonical_bytes(replay(pinned_inputs)) == canonical_bytes(original_semantic_bundle)`.

*Gate: export/import reconstructs the raw ledger, plans, route trace, revisions, witnesses, debts, contradictions (scenario tests 7, 11, 25).*

### M5 — Legacy wrapper + router + Observation Debt + completion *(Phases 6 + routing)*

- Legacy 2.2 wrapper exactly as Revision 2 M2 (bounded A1Q3 claim; `legacy_factory_missing_score_default`; `legacy_projection` scores; zero invented facts).
- Router: `ObservationNeed`-first (`ask_human` carries `observationNeedId` + `acquisitionContractId`, not a question ID), lexicographic tiers, **ordinal** within-tier policy (no manufactured probabilities), full `RouteDecision` traces with rejected candidates and categorical reasons.
- Observation Debt objects with waiver + reactivation guard → surfaced through `patient_question_queue`.
- **Fail-closed completion evaluator**: contract-relative, sentinel- and coverage-state-driven, queue length not an input; `completed_with_limitations` with the canonical statement template.
- Testimony contradiction detection (deterministic overlap rules; root ID + append-only revisions), extended to testimony-vs-lab/wearable pairs the witness layer already holds.

*Gate: safety lexicographically first; waived debt cannot silently reactivate; queue exhaustion cannot complete a session (scenario test 19).*

### M6 — Exemplar loops + mode-aware client *(Phases 7–8)*

- **Eight exemplar loops** as template-locked plans over the characterization vectors: nicotine (sentinel + episode), alcohol, sleep trajectory, intervention trial, life event, goal/readiness/capacity, **movement/physical load**, and the **Autobiography Review and Reconciliation surface** (mandatory lifecycle surface, eight strata, clinician annotates never overwrites).
- Client: evolve `IntakeQuestionCard` into the mode-aware deck rendering **only issued QuestionInstances** — never local card definitions; gestures via `InteractionBinding` only; typed-missingness footer limited to the person-facing five; witness receipt (the 8 receipt elements incl. "what it cannot establish" and visibility policy); safety takeover with protocol-locked transitions only; long-press step-back emits supersession, not UPDATEs. Behind `useCie3Flag`.

*Gate: reordered/localized/RTL options cannot change submitted semantics; every mode accessible without gestures; one-cognitive-act check on ordinary plans.*

### M7 — Reference Sensor Library migration + triple shadow *(Phase 9)*

- Classify inherited records module-by-module into `protocol_locked | template_locked | golden_exemplar | fallback_wording | retired_historical`; imported reference IDs are never reused by new compositions; snapshot CI asserts the 359-count as **release-integrity metadata only**.
- **Triple shadow**: v2.2 assignment vs v3.1-style selection vs v3.2 composition, compared on spine/sentinel coverage, burden, one-system-only signals, unknown/declined rates, contradiction preservation — never score agreement. Model-assisted novel candidates run in shadow/research only.

*Gate: no safety regression; equal-or-better decision-relevant coverage at lower or justified burden; no novel candidate has issued in production.*

### M8 — Manifest cutover; then capsule + cross-modal *(Phases 10–11)*

- PatientManifest commits (`schemaVersion: "3.2"`, parent-hash rebase semantics); terrain domains become derived lenses; legacy scores stay a labeled historical view; CELF export gains the compilation bundle additively; research exports preserve the eligibility denominator.
- Then: Sample Context Capsule (protocol-locked LIMS anchor; capsule **rejected** without an authoritative `collection_event_id`) and cross-modal Evidence Router actions (proposals only) — still last, unchanged from Revision 2.

*Gate: rollback loses no testimony; no cross-version score trend without a validated bridge.*

---

## 5. Research-content corrections

Unchanged from Revision 2 (Hampton/Peterson scoping, PRO category error, PGHD denominator, scribe causality, Q Bio, Epic share, SDC dating, claim-ledger schema) — with one update: **v3.2 itself now carries the prior-art honesty** (§1.3/§15 name FHIR DataAbsentReason and Provenance; the novelty claim is scoped integration), so the demonstrator's Research tab must be brought into line with the treatise's own posture, not just with our ledger.

## 6. "Implementation-canonical" gate

v3.2 §23 now defines this itself; our checklist merges into it. The implementation becomes canonical only when it: generates its contracts from **one machine-readable registry**; passes the **25-scenario conformance suite** and 36 compiler invariants; binds a complete release manifest (registry/protocol/template/renderer/localization/policy/compiler/validator versions + content hashes); demonstrates byte-equivalent replay and reversible audit export; enforces exact instance/answer binding, semantic gesture binding, fail-closed negatives, person-facing missingness subset, protocol-locked safety with no self-clear, purpose-bound completion; and survives clinical, safety, security, accessibility, and governance review. Until then, everything ships under pre-code / demonstrator / shadow labels.

## 7. Sequencing and risk

- **Biggest change from Revision 2**: upstream contracts move from "M7, later" to **M2, immediately after the registry** — answer binding, sentinels, and completion all depend on them; building the witness compiler first would bake in a second re-platforming.
- **Biggest structural risk** remains enum/contract drift — now with ~25 registries to pin, the generated-authority + release-manifest discipline is non-negotiable.
- **Biggest product risk** remains burden — hard budget ceilings are now contractual (overrun requires a new AcquisitionContract), so tune the exemplar deck early against real completion data.
- **Safety**: protocol-locked only, no generated wording, no self-clear, no safety item without an owned response operation.
- **What we never do** (now all treatise law): re-score or relabel v2.2 history; convert missing to 50/"no"/"normal"; person-facing `not_asked`; collapse or mutate contradictions; positional gesture semantics; completion from queue exhaustion; LLM-authored semantics or state; sentinel suppression by favorable answers or model prediction; cross-version score trends without a validated bridge.

Closing, in the treatise's own words: *"CIE is not a long questionnaire, a health score, or a generative chatbot. It is a governed human-sensing grammar and biological-autobiography compiler. Its primitives are finite, its rules are strict, its sessions are bounded, and its expressive capacity remains open because human lives remain open."*
