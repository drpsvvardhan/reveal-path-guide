# Azure Production Migration Plan — Reveal Path

Status: planning document. No code changes required to read this.

## 0. What actually has to move

| Layer | Today (Lovable Cloud / Supabase) | Azure target |
| --- | --- | --- |
| Frontend | Vite + React SPA on Lovable hosting | Azure Static Web Apps (or Blob + Front Door) |
| API / business logic | 29 Deno edge functions (`supabase/functions/*`) | Azure Container Apps (single Deno service) |
| Database | Managed Postgres + RLS (76 migrations) | Azure Database for PostgreSQL Flexible Server |
| Auth | Supabase Auth (email + Google, JWT, `auth.users`) | Keep Supabase Auth, or migrate to Entra ID External Identities |
| Storage | Buckets: lab uploads, `ontology/` | Azure Blob Storage (private + SAS) |
| Secrets | Supabase function secrets | Azure Key Vault |
| AI calls | Lovable AI Gateway (Gemini) | Azure OpenAI or direct Gemini key |

Hard dependencies to be aware of: RLS policies rely on `auth.uid()` and `auth.jwt()`; edge functions rely on `SUPABASE_SERVICE_ROLE_KEY`, `has_role()`, `has_valid_view_as_session()`; the ontology JSON is fetched at runtime from a public storage URL.

## 1. Decision to make first: auth

**Option A — keep Supabase Auth, move everything else (recommended, ~1-2 weeks).**
Postgres, functions, storage, and the frontend run in Azure; a Supabase project remains only as the identity provider (or you self-host GoTrue in Container Apps against the Azure Postgres). RLS keeps working unchanged because `auth.uid()` resolves from the JWT.

**Option B — Entra ID / MSAL (4-8 weeks).**
Every `auth.uid()` policy, the `profiles.user_id` chain, admin roles, and view-as auditing must be rewritten around a new claims model, and all 76 migrations' policies revalidated. Only choose this if corporate SSO is a compliance requirement.

The rest of this plan assumes Option A, with Option B notes where relevant.

## 2. Target Azure architecture

```text
                 Azure Front Door (WAF, TLS, custom domain)
                            |
      +---------------------+---------------------+
      |                                           |
Static Web Apps                          Container Apps
(React SPA build)                     "revealpath-api" (Deno)
                                       /functions/<name> routes
                                           |        |
                        Postgres Flexible Server   Blob Storage
                        (private endpoint, RLS)    (private, SAS)
                                           |
                                     Azure Key Vault
                                (service key, AI keys, JWT secret)
                             Log Analytics + App Insights (audit)
```

Networking: one VNet, private endpoints for Postgres, Blob, and Key Vault. Container Apps gets the managed identity that reads Key Vault. Nothing but Front Door is public.

## 3. Phase plan

### Phase 1 — Provision (2-3 days)
Terraform or Bicep, one resource group per environment (`rg-revealpath-prod`, `-staging`):
- PostgreSQL Flexible Server 15, zone-redundant HA, 7-35 day PITR backups, `pgcrypto` + `uuid-ossp` extensions.
- Container Apps environment + Log Analytics workspace.
- Static Web App, Storage account (containers `lab-uploads`, `ontology`), Key Vault, Front Door.
- Private DNS zones + private endpoints; enable diagnostic settings on every resource (required for any HIPAA-style audit story).

### Phase 2 — Database migration (2-4 days)
1. Apply the 76 migrations in order to the Azure server with the Supabase CLI or plain `psql` (they are ordinary SQL).
2. Pre-create the roles the migrations/GRANTs assume: `anon`, `authenticated`, `service_role`, plus the `auth` schema shim if you keep Supabase Auth externally (`auth.uid()`, `auth.jwt()`, `auth.role()` as `SECURITY DEFINER` functions reading `request.jwt.claims`). This shim is the single most important compatibility step — every RLS policy depends on it.
3. Data copy: `pg_dump -Fc --no-owner` per schema (`public`, then `auth` if self-hosting GoTrue), restore with `pg_restore --no-acl`. Freeze writes during the final cut, do a dry run first on staging.
4. Verify: row counts per table, then re-run the RLS smoke tests — sign in as a normal patient and confirm cross-patient reads return zero rows.

### Phase 3 — Edge functions to Container Apps (4-6 days)
The functions are Deno with `Deno.serve`, so they port without rewriting handlers:
- Add one thin Deno router that mounts each existing `index.ts` at `/functions/v1/<name>`, preserving the current paths so the frontend client needs no change beyond its base URL.
- Replace env expectations: `SUPABASE_URL` → API base URL, `SUPABASE_SERVICE_ROLE_KEY` → Key Vault secret, `SUPABASE_ANON_KEY` → publishable key. Keep the names to avoid touching `_shared/auth.ts`.
- Verify JWT locally with the auth JWKS/secret, then set `request.jwt.claims` on the Postgres session so RLS behaves identically.
- AI calls: the 7 functions that use the AI gateway (`patient-chat`, `parse-document`, `process-lab-pdf`, `process-fibroscan`, `define-term`, `generate-clusters`, `generate-ask-anything-context`) need an Azure OpenAI deployment or a direct Gemini key. Model outputs will differ if you switch model families — re-run the existing Deno test suites (BioTwin, attention fallback, receipt tests) before release.
- Ship as a container image in Azure Container Registry, min replicas 1 (avoid cold starts on chat), scale on concurrency.

### Phase 4 — Storage (1-2 days)
Move bucket contents with `azcopy`. Keep `lab-uploads` private and issue short-lived user-delegation SAS URLs from the API; do not make it public. `ontology/biomarker_ontology.json` can stay public-read or be fetched via the API — either way update the URL the functions fetch at invocation time.

### Phase 5 — Frontend (1-2 days)
`VITE_SUPABASE_URL` becomes the Azure API base and `VITE_SUPABASE_PUBLISHABLE_KEY` the retained publishable key. Build in GitHub Actions, deploy to Static Web Apps, SPA fallback to `index.html`, custom domain and TLS on Front Door. Add CSP and HSTS headers at Front Door.

### Phase 6 — Cutover (1 day, scheduled window)
1. Freeze writes / put app in read-only banner.
2. Final incremental `pg_dump`/restore + `azcopy` sync.
3. Flip DNS at Front Door, keep the old URL live and read-only for 48h.
4. Smoke script: sign-in, onboarding gate, lab upload → extraction, Ask My Twin (verify a receipt row lands with the expected `runtime_version`), admin view-as, clinician share link, CELF export.
5. Rollback: DNS back to Lovable hosting; because the old DB is untouched during the window, rollback is a DNS change only.

### Phase 7 — Operations (ongoing)
App Insights alerts on 5xx and function latency, Postgres slow-query and connection alerts, cost budget alerts, PITR restore drill once, and a documented key-rotation runbook for the service key and AI keys.

## 4. Rough effort and cost
- Effort: ~3-4 weeks for one engineer with Option A; add 4-6 weeks for Option B auth migration.
- Monthly Azure estimate (small production): Postgres HA D2s ~$250-400, Container Apps 1-2 replicas ~$60-120, Static Web Apps standard ~$9, Storage/egress ~$20-50, Front Door standard ~$35, Key Vault + logs ~$20. Total roughly **$400-650/month**, plus AI usage.

## 5. Risks
| Risk | Mitigation |
| --- | --- |
| RLS silently permissive after migration | The `auth.*` shim is mandatory; run cross-patient isolation tests as a gate on release |
| Model swap changes clinical narrative behaviour | Re-run BioTwin/attention-fallback/receipt suites and replay Peter's golden regression before cutover |
| PHI exposure during dump/copy | Encrypted transfer only, dumps stored in an encrypted Blob container, deleted after verification |
| Cold starts on chat | Container Apps min replicas ≥ 1 |
| Losing Lovable's automatic deploys | GitHub Actions pipeline built in Phase 1, not at the end |

## 6. Practical note
The Lovable editor will keep building against the current Cloud backend. The realistic pattern is: migrate to Azure as the production environment, keep Lovable Cloud as staging/dev, and promote changes through the GitHub Actions pipeline (migrations + container image + SPA build) rather than editing production directly.
