# Reveal Path

**A patient-facing clinical reasoning workspace that treats biology as a trajectory, not a snapshot.**

Reveal Path is the consumer surface of the Vizzhy Bio Intelligence platform. It helps patients convert their lab reports, body composition scans, elastography readings, and self-reported context into a structured longitudinal biological picture — then share that picture with clinicians in a form that supports real conversation, not just data transfer.

---

## What this system actually is

Most health apps show you a dashboard of your latest labs. Reveal Path does something different.

It takes every report you've ever had (across labs, years, and vendors), extracts every biomarker with its unit normalized to a canonical form, reconstructs the trajectory of each biomarker through time, and surfaces the contradictions across layers — where your blood chemistry disagrees with your body composition, where your symptoms disagree with your biomarkers, where one year's reading disagrees with the next.

The system is built on the thesis that biology is path-dependent — that what happens to you depends on where you've been, not just where you are right now. Standard medicine applies population statistics to individual bodies and calls the result personalized care. Reveal Path reconstructs the individual trajectory and treats cross-layer contradictions as the primary diagnostic signal.

This matters because the most important findings in a real medical workup are usually not visible in any single lab draw. They show up as trajectories: the insulin that tripled over three years while glucose stayed normal, the mercury that accumulated while the patient changed nothing in their diet, the inflammation that resolved after a lifestyle change the patient forgot to mention. Reveal Path makes these legible.

---

## Who it's for

Reveal Path has three user surfaces:

**Patients** upload their reports, complete a structured intake (the Clinical Intake Evaluation, or CIE), and see their own biological terrain rendered as a navigable workspace. They can queue questions for upcoming clinical visits and generate shareable summaries for their clinicians.

**Clinicians** receive a compressed handoff object — terrain overview, axis breakdown, perception gaps, and suggested questions — rather than a raw data dump. The goal is to give the clinician in the next encounter something they can actually use in fifteen minutes.

**Administrators and reviewers** triage observations the system's language model couldn't confidently classify, accept or correct the classification, and propose new concepts for the biomarker ontology. This human-in-the-loop step is what turns the system into a continuously improving knowledge base rather than a static extraction pipeline.

---

## The core loop

Every piece of the system exists to serve a single grammar:

```
patient data in
    → structured extraction (LLM-driven, against a biomarker ontology)
        → canonicalization and unit normalization at ingest
            → trajectory reconstruction across time
                → contradiction detection across layers
                    → shareable clinical artifact
                        → clinician-informed next action
                            → patient reflection and re-engagement
                                → more data in (loop)
```

The system's defensibility lives in two places: the ontology that grows through human review (each correction makes future extractions better), and the architectural commitment to preserving trajectories rather than collapsing them into snapshots.

---

## What's in this repository

This repo contains the patient-facing and administrative web application — the surface layer of the system. It includes:

- **Patient workspace** — onboarding, CIE assessment, lab upload, intake narrative, terrain rendering, records view, question queue
- **Clinician handoff pages** — token-gated shareable views for the next encounter
- **Administrative review queue** — the human-in-the-loop correction surface for low-confidence LLM extractions
- **CELF export adapter** — packages a patient's full longitudinal record into a canonical JSON bundle consumed by the downstream BioTwin generator

The BioTwin generator itself, the Cardiac Canon / terrain modeling engine, and the ontology governance pipeline live in separate repositories.

---

## How the data flows

1. A patient uploads a lab PDF, InBody scan, or FibroScan report.
2. An edge function routes the file to Gemini 2.5 Flash with the biomarker ontology injected as a constrained vocabulary.
3. Gemini extracts each observation, classifies it against the ontology, converts source units to canonical units, and emits a confidence score per observation.
4. Observations with confidence at or above 0.80 are written directly to the patient record. Lower-confidence observations are queued for human review.
5. Reviewers in the admin queue accept, correct, or reject each queued observation. Corrections update the canonical fields; new concepts the LLM proposed get queued for the next ontology version.
6. On demand, the CELF export adapter assembles the patient's full record into a canonical bundle — subject, source documents, observations, feature state, timelines, identity audit — at the versioned ontology contract.
7. The bundle feeds the BioTwin generator, which produces the terrain state a clinician or patient navigates.

All identity-sensitive surfaces (view-as admin impersonation, cross-patient data access, shareable token generation) are gated server-side with audited sessions and row-level security. The frontend never unilaterally decides whose data to read.

---

## What's production, what's experimental

Production-ready:
- Patient authentication and profile management
- Lab/InBody/FibroScan upload and extraction pipeline (LLM-canonicalized)
- Biomarker ontology v1.0 (173 concepts, versioned)
- CELF bundle export with subject identity gate and view-as audit trail
- Administrative observation review queue
- Admin view-as with server-enforced, audited, time-bounded sessions

Pilot:
- Terrain render and cross-layer contradiction display
- Clinician share pages (token-gated handoff)
- Shareable question queue

Internal/experimental:
- Continuous ontology proposal pipeline
- Direct-to-BioTwin push from the bundle
- 300-patient cardiac cohort instrumentation

---

## Running it locally

This is a Vite + React + TypeScript application backed by Supabase (Postgres, Auth, Storage, Edge Functions).

```bash
# install
pnpm install

# set environment variables (see .env.example)
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_ANON_KEY=...

# run dev server
pnpm dev

# run type checks and linter
pnpm check
```

Supabase migrations are in `supabase/migrations/`. Apply them with the Supabase CLI or the Lovable deployment workflow. Edge functions are in `supabase/functions/` and deploy as individual Deno workers.

The biomarker ontology is hosted in a public Supabase Storage bucket at `ontology/biomarker_ontology.json`. Edge functions fetch it at invocation time rather than bundling it, so ontology updates can be rolled out without redeploying functions.

---

## Further reading

- [`architecture.md`](./architecture.md) — deeper architectural map of the system, data model, and trust boundaries
- [Vizzhy platform documentation](../) — the broader non-ergodic biological intelligence thesis, BioTwin generator, Cardiac Canon, and Compendium volumes live in the platform repository

---

## License and use

Reveal Path is proprietary software developed by Vizzhy Bio Intelligence. It is not currently open source. All clinical data handled by the system is treated as protected health information; contributors should consult the governance documentation before making changes that touch patient data surfaces.
