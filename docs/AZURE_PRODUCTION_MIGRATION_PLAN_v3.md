# Azure Production Migration Plan — Patient Reveal (v3)

Status: **accepted-scope implementation plan.** Supersedes v1 (unsafe) and v2 (better, still not deployable). This revision applies the v2 review in full: no cloned auth server, correct identity mapping semantics, correct RPC inventory, a Front Door origin that actually supports Private Link, and pre-migration remediation of the security and fixture debt found in the repository.

## 0. What changed from v2

| v2 position | v3 position |
| --- | --- |
| Implement a `/auth/v1` compatibility surface (mini-GoTrue) | **Rejected.** Rewrite the frontend auth layer on MSAL + Entra External ID. Cloning GoTrue means owning token issuance, refresh rotation and session semantics forever. |
| Entra subject claim carries the existing patient UUID | **Corrected.** Entra `sub` is issuer-controlled and immutable. The patient UUID stays the application identity via an **identity mapping table**; the API resolves `sub` → patient UUID and injects that UUID into `request.jwt.claims.sub` for RLS. |
| 8 RPCs | **11 RPCs** (§2). |
| Static Web Apps behind Front Door Premium Private Link | **Invalid.** Static Web Apps cannot be a Private Link origin. Use Blob static website or a container web origin (§4). |
| Storage shim covers upload/download/signed URLs | **Incomplete.** `LabUploadsContext` also calls `.remove()`; the shim must cover delete and list. |
| Peter named-patient fixtures replaced "in the test plan" | **Not sufficient.** The fixtures exist in `supabase/functions/_shared/biotwin/__fixtures__/` and must be removed/de-identified as a pre-migration work item (§7). |
| `service_role` replaced by scoped identities | Retained, and expanded: six privileged handlers currently unbound must be scoped before migration (§3). |

## 1. Accepted end state

- Identity: **Entra External ID**, MSAL in the SPA. No Supabase Auth in production.
- Data plane: **Postgres Flexible Server** (private endpoint), RLS enforced, `auth.*` helpers shimmed as `SECURITY DEFINER` readers of `request.jwt.claims` owned by a **non-owner** role.
- API: one **Vizzhy API** on Container Apps exposing a bounded, explicit surface (`/api/...`) plus `/functions/v1/<name>` for the 29 handlers. **PostgREST is internal-only or absent** — the SPA no longer speaks PostgREST to the internet.
- Files: **Blob Storage**, private, short-lived user-delegation SAS only.
- Frontend: React SPA, built in CI, served from a Private-Link-capable origin behind Front Door Premium.

## 2. Verified inventory (repository facts, not assumptions)

- **29 edge functions** (`supabase/functions/*` excluding `_shared`), each its own `Deno.serve`.
- **28 of 29** read `SUPABASE_SERVICE_ROLE_KEY`. `_shared/auth.ts` builds both a user-JWT client and a service client and depends on `user_roles` plus `has_valid_view_as_session()`.
- **11 AI-calling functions**: `patient-chat`, `parse-document`, `process-lab-pdf`, `process-fibroscan`, `define-term`, `generate-clusters`, `generate-narrative`, `generate-action-plan`, `generate-terrain-render`, `generate-ask-anything-context`, `simulate-what-if`.
- **11 RPCs** called from the client or functions: `next_cie_version`, `next_narrative_version`, `next_action_plan_version`, `next_terrain_render_version`, `has_role`, `has_valid_view_as_session`, `resolve_observation_review_queue_item`, `rae_persist_initial_admission`, `rae_insert_witness_object`, `get_shared_clinical_summary`, `get_shared_question_queue`.
- **Storage surface actually used**: `upload`, `download`, `createSignedUrl`, `remove`, plus the `ontology/biomarker_ontology.json` object fetched by URL at function runtime. Bucket `lab-uploads` is private.
- **76 checked-in migrations**, referencing `auth.users` FKs, `auth.uid()` policies and `storage.objects` policies. Not environment-neutral.
- **Hardcoded backend host**: `supabase.co` appears in `src/components/terrain/ClinicalHandoffPanel.tsx` — must be removed before any cutover.
- **Named-patient assets**: Peter v18 fixtures under `supabase/functions/_shared/biotwin/__fixtures__/`.

The checked-in migrations are intent, not truth. The live catalogue (roles, grants, policies, functions, triggers, extensions, sequences, storage metadata, auth config) must be captured and diffed against a clean replay before a window is scheduled.

## 3. Pre-migration remediation (must land on main before Azure work begins)

These are defects today, independent of Azure. Fixing them after the move doubles the verification cost.

1. **Bind the six unbound privileged handlers.** Functions including `process-lab-pdf`, `simulate-what-if` and the other service-role handlers that accept a caller-supplied `user_id`/`patient_id` without routing it through `resolveTargetUserId` must be bound to caller identity (or admin + valid view-as session) before the identity model changes underneath them.
2. **Remove the hardcoded `supabase.co` URL** in `ClinicalHandoffPanel.tsx`; derive from config.
3. **De-identify the Peter fixtures.** Replace with synthetic BioTwin v18 assets carrying the same schema shape and driver classes. No real patient identity in test assets or CI logs.
4. **Centralize storage access** behind a small module wrapping upload/download/signed-URL/remove/list, so the Blob swap is one file, not a grep.
5. **Centralize auth access** behind a single session/token module, so the MSAL swap does not fan out across contexts and pages.

## 4. Target architecture

```text
                Azure Front Door Premium (WAF, TLS, Private Link origins)
                                |
        +-----------------------+------------------------+
        |                                                |
  Web origin (Private Link capable):                Container Apps
  Blob static website  OR  nginx container          Vizzhy API
  serving the SPA build                             /api/*  +  /functions/v1/*
                                                     |         |         |
                                    Postgres Flexible Server  Blob    Entra External ID
                                    (private endpoint, RLS)  (private,  (OIDC/JWKS)
                                                     |        SAS only)
                                              Azure Key Vault
                                     (DB creds, AI keys, signing material)
                                   Log Analytics + App Insights (audit trail)
```

Front Door **Premium** is required for Private Link origins. **Static Web Apps is not a valid Private Link origin** — use Blob static website behind Front Door, or an nginx container on Container Apps if request rewriting/headers are needed.

`SUPABASE_SERVICE_ROLE_KEY` is retired. Replace with managed identity for the API and distinct least-privilege database roles per handler class: read-only, patient-scoped write, admin/provisioning. No omnipotent key.

## 5. Identity (decision gate 1 — settle before provisioning)

- MSAL in the SPA; Entra External ID as issuer. Delete the `@lovable.dev/cloud-auth-js` wrapper and rewrite the auth-dependent modules (`AuthContext`, `Auth` page, `OnboardingGate`, `ViewAsContext`, admin pages, share flows) against the centralized session module from §3.5.
- **Identity mapping table** `identity_map(entra_oid uuid primary key, patient_user_id uuid unique not null, ...)`, backfilled once from the live `auth.users` set. Entra `oid`/`sub` is the external key; `patient_user_id` is the application identity.
- The API resolves the mapping on every request and sets `request.jwt.claims` with `sub = patient_user_id` before touching Postgres, so `auth.uid()` continues to resolve and no RLS policy is rewritten.
- `auth.uid()`, `auth.jwt()`, `auth.role()` are recreated as `SECURITY DEFINER` functions owned by a **non-owner, non-superuser** role reading `request.jwt.claims`. Ownership matters: a definer function owned by the table owner reintroduces the bypass being removed.
- Re-verification of every RLS policy under the new claims model is a **release gate**, not a smoke test.
- Unmapped `oid` → deny, log, surface an admin provisioning task. Never auto-create an application identity from a token.

## 6. API surface (decision gate 2)

The SPA stops speaking PostgREST publicly. Enumerate the reads and writes it actually performs and expose them as explicit endpoints, each with server-side identity binding:

- Table access used by `LabUploadsContext`, `ManifestContext`, `useClusters`, `BioTwinContext`, `QueueContext`, admin pages and share pages → bounded `/api/...` endpoints.
- The **11 RPCs** → explicit endpoints; version-allocating RPCs (`next_*_version`) stay single-statement server-side calls so concurrency semantics are preserved.
- Storage → `/api/files/*` issuing short-lived user-delegation SAS for upload/download and performing delete/list server-side (covers `.remove()`).
- Functions → `/functions/v1/<name>`, path-preserved.

PostgREST may run **inside** the private network as an implementation detail for breadth, but it is not internet-reachable and is not the contract.

## 7. Functions (refactor, not a port)

1. Strip `Deno.serve`, export handlers, mount all 29 under one router at `/functions/v1/<name>`.
2. Replace the service-role client with a scoped database identity and set `request.jwt.claims` on the session so RLS applies rather than being bypassed.
3. Re-implement `_shared/auth.ts` against Entra JWKS plus the identity map, preserving `authenticateRequest` / `resolveTargetUserId` behaviour byte-for-byte — including admin role checks and the view-as session RPC.
4. Replace storage calls with Blob SDK calls behind the §3.4 helper signatures.
5. **Long-running work moves to durable workers.** Document parsing, lab PDF extraction, cluster/narrative/action-plan generation and release compilation run as queue-backed jobs (Storage Queue + Container Apps job or worker replica), not as request-scoped HTTP handlers. Chat stays synchronous with min replicas ≥ 1 (cold starts are user-visible).
6. **AI providers and models are pinned through cutover.** Any provider/model change is a separate approved change with its own regression run.

## 8. Database and storage migration

1. Catalogue the live database (`pg_dumpall --globals-only`, per-schema `pg_dump -s`, extension/role/grant listings, auth config export, storage object inventory). Diff against a clean replay of the 76 migrations; reconcile drift explicitly.
2. Pre-create compatibility objects on Azure **before** any migration runs: roles `anon`, `authenticated`, `service_role`; the `auth` schema shim per §5; a `storage` schema sufficient for policies referencing `storage.objects`. Without this, RLS goes silently permissive.
3. Baseline: apply the reconciled schema, then load data with `pg_dump -Fc --no-owner` / `pg_restore --no-acl`.
4. **There is no incremental `pg_dump`.** Either full re-dump under write freeze, or logical replication (publication on source, subscription on Azure) caught up before the window. Choose now — cutover duration depends on it.
5. Storage: `azcopy` sync for `lab-uploads` and the ontology object; keep a manifest of names and hashes for reconciliation.
6. Verification gates: per-table row counts, sequence values, policy and grant diff, and cross-patient isolation tests — sign in as a non-privileged patient and confirm every other patient's rows, files and RPC calls return empty or denied.

## 9. Testing and cutover

**Regression suite.** Synthetic / de-identified fixtures only (see §3.3), exercising: BioTwin release compilation, the attention-fallback and no-refusal doctrine, receipt/telemetry stamping (`runtime_version`), AAE/PME admission verdicts, PPE comparator determinism, and the manifest render.

**Required test classes before scheduling a window:** endpoint parity against current behaviour, RLS cross-patient isolation under Entra claims, admin view-as auditing, AI output regression against pinned providers, durable-job retry/idempotency, load and cold-start, and rollback rehearsal.

**Two full rehearsals** on staging, end to end, including reconciliation and rollback — not a dump dry-run.

**Cutover:**
1. Write freeze, read-only banner, drain in-flight jobs and function invocations.
2. Final sync (full re-dump or replication catch-up) plus `azcopy`; reconcile row counts and the Blob manifest.
3. Flip Front Door.
4. Smoke: Entra sign-in, onboarding gate, lab upload → extraction job, chat receipt row with expected `runtime_version`, admin view-as, clinician share link, CELF export.
5. **Point of no return: the first accepted write or upload on Azure.** Before it, rollback is a DNS flip. After it, rollback is reverse reconciliation of Postgres **and** Blob — a rehearsed procedure with a named owner.
6. Old production stays read-only through the agreed rollback window; it is retired only after formal acceptance and rollback expiry.

## 10. Effort and cost

- **Effort:** MSAL frontend rewrite + identity mapping + bounded API + 29 refactored functions + durable workers + pre-migration remediation + two rehearsals → **14–20 weeks** for one engineer, **8–11 weeks** with two. (v2's 10–16 weeks predated the frontend auth rewrite and durable-worker scope.)
- **Monthly Azure estimate:** Front Door Premium ~$330 base; Postgres Flexible Server HA ~$250–400; Container Apps (API + workers, 2+ replicas) ~$150–250; web origin (Blob static website or nginx container) ~$5–40; Storage + egress ~$20–50; Key Vault + Log Analytics ~$20–60. **≈ $775–1,130/month**, plus AI usage and non-production environments.
- Environments: Azure **DEV / STAGE / PROD** authoritative. Lovable Cloud is the source system being retired and stays available only through the rollback window.

## 11. Governing sequence

1. Land the §3 pre-migration remediation on main (security binding, de-identification, storage/auth centralization).
2. Freeze and verify the exact commit and the live deployment it corresponds to.
3. Approve the identity design: Entra External ID + identity map + definer `auth.*` shims on a non-owner role (§5).
4. Approve the bounded API contract and the RPC/endpoint enumeration (§6).
5. Capture the live catalogue; produce a reconciled Azure baseline (§8.1–8.2).
6. Rewrite the frontend auth layer on MSAL; refactor and containerize the 29 functions with scoped identities and durable workers (§7).
7. Provision Azure infrastructure and GitHub OIDC pipelines.
8. Complete security, endpoint-parity, cross-patient and pinned-model regression testing (§9).
9. Two migration rehearsals, including rollback.
10. Cut over under write freeze with Postgres and Blob reconciliation.
11. Retire the source production only after acceptance and rollback expiry.

No WGS or omics dependencies exist in this application; no such workload is in scope.
