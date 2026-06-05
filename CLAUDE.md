# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Reveal Path is the patient-facing + admin web surface of the Vizzhy Bio Intelligence platform. It ingests patient lab/InBody/FibroScan reports, extracts and canonicalizes biomarker observations against a versioned ontology (LLM-driven), reconstructs longitudinal trajectories, and exports a canonical CELF bundle consumed by a downstream BioTwin generator. Read `README.md` for the product thesis and `architecture.md` for the authoritative system map (workflow grammar, data model, trust boundaries) — `architecture.md` is treated as source of truth and is updated in the same commit as any change that moves a trust boundary or adds a subsystem.

## Two runtimes, one repo

This is the single most important thing to understand before editing:

1. **Browser app** — Vite + React 18 + TypeScript, tested with **Vitest** (jsdom). Lives in `src/`. Path alias `@/*` → `src/*`.
2. **Supabase Edge Functions** — **Deno** workers in `supabase/functions/`. They import dependencies by URL (`https://esm.sh/...`, `./file.ts` with explicit extensions) and use `Deno.serve` / `Deno.env`. These are **not** run by Vitest.

Shared logic between the two lives in `supabase/functions/_shared/` and is aliased as `@shared/*` (configured in both `vite.config.ts` and `vitest.config.ts`). When importing shared code from the browser app use `@shared/...`; inside an edge function use relative `./_shared/...` paths with `.ts` extensions.

A `*.test.ts` file's runtime depends on its location:
- `src/**` and `tests/**` (excluding `tests/e2e/`) → **Vitest** (see `vitest.config.ts` `include`).
- `supabase/functions/_shared/**` (including the whole `rae/` tree) → **Deno test** (`deno test`). These use Deno-style imports and will fail under Vitest.
- `tests/e2e/**` → **Playwright** (excluded from Vitest).

## Commands

> Note: `README.md` references `pnpm` and a `pnpm check` script that do not exist here. The repo ships `bun.lock`/`bun.lockb` and `package-lock.json` (no `pnpm-lock.yaml`); use **npm** or **bun**. There is no `check` script — type-check via `tsc`/the build and lint separately.

```bash
npm install                 # or: bun install

npm run dev                 # Vite dev server on port 8080
npm run build               # production build
npm run build:dev           # development-mode build
npm run lint                # eslint .
npm run preview             # serve the built bundle

# Unit/component tests (Vitest)
npm test                    # vitest run (one-shot)
npm run test:watch          # vitest watch
npx vitest run src/lib/manifestDiff.test.ts        # single file
npx vitest run -t "describe or test name"          # by test name

# Deno tests for edge functions / shared code (need Deno on PATH)
deno test --allow-net --allow-env --no-check supabase/functions/_shared/rae/
deno test --no-check --filter integration supabase/functions/_shared/rae/storage/

# RAE SQL-layer integration harness (needs Docker + Deno)
bash scripts/test-integration.sh    # spins postgres:15-alpine, applies all
                                     # migrations in timestamp order, runs the
                                     # `--filter integration` Deno tests

# End-to-end (Playwright)
npx playwright test                 # boots Vite itself; testDir = tests/e2e
```

CI (`.github/workflows/rae-integration.yml`) runs `scripts/test-integration.sh` on push/PR to `main` with Deno v2.7.13. The Vitest/lint suites are not yet wired into CI — run them locally.

## Architecture essentials

### Frontend shape
- **Routing** is centralized in `src/App.tsx`. `ProtectedRoute` requires a Supabase session; `AdminRoute` additionally checks `user_roles.role = 'admin'`. Public token-gated routes (`/share/:token`, `/clinical/:token`) and `/manifest-preview` are intentionally unauthenticated.
- The patient experience (`/`, `pages/Index.tsx`) is a **single-page shell that swaps sections internally** rather than deep-linking — there is deliberately no URL per workflow step.
- **State is React Context-heavy.** `src/context/` holds ~15 providers (Auth, ViewAs, Intake, CIEAssessment, LabUploads, TerrainRender, Manifest, Queue, Navigation, etc.). Prefer extending the relevant existing context over introducing new global state. `@tanstack/react-query` is the server-cache layer; `src/integrations/supabase/client.ts` is the single Supabase client.
- **UI** is shadcn/ui (Radix primitives in `src/components/ui/`, configured via `components.json`) + Tailwind. Compose with `cn()` from `@/lib/utils`. Domain logic that is testable lives in `src/lib/` (manifest lint/diff/schema, cluster confidence, terrain axes, time-series parsing) and is unit-tested there.
- `src/integrations/supabase/types.ts` is generated DB types — don't hand-edit.

### Backend shape (Supabase)
- Each directory under `supabase/functions/` is one independently deployed Deno worker. The pipeline-critical ones: `process-lab-pdf` / `process-fibroscan` / `parse-document` (ingest + LLM extraction), `export-celf-bundle` (the data-out artifact), `admin-view-as-mint` (audited impersonation), the `resolve_observation_review_queue_item` flow surfaced via review-queue functions, and the `rae-admit-observation` / `witnessify-observations` RAE path.
- **Trust is enforced server-side, never in the client.** Postgres RLS isolates patient data (`user_id = auth.uid()`); admin cross-patient reads require an unexpired `admin_view_as_sessions` row. `_shared/auth.ts` (`authenticateRequest`) is the owner-or-admin-with-view-as gate edge functions should reuse rather than reimplementing.
- **Canonicalization happens once, at ingest**, inside the LLM extraction. Observations with `classification_confidence >= 0.80` (or `classification_method = 'human_reviewed'`) go straight to `patient_lab_observations`; lower-confidence/unknown ones go to `observation_review_queue`. Downstream consumers (e.g. `export-celf-bundle`) read the canonical fields directly and must NOT re-run alias/unit resolution. Source-verbatim observation fields are immutable after ingest; only the canonical fields evolve (via the review queue).
- **Migrations** are timestamped SQL in `supabase/migrations/` (67+ files) and are applied in filename/timestamp order — never reorder or rewrite an applied migration; add a new one. The integration harness applies them from zero, so a migration that only works against an existing prod DB will break CI.

### RAE subsystem (`supabase/functions/_shared/rae/`)
The Reasoning/Admission Engine adjudicates an observation against a candidate ontology concept. `orchestrator.ts` is **pure** (no I/O) — it composes the per-signal evaluators in `signals/` (lexical, unit, value, method, refRange, panel, longitudinal) through `scoring.ts` and `stateMachine.ts` to produce a witness draft + a discrete `witness_intent`. Storage/SQL side-effects are isolated in `rae/storage/`. Keep the orchestrator pure; put any DB access behind the storage layer. Design specs are in `docs/RAE_*_v1.md`; the witness ontology enums must stay aligned with the P1A registry (drift surfaces as "invalid input value for enum" failures in the integration harness).

### Ontology
The biomarker ontology (`ontology/biomarker_ontology.json`, also `biomarker_ontology.json` at root) is the shared canonical vocabulary. In production it is hosted in a Supabase Storage bucket and fetched by edge functions at invocation time (so updates roll out without redeploying functions). Reviewers can only *propose* concepts (`ontology_concept_proposals`); promotion into a new ontology version is a deliberate, separate build step. `scripts/build-witness-registry.ts` generates the P1A witness-registry seed migration from the ontology + CIE seed + InBody map (see `.github/workflows/generate-witness-registry.yml`).

## Conventions

- **TypeScript is intentionally loose** (`tsconfig.json`: `strictNullChecks: false`, `noImplicitAny: false`, unused-vars off; ESLint also disables `@typescript-eslint/no-unused-vars`). Match the surrounding style; don't add strictness flags repo-wide.
- Edge functions pin dependency versions in their import URLs (e.g. `@supabase/supabase-js@2.45.0`) and include CORS preflight handling — copy the pattern from an existing function.
- Several `.env` keys are committed for the (public-anon) Supabase frontend config. Backend secrets live in Supabase function env (`Deno.env.get(...)`), not in this repo.
- `docs/` holds versioned design docs (`*_v1.md`) that precede implementation — consult the matching design doc before changing RAE, CELF, or admission surfaces.

## Repo rough edges (still live)

Durable gotchas worth knowing before you change things here.

- **The 0.80 ingest confidence gate is not centralized.** It's hardcoded in `process-lab-pdf/index.ts` (`confidence < 0.80`) and again as `CONFIDENCE_THRESHOLD = 0.80` in `export-celf-bundle/index.ts`. Changing the gate means editing both sites — there is no single tunable source.
- **Duplicate ontology file.** `biomarker_ontology.json` (repo root) and `ontology/biomarker_ontology.json` are byte-identical. The witness-registry build and README reference the `ontology/` copy; the root copy is redundant and can silently drift.
- **`npm run lint` is not a clean gate.** A fresh checkout reports ~242 errors / ~38 warnings (mostly `@typescript-eslint/no-explicit-any`). These are pre-existing — don't assume your change caused them. The Vitest suite (164 tests) passes clean and is the reliable signal.
