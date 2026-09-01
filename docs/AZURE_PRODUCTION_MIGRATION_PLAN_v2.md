# Azure Production Migration Plan — Patient Reveal (v2, corrected)

Status: **developer implementation checklist**, subordinate to the governing v1.1 production runbook. Not an approval artifact. This revision incorporates the technical review of v1; corrections are listed in §9.

## 0. Scope of the correction

v1 was an adequate application inventory and an unsafe cutover plan. Its central error: it treated the backend as "edge functions + Postgres" and proposed repointing `VITE_SUPABASE_URL` at an Azure API. That single change breaks authentication, all table reads/writes, all RPCs and all file storage, because the frontend uses **one** Supabase client for four distinct protocols.

Evidence in the repository (`src/integrations/supabase/client.ts`) — one `createClient(SUPABASE_URL, PUBLISHABLE_KEY)` instance backs:

| Protocol | Path | Repository usage |
| --- | --- | --- |
| Auth (GoTrue) | `/auth/v1` | `src/context/AuthContext.tsx`, `src/pages/Auth.tsx`, Google OAuth via `@lovable.dev/cloud-auth-js` |
| PostgREST | `/rest/v1` | every context/hook (`LabUploadsContext`, `ManifestContext`, `useClusters`, admin pages, …) |
| RPC | `/rest/v1/rpc` | `next_cie_version`, `next_narrative_version`, `next_action_plan_version`, `next_terrain_render_version`, `has_role`, `has_valid_view_as_session`, `resolve_observation_review_queue_item`, `rae_persist_initial_admission` |
| Storage | `/storage/v1` | bucket `lab-uploads` (`LabUploadsContext`, `reject-upload-identity`), `ontology/biomarker_ontology.json` |
| Functions | `/functions/v1` | 29 functions |

Any target that is not protocol-compatible with all five requires frontend rewrites, not an env-var change.

## 1. Verified inventory (checked against the repo, not assumed)

- **29 edge functions** (`supabase/functions/*`, excluding `_shared`), each with its own `Deno.serve` entrypoint.
- **28 of 29** read `SUPABASE_SERVICE_ROLE_KEY`; shared auth (`_shared/auth.ts`) builds both a user-JWT client and a service client, and depends on the `user_roles` table plus `has_valid_view_as_session()`.
- **11 AI-calling functions** (v1 said 7): `patient-chat`, `parse-document`, `process-lab-pdf`, `process-fibroscan`, `define-term`, `generate-clusters`, `generate-narrative`, `generate-action-plan`, `generate-terrain-render`, `generate-ask-anything-context`, `simulate-what-if`.
- **76 checked-in migrations**, which reference the `auth` and `storage` schemas (`auth.users` FKs, `auth.uid()` policies, `storage.objects` policies). They are not environment-neutral SQL.
- **Storage**: private `lab-uploads`, plus an `ontology` object fetched at function runtime by URL.

The checked-in migrations are the *intent*, not the truth. The live database catalogue (roles, grants, policies, functions, triggers, extensions, sequences, storage object metadata, auth configuration) must be captured separately and diffed against the migration replay before any cutover is scheduled.

## 2. Decision gate 1 — identity (must be settled before anything is provisioned)

Target: **Entra External ID** (or another Vizzhy-approved Azure identity service), because "entirely in Vizzhy Azure" excludes retaining Supabase Auth in production.

Non-negotiable constraint: **the existing patient UUID remains the application identity.** Entra subject claims map onto the current `auth.users.id` values; they do not replace them. Otherwise every `profiles.user_id` chain, `user_roles` row, view-as audit record and RLS policy across 76 migrations must be rewritten and revalidated.

Consequences to budget for:
- A token-issuance path that emits a JWT carrying the patient UUID as `sub`, so `auth.uid()` continues to resolve.
- A one-time identity mapping table and backfill from the live `auth.users` set.
- Re-verification of every RLS policy under the new claims model, as a release gate, not a smoke test.

Interim hybrid (Supabase Auth retained while other layers move) is acceptable **only** as a rehearsal environment, never as the accepted production end state.

## 3. Decision gate 2 — compatibility API

Because the frontend speaks five protocols, choose one and record it:

**Option 1 — Azure compatibility API (recommended).** One Container Apps service implements:
- `/auth/v1` — the subset the client actually calls (`token`, `user`, `logout`, refresh), backed by Entra + the identity mapping.
- `/rest/v1` — either PostgREST containerized in Azure, or an explicit endpoint per table/RPC the frontend uses. PostgREST is the lower-risk choice because it preserves filter/select semantics and RLS behaviour via `request.jwt.claims`.
- `/storage/v1` — a thin shim over Blob Storage issuing short-lived user-delegation SAS URLs, preserving the `from(bucket).upload/download/createSignedUrl` surface used by `LabUploadsContext`.
- `/functions/v1/<name>` — the function router (§5).

The frontend then changes one base URL and keeps the Supabase JS client. This is the only path where "change the URL" is true, and it is true *because* the API implements the protocols.

**Option 2 — replace the client.** Write a Vizzhy SDK and rewrite every context, hook and page that touches `supabase.*`. Larger, more invasive, no protocol debt. Choose only if the compatibility surface is judged unmaintainable.

Do not proceed past this gate with the question open.

## 4. Target architecture

```text
                 Azure Front Door Premium (WAF, TLS, Private Link origins)
                            |
      +---------------------+---------------------+
      |                                           |
Static Web Apps                          Container Apps
(React SPA build)                  compat API: /auth /rest /storage /functions
                                           |        |          |
                        Postgres Flexible Server   Blob Storage
                        (private endpoint, RLS)    (private, SAS only)
                                           |
                                     Azure Key Vault
                            (DB creds, AI keys, JWT signing)
                        Log Analytics + App Insights (audit trail)
```

Front Door **Premium** is required — Standard does not support Private Link origins, and the design has no public origins. This is a cost correction, not a preference (§8).

Credentials: `SUPABASE_SERVICE_ROLE_KEY` is retired. Replace it with scoped Azure identities — managed identity for the API, distinct least-privilege database roles per function class (read-only, patient-scoped write, admin/provisioning). No single omnipotent key.

## 5. Function migration (refactor, not a port)

The 29 handlers do not "port without rewriting". Required work per function:
1. Strip `Deno.serve` and export a handler; mount all 29 under one router at `/functions/v1/<name>` so paths are preserved.
2. Replace the service-role client with a scoped database identity, and set `request.jwt.claims` on the session so RLS applies identically instead of being bypassed.
3. Re-implement `_shared/auth.ts` verification against Entra JWKS while keeping `authenticateRequest` / `resolveTargetUserId` semantics — including admin role checks and the view-as session RPC — byte-for-byte in behaviour.
4. Replace storage calls with Blob SDK calls behind the same helper signatures.
5. Ship as a single image in ACR, min replicas ≥ 1 (chat cold starts are user-visible), scale on concurrency.

**AI providers: no automatic swap.** The 11 AI functions keep their current providers and models through cutover. Preserving model behaviour is the default; any provider or model change is a separate, approved change with a regression run of its own. Migrating hosting and migrating model behaviour in one window is not acceptable.

## 6. Database and storage migration

1. **Catalogue the live database** (`pg_dumpall --globals-only`, per-schema `pg_dump -s`, extension/role/grant listings, auth config export, storage object inventory). Diff against a clean replay of the 76 migrations; reconcile drift explicitly before proceeding.
2. **Pre-create compatibility objects** on Azure before any migration runs: roles `anon`, `authenticated`, `service_role`; the `auth` schema shim (`auth.uid()`, `auth.jwt()`, `auth.role()` as `SECURITY DEFINER` readers of `request.jwt.claims`); a `storage` schema sufficient for the policies that reference `storage.objects`. Without this, RLS goes silently permissive.
3. **Baseline**: apply the reconciled schema, then load data with `pg_dump -Fc --no-owner` / `pg_restore --no-acl`.
4. **There is no incremental `pg_dump`.** Either re-dump in full under a write freeze, or stand up logical replication (publication on the source, subscription on Azure) and let it catch up before the window. Pick one now; the cutover duration depends on it.
5. **Storage**: `azcopy` sync for `lab-uploads` (stays private, SAS only) and the ontology object. Track a manifest of object names and hashes for reconciliation.
6. **Verification gates**: per-table row counts, sequence values, policy and grant diff, and cross-patient isolation tests — sign in as a non-privileged patient and confirm every other patient's rows, files and RPC calls return empty or denied.

## 7. Testing and cutover

**Regression suite.** Remove the named-patient golden regression. Replace it with an approved **synthetic / de-identified** fixture set that exercises the same paths: BioTwin release compilation, the attention-fallback and no-refusal doctrine, receipt/telemetry stamping (`runtime_version`), AAE/PME admission verdicts, and the manifest render. No real patient identity may appear in a test asset or a CI log.

**Required test classes before a window is scheduled:** protocol parity (auth, REST, RPC, storage, functions responses match the current backend), RLS cross-patient isolation, admin view-as auditing, AI output regression against pinned providers, load/cold-start, and rollback rehearsal.

**Two full rehearsals** on staging, end to end, including the reconciliation and rollback steps — not a dry run of the dump alone.

**Cutover:**
1. Write freeze, read-only banner, drain in-flight function invocations.
2. Final data sync (full re-dump or replication catch-up) plus `azcopy` sync; reconcile row counts and the Blob manifest.
3. Flip Front Door.
4. Smoke: sign-in, onboarding gate, lab upload → extraction, chat receipt row with expected `runtime_version`, admin view-as, clinician share link, CELF export.
5. **Point of no return: the first accepted write or upload on Azure.** Before it, rollback is a DNS flip. After it, rollback requires reverse reconciliation of both Postgres and Blob — a documented, rehearsed procedure with an owner, not a DNS change.
6. Old production stays read-only for the agreed rollback window; Supabase/Lovable production is retired only after formal acceptance and rollback expiry.

## 8. Effort and cost (corrected)

- **Effort**: not 3–4 weeks. With Entra identity plus a compatibility API plus 29 refactored functions plus two rehearsals, plan **10–16 weeks** for one engineer, or ~6–8 with two. The 3–4 week figure in v1 described a partial hosting move that retained Supabase — which is not the accepted end state.
- **Monthly Azure estimate**: Front Door **Premium** ~$330 base (not $35 Standard — Private Link origins require Premium), Postgres Flexible Server HA ~$250–400, Container Apps 2+ replicas ~$120–200, Static Web Apps ~$9, Storage + egress ~$20–50, Key Vault + Log Analytics ~$20–60. **Roughly $750–1,050/month**, plus AI usage and any non-production environments.

Environments: Azure **DEV / STAGE / PROD** are authoritative. Lovable Cloud is not a permanent staging tier; it is the source system being retired, and it stays available only through the rollback window.

## 9. Corrections applied from the v1 review

| v1 claim | Status |
| --- | --- |
| Change only `VITE_SUPABASE_URL` | **Wrong.** Breaks auth, REST, RPC, storage. Requires a compatibility API (§3). |
| Keep Supabase Auth in production | **Rejected on governance.** Entra External ID, patient UUID retained as app identity (§2). |
| Apply 76 migrations as ordinary SQL | **Insufficient.** They reference `auth`/`storage`; shims and roles must exist first, and the live catalogue must be reconciled (§6). |
| Functions "port without rewriting" | **Wrong.** 29 independent servers, 28 service-role dependent; refactor required (§5). |
| "Incremental `pg_dump`" | **Invalid.** No such mode. Full re-dump under freeze, or logical replication (§6.4). |
| 7 AI functions | **Wrong count.** 11 (§1). |
| Swap to Azure OpenAI | **Rejected as default.** Preserve current models through cutover; provider change is a separate approved change (§5). |
| DNS-only rollback | **Unsafe.** Point of no return defined; rollback covers Postgres and Blob (§7.5). |
| Front Door Standard ~$35 | **Wrong tier.** Premium required for Private Link origins (§8). |
| $400–650/month | **Understated.** ~$750–1,050 (§8). |
| 3–4 weeks, one engineer | **Understated for the accepted scope.** 10–16 weeks (§8). |
| Lovable Cloud as permanent staging | **Rejected.** Azure DEV/STAGE/PROD authoritative (§8). |
| Named-patient golden regression | **Removed.** Synthetic/de-identified suite (§7). |
| `SUPABASE_SERVICE_ROLE_KEY` in Key Vault | **Superseded.** Scoped Azure/database identities (§4). |
| Front Door + Container Apps + private storage + managed identity | Retained. |
| One Deno function host as target | Retained, with refactor acknowledged. |
| Dry-run migration and cross-patient security tests | Retained and strengthened to two full rehearsals. |

## 10. Governing sequence

1. Freeze and verify the exact GitHub commit and the live Lovable deployment it corresponds to.
2. Settle the Azure identity architecture (§2).
3. Build the compatibility API for auth, tables, RPCs, storage and functions (§3).
4. Capture the live database catalogue and produce a reconciled Azure baseline (§6.1–6.2).
5. Refactor and containerize the 29 functions with scoped identities (§5).
6. Provision Vizzhy Azure infrastructure and GitHub OIDC deployment pipelines.
7. Complete security, protocol parity, cross-patient and pinned-model regression testing (§7).
8. Two migration rehearsals, including rollback.
9. Cut over under write freeze with Postgres and Blob reconciliation (§7).
10. Retire Supabase/Lovable production only after acceptance and rollback expiry.

No WGS or omics dependencies exist in this application; no such workload is in scope.
