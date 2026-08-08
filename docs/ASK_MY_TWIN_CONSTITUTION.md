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

## CI rule for this workstream

New code typechecks; new tests pass; the existing relevant test suite passes;
no new lint errors in touched files. Known historical lint debt in untouched
areas is not a gate. No unrelated repository cleanup inside this workstream.
