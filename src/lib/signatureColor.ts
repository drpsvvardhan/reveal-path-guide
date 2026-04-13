import { DerivedPattern } from "@/types/manifest";

export interface SignatureColor {
  hsl: string;
  category: string;
  label: string;
  explanation: string;
}

interface CIEDomainScoreInput {
  domain_id: string;
  axis: string;
  final_score: number;
}

/**
 * Derive signature color from derived patterns, falling back to CIE domain scores.
 * The signature represents the dominant clinical theme in the patient's biology.
 */
export function deriveSignatureColor(
  patterns: DerivedPattern[],
  domainScores?: Record<string, CIEDomainScoreInput>,
): SignatureColor {
  const colorMap: Record<string, SignatureColor> = {
    metabolic: { hsl: "35 65% 50%", category: "metabolic", label: "Amber", explanation: "Your dominant biological theme is metabolic — glucose processing, insulin sensitivity, and energy regulation are where your body is working hardest." },
    inflammation: { hsl: "174 55% 38%", category: "inflammation", label: "Deep teal", explanation: "Your dominant biological theme is inflammation — your immune signaling and barrier systems are the most active area of your terrain." },
    cardiovascular: { hsl: "225 45% 50%", category: "cardiovascular", label: "Indigo", explanation: "Your dominant biological theme is cardiovascular — lipid transport, vascular tone, and circulatory regulation are where your body is directing the most effort." },
    sleep: { hsl: "265 40% 55%", category: "sleep", label: "Soft purple", explanation: "Your dominant biological theme is sleep and recovery — circadian rhythm, HRV, and autonomic regulation are your body's most active area of work." },
    gut: { hsl: "145 30% 45%", category: "gut", label: "Sage", explanation: "Your dominant biological theme is gut and immune tolerance — your digestive and microbiome systems are where your body is investing the most energy." },
    stress: { hsl: "15 55% 55%", category: "stress", label: "Muted coral", explanation: "Your dominant biological theme is stress regulation — cortisol rhythm and adrenal function are where your body is working hardest to maintain balance." },
    hormonal: { hsl: "320 35% 50%", category: "hormonal", label: "Dusty rose", explanation: "Your dominant biological theme is hormonal regulation — your endocrine signaling is the area where your body is directing the most attention." },
  };

  const defaultColor: SignatureColor = { hsl: "220 20% 50%", category: "default", label: "Slate", explanation: "Your signature color reflects a balanced biological profile with no single dominant theme standing out above the rest." };

  // ── Primary: from derived patterns ──
  if (patterns && patterns.length > 0) {
    const severityWeight: Record<string, number> = {
      critical: 4, high: 3, moderate: 2, informational: 1,
    };

    const scores: Record<string, number> = {
      metabolic: 0, inflammation: 0, cardiovascular: 0, sleep: 0, gut: 0, stress: 0,
    };

    for (const p of patterns) {
      const weight = severityWeight[p.severity] || 1;
      const text = `${p.title} ${p.rule_id} ${p.summary}`.toLowerCase();

      if (/glucose|hba1c|insulin|metabolic|blood sugar/.test(text)) scores.metabolic += weight;
      if (/crp|inflamm|immune|ferritin|esr/.test(text)) scores.inflammation += weight;
      if (/ldl|cholesterol|blood pressure|cardiovas|bp|lipid|apob/.test(text)) scores.cardiovascular += weight;
      if (/sleep|hrv|circadian|recovery/.test(text)) scores.sleep += weight;
      if (/gut|digest|microbiome|permeab/.test(text)) scores.gut += weight;
      if (/cortisol|stress|adrenal/.test(text)) scores.stress += weight;
    }

    const topCategory = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    if (topCategory && topCategory[1] > 0) {
      return colorMap[topCategory[0]] || defaultColor;
    }
  }

  // ── Fallback: from CIE domain scores (weakest axis = signature) ──
  if (domainScores && Object.keys(domainScores).length > 0) {
    const axisScores: Record<string, number[]> = {};
    for (const d of Object.values(domainScores)) {
      if (!axisScores[d.axis]) axisScores[d.axis] = [];
      axisScores[d.axis].push(d.final_score);
    }

    const axisMeans = Object.entries(axisScores).map(([axis, scores]) => ({
      axis,
      mean: scores.reduce((a, b) => a + b, 0) / scores.length,
    })).sort((a, b) => a.mean - b.mean);

    const weakest = axisMeans[0];
    if (weakest && weakest.mean < 95) {
      const axisMap: Record<string, string> = {
        "A - Metabolic": "metabolic",
        "B - Cardiovascular": "cardiovascular",
        "C - Neuroendocrine": "stress",
        "D - Gut-Immune": "gut",
        "E - Structural": "inflammation",
        "F - Brain-Cognitive": "sleep",
        "G - Hormonal": "hormonal",
        "H - Lifestyle": "stress",
      };
      const category = axisMap[weakest.axis];
      if (category && colorMap[category]) {
        return colorMap[category];
      }
    }
  }

  return defaultColor;
}
