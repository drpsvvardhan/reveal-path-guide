
# Precision Perturbation Engine v2 — Vertical Slice

Additive upgrade on top of today's Simulator. No deploy/publish. No removal of AAE/EAE/PME gates or `patient_safe` filtering. Reveal design language preserved.

## 1. Data model (reversible migration)

New tables (all with GRANT + RLS + `service_role` grants):

- **`simulator_experiment_protocols`** — one row per experiment, joined 1:1 to `simulator_experiments.id`.
  - `protocol_version` (int), `hypothesis_question` (text)
  - `perturbation_category` (enum text: food|sleep|movement|stress|timing|recovery)
  - `intervention` jsonb: `{ dose, intensity, duration_min, timing, frequency }`
  - `primary_outcome` jsonb: `{ source, name, unit, direction: "increase"|"decrease"|"stabilize", cadence: "daily"|"per_session"|"weekly" }`
  - `secondary_outcomes` jsonb[], `hold_stable` text[], `allowed_cointerventions` text[]
  - `run_in_days`, `intervention_days`, `washout_days` (nullable), `crossover` jsonb (nullable)
  - `min_observations_per_phase`, `min_adherence_pct`
  - `stop_criteria` text[], `contraindications` text[], `clinician_review_required` bool
  - `expected_direction` text (never magnitude)
  - `admission_verdict`, `admission_reasons` jsonb, `evidence_refs` jsonb
  - timestamps

- **`simulator_daily_observations`** — immutable append-only per-day rows.
  - `experiment_id`, `user_id`, `phase` (run_in|intervention|washout|crossover_a|crossover_b)
  - `observed_on` date, `logged_at` timestamptz
  - `intervention_performed` bool, `actual_dose` jsonb, `actual_time` time, `actual_duration_min` int
  - `primary_value` numeric, `secondary_values` jsonb
  - `sleep_hours` numeric, `sleep_quality` int, `energy` int, `recovery` int, `symptom` int
  - `confounders` jsonb `{ illness, travel, alcohol, unusual_stress, diet_deviation, med_change, other }`
  - `note` text

- **`simulator_experiment_comparisons`** — deterministic comparator output.
  - `experiment_id`, `phase_a`, `phase_b` (e.g. run_in vs intervention)
  - `n_a`, `n_b`, `median_a`, `median_b`, `abs_change`, `pct_change`, `direction_consistency_pct`, `overlap_ratio`, `adherence_pct`, `missingness_pct`, `confounder_burden`
  - `result` text (SIGNAL_DETECTED | POSSIBLE_SIGNAL | NO_DETECTABLE_SIGNAL | NOT_INTERPRETABLE | STOPPED_FOR_SAFETY)
  - `reasons` jsonb, `human_summary` text (LLM-explained, not LLM-decided)
  - `computed_at`

Additive columns:
- `simulator_experiments`: `phase text` (draft|run_in|intervention|washout|crossover|ready_to_compare|completed|stopped|not_interpretable), `phase_started_at`, `run_in_started_at`, `intervention_started_at`, `stopped_reason`.
- `simulator_learnings`: `status text` (provisional|replicated|refuted|inconclusive|superseded), `cycle_count int default 1`, `replicated_by_experiment_id uuid`.
- `simulator_what_if_cards`: `protocol_template jsonb`, `primary_outcome jsonb`, `perturbation_category text`.

## 2. Edge functions

- **`simulate-what-if` (edit)** — abstain when no patient-bound, measurable, interpretable hypothesis exists (return zero cards + `abstain_reason`). Every emitted card carries `protocol_template`, `primary_outcome`, `perturbation_category`. Medication/supplement/fasting/high-risk exercise → `patient_safe=false`.
- **`design-experiment-protocol` (new)** — validates a proposed protocol, checks patient-bound outcome availability, runs AAE/EAE admission, writes `simulator_experiment_protocols` + creates `simulator_experiments` in `phase=draft`. Returns missing-field list on failure.
- **`start-experiment-phase` (new)** — transitions phases (draft→run_in→intervention→…). Enforces phase-min days and observation floors.
- **`compare-experiment-phases` (new, deterministic)** — pure TS comparator over `simulator_daily_observations`. No LLM in the decision. Writes `simulator_experiment_comparisons`, updates phase to `completed|not_interpretable|stopped`. Result rules:
  - `adherence_pct < min_adherence_pct` OR `n_intervention < min_observations` OR `confounder_burden ≥ 30%` → **NOT_INTERPRETABLE**
  - non-overlapping medians in desired direction, direction_consistency ≥ 70%, ≥ min obs both phases → **SIGNAL_DETECTED**
  - direction matches but overlap high or consistency 50–70% → **POSSIBLE_SIGNAL**
  - direction consistency < 50% or |pct_change| small with heavy overlap → **NO_DETECTABLE_SIGNAL**
  - any stop-criteria hit → **STOPPED_FOR_SAFETY**
  - Optional LLM `explain-comparison` may narrate the result but cannot alter it.
- **`checkpoint-comparator` (existing)** — untouched; remains the slow lab evidence layer.

## 3. Frontend (Simulator section only)

- `SimulatorContext`: add `protocols`, `dailyObservations`, `comparisons`; new actions `designProtocol`, `logDailyObservation`, `advancePhase`, `comparePhases`, `markProvisional`, `replicateExperiment`.
- Replace `WhatIfCard` primary CTA "Run this experiment" → **"Design this experiment"**.
- New `ProtocolBuilderModal` — stepper: Hypothesis → Perturbation → Primary/Secondary outcomes → Run-in/Intervention/Washout → Adherence & stop criteria → Review & confirm. Blocks confirm when required fields or bound outcomes missing.
- New `PhasedTimelineStrip` on `ExperimentCard` — pill row for DRAFT→RUN_IN→INTERVENTION→(WASHOUT)→READY_TO_COMPARE→COMPLETED/STOPPED/NOT_INTERPRETABLE.
- New `DailyCheckInCard` — appears in Simulator section for any active experiment with a check-in due today. Only shows protocol-required fields.
- New `ComparisonResultPanel` — replaces the current single-value verdict UI. Shows medians, overlap, direction consistency, adherence, missingness, confounders, and a human-language uncertainty line.
- Graduation gate: `Graduate` disabled until `cycle_count ≥ 2` (replication) OR clinician approval recorded via existing admin view-as authorization.
- Admin/view-as clinician surface: full protocol, admission verdict + reasons, blocked/unbound cards list, contraindications, stop criteria, adherence, deterministic comparison details. Uses existing role check — no new bypass.
- UI copy replaced with "What are we trying to learn about you?", "What changed?", "Was the experiment interpretable?", "What did we learn — and how certain are we?".

## 4. Demo experiment

Dev-only seeded protocol (behind an `import.meta.env.DEV` guard, not auto-prescribed):
> "Does morning vs late-afternoon resistance training improve this individual's session performance and next-day recovery without worsening sleep?"

5-day run-in, 14-day alternating AM/PM intervention. Primary: session RPE-adjusted work (manual entry). Secondary: next-day recovery, sleep quality. Confounders per schema.

## 5. Verification (no deploy)

- `tsgo` type-check, `bunx vitest run` on new comparator (`supabase/functions/compare-experiment-phases/comparator.test.ts`) with fixtures for each of the 5 result states.
- Playwright headless (localhost) flow on demo user: card → design protocol → start run-in → seed 5 daily obs → advance to intervention → seed 10 daily obs → compare → provisional learning row appears → graduation still blocked.
- Second fixture: low adherence + heavy confounders → asserts `NOT_INTERPRETABLE`, not `NO_DETECTABLE_SIGNAL`.
- SQL check: a card with `patient_safe=false` never appears in the patient query.

## Files touched (net)

New:
- `supabase/migrations/<ts>_ppe_v2_slice.sql`
- `supabase/functions/design-experiment-protocol/index.ts`
- `supabase/functions/start-experiment-phase/index.ts`
- `supabase/functions/compare-experiment-phases/index.ts` (+ `comparator.ts`, `comparator.test.ts`)
- `src/components/simulator/ProtocolBuilderModal.tsx`
- `src/components/simulator/PhasedTimelineStrip.tsx`
- `src/components/simulator/DailyCheckInCard.tsx`
- `src/components/simulator/ComparisonResultPanel.tsx`
- `src/components/simulator/ClinicianReviewPanel.tsx`
- `src/lib/ppe/comparator.ts` (shared client-side types)
- `scripts/seed-ppe-demo.ts`

Edited:
- `supabase/functions/simulate-what-if/index.ts` (abstain + protocol_template)
- `src/context/SimulatorContext.tsx`
- `src/components/simulator/WhatIfCard.tsx`
- `src/components/simulator/ExperimentCard.tsx`
- `src/components/sections/SimulatorSection.tsx`

Untouched: AAE / EAE / PME modules, patient-chat, terrain, CIE, action plan, care map, RAE.

## Non-goals for this slice

- No population recommendations.
- No LLM decides efficacy.
- No auto-prescribed morning-vs-afternoon RT; demo only.
- No changes to existing lab checkpoint comparator.
- No deploy or publish.

## Assumptions to confirm

- The additive-migration approach (separate protocol/observations/comparisons tables) is preferred over stuffing JSONB into `simulator_experiments`. Say the word if you'd rather keep it single-table.
- Daily check-in lives inside the Simulator section (not on Journey/Today). Confirm if you want a Today-bar nudge as well.
- "Clinician approval" for graduation uses existing admin view-as role — no new signing surface in this slice.
