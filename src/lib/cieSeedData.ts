// ─── CIE v2.2 — Single Source of Truth ───
// 25 domains × (3 L1 + 10 L2 questions) + 9 gates

export interface CieQuestion {
  id: string;
  text: string;
  type: "frequency" | "yesno" | "severity" | "effectiveness" | "comparison" | "chronotype" | "activity";
}

export interface CieDomain {
  id: string;
  name: string;
  axis: string;
  axisName: string;
  layer1: CieQuestion[];
  layer2: CieQuestion[];
}

export interface CieGate {
  id: string;
  name: string;
  domains: string[];
}

export const CIE_CONFIG = {
  version: "2.2.0",
  layer1Weights: [0.40, 0.35, 0.25],
  layer2Weights: [0.15, 0.13, 0.12, 0.11, 0.10, 0.10, 0.08, 0.08, 0.07, 0.06],
  blendWeights: { layer2: 0.60, layer1: 0.40 },
  thresholds: { GREEN: 80, YELLOW: 60, ORANGE: 40, RED: 0 },
  deepDiveTrigger: { domainScore: 60, questionScore: 40 },
} as const;

export const SCORE_MAPS: Record<string, Record<string, number>> = {
  frequency: { never: 100, rarely: 75, sometimes: 50, often: 25, always: 0 },
  yesno: { no: 100, yes: 0 },
  severity: { none: 100, mild: 75, moderate: 50, severe: 25, extreme: 0 },
  effectiveness: { excellent: 100, good: 75, fair: 50, poor: 25, none: 0 },
  comparison: { much_better: 100, better: 75, same: 50, worse: 25, much_worse: 0 },
  chronotype: { morning: 75, afternoon: 50, evening: 50 },
  activity: { strength: 75, cardio: 75, mixed: 100, none: 25 },
};

export const CIE_DOMAINS: CieDomain[] = [
  // ── AXIS A — Metabolic ──
  {
    id: "A1", name: "Liver/Hepatic Flux", axis: "A", axisName: "Metabolic",
    layer1: [
      { id: "A1Q1", text: "How often do you experience digestive discomfort after fatty meals?", type: "frequency" },
      { id: "A1Q2", text: "Have you been told you have elevated liver enzymes?", type: "yesno" },
      { id: "A1Q3", text: "Do you consume more than 2 alcoholic drinks per day on average?", type: "yesno" },
    ],
    layer2: [
      { id: "A1D1", text: "Do you experience unexplained fatigue, especially after meals?", type: "frequency" },
      { id: "A1D2", text: "Have you noticed any yellowing of skin or eyes (jaundice)?", type: "yesno" },
      { id: "A1D3", text: "Do you have a history of hepatitis (A, B, or C)?", type: "yesno" },
      { id: "A1D4", text: "Have you been diagnosed with fatty liver disease (NAFLD/NASH)?", type: "yesno" },
      { id: "A1D5", text: "Do you take medications that can affect liver function (statins, acetaminophen regularly)?", type: "yesno" },
      { id: "A1D6", text: "How would you rate your exposure to environmental toxins (chemicals, pesticides, solvents)?", type: "severity" },
      { id: "A1D7", text: "Do you experience itchy skin without visible rash?", type: "frequency" },
      { id: "A1D8", text: "Have you had any imaging (ultrasound, CT, MRI) of your liver?", type: "yesno" },
      { id: "A1D9", text: "Do you have spider angiomas (small red spider-like blood vessels on skin)?", type: "yesno" },
      { id: "A1D10", text: "How often do you experience nausea or loss of appetite?", type: "frequency" },
    ],
  },
  {
    id: "A2", name: "Pancreas/Insulin Signaling", axis: "A", axisName: "Metabolic",
    layer1: [
      { id: "A2Q1", text: "Do you experience energy crashes or shakiness between meals?", type: "frequency" },
      { id: "A2Q2", text: "Have you been diagnosed with prediabetes or diabetes?", type: "yesno" },
      { id: "A2Q3", text: "Do you crave sugary or starchy foods frequently?", type: "frequency" },
    ],
    layer2: [
      { id: "A2D1", text: "Do you experience excessive thirst (polydipsia)?", type: "frequency" },
      { id: "A2D2", text: "Do you urinate more frequently than usual (polyuria)?", type: "frequency" },
      { id: "A2D3", text: "Have you noticed darkened skin patches in body folds (acanthosis nigricans)?", type: "yesno" },
      { id: "A2D4", text: "Is there a family history of diabetes in first-degree relatives?", type: "yesno" },
      { id: "A2D5", text: "How often do you experience brain fog after high-carb meals?", type: "frequency" },
      { id: "A2D6", text: "Have you been tested for HbA1c or fasting glucose recently?", type: "yesno" },
      { id: "A2D7", text: "Do you experience unexplained weight loss despite eating normally?", type: "yesno" },
      { id: "A2D8", text: "Have you had a glucose tolerance test (OGTT)?", type: "yesno" },
      { id: "A2D9", text: "Do you experience blurred vision that comes and goes?", type: "frequency" },
      { id: "A2D10", text: "Do wounds or infections take longer to heal than before?", type: "yesno" },
    ],
  },
  {
    id: "A3", name: "Adipose/Fat Signaling", axis: "A", axisName: "Metabolic",
    layer1: [
      { id: "A3Q1", text: "Is your waist circumference greater than 40 inches (men) or 35 inches (women)?", type: "yesno" },
      { id: "A3Q2", text: "Do you find it difficult to lose weight despite diet and exercise?", type: "frequency" },
      { id: "A3Q3", text: "Have you experienced significant weight fluctuations (>10 lbs) in the past year?", type: "yesno" },
    ],
    layer2: [
      { id: "A3D1", text: "Do you carry most of your weight around your midsection (apple shape)?", type: "yesno" },
      { id: "A3D2", text: "Have you been diagnosed with metabolic syndrome?", type: "yesno" },
      { id: "A3D3", text: "Do you experience joint pain that worsens with weight?", type: "frequency" },
      { id: "A3D4", text: "How would you rate your body's response to caloric restriction?", type: "effectiveness" },
      { id: "A3D5", text: "Have you had body composition analysis (DEXA, BIA)?", type: "yesno" },
      { id: "A3D6", text: "Do you have a family history of obesity?", type: "yesno" },
      { id: "A3D7", text: "Have you experienced yo-yo dieting (repeated weight loss and regain)?", type: "yesno" },
      { id: "A3D8", text: "Do you have lipomas (fatty lumps under the skin)?", type: "yesno" },
      { id: "A3D9", text: "Have you been diagnosed with lipedema or lymphedema?", type: "yesno" },
      { id: "A3D10", text: "Do you experience hunger that feels uncontrollable?", type: "frequency" },
    ],
  },

  // ── AXIS B — Cardiovascular ──
  {
    id: "B4", name: "Endothelium/Microcirculation", axis: "B", axisName: "Cardiovascular",
    layer1: [
      { id: "B4Q1", text: "Do you experience cold hands or feet regularly?", type: "frequency" },
      { id: "B4Q2", text: "Have you noticed any changes in wound healing speed?", type: "yesno" },
      { id: "B4Q3", text: "Do you have visible spider veins or varicose veins?", type: "yesno" },
    ],
    layer2: [
      { id: "B4D1", text: "Do you experience numbness or tingling in extremities?", type: "frequency" },
      { id: "B4D2", text: "Have you been diagnosed with Raynaud's phenomenon?", type: "yesno" },
      { id: "B4D3", text: "Do cuts or bruises take longer than expected to heal?", type: "yesno" },
      { id: "B4D4", text: "How often do you experience leg cramps or restless legs?", type: "frequency" },
      { id: "B4D5", text: "Do you have discoloration in your lower legs (brown spots, red patches)?", type: "yesno" },
      { id: "B4D6", text: "Have you been diagnosed with peripheral artery disease (PAD)?", type: "yesno" },
      { id: "B4D7", text: "Do you experience pain in your legs when walking that resolves with rest?", type: "frequency" },
      { id: "B4D8", text: "Have you had ankle-brachial index (ABI) testing?", type: "yesno" },
      { id: "B4D9", text: "Do you have erectile dysfunction (if applicable)?", type: "yesno" },
      { id: "B4D10", text: "Have you noticed changes in nail texture or color on feet?", type: "yesno" },
    ],
  },
  {
    id: "B5", name: "Heart/Autonomic Flow", axis: "B", axisName: "Cardiovascular",
    layer1: [
      { id: "B5Q1", text: "Do you experience heart palpitations or irregular heartbeat?", type: "frequency" },
      { id: "B5Q2", text: "Have you been diagnosed with any heart condition?", type: "yesno" },
      { id: "B5Q3", text: "Do you experience shortness of breath during mild exertion?", type: "frequency" },
    ],
    layer2: [
      { id: "B5D1", text: "Do you experience chest pain, pressure, or tightness?", type: "frequency" },
      { id: "B5D2", text: "Have you ever fainted (syncope) or nearly fainted?", type: "yesno" },
      { id: "B5D3", text: "Is there a family history of heart disease before age 55 (men) or 65 (women)?", type: "yesno" },
      { id: "B5D4", text: "How would you rate your exercise tolerance compared to peers?", type: "comparison" },
      { id: "B5D5", text: "Have you had an EKG/ECG in the past 2 years?", type: "yesno" },
      { id: "B5D6", text: "Have you had an echocardiogram?", type: "yesno" },
      { id: "B5D7", text: "Do you experience swelling in ankles or feet?", type: "frequency" },
      { id: "B5D8", text: "Have you been diagnosed with heart murmur?", type: "yesno" },
      { id: "B5D9", text: "Do you experience shortness of breath when lying flat?", type: "frequency" },
      { id: "B5D10", text: "Have you ever had sudden cardiac death in your family?", type: "yesno" },
    ],
  },
  {
    id: "B6", name: "Vascular Inflammation", axis: "B", axisName: "Cardiovascular",
    layer1: [
      { id: "B6Q1", text: "Have you been told you have elevated CRP or inflammatory markers?", type: "yesno" },
      { id: "B6Q2", text: "Do you experience persistent low-grade symptoms (fatigue, aches)?", type: "frequency" },
      { id: "B6Q3", text: "Do you have a history of autoimmune conditions?", type: "yesno" },
    ],
    layer2: [
      { id: "B6D1", text: "Do you experience morning stiffness lasting more than 30 minutes?", type: "frequency" },
      { id: "B6D2", text: "Have you been diagnosed with elevated homocysteine?", type: "yesno" },
      { id: "B6D3", text: "Do you have chronic infections or recurring illness?", type: "yesno" },
      { id: "B6D4", text: "How would you rate your overall inflammatory burden?", type: "severity" },
      { id: "B6D5", text: "Have you been tested for Lp-PLA2 or oxidized LDL?", type: "yesno" },
      { id: "B6D6", text: "Do you have periodontal (gum) disease?", type: "yesno" },
      { id: "B6D7", text: "Have you been diagnosed with psoriasis or eczema?", type: "yesno" },
      { id: "B6D8", text: "Do you experience frequent joint or muscle pain?", type: "frequency" },
      { id: "B6D9", text: "Have you been tested for ANA (antinuclear antibodies)?", type: "yesno" },
      { id: "B6D10", text: "Do you have unexplained fevers or night sweats?", type: "frequency" },
    ],
  },

  // ── AXIS C — Neuroendocrine ──
  {
    id: "C7", name: "Adrenal/Stress Response", axis: "C", axisName: "Neuroendocrine",
    layer1: [
      { id: "C7Q1", text: "Do you feel 'wired but tired' - exhausted yet unable to relax?", type: "frequency" },
      { id: "C7Q2", text: "Do you rely on caffeine to get through the day?", type: "frequency" },
      { id: "C7Q3", text: "Have you experienced prolonged periods of high stress?", type: "yesno" },
    ],
    layer2: [
      { id: "C7D1", text: "Do you experience a 'second wind' of energy late at night (after 10pm)?", type: "frequency" },
      { id: "C7D2", text: "Have you been diagnosed with adrenal fatigue or HPA axis dysfunction?", type: "yesno" },
      { id: "C7D3", text: "Do you crave salt or salty foods?", type: "frequency" },
      { id: "C7D4", text: "How would you rate your stress recovery ability?", type: "effectiveness" },
      { id: "C7D5", text: "Have you had cortisol testing (saliva, blood, or urine)?", type: "yesno" },
      { id: "C7D6", text: "Do you feel lightheaded when standing up quickly?", type: "frequency" },
      { id: "C7D7", text: "Have you experienced significant weight gain during stressful periods?", type: "yesno" },
      { id: "C7D8", text: "Do you have difficulty handling everyday stressors that used to be manageable?", type: "frequency" },
      { id: "C7D9", text: "Have you been diagnosed with chronic fatigue syndrome?", type: "yesno" },
      { id: "C7D10", text: "Do you experience hypoglycemia (low blood sugar) symptoms under stress?", type: "frequency" },
    ],
  },
  {
    id: "C8", name: "Mitochondrial Energy", axis: "C", axisName: "Neuroendocrine",
    layer1: [
      { id: "C8Q1", text: "Do you experience persistent fatigue not relieved by rest?", type: "frequency" },
      { id: "C8Q2", text: "Do you have difficulty with exercise recovery?", type: "frequency" },
      { id: "C8Q3", text: "Have you been diagnosed with chronic fatigue syndrome or fibromyalgia?", type: "yesno" },
    ],
    layer2: [
      { id: "C8D1", text: "Do you experience muscle weakness or post-exertional malaise?", type: "frequency" },
      { id: "C8D2", text: "Have you been tested for CoQ10 levels?", type: "yesno" },
      { id: "C8D3", text: "Do you have a history of long-term statin use?", type: "yesno" },
      { id: "C8D4", text: "How would you rate your cellular energy levels throughout the day?", type: "effectiveness" },
      { id: "C8D5", text: "Have you had organic acids testing?", type: "yesno" },
      { id: "C8D6", text: "Do you experience exercise intolerance (unable to sustain exercise)?", type: "frequency" },
      { id: "C8D7", text: "Have you been tested for carnitine levels?", type: "yesno" },
      { id: "C8D8", text: "Do you have brain fog that worsens with physical activity?", type: "frequency" },
      { id: "C8D9", text: "Have you been diagnosed with any mitochondrial disorder?", type: "yesno" },
      { id: "C8D10", text: "Do you take any supplements for energy (CoQ10, B vitamins, carnitine)?", type: "yesno" },
    ],
  },
  {
    id: "C9", name: "Autonomic Balance", axis: "C", axisName: "Neuroendocrine",
    layer1: [
      { id: "C9Q1", text: "Do you experience anxiety or panic symptoms?", type: "frequency" },
      { id: "C9Q2", text: "Do you have trouble with temperature regulation (always hot/cold)?", type: "frequency" },
      { id: "C9Q3", text: "Have you been diagnosed with dysautonomia, POTS, or similar condition?", type: "yesno" },
    ],
    layer2: [
      { id: "C9D1", text: "Do you experience dizziness or lightheadedness when standing up quickly?", type: "frequency" },
      { id: "C9D2", text: "Do you have digestive issues that worsen with stress?", type: "frequency" },
      { id: "C9D3", text: "Have you measured your heart rate variability (HRV)?", type: "yesno" },
      { id: "C9D4", text: "How would you rate your parasympathetic (rest/digest) function?", type: "effectiveness" },
      { id: "C9D5", text: "Do you experience abnormal sweating (too much or too little)?", type: "frequency" },
      { id: "C9D6", text: "Have you had a tilt table test?", type: "yesno" },
      { id: "C9D7", text: "Do you experience rapid heart rate upon standing (>30 bpm increase)?", type: "frequency" },
      { id: "C9D8", text: "Do you have difficulty with deep breathing or breath-holding?", type: "yesno" },
      { id: "C9D9", text: "Have you been diagnosed with irritable bowel syndrome (IBS)?", type: "yesno" },
      { id: "C9D10", text: "Do you experience frequent urination or bladder issues?", type: "frequency" },
    ],
  },

  // ── AXIS D — Gut-Immune ──
  {
    id: "D10", name: "Gut Ecology", axis: "D", axisName: "Gut-Immune",
    layer1: [
      { id: "D10Q1", text: "Do you experience bloating, gas, or digestive discomfort regularly?", type: "frequency" },
      { id: "D10Q2", text: "Have you taken multiple courses of antibiotics in your life?", type: "yesno" },
      { id: "D10Q3", text: "Do you have food sensitivities or intolerances?", type: "yesno" },
    ],
    layer2: [
      { id: "D10D1", text: "Do you experience irregular bowel movements (constipation/diarrhea)?", type: "frequency" },
      { id: "D10D2", text: "Have you been diagnosed with SIBO (small intestinal bacterial overgrowth)?", type: "yesno" },
      { id: "D10D3", text: "Do you have a history of C. diff or other gut infections?", type: "yesno" },
      { id: "D10D4", text: "How would you rate your gut microbiome diversity?", type: "effectiveness" },
      { id: "D10D5", text: "Have you had stool testing (GI-MAP, comprehensive stool analysis)?", type: "yesno" },
      { id: "D10D6", text: "Do you experience acid reflux or heartburn regularly?", type: "frequency" },
      { id: "D10D7", text: "Have you been diagnosed with IBS, IBD, or Crohn's disease?", type: "yesno" },
      { id: "D10D8", text: "Do you experience undigested food in your stool?", type: "frequency" },
      { id: "D10D9", text: "Have you tried probiotics or fermented foods? Did they help?", type: "effectiveness" },
      { id: "D10D10", text: "Do you have a history of H. pylori infection?", type: "yesno" },
    ],
  },
  {
    id: "D11", name: "Immune Tolerance", axis: "D", axisName: "Gut-Immune",
    layer1: [
      { id: "D11Q1", text: "Do you have allergies, asthma, or eczema?", type: "yesno" },
      { id: "D11Q2", text: "Do you get sick frequently (more than 3 times per year)?", type: "yesno" },
      { id: "D11Q3", text: "Have you been diagnosed with an autoimmune condition?", type: "yesno" },
    ],
    layer2: [
      { id: "D11D1", text: "Do you react to multiple foods or environmental triggers?", type: "frequency" },
      { id: "D11D2", text: "Have you been tested for leaky gut (intestinal permeability)?", type: "yesno" },
      { id: "D11D3", text: "Do you have a history of chronic infections (EBV, Lyme, etc.)?", type: "yesno" },
      { id: "D11D4", text: "How would you rate your immune system's balance?", type: "effectiveness" },
      { id: "D11D5", text: "Have you had food sensitivity testing (IgG, IgE)?", type: "yesno" },
      { id: "D11D6", text: "Do you experience hives, rashes, or skin reactions frequently?", type: "frequency" },
      { id: "D11D7", text: "Have you been diagnosed with mast cell activation syndrome (MCAS)?", type: "yesno" },
      { id: "D11D8", text: "Do infections take longer to resolve than they should?", type: "yesno" },
      { id: "D11D9", text: "Have you had immunoglobulin levels tested (IgA, IgG, IgM)?", type: "yesno" },
      { id: "D11D10", text: "Do you have multiple chemical sensitivities (MCS)?", type: "yesno" },
    ],
  },
  {
    id: "D12", name: "Liver-Gut Loop", axis: "D", axisName: "Gut-Immune",
    layer1: [
      { id: "D12Q1", text: "Do you experience symptoms after eating high-fat meals?", type: "frequency" },
      { id: "D12Q2", text: "Have you had your gallbladder removed?", type: "yesno" },
      { id: "D12Q3", text: "Do you experience acid reflux or GERD?", type: "frequency" },
    ],
    layer2: [
      { id: "D12D1", text: "Do you have difficulty digesting fats or oils?", type: "frequency" },
      { id: "D12D2", text: "Have you been diagnosed with bile acid malabsorption?", type: "yesno" },
      { id: "D12D3", text: "Do you experience light-colored (clay) or floating stools?", type: "frequency" },
      { id: "D12D4", text: "How would you rate your enterohepatic circulation function?", type: "effectiveness" },
      { id: "D12D5", text: "Have you had bile acid testing?", type: "yesno" },
      { id: "D12D6", text: "Do you experience right upper quadrant discomfort after meals?", type: "frequency" },
      { id: "D12D7", text: "Have you had gallstones or sludge detected on imaging?", type: "yesno" },
      { id: "D12D8", text: "Do you take ox bile or digestive enzyme supplements?", type: "yesno" },
      { id: "D12D9", text: "Do you experience diarrhea after fatty meals specifically?", type: "frequency" },
      { id: "D12D10", text: "Have you been tested for pancreatic elastase?", type: "yesno" },
    ],
  },

  // ── AXIS E — Neuropsychological ──
  {
    id: "E13", name: "Sleep/Circadian", axis: "E", axisName: "Neuropsychological",
    layer1: [
      { id: "E13Q1", text: "Do you have trouble falling or staying asleep?", type: "frequency" },
      { id: "E13Q2", text: "Do you feel unrefreshed after a full night's sleep?", type: "frequency" },
      { id: "E13Q3", text: "Do you work night shifts or have irregular sleep schedules?", type: "yesno" },
    ],
    layer2: [
      { id: "E13D1", text: "Do you use screens within 1 hour of bedtime?", type: "frequency" },
      { id: "E13D2", text: "Have you been diagnosed with sleep apnea?", type: "yesno" },
      { id: "E13D3", text: "Do you experience vivid dreams, nightmares, or sleep paralysis?", type: "frequency" },
      { id: "E13D4", text: "How would you rate your sleep quality on a typical night?", type: "effectiveness" },
      { id: "E13D5", text: "Have you had a sleep study (polysomnography)?", type: "yesno" },
      { id: "E13D6", text: "Do you use sleep aids (medications, supplements)?", type: "frequency" },
      { id: "E13D7", text: "Do you have restless leg syndrome or periodic limb movements?", type: "yesno" },
      { id: "E13D8", text: "What time do you typically feel most alert (morning, afternoon, evening)?", type: "chronotype" },
      { id: "E13D9", text: "Do you wake up at the same time every day (weekdays and weekends)?", type: "yesno" },
      { id: "E13D10", text: "Do you get morning sunlight exposure within 30 minutes of waking?", type: "frequency" },
    ],
  },
  {
    id: "E14", name: "Mood/Emotional Tone", axis: "E", axisName: "Neuropsychological",
    layer1: [
      { id: "E14Q1", text: "Do you experience persistent low mood or depression?", type: "frequency" },
      { id: "E14Q2", text: "Have you been diagnosed with anxiety or depression?", type: "yesno" },
      { id: "E14Q3", text: "Do you find it hard to feel joy or pleasure in activities?", type: "frequency" },
    ],
    layer2: [
      { id: "E14D1", text: "Do you experience mood swings or emotional volatility?", type: "frequency" },
      { id: "E14D2", text: "Are you currently taking psychiatric medications?", type: "yesno" },
      { id: "E14D3", text: "Have you experienced trauma or significant adverse events?", type: "yesno" },
      { id: "E14D4", text: "How would you rate your emotional resilience?", type: "effectiveness" },
      { id: "E14D5", text: "Have you tried therapy or counseling?", type: "yesno" },
      { id: "E14D6", text: "Do you experience irritability or anger outbursts?", type: "frequency" },
      { id: "E14D7", text: "Have you been screened for bipolar disorder?", type: "yesno" },
      { id: "E14D8", text: "Do you have a family history of mental health conditions?", type: "yesno" },
      { id: "E14D9", text: "Do you experience seasonal changes in mood (SAD)?", type: "yesno" },
      { id: "E14D10", text: "Do you practice any form of meditation or mindfulness?", type: "frequency" },
    ],
  },
  {
    id: "E15", name: "Cognitive Load", axis: "E", axisName: "Neuropsychological",
    layer1: [
      { id: "E15Q1", text: "Do you experience brain fog or difficulty concentrating?", type: "frequency" },
      { id: "E15Q2", text: "Have you noticed memory issues (forgetting names, tasks)?", type: "frequency" },
      { id: "E15Q3", text: "Do you feel mentally exhausted by the end of the day?", type: "frequency" },
    ],
    layer2: [
      { id: "E15D1", text: "Do you have difficulty with word-finding or verbal fluency?", type: "frequency" },
      { id: "E15D2", text: "Have you been evaluated for ADHD?", type: "yesno" },
      { id: "E15D3", text: "Do you experience 'tip of the tongue' moments frequently?", type: "frequency" },
      { id: "E15D4", text: "How would you rate your mental clarity on a typical day?", type: "effectiveness" },
      { id: "E15D5", text: "Have you had cognitive testing or neuropsychological evaluation?", type: "yesno" },
      { id: "E15D6", text: "Do you multitask frequently during work?", type: "frequency" },
      { id: "E15D7", text: "Have you been diagnosed with any neurodegenerative condition?", type: "yesno" },
      { id: "E15D8", text: "Do you experience difficulty learning new information?", type: "frequency" },
      { id: "E15D9", text: "Do you have a family history of dementia or Alzheimer's?", type: "yesno" },
      { id: "E15D10", text: "Do you take any supplements for brain health (omega-3, lion's mane)?", type: "yesno" },
    ],
  },

  // ── AXIS F — Structural ──
  {
    id: "F16", name: "Musculoskeletal", axis: "F", axisName: "Structural",
    layer1: [
      { id: "F16Q1", text: "Do you experience chronic muscle or joint pain?", type: "frequency" },
      { id: "F16Q2", text: "Have you been diagnosed with arthritis or fibromyalgia?", type: "yesno" },
      { id: "F16Q3", text: "Do you have limited mobility or range of motion?", type: "yesno" },
    ],
    layer2: [
      { id: "F16D1", text: "Do you experience muscle weakness or atrophy?", type: "frequency" },
      { id: "F16D2", text: "Have you had joint replacements or orthopedic surgery?", type: "yesno" },
      { id: "F16D3", text: "Do you use mobility aids (cane, walker, wheelchair)?", type: "yesno" },
      { id: "F16D4", text: "How would you rate your overall musculoskeletal function?", type: "effectiveness" },
      { id: "F16D5", text: "Have you had imaging (X-ray, MRI) of joints?", type: "yesno" },
      { id: "F16D6", text: "Do you experience morning stiffness that improves with movement?", type: "frequency" },
      { id: "F16D7", text: "Have you been diagnosed with osteoarthritis or rheumatoid arthritis?", type: "yesno" },
      { id: "F16D8", text: "Do you do strength training or resistance exercise?", type: "frequency" },
      { id: "F16D9", text: "Have you had physical therapy in the past year?", type: "yesno" },
      { id: "F16D10", text: "Do you take anti-inflammatory medications regularly?", type: "yesno" },
    ],
  },
  {
    id: "F17", name: "Skin/Connective Tissue", axis: "F", axisName: "Structural",
    layer1: [
      { id: "F17Q1", text: "Do you have chronic skin conditions (acne, eczema, psoriasis)?", type: "yesno" },
      { id: "F17Q2", text: "Have you noticed premature aging or loss of skin elasticity?", type: "yesno" },
      { id: "F17Q3", text: "Do you bruise easily or have thin skin?", type: "yesno" },
    ],
    layer2: [
      { id: "F17D1", text: "Do you have a history of keloid or hypertrophic scarring?", type: "yesno" },
      { id: "F17D2", text: "Have you been diagnosed with Ehlers-Danlos syndrome or hypermobility?", type: "yesno" },
      { id: "F17D3", text: "Do you experience frequent skin infections?", type: "frequency" },
      { id: "F17D4", text: "How would you rate your skin's healing and regeneration?", type: "effectiveness" },
      { id: "F17D5", text: "Do you have stretch marks (striae)?", type: "yesno" },
      { id: "F17D6", text: "Have you been diagnosed with any connective tissue disorder?", type: "yesno" },
      { id: "F17D7", text: "Do you experience joint hypermobility (double-jointed)?", type: "yesno" },
      { id: "F17D8", text: "Have you had skin biopsies or dermatology evaluations?", type: "yesno" },
      { id: "F17D9", text: "Do you take collagen supplements?", type: "yesno" },
      { id: "F17D10", text: "Do you have sensitive skin that reacts to products easily?", type: "yesno" },
    ],
  },
  {
    id: "F18", name: "Bone/Density", axis: "F", axisName: "Structural",
    layer1: [
      { id: "F18Q1", text: "Have you been diagnosed with osteoporosis or osteopenia?", type: "yesno" },
      { id: "F18Q2", text: "Have you had a fracture from minor impact?", type: "yesno" },
      { id: "F18Q3", text: "Do you have risk factors for bone loss (low vitamin D, sedentary)?", type: "yesno" },
    ],
    layer2: [
      { id: "F18D1", text: "Have you had a DEXA scan? What were the results?", type: "yesno" },
      { id: "F18D2", text: "Do you take calcium or vitamin D supplements?", type: "yesno" },
      { id: "F18D3", text: "Do you do weight-bearing exercise regularly?", type: "frequency" },
      { id: "F18D4", text: "How would you rate your bone health?", type: "effectiveness" },
      { id: "F18D5", text: "Have you taken bisphosphonates or other bone medications?", type: "yesno" },
      { id: "F18D6", text: "Do you have a family history of osteoporosis or fractures?", type: "yesno" },
      { id: "F18D7", text: "Have you lost height over the years?", type: "yesno" },
      { id: "F18D8", text: "Do you have kyphosis (forward curvature of spine)?", type: "yesno" },
      { id: "F18D9", text: "Have you ever taken long-term corticosteroids?", type: "yesno" },
      { id: "F18D10", text: "Do you consume adequate protein for bone health?", type: "yesno" },
    ],
  },

  // ── AXIS G — Hormonal ──
  {
    id: "G19", name: "Thyroid", axis: "G", axisName: "Hormonal",
    layer1: [
      { id: "G19Q1", text: "Have you been diagnosed with thyroid dysfunction?", type: "yesno" },
      { id: "G19Q2", text: "Do you experience unexplained weight changes or temperature sensitivity?", type: "frequency" },
      { id: "G19Q3", text: "Do you have symptoms of slow metabolism (fatigue, dry skin, hair loss)?", type: "frequency" },
    ],
    layer2: [
      { id: "G19D1", text: "Are you currently on thyroid medication?", type: "yesno" },
      { id: "G19D2", text: "Have you had your thyroid antibodies tested (TPO, TG)?", type: "yesno" },
      { id: "G19D3", text: "Do you have a family history of thyroid disease?", type: "yesno" },
      { id: "G19D4", text: "How would you rate your thyroid function overall?", type: "effectiveness" },
      { id: "G19D5", text: "Have you had a thyroid ultrasound?", type: "yesno" },
      { id: "G19D6", text: "Do you have thyroid nodules?", type: "yesno" },
      { id: "G19D7", text: "Have you been tested for reverse T3?", type: "yesno" },
      { id: "G19D8", text: "Do you experience difficulty swallowing or neck tightness?", type: "frequency" },
      { id: "G19D9", text: "Have you been diagnosed with Hashimoto's or Graves' disease?", type: "yesno" },
      { id: "G19D10", text: "Do you take iodine or selenium supplements?", type: "yesno" },
    ],
  },
  {
    id: "G20", name: "Reproductive Hormones", axis: "G", axisName: "Hormonal",
    layer1: [
      { id: "G20Q1", text: "Do you experience hormonal symptoms (PMS, hot flashes, low libido)?", type: "frequency" },
      { id: "G20Q2", text: "Have you been diagnosed with hormone imbalance or PCOS?", type: "yesno" },
      { id: "G20Q3", text: "Are you in perimenopause, menopause, or andropause?", type: "yesno" },
    ],
    layer2: [
      { id: "G20D1", text: "Have you had your hormone levels tested recently (estrogen, testosterone, progesterone)?", type: "yesno" },
      { id: "G20D2", text: "Are you on hormone replacement therapy (HRT)?", type: "yesno" },
      { id: "G20D3", text: "Do you experience fertility issues?", type: "yesno" },
      { id: "G20D4", text: "How would you rate your hormonal balance?", type: "effectiveness" },
      { id: "G20D5", text: "Have you been tested for DHEA-S and cortisol?", type: "yesno" },
      { id: "G20D6", text: "Do you experience irregular menstrual cycles (if applicable)?", type: "yesno" },
      { id: "G20D7", text: "Have you been diagnosed with endometriosis or fibroids (if applicable)?", type: "yesno" },
      { id: "G20D8", text: "Do you experience symptoms of low testosterone (if applicable)?", type: "yesno" },
      { id: "G20D9", text: "Have you had breast or prostate cancer screening?", type: "yesno" },
      { id: "G20D10", text: "Do you take any hormone-modulating supplements (DIM, maca, ashwagandha)?", type: "yesno" },
    ],
  },
  {
    id: "G21", name: "Insulin-Cortisol Axis", axis: "G", axisName: "Hormonal",
    layer1: [
      { id: "G21Q1", text: "Do you experience blood sugar swings throughout the day?", type: "frequency" },
      { id: "G21Q2", text: "Do you gain weight easily, especially around the middle?", type: "yesno" },
      { id: "G21Q3", text: "Do you feel 'hangry' or irritable when meals are delayed?", type: "frequency" },
    ],
    layer2: [
      { id: "G21D1", text: "Have you had a glucose tolerance test (OGTT) or HbA1c measured?", type: "yesno" },
      { id: "G21D2", text: "Do you experience reactive hypoglycemia after meals?", type: "frequency" },
      { id: "G21D3", text: "Have you been diagnosed with insulin resistance?", type: "yesno" },
      { id: "G21D4", text: "How would you rate your metabolic hormone balance?", type: "effectiveness" },
      { id: "G21D5", text: "Have you worn a continuous glucose monitor (CGM)?", type: "yesno" },
      { id: "G21D6", text: "Do you experience afternoon energy crashes?", type: "frequency" },
      { id: "G21D7", text: "Have you been tested for fasting insulin?", type: "yesno" },
      { id: "G21D8", text: "Do you practice time-restricted eating or intermittent fasting?", type: "yesno" },
      { id: "G21D9", text: "Have you been diagnosed with Cushing's syndrome or tested for cortisol?", type: "yesno" },
      { id: "G21D10", text: "Do you take metformin or other glucose-lowering medications?", type: "yesno" },
    ],
  },

  // ── AXIS H — Lifestyle ──
  {
    id: "H22", name: "Light & Movement", axis: "H", axisName: "Lifestyle",
    layer1: [
      { id: "H22Q1", text: "Do you get at least 30 minutes of outdoor light daily?", type: "frequency" },
      { id: "H22Q2", text: "Do you exercise at least 150 minutes per week?", type: "yesno" },
      { id: "H22Q3", text: "Do you spend most of your day sedentary?", type: "yesno" },
    ],
    layer2: [
      { id: "H22D1", text: "Do you have a consistent morning light exposure routine?", type: "frequency" },
      { id: "H22D2", text: "Do you use blue light blocking glasses at night?", type: "yesno" },
      { id: "H22D3", text: "Do you do strength training at least twice per week?", type: "yesno" },
      { id: "H22D4", text: "How would you rate your overall activity level?", type: "effectiveness" },
      { id: "H22D5", text: "Do you track your steps or activity with a device?", type: "yesno" },
      { id: "H22D6", text: "What type of exercise do you do most often?", type: "activity" },
      { id: "H22D7", text: "Do you take breaks from sitting every hour?", type: "frequency" },
      { id: "H22D8", text: "Do you exercise outdoors or primarily indoors?", type: "yesno" },
      { id: "H22D9", text: "Have you had VO2 max or fitness testing?", type: "yesno" },
      { id: "H22D10", text: "Do you experience post-exercise soreness that lasts more than 2 days?", type: "frequency" },
    ],
  },
  {
    id: "H23", name: "Nutrition Identity", axis: "H", axisName: "Lifestyle",
    layer1: [
      { id: "H23Q1", text: "Do you eat processed or fast food more than 3 times per week?", type: "frequency" },
      { id: "H23Q2", text: "Do you have a consistent eating schedule?", type: "yesno" },
      { id: "H23Q3", text: "Do you consume at least 5 servings of vegetables daily?", type: "yesno" },
    ],
    layer2: [
      { id: "H23D1", text: "Do you practice time-restricted eating or intermittent fasting?", type: "yesno" },
      { id: "H23D2", text: "Do you track your macronutrient intake?", type: "yesno" },
      { id: "H23D3", text: "Do you have identified food sensitivities you actively avoid?", type: "yesno" },
      { id: "H23D4", text: "How would you rate your nutritional awareness?", type: "effectiveness" },
      { id: "H23D5", text: "Do you prepare most of your meals at home?", type: "frequency" },
      { id: "H23D6", text: "Do you consume adequate protein (0.8-1g per pound body weight)?", type: "yesno" },
      { id: "H23D7", text: "Do you limit sugar intake to less than 25g per day?", type: "yesno" },
      { id: "H23D8", text: "Have you tried elimination diets to identify triggers?", type: "yesno" },
      { id: "H23D9", text: "Do you consume fermented foods regularly?", type: "frequency" },
      { id: "H23D10", text: "Do you eat organic or prioritize food quality?", type: "frequency" },
    ],
  },

  // ── AXIS I — Functional ──
  {
    id: "I24", name: "Hydration/Electrolyte", axis: "I", axisName: "Functional",
    layer1: [
      { id: "I24Q1", text: "Do you drink at least 8 glasses of water daily?", type: "yesno" },
      { id: "I24Q2", text: "Do you experience frequent headaches or muscle cramps?", type: "frequency" },
      { id: "I24Q3", text: "Is your urine typically dark yellow?", type: "frequency" },
    ],
    layer2: [
      { id: "I24D1", text: "Do you consume adequate electrolytes (sodium, potassium, magnesium)?", type: "yesno" },
      { id: "I24D2", text: "Do you experience dizziness when standing?", type: "frequency" },
      { id: "I24D3", text: "Have you been diagnosed with electrolyte imbalances?", type: "yesno" },
      { id: "I24D4", text: "How would you rate your hydration status?", type: "effectiveness" },
      { id: "I24D5", text: "Do you use electrolyte supplements or drinks?", type: "yesno" },
      { id: "I24D6", text: "Do you experience frequent thirst?", type: "frequency" },
      { id: "I24D7", text: "Have you had kidney function tests (BUN, creatinine)?", type: "yesno" },
      { id: "I24D8", text: "Do you limit caffeine and alcohol intake?", type: "yesno" },
      { id: "I24D9", text: "Do you exercise in hot environments or sweat heavily?", type: "frequency" },
      { id: "I24D10", text: "Have you experienced kidney stones?", type: "yesno" },
    ],
  },

  // ── AXIS J — Social ──
  {
    id: "J25", name: "Social Connection", axis: "J", axisName: "Social",
    layer1: [
      { id: "J25Q1", text: "Do you have meaningful social connections you can rely on?", type: "yesno" },
      { id: "J25Q2", text: "Do you feel lonely or isolated frequently?", type: "frequency" },
      { id: "J25Q3", text: "Do you engage in community or group activities?", type: "frequency" },
    ],
    layer2: [
      { id: "J25D1", text: "Do you have at least one person you can confide in deeply?", type: "yesno" },
      { id: "J25D2", text: "Do you feel supported in times of stress?", type: "frequency" },
      { id: "J25D3", text: "Do you volunteer or contribute to your community?", type: "yesno" },
      { id: "J25D4", text: "How would you rate your social support network?", type: "effectiveness" },
      { id: "J25D5", text: "Do you have regular face-to-face social interactions?", type: "frequency" },
      { id: "J25D6", text: "Do you feel a sense of belonging to a group or community?", type: "yesno" },
      { id: "J25D7", text: "Have you experienced major relationship changes in the past year?", type: "yesno" },
      { id: "J25D8", text: "Do you share meals with others regularly?", type: "frequency" },
      { id: "J25D9", text: "Do you have a sense of purpose or meaning in life?", type: "yesno" },
      { id: "J25D10", text: "Do you engage in activities that bring you joy with others?", type: "frequency" },
    ],
  },
];

// ── Gate definitions ──
export const CIE_GATES: CieGate[] = [
  { id: "OFFI", name: "Organ/Fat Flux Index", domains: ["A1", "A3", "D12", "H23"] },
  { id: "FPIS", name: "Fuel Processing & Insulin Sensitivity", domains: ["A1", "A2", "G21", "H23"] },
  { id: "BCS", name: "Barrier & Colonization Status", domains: ["A3", "B6", "D10", "D11", "D12", "F17"] },
  { id: "BRI", name: "Brain-Resilience Index", domains: ["C7", "C9", "E13", "E14", "G19", "G20", "G21", "H22", "J25"] },
  { id: "TIS", name: "Tissue Integrity Score", domains: ["B4", "B6", "D10", "F16", "F17", "I24"] },
  { id: "CLI", name: "Cellular Longevity Index", domains: ["B5", "C8", "E15", "F16", "I24"] },
  { id: "HPI", name: "Health Potential Index", domains: ["C7", "C8", "E13", "E15", "F18", "G19", "G20", "H22"] },
  { id: "GRIP", name: "Global Risk Integration Profile", domains: ["A2", "B4", "B5", "C9", "F18"] },
  { id: "SCAR", name: "SCAR Memory Gate", domains: ["D11", "E14", "J25"] },
];

// ── Lookup helpers ──
export const CIE_DOMAIN_MAP = Object.fromEntries(CIE_DOMAINS.map((d) => [d.id, d]));
export const CIE_GATE_MAP = Object.fromEntries(CIE_GATES.map((g) => [g.id, g]));

// ── Client-side scoring (mirrors edge function for optimistic UI) ──
export function scoreResponse(questionType: string, rawResponse: string): number {
  const map = SCORE_MAPS[questionType] || SCORE_MAPS.frequency;
  return map[rawResponse.toLowerCase()] ?? 50;
}

export function computeDomainScore(
  domainId: string,
  layer1Scores: number[],
  layer2Scores?: number[]
): { layer1Score: number; layer2Score: number | null; finalScore: number; triggeredLayer2: boolean } {
  let layer1Score = 0;
  for (let i = 0; i < layer1Scores.length && i < CIE_CONFIG.layer1Weights.length; i++) {
    layer1Score += layer1Scores[i] * CIE_CONFIG.layer1Weights[i];
  }

  const triggeredLayer2 =
    layer1Score < CIE_CONFIG.deepDiveTrigger.domainScore ||
    layer1Scores.some((s) => s < CIE_CONFIG.deepDiveTrigger.questionScore);

  let layer2Score: number | null = null;
  if (layer2Scores && layer2Scores.length > 0) {
    layer2Score = 0;
    for (let i = 0; i < layer2Scores.length && i < CIE_CONFIG.layer2Weights.length; i++) {
      layer2Score += layer2Scores[i] * CIE_CONFIG.layer2Weights[i];
    }
  }

  const finalScore =
    layer2Score !== null
      ? layer2Score * CIE_CONFIG.blendWeights.layer2 + layer1Score * CIE_CONFIG.blendWeights.layer1
      : layer1Score;

  return {
    layer1Score: Math.round(layer1Score * 10) / 10,
    layer2Score: layer2Score !== null ? Math.round(layer2Score * 10) / 10 : null,
    finalScore: Math.round(finalScore * 10) / 10,
    triggeredLayer2,
  };
}

export function trafficLight(score: number): "GREEN" | "YELLOW" | "ORANGE" | "RED" {
  if (score >= CIE_CONFIG.thresholds.GREEN) return "GREEN";
  if (score >= CIE_CONFIG.thresholds.YELLOW) return "YELLOW";
  if (score >= CIE_CONFIG.thresholds.ORANGE) return "ORANGE";
  return "RED";
}
