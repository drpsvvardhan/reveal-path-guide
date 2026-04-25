// ============================================================================
// src/lib/sampleManifestPreview.ts
// ----------------------------------------------------------------------------
// Realistic mock manifest used by the /manifest-preview "Load sample" button.
// All optional sections are populated so reviewers can see every renderer.
// Plain object — typed loosely so the previewer's zod schema is the source
// of truth (not the production PatientRevealManifest interface).
// ============================================================================

export const sampleManifestPreview = {
  schema_version: "1.0.0",
  patient: {
    id: "demo-001",
    firstName: "Sample Patient",
    age: 47,
    sex: "Female",
  },
  todayBar: {
    focus: "Stabilizing inflammatory load",
    keyAction: "Take vitamin D 5000 IU with breakfast",
    nextCheckpoint: "Lab redraw scheduled in 14 days",
    statusNote: "Day 12 of the 30-day reset phase — staying the course.",
    lastUpdated: "Updated 1 hour ago",
  },
  weeklySnapshot: {
    keyImprovement: "Morning energy up — 3 fewer afternoon crashes this week",
    fragileArea: "Sleep latency still 35+ minutes on average",
    keepDoing: "Daily 25-minute walk after lunch is supporting glucose control",
    periodLabel: "Based on the last 14 days",
  },
  studyOverview: {
    summary:
      "We reviewed bloodwork, genomic variants, gut microbiome, metabolic markers, and lifestyle patterns to build a single coherent picture.",
    statLine: "5 layers analyzed · 132 biomarkers reviewed · 3 root patterns identified",
    layers: [
      {
        id: "bloodwork",
        icon: "🩸",
        title: "Advanced Bloodwork",
        description: "CBC, CMP, lipid panel, hs-CRP, ferritin, vitamin D, B12, homocysteine.",
        status: "complete" as const,
      },
      {
        id: "genomics",
        icon: "🧬",
        title: "Genomic Variants",
        description: "MTHFR, COMT, APOE, GST family, CYP-related SNPs.",
        status: "complete" as const,
      },
      {
        id: "microbiome",
        icon: "🦠",
        title: "Gut Microbiome",
        description: "Diversity index, Akkermansia, Faecalibacterium, zonulin marker.",
        status: "complete" as const,
      },
      {
        id: "metabolic",
        icon: "⚡",
        title: "Metabolic Function",
        description: "Fasting glucose, HbA1c, HOMA-IR, post-prandial response.",
        status: "complete" as const,
      },
      {
        id: "lifestyle",
        icon: "🌙",
        title: "Sleep & Stress Patterns",
        description: "Wearable HRV, sleep stages, cortisol diurnal slope.",
        status: "in-progress" as const,
      },
    ],
  },
  patientThesis: {
    title:
      "A slow inflammatory loop is driving energy, focus, and sleep symptoms — and the loop is reversible.",
    body: "Three patterns connect: low-grade gut inflammation is keeping the immune system mildly activated, which is depleting nutrient cofactors and disrupting sleep architecture. None of these are advanced; they reinforce each other. The plan addresses the root of the loop first, then layers in supportive interventions.",
  },
  layerFindings: {
    bloodwork:
      "hs-CRP 4.8 mg/L (elevated). Vitamin D 22 ng/mL (low). B12 410 pg/mL (borderline). Ferritin 180 ng/mL (high-normal).",
    genomics:
      "MTHFR C677T heterozygous. COMT Val/Met. No APOE4 copies.",
    microbiome:
      "Reduced Akkermansia. Elevated zonulin suggests increased intestinal permeability.",
    metabolic:
      "Fasting glucose 96 mg/dL. HbA1c 5.6%. HOMA-IR 2.4 — early insulin resistance.",
    lifestyle:
      "Average sleep 6.1h. HRV trending down on poor-sleep nights.",
  },
  helpingVsFeeding: {
    helping: [
      { label: "Daily 25-minute walk after lunch", mechanism: "Improves post-prandial glucose clearance and vagal tone." },
      { label: "Mediterranean-style meals", mechanism: "Polyphenols and fiber support gut barrier and reduce systemic inflammation." },
      { label: "Magnesium glycinate at night", mechanism: "Supports GABA tone and sleep onset." },
    ],
    feeding: [
      { label: "Late-evening snacking", mechanism: "Disrupts overnight glucose stability and delays melatonin onset." },
      { label: "Three+ alcoholic drinks per week", mechanism: "Impairs sleep architecture and increases gut permeability." },
      { label: "Skipping breakfast on workdays", mechanism: "Drives an exaggerated cortisol curve and afternoon crashes." },
    ],
  },
  symptomBridges: [
    "Fatigue connects to gut inflammation via cytokine load on mitochondria.",
    "Brain fog connects to B12 borderline status and disrupted sleep.",
    "Afternoon energy crashes connect to insulin variability after refined-carb lunches.",
  ],
  reversibility: {
    weeks: [
      "Vitamin D status with daily 5000 IU dosing.",
      "Sleep onset latency with consistent 10:30pm wind-down.",
    ],
    months: [
      "hs-CRP downward trend with reduced alcohol and improved sleep.",
      "HOMA-IR improvement with post-meal walks.",
    ],
    slow: [
      "Akkermansia repopulation with sustained polyphenol intake.",
    ],
    permanent: [
      "MTHFR genotype is fixed — managed via methylated folate, not reversed.",
    ],
    closingLine: "Most of the visible symptom load sits in the weeks-to-months bucket.",
  },
  confidenceBreakdown: {
    confident: [
      "Vitamin D deficiency",
      "Early insulin resistance",
      "Sleep-onset disruption",
    ],
    investigating: [
      "Underlying cause of elevated zonulin",
      "Cortisol diurnal slope",
    ],
    retest: [
      "hs-CRP in 8 weeks",
      "Vitamin D in 12 weeks",
      "HOMA-IR in 12 weeks",
    ],
  },
  careMap: {
    medications: [
      { name: "Vitamin D3", dose: "5000 IU daily", purpose: "Restore 25-OH vitamin D to >40 ng/mL.", notes: "Take with a fat-containing meal." },
      { name: "Methylated B-complex", dose: "1 cap daily", purpose: "Support methylation given MTHFR variant." },
      { name: "Magnesium glycinate", dose: "300 mg at night", purpose: "Sleep onset and muscle relaxation." },
    ],
    checkpoints: [
      { label: "Coaching call", date: "Day 14", description: "Review sleep and meal timing adherence.", owner: "Health coach", checking: "Sleep diary + glucose log", whyItMatters: "Behavior is the lever this month." },
      { label: "Lab redraw", date: "Day 30", description: "hs-CRP, vitamin D, fasting insulin.", owner: "Primary care", checking: "Inflammation and metabolic markers" },
      { label: "Plan update", date: "Day 35", description: "Adjust plan based on labs and self-report." },
    ],
    responsibilities: [
      { who: "Patient", tasks: ["Take supplements daily", "Keep sleep diary", "Walk after lunch 5×/week"] },
      { who: "Health coach", tasks: ["Weekly check-in", "Adjust behavioral targets", "Surface adherence blockers"] },
      { who: "Primary care", tasks: ["Order labs at day 30", "Review trend and prescribe follow-ups"] },
    ],
  },
  patientJourney: {
    currentPhase: "Day 12 of the 30-day reset phase",
    nextStep: "Lab redraw on Day 30 — hs-CRP, vitamin D, fasting insulin",
    timeline: [
      {
        dateLabel: "Day -14",
        title: "Initial intake",
        description: "Symptom history, lifestyle baseline, and goals captured.",
        status: "complete" as const,
        icon: "📝",
      },
      {
        dateLabel: "Day -7",
        title: "Baseline labs drawn",
        description: "CBC, CMP, lipid, hs-CRP, vitamin D, B12, HbA1c, fasting insulin.",
        status: "complete" as const,
        icon: "🩸",
      },
      {
        dateLabel: "Day 0",
        title: "Plan kickoff",
        description: "Patient thesis reviewed; supplements and behavioral targets started.",
        status: "complete" as const,
        icon: "🚀",
      },
      {
        dateLabel: "Day 12",
        title: "Mid-phase check-in",
        description: "Adherence review with health coach; sleep diary inspection.",
        status: "current" as const,
        icon: "📍",
      },
      {
        dateLabel: "Day 30",
        title: "Lab redraw",
        description: "Repeat hs-CRP, vitamin D, fasting insulin to measure inflection.",
        status: "upcoming" as const,
        icon: "🧪",
      },
      {
        dateLabel: "Day 35",
        title: "Plan update",
        description: "Adjust the plan based on labs and self-report.",
        status: "upcoming" as const,
        icon: "🗺️",
      },
    ],
  },
};