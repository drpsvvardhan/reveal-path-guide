import { PatientRevealManifest } from "@/types/manifest";

export const sampleManifest: PatientRevealManifest = {
  patient: {
    id: "pt-001",
    firstName: "Maria",
    age: 54,
    sex: "Female",
  },
  studyOverview: {
    summary:
      "We analyzed your bloodwork, genetic markers, gut microbiome, metabolic panel, and lifestyle patterns to build a complete picture of what's driving your symptoms.",
    statLine: "5 layers analyzed · 127 biomarkers reviewed · 3 root patterns identified",
    layers: [
      {
        id: "bloodwork",
        icon: "🩸",
        title: "Advanced Bloodwork",
        description: "Complete metabolic panel, inflammatory markers, hormone levels, and nutrient status.",
        status: "complete",
      },
      {
        id: "genomics",
        icon: "🧬",
        title: "Genomic Variants",
        description: "Key SNPs affecting methylation, detoxification, and inflammation pathways.",
        status: "complete",
      },
      {
        id: "microbiome",
        icon: "🦠",
        title: "Gut Microbiome",
        description: "Stool analysis showing bacterial diversity, dysbiosis markers, and gut permeability indicators.",
        status: "complete",
      },
      {
        id: "metabolic",
        icon: "⚡",
        title: "Metabolic Function",
        description: "Insulin sensitivity, mitochondrial markers, and energy metabolism assessment.",
        status: "complete",
      },
      {
        id: "lifestyle",
        icon: "🌙",
        title: "Sleep & Stress Patterns",
        description: "Wearable data integration and cortisol rhythm analysis.",
        status: "pending",
      },
    ],
  },
  patientThesis: {
    title: "Your body is caught in a slow inflammatory loop that's draining your energy and clouding your thinking.",
    body: "Three interconnected patterns are driving most of your symptoms: chronic low-grade gut inflammation is triggering systemic immune activation, which is disrupting your hormone balance and depleting key nutrients your brain and mitochondria need. This isn't one thing going wrong — it's a cascade. The good news is that the root of this cascade is addressable, and several of these patterns are already showing early signs of reversibility.",
  },
  layerFindings: {
    bloodwork: "Elevated hs-CRP and ferritin suggest ongoing systemic inflammation. Vitamin D is critically low at 18 ng/mL. B12 is borderline despite supplementation, suggesting absorption issues.",
    genomics: "MTHFR C677T heterozygous variant affecting folate metabolism. COMT Val/Met variant influencing estrogen clearance. No APOE4 copies.",
    microbiome: "Reduced Akkermansia and Faecalibacterium. Elevated Prevotella ratio. Zonulin elevated suggesting increased intestinal permeability.",
    metabolic: "HOMA-IR of 3.2 indicates early insulin resistance. Fasting glucose normal but post-prandial glucose elevated. CoQ10 below optimal range.",
  },
  helpingVsFeeding: {
    helping: [
      { label: "Your Mediterranean-style diet", mechanism: "Provides anti-inflammatory polyphenols and fiber that support gut barrier integrity." },
      { label: "Regular walking habit", mechanism: "Gentle movement improves insulin sensitivity and supports lymphatic drainage." },
      { label: "Magnesium supplementation", mechanism: "Supporting over 300 enzymatic reactions and helping with sleep quality." },
      { label: "Strong social connections", mechanism: "Reduces cortisol burden and supports immune regulation through oxytocin pathways." },
    ],
    feeding: [
      { label: "Evening wine habit", mechanism: "Alcohol disrupts gut barrier, increases endotoxin translocation, and impairs liver detoxification of estrogen metabolites." },
      { label: "Late-night eating pattern", mechanism: "Eating within 2 hours of sleep disrupts circadian insulin signaling and reduces overnight cellular repair." },
      { label: "Chronic sleep debt", mechanism: "Less than 6 hours consistently elevates inflammatory cytokines and impairs glymphatic brain clearance." },
      { label: "Unfiltered water source", mechanism: "Potential exposure to endocrine-disrupting compounds that may worsen hormone imbalance." },
    ],
  },
  symptomBridges: [
    "Your afternoon brain fog likely traces back to post-meal glucose spikes combined with neuroinflammation from gut-derived endotoxins crossing into circulation.",
    "The persistent fatigue isn't just 'getting older' — it maps directly to mitochondrial nutrient depletion (CoQ10, B vitamins) and early insulin resistance.",
    "Your joint stiffness in the morning correlates with elevated inflammatory markers, not structural joint damage — this is systemic, not mechanical.",
    "The difficulty losing weight despite eating well connects to insulin resistance and disrupted cortisol patterns, which shift your metabolism toward fat storage.",
    "Sleep disruptions are being amplified by both the gut-brain inflammatory axis and declining progesterone levels typical of perimenopause.",
  ],
  reversibility: {
    weeks: [
      "Brain fog intensity — often improves within 2–3 weeks of dietary and sleep changes",
      "Energy levels — early gains from nutrient repletion and blood sugar stabilization",
      "Morning joint stiffness — typically responds quickly to anti-inflammatory interventions",
    ],
    months: [
      "Gut barrier integrity — zonulin levels usually normalize within 2–4 months",
      "Insulin sensitivity — HOMA-IR can improve significantly with sustained lifestyle shifts",
      "Sleep architecture — deeper sleep patterns re-establish as inflammation recedes",
    ],
    slow: [
      "Microbiome diversity — rebuilding a healthy ecosystem takes 6–12 months of consistent effort",
      "Hormone rebalancing — estrogen metabolism optimization is gradual and layered",
      "Mitochondrial function — CoQ10 and NAD+ recovery is a slow but measurable process",
    ],
    permanent: [
      "MTHFR variant — genetic, requires ongoing methylfolate support rather than reversal",
      "Perimenopause trajectory — natural progression, but symptoms can be dramatically managed",
    ],
    closingLine: "Most of what's driving your symptoms today is modifiable. The goal isn't perfection — it's interrupting the cascade.",
  },
  sequencedActions: {
    startHere: {
      title: "Heal the gut barrier first",
      description: "Begin a 30-day gut repair protocol focusing on removing inflammatory triggers and rebuilding intestinal lining integrity.",
      details: "Eliminate alcohol and processed foods for 30 days. Add L-glutamine (5g/day), zinc carnosine, and a targeted probiotic with Akkermansia support.",
    },
    thenAdd: [
      {
        title: "Optimize nutrient repletion",
        description: "Address the critical vitamin D, B12, and CoQ10 deficiencies identified in your bloodwork.",
      },
      {
        title: "Stabilize blood sugar patterns",
        description: "Implement time-restricted eating (12-hour window) and protein-first meals to improve insulin sensitivity.",
      },
      {
        title: "Support sleep architecture",
        description: "Establish a consistent 10pm wind-down protocol and add targeted magnesium glycinate before bed.",
      },
    ],
    notYet: [
      {
        title: "Hormone replacement therapy",
        description: "May be beneficial but should wait until inflammation is reduced.",
        why: "Starting HRT with active gut inflammation can amplify estrogen recirculation and worsen symptoms.",
        unlockedWhen: "After 3 months of gut healing and confirmed reduction in inflammatory markers.",
        unlockedBy: "Dr. Patel, after follow-up bloodwork review.",
      },
      {
        title: "Intensive exercise program",
        description: "High-intensity training could be counterproductive right now.",
        why: "With current cortisol patterns and mitochondrial depletion, intense exercise may increase oxidative stress.",
        unlockedWhen: "After CoQ10 levels normalize and sleep improves consistently.",
        unlockedBy: "Your care coach, based on wearable recovery data.",
      },
    ],
  },
  doctorQuestions: [
    {
      question: "Given my elevated hs-CRP and gut permeability markers, would you consider a short course of low-dose naltrexone to help modulate the inflammatory response?",
      rationale: "LDN has shown promise in reducing systemic inflammation driven by gut-immune axis dysfunction, and your profile fits the pattern where it's most studied.",
    },
    {
      question: "My MTHFR variant may be affecting B12 absorption — can we trial methylcobalamin injections instead of oral supplementation?",
      rationale: "Your borderline B12 despite oral supplementation, combined with the MTHFR variant, suggests a methylation bottleneck that bypassing the gut could resolve.",
    },
    {
      question: "Would it make sense to run a DUTCH test before considering any hormone support, given the COMT variant affecting estrogen clearance?",
      rationale: "The DUTCH test maps estrogen metabolite pathways and would show whether your body is clearing estrogen safely — important context before any HRT discussion.",
    },
  ],
  monitoringPlan: [
    { name: "hs-CRP", explanation: "Tracks systemic inflammation — our primary signal that the gut healing protocol is working.", nextCheck: "8 weeks" },
    { name: "Zonulin", explanation: "Measures gut permeability — should decrease as barrier integrity improves.", nextCheck: "12 weeks" },
    { name: "HOMA-IR", explanation: "Insulin resistance marker — expect improvement with dietary changes.", nextCheck: "12 weeks" },
    { name: "Vitamin D (25-OH)", explanation: "Must reach 40–60 ng/mL for optimal immune and metabolic function.", nextCheck: "8 weeks" },
    { name: "Complete microbiome panel", explanation: "Re-assess bacterial diversity and Akkermansia levels after protocol.", nextCheck: "16 weeks" },
  ],
  expectedProgress: {
    weeks2: "You may notice slightly more energy in the afternoons and less morning stiffness. Sleep may feel lighter initially as your body adjusts to the new routine. Brain fog episodes may become shorter, though not yet less frequent.",
    months3: "Energy should be noticeably more stable throughout the day. Inflammatory markers typically show 30–50% improvement by now. Gut symptoms like bloating should be significantly reduced. Weight may begin to shift as insulin sensitivity improves.",
    months6: "Microbiome diversity begins measurably improving. Hormone-related symptoms typically stabilize. Cognitive clarity improvements become consistent rather than intermittent. This is when we reassess the HRT conversation with better data.",
    months12: "Full metabolic picture should show significant improvement. Most patients at this stage report feeling fundamentally different — not just better managed, but genuinely well. Long-term monitoring cadence can likely shift to every 6 months.",
  },
  confidenceBreakdown: {
    confident: [
      "Gut inflammation is a primary driver of your systemic symptoms — supported by zonulin, hs-CRP, and microbiome data converging.",
      "Nutrient depletion (D, B12, CoQ10) is real and contributing to fatigue and cognitive symptoms.",
      "Insulin resistance is early-stage and highly reversible with lifestyle intervention.",
      "The MTHFR variant is affecting your methylation efficiency and nutrient processing.",
    ],
    investigating: [
      "Whether the gut permeability is driving the insulin resistance, or vice versa — the treatment approach covers both, but causality matters for long-term strategy.",
      "The degree to which perimenopause hormonal shifts are independent of vs. amplified by the inflammatory state.",
      "Whether your sleep disruption is primarily inflammatory, hormonal, or behavioral in origin.",
    ],
    retest: [
      "Thyroid function — your TSH was normal-range but we'd like to see free T3 and reverse T3 to rule out subclinical conversion issues.",
      "Iron studies — ferritin is elevated (likely inflammatory), but we should confirm iron saturation is adequate for energy production.",
      "Cortisol rhythm — a 4-point salivary cortisol would clarify whether adrenal patterns are contributing to your energy crashes.",
    ],
  },
  careMap: {
    medications: [
      { name: "Vitamin D3", purpose: "Replete critically low levels to support immune regulation", dose: "5,000 IU daily with fat-containing meal", notes: "Recheck at 8 weeks, adjust based on levels" },
      { name: "Methylfolate + Methylcobalamin", purpose: "Support methylation given MTHFR variant", dose: "1mg folate / 1mg B12 daily", notes: "Sublingual form preferred for better absorption" },
      { name: "CoQ10 (Ubiquinol)", purpose: "Support mitochondrial energy production", dose: "200mg daily", notes: "Take with breakfast for best absorption" },
      { name: "L-Glutamine", purpose: "Gut barrier repair support", dose: "5g powder daily in water", notes: "Part of the 30-day gut repair protocol" },
      { name: "Magnesium Glycinate", purpose: "Sleep support, enzymatic function, muscle relaxation", dose: "400mg before bed", notes: "Glycinate form chosen for calming effect" },
    ],
    checkpoints: [
      { label: "2-week check-in", date: "Week 2", description: "Brief coaching call to assess tolerance, adjust if needed." },
      { label: "8-week bloodwork", date: "Week 8", description: "Recheck hs-CRP, Vitamin D, basic metabolic panel." },
      { label: "12-week comprehensive", date: "Week 12", description: "Full re-evaluation: bloodwork, gut markers, symptom assessment. HRT discussion if appropriate." },
      { label: "16-week microbiome retest", date: "Week 16", description: "Repeat microbiome analysis to measure diversity recovery." },
      { label: "6-month review", date: "Month 6", description: "Comprehensive progress review with full team. Adjust long-term strategy." },
    ],
    responsibilities: [
      { who: "You", tasks: ["Follow the gut repair protocol for 30 days", "Take supplements as directed", "Track energy, sleep, and symptoms in the app", "Attend scheduled check-ins"] },
      { who: "Dr. Patel", tasks: ["Review bloodwork results at each checkpoint", "Manage medication decisions", "Evaluate HRT readiness at 12 weeks", "Coordinate with specialist referrals if needed"] },
      { who: "Care Coach (Jamie)", tasks: ["Weekly check-in calls for first 8 weeks", "Help troubleshoot dietary transitions", "Monitor wearable data trends", "Coordinate scheduling and follow-ups"] },
    ],
  },
  careTeam: {
    physician: {
      name: "Dr. Anita Patel",
      role: "Primary Physician",
      specialty: "Functional & Integrative Medicine",
      contact: "Secure message via portal",
    },
    coach: {
      name: "Jamie Torres",
      role: "Care Coach",
      specialty: "Nutrition & Lifestyle Medicine",
      contact: "Direct message or call",
    },
    appointments: [
      { type: "Coaching Call", date: "In 5 days", provider: "Jamie Torres", notes: "Review first week of gut repair protocol" },
      { type: "Bloodwork", date: "In 8 weeks", provider: "Quest Diagnostics", notes: "Fasting required — morning appointment recommended" },
      { type: "Physician Review", date: "In 12 weeks", provider: "Dr. Anita Patel", notes: "Comprehensive review — plan 45 minutes" },
      { type: "Telemedicine Follow-up", date: "In 16 weeks", provider: "Dr. Anita Patel", notes: "Microbiome results review and next phase planning" },
    ],
  },
  coach: {
    starterQuestions: [
      "Why do I feel worse in the afternoon specifically?",
      "Is it safe to keep exercising while my gut is healing?",
      "What should I eat during the 30-day gut repair protocol?",
      "How will I know if the supplements are actually working?",
      "Can I still drink coffee during the protocol?",
      "What happens if I can't give up wine for 30 days?",
    ],
  },
};
