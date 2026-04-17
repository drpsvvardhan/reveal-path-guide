# Reveal Path — Architecture

*This is a living document. It's versioned alongside the code. When a new subsystem goes in or a trust boundary moves, it gets a section here. The goal is not comprehensive specification — it's a map that lets someone new to the project reason about the system without reading every line of code.*

---

## How to read this document

The architecture is organized around three concerns, in order of importance:

1. **The workflow grammar** — what user-facing workflows the system supports, and how they compose
2. **The data model** — what gets stored, how it's organized, and what invariants the database holds
3. **The trust boundaries** — who is allowed to read or write what, and where those rules are enforced

Everything else (framework choices, directory structure, build tooling) is implementation detail that can change without affecting the system's identity.

---

## Part 1 — The workflow grammar

Reveal Path supports four primary workflows. Each is a composition of smaller steps; each produces an artifact that feeds another workflow.

### Workflow A — Patient ingestion

```
[patient uploads PDF]
    → [process-lab-pdf edge function]
        → [Gemini 2.5 Flash, ontology-constrained extraction]
            → [per-observation: canonical_concept_id, canonical_value, confidence]
                → [confidence >= 0.80] → patient_lab_observations
                → [confidence < 0.80]  → observation_review_queue
                → [concept = unknown]  → observation_review_queue
                                         + ontology_concept_proposals
```

The ingestion workflow is the highest-volume path in the system. Every PDF a patient uploads flows through it. The LLM at the extraction step is doing three distinct jobs simultaneously — OCR recovery, canonicalization against the ontology, and unit conversion. All three are driven by a single prompt that includes the ontology as a constrained vocabulary.

Confidence thresholding at 0.80 is the primary quality gate. Observations above threshold flow straight into the patient record. Observations below threshold accumulate in the review queue for human triage. The threshold is tunable and lives in `supabase/functions/_shared/ontology.ts`.

### Workflow B — Human review and ontology growth

```
[admin loads /admin/review-queue]
    → [review queue rows with review_status = pending]
        → [admin action: accept | correct | reject]
            → [atomic Postgres function: resolve_observation_review_queue_item]
                → updates observation_review_queue.review_status
                → patches patient_lab_observations.canonical_concept_id
                    (sets classification_method = 'human_reviewed', confidence = 1.0)
                → upserts ontology_concept_proposals if new concept
                → writes review_queue_audit_log entry
```

The review workflow is the system's learning loop. It is atomic — either all four writes succeed or none do — so the review state is never internally inconsistent. The atomicity is enforced by a Postgres function (`resolve_observation_review_queue_item`) rather than by a client-side transaction, because the client cannot be trusted to complete every step.

Accepted proposals that introduce new concepts don't automatically enter the ontology. They accumulate in `ontology_concept_proposals` until the next ontology version is minted, which is a deliberate human-in-the-loop step (typically weekly or as a batch decision). This prevents a single reviewer's mistake from polluting the vocabulary.

### Workflow C — Clinical handoff

```
[patient generates share link]
    → [terrain_renders row with active terrain_share_token]
        → [clinician navigates to share URL]
            → [share token resolves to user_id via profiles]
                → [fetch terrain_renders, axis breakdown, question queue, perception gaps]
                    → [clinician share view — compressed handoff object]
```

The handoff workflow is deliberately read-only from the clinician's side. Clinicians don't have accounts in Reveal Path; they authenticate through the token itself. This is a pragmatic choice for the current pilot phase — the eventual production version will require proper clinician accounts with role-based access.

The share token is rotated on patient request and carries an expiration. No token grants access to data older than the terrain render's `generated_at` timestamp, which gives the patient control over what the clinician sees.

### Workflow D — CELF bundle export

```
[admin or patient clicks "Download bundle"]
    → [export-celf-bundle edge function]
        → [subject identity gate — requires profile + demographics]
            → [load observations with canonical_concept_id != 'unknown']
                → [load CIE assessment, source documents, identity audit]
                    → [compute feature_state (latest per concept) and timelines]
                        → [assemble bundle, sha256, write celf_exports audit row]
                            → [return bundle, frontend triggers download]
```

The bundle is the artifact that moves data out of Reveal Path and into the downstream BioTwin generator. It has a stable contract (currently `celf-v0.9` bundle version, `celf-ontology-v1.0` ontology version). The bundle format is deliberately *additive* — every version adds fields, none ever remove or rename. Downstream consumers can ignore fields they don't understand.

Bundles produced in admin view-as mode are stamped with both `caller_user_id` (the admin) and `target_user_id` (the patient being viewed), plus `is_view_as_export: true`. This is forensic: every bundle carries complete provenance of who exported it and on whose behalf.

---

## Part 2 — The data model

The data model has three layers: identity, content, and audit.

### Identity layer

**`profiles`** holds patient demographics and share tokens. Each profile is keyed by the Supabase auth user ID. The patient's name, date of birth, and sex live here — these are the fields the export function's subject identity gate checks before producing a bundle.

**`user_roles`** holds role assignments for privileged users (admin role primarily). A user can be both a patient and an admin simultaneously; role checks happen at the server, never in the client.

**`admin_view_as_sessions`** (new in the hardening pass) holds server-issued, time-bounded, audited impersonation tokens. When an admin wants to view another patient's data, they mint a session through the `admin-view-as-mint` edge function with a reason captured in free text. The session expires after a fixed TTL (currently 4 hours). Every session mint, every use, and every expiry is logged.

### Content layer

**`patient_lab_uploads`** holds the raw uploaded files, extraction metadata, identity verification outcomes, and content hashes for deduplication. The `document_type` field routes observations to the correct specimen type at ingest time via a database trigger.

**`patient_lab_observations`** is the heart of the system. Each row is a single biomarker observation with:
- Source-verbatim fields: `original_name`, `value`, `unit`, `reference_range_text`
- LLM-canonicalized fields: `canonical_concept_id`, `canonical_unit`, `canonical_value`, `classification_confidence`, `biomarker_class`
- Provenance fields: `upload_id`, `collection_date`, `page_number`, `classification_method`

The source-verbatim fields are immutable after ingest — they represent what the PDF actually said. The canonicalized fields are the system's interpretation, and can be updated by the review queue workflow. The split between verbatim and canonical is intentional: provenance is preserved forever, interpretation is allowed to evolve.

**`observation_review_queue`** holds observations the LLM classified with low confidence or as unknown. Each row references its parent observation, captures the LLM's proposal, and tracks the reviewer's decision.

**`ontology_concept_proposals`** accumulates reviewer-accepted concepts that don't yet exist in the ontology. A batch process (or eventually an automated policy) promotes accepted proposals into the next ontology version.

**`cie_assessments`, `cie_domain_scores`, `cie_gate_scores`** hold the Clinical Intake Evaluation results. The CIE is a structured self-report that produces domain scores (0–100 across ~25 domains) and gate statuses (pass/conditional/fail on gating questions like "are you actively suicidal"). CIE data enters the CELF bundle as a distinct observation class with `source_class: "cie"`.

**`terrain_renders`** holds computed terrain states — the output of the BioTwin generator, cached per patient with a share token. A terrain render contains axis breakdowns, perception gaps, contradiction flags, and suggested clinical questions.

### Audit layer

**`celf_exports`** logs every bundle ever produced, with SHA-256 content hash, bundle version, map/ontology version, subject and observation counts, and status lifecycle (pending → ready → downloaded → shared_with_clinician → pushed_to_biotwin_generator). Combined with the `caller_user_id` / `target_user_id` / `is_view_as_export` meta fields in the bundle itself, this gives complete traceability of who generated what bundle on whose behalf.

**`upload_rejection_audit`** logs uploads that failed identity verification (e.g., a PDF with a different patient's name than the account holder's) or content deduplication. This is the SWATHI-class protection: if someone uploads the wrong person's PDF, it's rejected and logged, never ingested.

**`admin_view_as_audit`** (new) logs every admin view-as action — session mint, each data access, session end, reason capture. This is the HIPAA-adjacent audit trail.

**`review_queue_audit_log`** (new) captures every reviewer decision on the observation review queue. This lets the system answer "who changed this observation's canonical, when, and from what to what."

---

## Part 3 — Trust boundaries

The system has five meaningful trust boundaries. Each is enforced at a specific layer.

### Boundary 1 — Patient data isolation

**Rule:** A patient can only read and write their own data.

**Enforcement:** Postgres row-level security (RLS) policies on every table that holds patient data. Every policy joins to `auth.uid()` and refuses access to rows where `user_id != auth.uid()`. The frontend does not enforce this — it can't. The database does.

**Exception:** Admins with a valid `admin_view_as_sessions` row can read another patient's data *for the duration of the session*. The RLS policy explicitly checks for an unexpired session matching the admin's auth ID and the target user ID.

### Boundary 2 — Admin impersonation

**Rule:** No admin can silently view another patient's data. Every view-as action is explicitly authorized, time-bounded, and audited.

**Enforcement:**
- The `admin-view-as-mint` edge function requires the caller to have `user_roles.role = 'admin'` AND requires a non-empty reason string AND returns a session token with a hardcoded 4-hour expiry.
- RLS policies on patient data check for a matching unexpired session before granting read access.
- Every session mint, every token use, and every session expiry writes a row to `admin_view_as_audit`.
- The frontend cannot decide to impersonate — it can only request a session from the edge function and use the returned token.

This is the hardest boundary to get right because it's the one most often violated through convenience. The system deliberately chooses audit completeness over UX smoothness: yes, the admin has to type a reason; yes, the session expires; yes, every action is logged. These are features.

### Boundary 3 — Share token resolution

**Rule:** A share token grants read-only access to a bounded subset of one patient's data, until the patient revokes it.

**Enforcement:**
- Share tokens are UUIDs with ~128 bits of entropy, generated server-side via `gen_random_uuid()`.
- Token lookup happens in an edge function, not client-side, so the token is never exposed to random GETs.
- The edge function returns only the specific fields needed for the share view (terrain overview, question queue, perception gaps), never full bundles or raw lab data.
- The patient can rotate the token on demand, which invalidates the old one.

**Known gap:** Tokens don't currently carry an expiration. This is acceptable for the pilot phase but should be addressed before broader deployment. See the "Known gaps" section below.

### Boundary 4 — Bundle export authorization

**Rule:** Only the patient or an admin in a valid view-as session can export a patient's CELF bundle.

**Enforcement:** The `export-celf-bundle` edge function:
1. Authenticates the caller via JWT
2. If a `?user_id=` parameter is present and differs from the caller's ID, requires an admin role AND a valid view-as session targeting that user
3. Applies the subject identity gate (refuses to export a bundle for an account with no demographics, to prevent silent exports of empty or wrong-user accounts)
4. Stamps the bundle with caller ID, target ID, and view-as flag for forensic provenance
5. Writes a `celf_exports` audit row with the complete bundle, SHA-256 hash, and metadata

### Boundary 5 — Ontology mutation

**Rule:** The biomarker ontology is a system-wide shared resource. Individual reviewers can propose concepts but cannot unilaterally add them.

**Enforcement:**
- The ontology JSON file lives in a Supabase Storage bucket with write access restricted to service-role keys. Admins cannot upload new versions from the frontend.
- Reviewer-accepted new concepts are written to `ontology_concept_proposals`, not the ontology itself.
- Promoting proposals to the next ontology version is a deliberate build-and-deploy step, currently manual. The accepted proposal set is reviewed, the ontology JSON is rebuilt from the current feature map plus accepted proposals, the result is uploaded, and edge functions pick up the new version on their next invocation.

---

## Known gaps and future hardening

This section documents what we know is incomplete. Writing it down is a commitment to address it, not a confession of defeat.

### Security and governance

- **Share tokens don't expire.** They rotate on patient request but have no automatic TTL. Needs a configurable expiration policy (e.g., 30 days for most shares, 24 hours for one-time clinical handoffs).
- **Clinician identity is not verified.** Anyone with a share token can access the share view. For the pilot phase this is acceptable; for production, clinicians need authenticated accounts with institutional verification.
- **Audit logs have no retention policy.** Currently every event is kept forever. This is fine at current volumes but will need attention as the cohort grows.

### Data integrity

- **Historical observations classified under the hand-curated feature map haven't been re-extracted through the LLM path.** They still carry their original canonicalization. A background re-extraction job would normalize the full corpus to the current ontology version, but has not been built yet.
- **Unit conversion trusted to the LLM at ingest.** The LLM emits the conversion factor. We don't currently have a sanity-check layer (e.g., "is this factor in a plausible range for this biomarker class?"). Occasional LLM errors could produce wrong canonical values. The review queue catches obvious cases but not subtle ones.

### Product and workflow

- **No deep linking into patient workflows.** The patient shell is a single page that swaps sections internally. A clinician sharing a specific finding can't send a URL that opens to that finding. Considered; deliberately deferred; may revisit.
- **No outcome instrumentation.** We don't currently measure whether patients queue better questions, whether clinicians actually use the handoff links, or whether review queue corrections reduce future misclassification rates. These are the metrics that would prove the system is doing what it claims. Instrumentation work is planned but not started.
- **Testing coverage is incomplete.** The edge functions have no automated test suite. High-value targets for initial tests: the CELF export function's subject identity gate, the review queue resolution atomicity, the admin view-as permission check, and the ingestion pipeline's confidence gating.

---

## Versioning and evolution

This architecture will change. Every time it does, this document gets updated in the same commit as the change. The sections above are structured so that additions happen at the end of sections, not in the middle — a new workflow gets a new `Workflow E` section, not a retrofit to Workflow A.

The commitment is that the document stays synchronized with the code. If you're reading this and something you see in the repo contradicts what's written here, the document is the bug, not the code, and a pull request correcting it is welcome.

---

*Last substantive revision: April 2026 — added admin view-as hardening (Boundary 2), review queue atomic function, README.*
