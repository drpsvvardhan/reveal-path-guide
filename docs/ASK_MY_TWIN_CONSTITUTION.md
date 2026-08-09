# Ask My Twin — Build Constitution

*This document governs the Ask My Twin build (Release 0 and beyond). It is
checked in before implementation, per the product constitution, and every
commit in this workstream is expected to be consistent with it. When code and
this document disagree, the discrepancy is a bug in one of them and must be
resolved explicitly — never silently.*

---

## The five objects

```
Twin      = remembers   (governed biological state — slow plane)
Runtime   = governs     (what may cross to a person, at what confidence)
Conversation = interrogates  (the control surface: Ask My Twin)
Agents    = watch       (labor over time; proposals, never truth)
Receipts  = prove       (epistemic memory: what was known, used, and why)
```

Renderers (charts, timelines, omics graphs, 3D) are how an answer happens to
be displayed. They are not a sixth object.

---

## The ten rules

1. **The Twin owns biological state.**
2. **The runtime owns authorization.**
3. **Agents own labor, never truth.**
4. **Live data may inform answers without silently becoming Twin state.**
5. **Every patient-specific assertion must resolve to governed evidence.**
6. **Every admitted answer must be receipted and replayable.**
7. **Contradictions persist until discriminating evidence resolves them.**
8. **Retractions persist as scar memory and cannot silently re-enter.**
9. **Patient priorities may shape attention but never biological truth.**
10. **The simplest possible interface sits on top of the deepest possible
    substrate.**

The operating invariant, applied to LLM answers, agent outputs, sensor
interpretations, proposed Twin updates, external knowledge, active
phenotyping, and visit preparation alike:

> **Generation is proposal. Validation is authorization.**

---

## Receipt doctrine

- **Available evidence is not used evidence.** The receipt records both, and
  never conflates them. Availability is bound by the context packet hash and
  counts on the receipt row; per-reference rows are written for evidence the
  admitted answer actually cited.
- **Fabricated provenance never crosses.** A grounding marker citing an ID
  that was not in the authorized context fails validation.
- **Missing markers are measured, not blocked, during beta.** Marker coverage
  is recorded per answer; the strictness threshold is decided from measured
  data at the benchmark, not guessed in advance.
- **Two freshness clocks, never one.** `twin_state_as_of` (latest admitted
  canonical Twin state) and `latest_witness_as_of` (newest authorized
  evidence) are stored separately. Display may compress them; storage may not.
- **Hashes bind to what the model actually saw.** Canonical serialization
  (stable key order) before hashing. No hashing of unstable object graphs.

---

## Release 0 scope

**Build:** Answer Receipt v1 → evidence-use markers → packet hashing →
freshness clocks → context-budget guard → deterministic Biological
Intelligence Brief → Ask My Twin home → doctor-question queue linkage →
Intent Passport → query telemetry. Then beta (20–30 existing Twin
recipients). Then **stop and observe**.

**Explicitly prohibited during Release 0:**

- no 3D / Tripo / BioDigital work
- no sensor infrastructure
- no microphone / voice
- no clinician chat
- no Practice Better / PracticeMD integration
- no multi-agent framework
- no ontology or Twin schema rewrite
- no LLM database access
- no autonomous treatment agent
- no model/provider switch without benchmark evidence

**Preserved absolutely:** the deterministic BioTwin adapter, the P1a witness
boundary, identity binding, the server-buffered admission gate, dose and
authority policies, release controls, the patient-question queue, RLS, and
all existing negative tests. The buffered gate is not weakened for streaming,
agents, tools, or prettier UX — invalid output never crosses.

---

## Later releases (seams only, no early builds)

- **Release 1 — Live Twin:** sensor schema (CGM + sleep first), deterministic
  window services, bounded tool API with governed return envelopes,
  TwinQueryOrchestrator, Response IR, "What changed?" diff service.
- **Release 1.5 — Agentic Twin:** biological event bus; agent
  task/run/proposal ledger; Change, EFE, Contradiction, Scar, Measurement,
  Interview, Visit, and Patient-Priority stewards. Every agent output is an
  `AgentProposal` with `mayWriteCanonicalTwin: false` — constitutionally.
- **Release 2 — Clinician network:** real clinician identities and
  `care_relationships` (patient-consented, scoped, expiring, audited) —
  never an extension of `admin_view_as`.
- **Release 3 — Rich representation:** voice, photo intake, broader sensors,
  omics visualization, 3D BioSpatial renderer.

---

## Quality doctrine (ratified after the first live smoke, Aug 9)

The product equation:

```
BioIntelligence = frontier-model intelligence
                + personal biological state
                + longitudinal memory
                + epistemic discipline
```

**The last term must be additive.** The moment epistemic discipline
subtracts fluency, synthesis, curiosity, or usefulness, it has been
implemented incorrectly. Governance appears as precision, never as tone.

> A patient should almost never be able to tell that a governance runtime
> exists. They should only notice that their Twin is unusually hard to fool.

Rules, all measurable from receipts:

1. **Fluency parity with a raw frontier model is a launch gate**, not a
   maturity milestone. If pasting the Twin JSON into a consumer LLM is a
   better experience than Ask My Twin, the product has failed regardless
   of the receipt system.
2. **A fallback template on a benign informational question is a defect,
   not a safety success.** Benign fallback rate targets ~0%; every
   fallback is triaged like an incident (which gate, what matched, what
   the model originally wrote — all on the receipt).
3. **Police assertions, not topics.** The forbidden act is asserting a
   retired or prohibited proposition as currently true. The Twin must be
   able to discuss, negate, explain, compare, and historicize its scars
   naturally — that wording is required, never a violation.
4. **Regeneration before replacement; span repair before regeneration**
   (goal state): repair the offending claim span using the report's own
   replacement wording rather than discarding twelve good paragraphs
   because sentence eight overreached.
5. **A passing gate does not prove an intelligent answer.** Blandness is
   the failure mode no validator catches. The anti-blandness metric is
   grounding density — USED evidence refs and marker coverage per answer:
   boilerplate cites nothing.

### The BioIntelligence Quality Gate

Every significant runtime release runs the same Twin and question set,
blind-scored, across arms:

- **A.** raw frontier model + full Twin JSON
- **B.** frontier model + our bounded packet (isolates compression loss)
- **C.** our model + packet, gates disabled (isolates prompt/gate cost)
- **D.** full Vizzhy runtime

Score: specificity · synthesis · usefulness · fluency · epistemic
correctness. Count separately: invented values, resurrected scars, false
diagnoses, unsupported causal attribution, prohibited medication/dose
decisions, cross-person contamination.

Release condition: `usefulness(D) >= usefulness(A)` subject to
`critical_errors(D) << critical_errors(A)`. The arm deltas assign any
deficit to its layer: A−B = packet compression, B/C differences = model
capability and prompt defensiveness, C−D = gate suppression.

Known quantified risks feeding this gate (Aug 9 baseline): the assembled
prompt carries on the order of 170+ prohibition-shaped imperatives plus up
to 40 verbatim prohibited statements (self-censorship pressure that no
fallback counter detects), and PACKET_CAPS discards silently beyond
12/bucket, 6 drivers, 8 actions, 8 contradictions, 4 bounds/statement
(compression loss no model can recover).

---

## CI rule for this workstream

New code typechecks; new tests pass; the existing relevant test suite passes;
no new lint errors in touched files. Known historical lint debt in untouched
areas is not a gate. No unrelated repository cleanup inside this workstream.
