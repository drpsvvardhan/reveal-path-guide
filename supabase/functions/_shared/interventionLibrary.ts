// ─── Intervention Library v1 ───
// Canonical mapping from derivation rules, gate findings, and biomarker conditions
// to specific, actionable interventions. This is deterministic — no LLM involvement.

export type StateCoordinate = "E" | "I" | "V" | "R" | "Σ";
export type InterventionCategory = "nutrition" | "supplementation" | "movement" | "sleep" | "stress" | "monitoring";

// ── Policy classification ──
// Tags every intervention with the clinical-authority class it occupies.
// Constitutional Anchor 1 forbids Core mode from carrying entries whose
// class transfers clinical authority to the action plan itself.
export type InterventionPolicyClass =
  // Permitted in both Core and BioTwin+
  | "lifestyle"
  | "food_pattern"
  | "movement"
  | "sleep_circadian"
  | "stress_practice"
  | "tracking"
  | "retest"
  | "doctor_question"
  | "mechanism_education"
  // Forbidden in Core mode, permitted in BioTwin+
  | "supplement_with_dose"
  | "medication_change"
  | "titration"
  | "individualized_protocol";

export interface Intervention {
  id: string;
  trigger: {
    rule_ids?: string[];
    gate_conditions?: Array<{ gate: string; traffic_light: string }>;
    biomarker_conditions?: Array<{ name: string; operator: "<" | ">" | "<=" | ">="; value: number }>;
    domain_conditions?: Array<{ domain: string; operator: "<" | ">"; value: number }>;
  };
  what: string;
  why_template: string;
  how: string;
  coordinates: StateCoordinate[];
  gates: string[];
  retest_weeks: number;
  retest_markers: string[];
  contraindications: string[];
  category: InterventionCategory;
  sequence_priority: number;
  policy_class: InterventionPolicyClass;

  // ── Core-mode fields (interpreter voice) ──
  // Optional, terrain-oriented authoring of the same intervention.
  // Used by ActionSection when consumer_action_plan_mode === 'core'.
  // BioTwin+ rendering continues to use what/how unchanged.
  core_title?: string;
  core_rationale?: string;
  core_observation?: string;
  core_clinician_question?: string;
}

export const INTERVENTION_LIBRARY: Intervention[] = [
  // ── SUPPLEMENTATION ──
  {
    id: "vitamin_d_repletion_low",
    trigger: {
      biomarker_conditions: [{ name: "vitamin_d", operator: "<", value: 30 }],
      gate_conditions: [{ gate: "HPI", traffic_light: "YELLOW" }],
    },
    what: "Start Vitamin D3 5,000 IU daily with a fat-containing meal.",
    why_template: "Your Vitamin D at {vitamin_d} ng/mL sits below the range where muscle protein synthesis and immune regulation operate optimally. The regulatory axis depends on adequate D3 for calcium signaling, circadian gene expression, and immune tolerance.",
    how: "One softgel, taken with breakfast if it contains fat (eggs, avocado, butter, nuts), or with lunch otherwise. Daily without interruption. Do not take at bedtime — D3 can interfere with melatonin onset in some individuals.",
    coordinates: ["R", "I"],
    gates: ["HPI", "TIS"],
    retest_weeks: 8,
    retest_markers: ["25-OH Vitamin D"],
    contraindications: ["hypercalcemia", "sarcoidosis", "granulomatous disease"],
    category: "supplementation",
    sequence_priority: 2,
    policy_class: "supplement_with_dose",
    core_title: "Vitamin D as a regulatory signal in your terrain",
    core_rationale: "Vitamin D appears to be sitting below the range where regulatory and immune signaling tend to operate comfortably. The pattern is worth a closer look in conversation with your clinician.",
    core_observation: "Levels respond gradually. A repeat reading after a season of consistent sunlight, food, and any clinician-guided support tends to be more informative than a single number.",
    core_clinician_question: "What approach to vitamin D would make sense given my current level and the rest of my picture?",
  },
  {
    id: "magnesium_repletion",
    trigger: {
      biomarker_conditions: [{ name: "magnesium", operator: "<", value: 2.0 }],
      domain_conditions: [{ domain: "E13", operator: "<", value: 60 }],
    },
    what: "Start magnesium glycinate 200–400 mg before bed.",
    why_template: "Your sleep and circadian domain scored {E13_score}/100, and magnesium is a cofactor in over 300 enzymatic reactions including melatonin synthesis and GABA receptor activation. Low magnesium amplifies regulatory stress.",
    how: "200 mg magnesium glycinate (not oxide — glycinate is better absorbed and less likely to cause GI issues) 30–60 minutes before your target bedtime. If tolerated well for 1 week, increase to 400 mg. Take consistently.",
    coordinates: ["R", "E"],
    gates: ["BRI", "HPI"],
    retest_weeks: 6,
    retest_markers: ["RBC Magnesium", "serum magnesium"],
    contraindications: ["severe renal impairment", "myasthenia gravis"],
    category: "supplementation",
    sequence_priority: 3,
    policy_class: "supplement_with_dose",
    core_title: "Magnesium as a sleep and regulation signal",
    core_rationale: "Magnesium reads on the lower side, and your sleep-and-circadian patterns are also under some load. The two often move together, which makes this a useful signal to bring into a clinical conversation.",
    core_observation: "Notice whether sleep onset, depth, and morning energy seem to shift over several weeks of any approach you and your clinician decide on.",
    core_clinician_question: "Given my magnesium and sleep patterns, what approach would make sense for me?",
  },
  {
    id: "b12_repletion",
    trigger: {
      biomarker_conditions: [{ name: "vitamin_b12", operator: "<", value: 400 }],
    },
    what: "Start methylcobalamin (B12) 1,000 mcg sublingual daily.",
    why_template: "Your B12 at {vitamin_b12} pg/mL is below the functional threshold where methylation, nerve myelination, and red blood cell production operate efficiently. This affects both your energy coordinate and neurological regulation.",
    how: "One 1,000 mcg methylcobalamin sublingual tablet dissolved under the tongue each morning. Sublingual bypasses absorption issues common with oral tablets. Daily for 8 weeks, then retest.",
    coordinates: ["E", "R"],
    gates: ["CLI", "BRI"],
    retest_weeks: 8,
    retest_markers: ["Vitamin B12", "methylmalonic acid"],
    contraindications: [],
    category: "supplementation",
    sequence_priority: 4,
    policy_class: "supplement_with_dose",
    core_title: "B12 as an energy and methylation signal",
    core_rationale: "B12 sits below the range where methylation and energy pathways tend to feel resourced. Whether the level itself or absorption is the limiting factor is a clinical question worth asking.",
    core_observation: "B12 status often changes more slowly than people expect. A retest a couple of months into any approach gives the clearest picture.",
    core_clinician_question: "Given my B12 reading, what investigation or approach would you recommend?",
  },
  {
    id: "omega3_inflammation",
    trigger: {
      biomarker_conditions: [{ name: "hs_crp", operator: ">", value: 3.0 }],
      gate_conditions: [{ gate: "TIS", traffic_light: "ORANGE" }],
    },
    what: "Start omega-3 fatty acids (EPA+DHA) 2,000 mg daily with food.",
    why_template: "Your hs-CRP at {hs_crp} mg/L indicates systemic inflammatory tone above the threshold where tissue integrity is under chronic load. EPA and DHA compete with arachidonic acid in the inflammatory cascade, directly modulating the I coordinate.",
    how: "Look for a product listing EPA+DHA combined at 2,000 mg per serving (not total fish oil — the EPA+DHA content is what matters). Take with your largest meal for absorption. Triglyceride form absorbs better than ethyl ester.",
    coordinates: ["I", "V"],
    gates: ["TIS", "BCS"],
    retest_weeks: 12,
    retest_markers: ["hs-CRP", "omega-3 index"],
    contraindications: ["fish allergy", "bleeding disorder", "anticoagulant therapy"],
    category: "supplementation",
    sequence_priority: 3,
    policy_class: "supplement_with_dose",
    core_title: "Inflammatory tone as an emerging signal",
    core_rationale: "Your hs-CRP is running above the range where tissue-integrity signals tend to feel quiet. Background inflammation has many possible sources, and untangling which ones matter for you is worth a clinical conversation.",
    core_observation: "Inflammation markers move with sleep, food, infection, and recovery. A pattern across several readings tends to be more meaningful than any single number.",
    core_clinician_question: "Given my inflammatory pattern, which possible drivers would be worth exploring first?",
  },

  // ── NUTRITION ──
  {
    id: "protein_targeting_sarcopenia",
    trigger: {
      biomarker_conditions: [{ name: "skeletal_muscle_mass", operator: "<", value: 70 }],
      domain_conditions: [{ domain: "F16", operator: "<", value: 60 }],
    },
    what: "Increase daily protein intake to 1.2–1.6 g per kg of body weight, distributed across 3–4 meals.",
    why_template: "Your skeletal muscle mass at {skeletal_muscle_mass} lb and musculoskeletal domain at {F16_score}/100 indicate your structural scaffold needs more substrate. Muscle protein synthesis requires a leucine threshold at each meal — spreading protein across the day is more effective than loading it at dinner.",
    how: "Target 30–40 g protein per meal. Prioritize complete proteins: eggs, fish, poultry, dairy, legumes + grains. Front-load protein at breakfast — most people undereat protein in the morning. Track for 2 weeks to calibrate portion sizes, then maintain by habit.",
    coordinates: ["E", "Σ"],
    gates: ["CLI", "HPI"],
    retest_weeks: 12,
    retest_markers: ["body composition (InBody)", "skeletal muscle mass"],
    contraindications: ["advanced chronic kidney disease"],
    category: "nutrition",
    sequence_priority: 2,
    policy_class: "food_pattern",
    core_title: "Protein as a structural-reserve signal",
    core_rationale: "Your structural reserves and the substrate that supports them appear under-resourced. Spreading protein across the day, rather than loading it into one meal, is one of the patterns that tends to support muscle synthesis over time.",
    core_observation: "Notice whether strength, recovery, and how you feel after meals seem to shift across several weeks of more even protein distribution.",
    core_clinician_question: "Are there reasons in my picture to be cautious about a higher-protein pattern?",
  },
  {
    id: "ldl_particle_nutrition_shift",
    trigger: {
      biomarker_conditions: [{ name: "ldl_cholesterol", operator: ">", value: 160 }],
      gate_conditions: [{ gate: "GRIP", traffic_light: "YELLOW" }],
    },
    what: "Shift dietary pattern toward whole foods, reducing refined carbohydrates and increasing omega-3 sources.",
    why_template: "Your LDL at {ldl_cholesterol} mg/dL indicates more cholesterol-carrying particles than your cellular receptors can efficiently clear. The vascular coordinate is under load from particle excess, and dietary pattern is the first lever before pharmacology.",
    how: "Emphasize fatty fish 2× per week, olive oil as primary cooking fat, nuts daily (especially walnuts and almonds). Reduce refined carbohydrates to under 50 g daily — this means reading labels on bread, pasta, and packaged foods. Increase soluble fiber: oats, beans, lentils.",
    coordinates: ["V", "E"],
    gates: ["GRIP", "OFFI"],
    retest_weeks: 12,
    retest_markers: ["LDL-C", "ApoB", "triglycerides"],
    contraindications: ["nut allergy"],
    category: "nutrition",
    sequence_priority: 3,
    policy_class: "food_pattern",
    core_title: "Dietary pattern as a vascular signal",
    core_rationale: "Your lipid pattern suggests more particle traffic than the vascular system tends to clear comfortably. Whole-food eating patterns, with attention to fats and refined carbohydrates, are usually the first lever before a deeper clinical conversation.",
    core_observation: "Lipid patterns respond gradually. A retest after a season of consistent eating tends to show direction more clearly than week-to-week change.",
    core_clinician_question: "What pattern would tell us whether dietary change alone is enough for me?",
  },
  {
    id: "glucose_stability_meal_timing",
    trigger: {
      biomarker_conditions: [{ name: "hba1c", operator: ">", value: 5.6 }],
      gate_conditions: [{ gate: "FPIS", traffic_light: "YELLOW" }],
    },
    what: "Front-load carbohydrates to the first two-thirds of the day and pair every carbohydrate with protein or fat.",
    why_template: "Your HbA1c at {hba1c}% indicates your average glucose is running above the metabolic sweet spot. Insulin sensitivity is highest in the morning and lowest at night — eating carbs late forces your pancreas to work harder when it's least equipped to.",
    how: "Move starchy carbs (rice, bread, potatoes, fruit) to breakfast and lunch. Dinner should be protein + vegetables + healthy fat. When you eat carbs, always pair with protein or fat (apple + almond butter, rice + chicken, bread + avocado). This blunts the glucose spike without eliminating the food.",
    coordinates: ["E"],
    gates: ["FPIS", "OFFI"],
    retest_weeks: 12,
    retest_markers: ["HbA1c", "fasting glucose", "fasting insulin"],
    contraindications: [],
    category: "nutrition",
    sequence_priority: 2,
    policy_class: "food_pattern",
    core_title: "Glucose stability as a daily-rhythm signal",
    core_rationale: "Your glucose pattern suggests insulin is working harder than the rhythm of the day calls for, especially later in the day. Front-loading carbohydrates and pairing them with protein or fat are patterns that tend to ease that load.",
    core_observation: "Energy steadiness, post-meal alertness, and sleep quality often shift before lab markers do. They are useful early signals.",
    core_clinician_question: "What glucose pattern would suggest we should look more closely?",
  },
  {
    id: "fiber_gut_ecology",
    trigger: {
      domain_conditions: [{ domain: "D10", operator: "<", value: 60 }],
      gate_conditions: [{ gate: "BCS", traffic_light: "YELLOW" }],
    },
    what: "Increase dietary fiber to 30+ grams daily from diverse plant sources.",
    why_template: "Your gut ecology domain scored {D10_score}/100. Microbial diversity depends on prebiotic substrate — fiber from varied plant sources feeds different bacterial communities. A fiber-poor diet narrows your microbial repertoire, which weakens barrier function and immune tolerance.",
    how: "Add 2–3 servings of legumes per week (lentils, chickpeas, black beans). Include 1 serving of fermented food daily (sauerkraut, kimchi, yogurt, kefir). Increase vegetable variety — aim for 30 different plant species per week. Increase fiber gradually over 2 weeks to avoid GI distress.",
    coordinates: ["I", "E"],
    gates: ["BCS", "TIS"],
    retest_weeks: 8,
    retest_markers: ["gut symptoms", "hs-CRP"],
    contraindications: ["active IBD flare", "SIBO (discuss with physician first)"],
    category: "nutrition",
    sequence_priority: 4,
    policy_class: "food_pattern",
    core_title: "Fiber and microbial diversity as a gut-ecology signal",
    core_rationale: "Your gut-ecology signal reads under-resourced. Microbial diversity tends to track with the diversity of plant inputs, and slowly building variety is usually a gentler path than a single dramatic change.",
    core_observation: "Increase variety gradually over weeks. Notice digestion, regularity, and how you feel after meals as the early signals.",
    core_clinician_question: "Are there reasons in my picture to be cautious about a higher-fiber pattern?",
  },
  {
    id: "hydration_baseline",
    trigger: {
      domain_conditions: [{ domain: "I24", operator: "<", value: 60 }],
      biomarker_conditions: [{ name: "ecw_tbw_ratio", operator: ">", value: 0.39 }],
    },
    what: "Establish a consistent hydration baseline — 2.5–3 liters of water daily, distributed evenly.",
    why_template: "Your hydration domain scored {I24_score}/100 and your ECW/TBW ratio at {ecw_tbw_ratio} suggests fluid compartment imbalance. Adequate hydration supports kidney clearance, blood viscosity, and cellular function across every coordinate.",
    how: "Start each morning with 500 mL of water before coffee or food. Keep a water bottle visible at your workspace. Set 3 reminders across the day. Reduce evening fluid intake 2 hours before bed to protect sleep quality. Electrolytes (sodium, potassium) support retention — add a pinch of salt to morning water if not hypertensive.",
    coordinates: ["V", "I"],
    gates: ["TIS", "CLI"],
    retest_weeks: 4,
    retest_markers: ["ECW/TBW ratio", "hydration domain reassessment"],
    contraindications: ["heart failure with fluid restriction", "severe renal impairment"],
    category: "nutrition",
    sequence_priority: 5,
    policy_class: "food_pattern",
    core_title: "Hydration as a baseline signal",
    core_rationale: "Your hydration signals suggest fluid compartments are not quite balanced. Steady, evenly-distributed water across the day tends to support clearance, blood viscosity, and cellular function.",
    core_observation: "Notice morning energy, urine color, and how you feel between meals across a few weeks of a steadier pattern.",
    core_clinician_question: "Given my picture, are there reasons to think carefully about how much fluid is right for me?",
  },

  // ── MOVEMENT ──
  {
    id: "resistance_training_sarcopenia",
    trigger: {
      domain_conditions: [{ domain: "F16", operator: "<", value: 60 }],
      biomarker_conditions: [{ name: "skeletal_muscle_mass", operator: "<", value: 70 }],
    },
    what: "Begin a progressive resistance training program — two sessions per week targeting major muscle groups.",
    why_template: "Your skeletal muscle mass at {skeletal_muscle_mass} lb and musculoskeletal domain at {F16_score}/100 indicate your structural reserve is below where it needs to be. Resistance training is the only intervention that reverses sarcopenia — cardiovascular exercise alone cannot build the muscle mass your metabolism requires.",
    how: "45–60 minute sessions, 2× per week with at least 48 hours between sessions. Compound movements: squat pattern, hinge pattern (deadlift/hip hinge), horizontal push (push-up/bench), horizontal pull (row), vertical push (press), carry (farmer's walk). Start with bodyweight or light resistance for 2 weeks to establish form and avoid injury. Progress load weekly — 5% increases.",
    coordinates: ["E", "Σ", "R"],
    gates: ["CLI", "HPI"],
    retest_weeks: 12,
    retest_markers: ["body composition (InBody)", "skeletal muscle mass", "phase angle"],
    contraindications: ["acute injury", "uncontrolled hypertension", "unstable angina"],
    category: "movement",
    sequence_priority: 3,
    policy_class: "movement",
    core_title: "Resistance practice as a structural signal",
    core_rationale: "Your structural-reserve signals suggest the tissue that supports metabolism and resilience is under-built. Loading the body against resistance is the pattern most consistently associated with rebuilding it.",
    core_observation: "Strength and recovery shift slowly. Several weeks of consistent practice usually shows up before any scan does.",
    core_clinician_question: "Are there constraints in my picture that should shape how I begin?",
  },
  {
    id: "daily_walking_baseline",
    trigger: {
      domain_conditions: [{ domain: "H22", operator: "<", value: 70 }],
    },
    what: "Walk 20–30 minutes daily, preferably outdoors in morning light.",
    why_template: "Your lifestyle movement domain scored {H22_score}/100. Daily walking is the lowest-friction intervention that simultaneously supports your energy coordinate (glucose disposal), vascular coordinate (endothelial shear stress), and regulatory coordinate (circadian light exposure).",
    how: "Morning is ideal — within 2 hours of waking. Outdoor if possible for light exposure benefits. Pace should be brisk enough that you can talk but wouldn't choose to sing. If 30 minutes feels like too much, start with 10 and add 5 minutes per week. Consistency matters more than duration.",
    coordinates: ["E", "V", "R"],
    gates: ["HPI", "GRIP"],
    retest_weeks: 4,
    retest_markers: ["movement domain reassessment", "resting heart rate"],
    contraindications: [],
    category: "movement",
    sequence_priority: 1,
    policy_class: "movement",
    core_title: "Daily walking as a low-friction signal-builder",
    core_rationale: "Steady aerobic movement may reinforce the metabolic, vascular, and circadian patterns already emerging in your terrain. The pace matters less than the consistency.",
    core_observation: "Notice whether sleep, daytime energy, and resting heart rate seem to shift across several weeks of a steadier rhythm.",
    core_clinician_question: "Which signals would tell us this is supporting my terrain meaningfully?",
  },

  // ── SLEEP ──
  {
    id: "sleep_consistency_window",
    trigger: {
      domain_conditions: [{ domain: "E13", operator: "<", value: 70 }],
    },
    what: "Stabilize your sleep window — consistent bedtime and wake time within a 30-minute window.",
    why_template: "Your sleep/circadian domain scored {E13_score}/100. Circadian variability is one of the highest-leverage regulatory disruptions — when your body doesn't know when sleep is coming, it cannot prepare the hormonal cascade (melatonin, cortisol, growth hormone) that makes sleep restorative.",
    how: "Pick a target bedtime and wake time. Set alarms for both — yes, a bedtime alarm. Hold the window for 14 consecutive nights, including weekends. This is harder than it sounds because weekend drift is the most common failure mode. The first week may feel restrictive. By week 2, your circadian system starts to lock in.",
    coordinates: ["R"],
    gates: ["BRI", "HPI"],
    retest_weeks: 3,
    retest_markers: ["sleep domain reassessment", "subjective energy"],
    contraindications: [],
    category: "sleep",
    sequence_priority: 1,
    policy_class: "sleep_circadian",
    core_title: "Sleep window as a regulatory signal",
    core_rationale: "Your sleep-and-circadian signals suggest the body is uncertain about when sleep is coming. A steadier window tends to let the underlying hormonal cascade prepare the night more reliably.",
    core_observation: "The first week of holding a window often feels harder; the second week is usually where the change shows up.",
    core_clinician_question: "If sleep stays uneven despite a steadier window, what would be worth exploring next?",
  },
  {
    id: "evening_light_hygiene",
    trigger: {
      domain_conditions: [{ domain: "E13", operator: "<", value: 60 }],
      gate_conditions: [{ gate: "BRI", traffic_light: "YELLOW" }],
    },
    what: "Reduce bright and blue-spectrum light exposure in the 2 hours before bed.",
    why_template: "Your sleep domain at {E13_score}/100 and brain-resilience gate at {BRI_status} suggest your circadian signaling is under load. Bright light after sunset suppresses melatonin onset by 60–90 minutes, compressing the window where deep sleep can occur.",
    how: "Dim overhead lights after 8 PM. Switch devices to night mode / warm tone. If you read on a screen, use a blue-light filter app or dedicated e-reader. Avoid scrolling in bed entirely — the behavioral association between bed and screen time degrades sleep onset latency independently of light.",
    coordinates: ["R"],
    gates: ["BRI"],
    retest_weeks: 3,
    retest_markers: ["sleep quality subjective", "sleep domain reassessment"],
    contraindications: [],
    category: "sleep",
    sequence_priority: 2,
    policy_class: "sleep_circadian",
    core_title: "Evening light as a circadian signal",
    core_rationale: "Your circadian signals read under load. Bright and blue-spectrum light in the late evening tends to delay melatonin onset and compress the window where deeper sleep tends to occur.",
    core_observation: "Notice sleep onset and morning clarity across several weeks of dimmer evenings.",
    core_clinician_question: "If evening environment changes don't seem to help, what would be worth looking at next?",
  },
  {
    id: "morning_light_exposure",
    trigger: {
      domain_conditions: [{ domain: "E13", operator: "<", value: 65 }, { domain: "E14", operator: "<", value: 65 }],
    },
    what: "Get 10–15 minutes of bright outdoor light within the first hour of waking.",
    why_template: "Your sleep and mood domains scored {E13_score}/100 and {E14_score}/100. Morning light is the single strongest circadian zeitgeber — it sets the cortisol awakening response, anchors the melatonin onset 14–16 hours later, and modulates serotonin production that affects mood throughout the day.",
    how: "Step outside within 60 minutes of waking. Overcast days still provide 10,000+ lux — far more than indoor lighting. No sunglasses for this window (prescription glasses are fine). If you live in a northern latitude during winter, a 10,000 lux light therapy lamp at arm's length for 20 minutes is an acceptable substitute.",
    coordinates: ["R", "E"],
    gates: ["BRI", "HPI"],
    retest_weeks: 3,
    retest_markers: ["mood domain reassessment", "sleep quality"],
    contraindications: ["photosensitivity conditions", "certain medications causing photosensitivity"],
    category: "sleep",
    sequence_priority: 1,
    policy_class: "sleep_circadian",
    core_title: "Morning light as a circadian anchor",
    core_rationale: "Sleep, mood, and circadian signals tend to organize around morning light exposure. Outdoor light within the first hour of waking is one of the strongest patterns the body uses to set the day.",
    core_observation: "Notice mood, daytime energy, and the ease of evening wind-down across several weeks of a steadier morning pattern.",
    core_clinician_question: "Are there reasons in my picture to be careful about morning light exposure?",
  },

  // ── STRESS ──
  {
    id: "stress_downregulation_breathing",
    trigger: {
      domain_conditions: [{ domain: "C7", operator: "<", value: 60 }],
      gate_conditions: [{ gate: "BRI", traffic_light: "ORANGE" }],
    },
    what: "Practice a structured 5-minute breathing protocol twice daily — morning and before bed.",
    why_template: "Your adrenal/stress domain scored {C7_score}/100 and your brain-resilience gate is at {BRI_status}. Chronic sympathetic activation (the 'on' state) suppresses vagal tone, elevates cortisol, and reduces HRV. Structured breathing is the fastest way to shift the autonomic balance without medication.",
    how: "Box breathing: inhale 4 seconds, hold 4 seconds, exhale 4 seconds, hold 4 seconds. Repeat for 5 minutes. Alternatively, physiological sigh: double inhale through nose, long exhale through mouth — repeat 5 times. Do this once upon waking and once 30 minutes before sleep. Timer apps help but are not required.",
    coordinates: ["R", "V"],
    gates: ["BRI", "GRIP"],
    retest_weeks: 4,
    retest_markers: ["stress domain reassessment", "HRV if tracked"],
    contraindications: [],
    category: "stress",
    sequence_priority: 2,
    policy_class: "stress_practice",
    core_title: "Breath practice as an autonomic signal",
    core_rationale: "Your stress and brain-resilience signals suggest the autonomic system is leaning toward the 'on' state. Structured breathing is one of the few patterns that can shift autonomic balance within minutes.",
    core_observation: "Notice the moments after the practice — they often carry more information than the practice itself. Patterns become clearer across weeks.",
    core_clinician_question: "Given my stress picture, would there be value in tracking HRV or other autonomic signals more formally?",
  },

  // ── MONITORING ──
  {
    id: "visceral_fat_monitoring",
    trigger: {
      biomarker_conditions: [{ name: "visceral_fat_area", operator: ">", value: 100 }],
      gate_conditions: [{ gate: "OFFI", traffic_light: "YELLOW" }],
    },
    what: "Track visceral fat area with body composition analysis every 12 weeks.",
    why_template: "Your visceral fat area at {visceral_fat_area} cm² is above the threshold where metabolic load begins to drive insulin resistance and inflammatory signaling. This is a key metric for your energy coordinate — it tells you whether your interventions are actually reducing the central adiposity burden.",
    how: "Schedule an InBody or DEXA scan every 12 weeks. Same conditions each time: morning, fasted, same hydration level. The number matters less than the trend — you are watching direction, not chasing a target.",
    coordinates: ["E", "I"],
    gates: ["OFFI", "FPIS"],
    retest_weeks: 12,
    retest_markers: ["visceral fat area", "body fat percentage", "waist circumference"],
    contraindications: [],
    category: "monitoring",
    sequence_priority: 5,
    policy_class: "retest",
    core_title: "Visceral fat as a metabolic-load signal",
    core_rationale: "Visceral fat appears to be carrying meaningful metabolic and inflammatory signal in your terrain. The trajectory across scans tends to matter more than any single reading.",
    core_observation: "Worth following over time, under consistent conditions. Direction is more informative than the number on any one day.",
    core_clinician_question: "What change in visceral fat would meaningfully shift our thinking?",
  },
  {
    id: "apob_monitoring",
    trigger: {
      biomarker_conditions: [{ name: "apolipoprotein_b", operator: ">", value: 90 }],
    },
    what: "Retest ApoB in 12 weeks after dietary and lifestyle interventions are established.",
    why_template: "Your ApoB at {apolipoprotein_b} mg/dL is above the optimal range. ApoB is the single best predictor of atherogenic particle burden — better than LDL-C alone. Monitoring this tells you whether your vascular coordinate is actually improving from interventions.",
    how: "Fasting blood draw, 12-hour fast minimum. Schedule the retest 12 weeks from when you start your dietary shift. If ApoB has not moved after 12 weeks of consistent dietary change, the conversation shifts to pharmacologic options with your physician.",
    coordinates: ["V"],
    gates: ["GRIP"],
    retest_weeks: 12,
    retest_markers: ["ApoB", "LDL-C", "triglycerides"],
    contraindications: [],
    category: "monitoring",
    sequence_priority: 5,
    policy_class: "retest",
    core_title: "ApoB as a cardiovascular signal in your terrain",
    core_rationale: "ApoB appears to be one of the stronger cardiovascular signals in your current picture. Particle count tends to carry more information than cholesterol mass alone.",
    core_observation: "Worth following over time. Patterns become more meaningful as they repeat.",
    core_clinician_question: "What ApoB pattern would shift our thinking, and what timing makes sense for the next reading?",
  },
  {
    id: "phase_angle_tracking",
    trigger: {
      biomarker_conditions: [{ name: "phase_angle_whole_body", operator: "<", value: 5.5 }],
      gate_conditions: [{ gate: "TIS", traffic_light: "YELLOW" }],
    },
    what: "Retest whole-body phase angle with InBody every 12 weeks to track cellular integrity.",
    why_template: "Your phase angle at {phase_angle_whole_body}° is below the range that indicates healthy cellular membrane integrity. Phase angle is a composite marker of cellular health — it integrates hydration, nutrition, and inflammation into a single measurement. Tracking it tells you whether your biology is rebuilding or drifting.",
    how: "InBody scan every 12 weeks, same conditions: morning, fasted, consistent hydration. Phase angle responds to protein intake, resistance training, and inflammation reduction — it is a lagging indicator, so give interventions time to manifest.",
    coordinates: ["I", "Σ"],
    gates: ["TIS", "CLI"],
    retest_weeks: 12,
    retest_markers: ["phase angle", "ECW/TBW ratio"],
    contraindications: [],
    category: "monitoring",
    sequence_priority: 5,
    policy_class: "retest",
    core_title: "Phase angle as a cellular-resilience signal",
    core_rationale: "Your phase angle may be useful to follow over time as a reflection of cellular resilience and recovery capacity.",
    core_observation: "Single measurements carry less meaning than the trajectory across several scans.",
    core_clinician_question: "What phase-angle change would be worth discussing in our next conversation?",
  },
];

// ── Biomarker name normalization ──
const BIOMARKER_ALIASES: Record<string, string[]> = {
  vitamin_d: ["vitamin_d", "25_oh_vitamin_d", "25-oh vitamin d", "vitamin d"],
  hs_crp: ["hs_crp", "hs-crp", "high sensitivity crp", "c-reactive protein"],
  hba1c: ["hba1c", "hemoglobin_a1c", "hemoglobin a1c", "a1c"],
  ldl_cholesterol: ["ldl_cholesterol", "ldl", "ldl-c", "low density lipoprotein"],
  skeletal_muscle_mass: ["skeletal_muscle_mass", "smm"],
  visceral_fat_area: ["visceral_fat_area", "vfa", "visceral fat area"],
  ecw_tbw_ratio: ["ecw_tbw_ratio", "ecw/tbw", "ecw tbw"],
  phase_angle_whole_body: ["phase_angle_whole_body", "whole body phase angle", "phase angle"],
  magnesium: ["magnesium", "mg"],
  vitamin_b12: ["vitamin_b12", "b12", "cobalamin"],
  apolipoprotein_b: ["apolipoprotein_b", "apob", "apo b"],
};

export function normalizeBiomarkerName(raw: string): string {
  const lower = raw.toLowerCase().replace(/[\s\-\/]+/g, "_");
  for (const [canonical, aliases] of Object.entries(BIOMARKER_ALIASES)) {
    if (aliases.some((a) => a.replace(/[\s\-\/]+/g, "_") === lower || lower.includes(a.replace(/[\s\-\/]+/g, "_")))) {
      return canonical;
    }
  }
  return lower;
}

// ── Core-mode policy gate ──
const CORE_FORBIDDEN_CLASSES: Set<InterventionPolicyClass> = new Set([
  "supplement_with_dose",
  "medication_change",
  "titration",
  "individualized_protocol",
]);

export function isPermittedInCoreMode(intervention: Intervention): boolean {
  return !CORE_FORBIDDEN_CLASSES.has(intervention.policy_class);
}

export function isForbiddenInCoreMode(intervention: Intervention): boolean {
  return CORE_FORBIDDEN_CLASSES.has(intervention.policy_class);
}
