# Vizzhy Biological Simulator — Integration Plan

Embed the Simulator inside the existing Patient Reveal shell. Reuse the current Reveal design language (Source Serif 4 / Source Sans 3, signature accent, dark surfaces, 1360px section width). No new app, no habit-tracking framing — every surface speaks the predictive-intuition loop.

## The loop, mapped to surfaces

```text
Observe → already in Terrain + Coherence Map (link in, don't duplicate)
Explain → already in Narrative + Clusters (link in)
Simulate → NEW: What-if cards on Action page + /simulator
Choose   → NEW: commit a simulation as an active experiment
Act      → existing ActionSection check-ins, now tied to an experiment
Compare  → NEW: prediction-vs-reality panel at retest
Learn    → NEW: "What we've learned about you" log
Internalize → NEW: scaffold graduation badges + retest checkpoints
```

## Navigation

- New sidebar item **Simulator** (flask icon) under existing chapter list, between "What to do" and the rest.
- On the existing Action / "What to do" page, add a top-level **Simulator** summary card that links into `/simulator` and surfaces the 1–2 active experiments + next retest checkpoint.

## New routes / components (frontend)

- `src/pages/Simulator.tsx` — full loop hub. Tabs: **Simulate**, **Active experiments**, **Compare**, **What we've learned**, **Checkpoints**.
- `src/components/simulator/WhatIfCard.tsx` — one intervention hypothesis: lever, predicted Δ on 1–3 biomarkers/coordinates, time horizon, confidence band, "Run this experiment" CTA.
- `src/components/simulator/ActiveExperimentCard.tsx` — committed simulation with daily check-in progress + days-to-checkpoint.
- `src/components/simulator/PredictionVsRealityPanel.tsx` — predicted vs measured deltas at a retest, with a "calibration" verdict (over/under/on-target).
- `src/components/simulator/LearningsFeed.tsx` — `What we've learned about you`: short, second-person insights derived from past experiments.
- `src/components/simulator/ScaffoldGraduation.tsx` — milestone chips ("You no longer need the reminder for…") that graduate when intuition is internalized.
- `src/components/simulator/RetestCheckpointCard.tsx` — date, biomarkers to re-measure, what each result will confirm or refute.
- `src/components/sections/SimulatorSummarySection.tsx` — the embed on the "What to do" page.
- `src/components/navigation/navItems.ts` — add Simulator entry.

## New tables

All under `public`, RLS scoped to `auth.uid()`, full GRANTs for `authenticated` + `service_role`. Each has `id uuid pk`, `user_id uuid`, `created_at`, `updated_at`.

1. **`simulator_experiments`** — committed What-ifs.
   - `lever` text (intervention concept), `rationale` text, `predicted_deltas` jsonb (biomarker/coordinate → {direction, magnitude, unit, confidence}), `horizon_days` int, `started_at`, `status` text (`active|paused|graduated|abandoned`), `source_cluster_ids` uuid[], `source_terrain_render_id` uuid.
2. **`simulator_what_if_cards`** — generated candidate cards (not yet committed). Same predicted_deltas shape, plus `engine_version` text, `seen_at`, `dismissed_at`. Cards become an experiment by inserting into table 1.
3. **`simulator_checkpoints`** — retest dates per experiment. `experiment_id` fk, `checkpoint_at`, `biomarkers` text[], `status` (`pending|completed|missed`), `measured_deltas` jsonb (filled at completion), `verdict` text (`confirmed|partial|refuted`), `verdict_summary` text.
4. **`simulator_learnings`** — durable "what we've learned about you" entries. `experiment_id` fk nullable, `kind` text (`responder|non_responder|threshold|interaction|stability`), `headline` text, `body` text, `confidence` numeric, `evidence_witness_ids` uuid[]. Append-only from UI; updates only via edge function.

Add a trigger on `simulator_experiments` to auto-schedule a `simulator_checkpoints` row at `started_at + horizon_days`.

## New edge functions

1. **`simulate-what-if`** — given `user_id` + optional `focus` (cluster id, coordinate, biomarker), loads terrain render, clusters, latest labs, witness objects; uses Lovable AI (`google/gemini-3-flash-preview`) with the existing Framework v2 voice rules to produce 3 What-if cards. Writes to `simulator_what_if_cards`. Re-uses `_shared/contextLoader.ts`.
2. **`compare-experiment-checkpoint`** — given `checkpoint_id`, loads experiment + new lab observations after `started_at`; computes measured deltas, classifies verdict, drafts a `simulator_learnings` entry, marks the checkpoint completed, optionally graduates the experiment.

Both follow the `creating-or-editing-new-edge-function-native` rules (CORS, in-code JWT validation, Zod input validation, `verify_jwt = false` per project default — no `config.toml` edit needed).

## Client wiring

- `src/context/SimulatorContext.tsx` — exposes `whatIfCards`, `experiments`, `checkpoints`, `learnings`, `generateCards()`, `commitCard(cardId)`, `runCheckpoint(checkpointId)`, `dismissCard(cardId)`.
- Provider mounted in `src/pages/Index.tsx` inside the existing context tree (after `LabUploadsProvider` so it can read lab data).
- Reuse `useAuth`, `useViewAs`, `useTerrainRender`, `useClusters` for inputs.
- Cards/experiments render with existing tokens; signature accent for predicted-improvement deltas, muted destructive for refuted predictions.

## Existing files touched

- `src/pages/Index.tsx` — add `/simulator` route + provider.
- `src/App.tsx` (or router file) — same.
- `src/components/navigation/navItems.ts` — add Simulator nav item.
- `src/components/sections/ActionSection.tsx` — embed `<SimulatorSummarySection />` near the top.
- `src/components/navigation/DesktopNav.tsx` / `MobileNav.tsx` — pick up the new nav item automatically if they iterate `navItems`; otherwise small edit.

## Out of scope (first pass)

- Push notifications for checkpoints (use in-app card + existing nudges).
- Wearable/CGM ingestion beyond the existing lab pipeline.
- Multi-user / clinician annotation of experiments (read-only via existing share link only).

## Build order

1. Migration: 4 tables + trigger + RLS + GRANTs.
2. Edge functions: `simulate-what-if`, `compare-experiment-checkpoint`.
3. `SimulatorContext` + types.
4. `/simulator` page + 7 components.
5. Nav item + Action page summary embed.
6. Smoke test: generate cards → commit → simulate checkpoint completion → see learning appear.

Reply **approve** to build, or tell me what to change.