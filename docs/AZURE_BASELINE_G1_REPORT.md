# Azure-Compatible Baseline — Gate G1 Report

Status: **PASS (schema + enforcement parity proven by replay)**
Scope: schema, RLS, storage inventory, privileged handlers. No data movement, no
Azure resources created, no production change.

## What was built

| Tool | Purpose |
| --- | --- |
| `ops/migrate/capture-catalogue.sh` | G0: capture the live catalogue as machine-readable evidence |
| `ops/migrate/render_azure_baseline.py` | Render an Azure-portable baseline from that capture |
| `ops/migrate/azure-baseline-prereqs.sql` | Compatibility prerequisites (roles, identity, `auth.*` shims, storage shim) |
| `ops/migrate/reconcile_replay.py` | Diff live vs replayed candidate; fail on any behaviour-changing drift |
| `ops/migrate/rls_isolation_probe.sql` | Prove patient isolation actually enforces under the new identity path |

## Evidence

- Source catalogue hash: `9a739e2f264942f00eed577a5e9f98b6016bf7bb57c00e7626232f7683e487ef`
- Rendered baseline hash: `99e6d17c034860492d74cb34d3a66c4d1ffcc5887cbe10cbf78fa8f58479e162`
- Replay target: PostgreSQL **17.9**, isolated local instance, database `reveal_candidate`
- All nine baseline files replayed with **zero errors**

### Live vs replayed candidate

| Dimension | Live | Candidate | Missing | Extra |
| --- | --- | --- | --- | --- |
| Tables | 49 | 49 | 0 | 0 |
| Views | 1 | 1 | 0 | 0 |
| Columns (name+type+notnull) | 731 | 731 | 0 | 0 |
| Enum types | 9 | 9 | 0 | 0 |
| Routines | 34 | 34 | 0 | 0 |
| Triggers | 30 | 30 | 0 | 0 |
| Policies (incl. predicates) | 213 | 213 | 0 | 0 |
| Foreign keys | 51 | 51 | 0 | 0 |
| Tables without RLS | 0 | 0 | 0 | 0 |

Report: `/tmp/azure-migration/g0/replay-reconcile.json` — verdict `PASS`.

### Deliberate transformations (each itemized in `transformation-manifest.json`)

- **T1** — 14 foreign keys to `auth.users` rewritten to `app_identity.app_users`.
  The patient UUID stays the application identity; Entra `oid` is an external key
  in `app_identity.identity_bindings`, and an unmapped `oid` is denied and logged
  as a provisioning task rather than auto-provisioned.
- **T2** — `auth.uid()` / `auth.jwt()` / `auth.role()` reimplemented as
  `SECURITY DEFINER` shims over `request.jwt.claims`, owned by `app_auth_owner`,
  a role that owns no application table (proven by probe assertion).
- **T3** — 47 platform-default `anon` table grants are **not** replayed. Zero live
  policies name the `anon` role, so nothing legitimately needed them; replaying
  them would have carried the widest privilege surface into Azure unexamined.
- **T4** — 8 `storage.objects` policies are emitted as advisory comments only.
  Private Blob Storage plus short-lived user-delegation SAS issued by the API is
  the file authority in Azure; table policies would be decorative there.
- Extensions are installed into an `extensions` schema (as today), not `public`.

### Enforcement probe (synthetic identities, transaction rolled back)

11 assertions pass, including:
`auth.uid()` resolves the claims subject · each subject reads only its own
profile and twin report · cross-patient `UPDATE` affects zero rows · forged
insert for another patient rejected by RLS · `anon` reaches neither
`biotwin_reports` nor `profiles` · `app_auth_owner` owns no application table ·
`has_role()` remains `SECURITY DEFINER` · no public table left without RLS.

### Storage inventory carried forward

`lab-uploads` 53 objects / 53,808,109 bytes; `ontology` 1 object / 52,177 bytes.
51 upload rows, 51 distinct storage paths, **0 orphans**. Both buckets are
private in the Azure target.

### Privileged handlers

The six previously unbound handlers (`process-lab-pdf`, `start-experiment-phase`,
`compare-experiment-checkpoint`, `compare-experiment-phases`,
`design-experiment-protocol`, `simulate-what-if`) remain bound to
`authenticateRequest` + `resolveTargetUserId`, deployed, and verified against the
live environment: unauthenticated calls return 401, cross-patient calls 403.

## Regression suite

- BioTwin / RAE Deno suite: **61 passed, 1 failed**
- Frontend Vitest: **302 passed, 1 failed**

Both failures are pre-existing drift, unrelated to this work and unchanged by it:
`releaseCompiler.test.ts` "compiler version is frozen" (test pinned to v1 while
the compiler is v2) and `ppe/comparator.test.ts` high-overlap case
(`POSSIBLE_SIGNAL` vs expected `SIGNAL_DETECTED`). They need a product decision
about which side is correct, not a migration fix.

One incidental fix was required to make the Deno suite runnable at all: two
`ReleaseDecision` → `JsonObject` casts in `releaseCompiler.ts` failed type
checking and blocked the whole suite. Behaviour is unchanged.

## Not done, deliberately

Data movement, cutover rehearsal, MSAL frontend rewrite, and Azure resource
provisioning. The baseline is the precondition for those, not a substitute.
