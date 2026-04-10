import { DerivedPattern } from "@/types/manifest";

export interface SignatureColor {
  hsl: string;
  category: string;
  label: string;
}

export function deriveSignatureColor(patterns: DerivedPattern[]): SignatureColor {
  if (!patterns || patterns.length === 0) {
    return { hsl: "220 20% 50%", category: "default", label: "Slate" };
  }

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
    if (/ldl|cholesterol|blood pressure|cardiovas|bp|lipid/.test(text)) scores.cardiovascular += weight;
    if (/sleep|hrv|circadian|recovery/.test(text)) scores.sleep += weight;
    if (/gut|digest|microbiome|permeab/.test(text)) scores.gut += weight;
    if (/cortisol|stress|adrenal/.test(text)) scores.stress += weight;
  }

  const topCategory = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

  if (!topCategory || topCategory[1] === 0) {
    return { hsl: "220 20% 50%", category: "default", label: "Slate" };
  }

  const colorMap: Record<string, SignatureColor> = {
    metabolic: { hsl: "35 65% 50%", category: "metabolic", label: "Amber" },
    inflammation: { hsl: "174 55% 38%", category: "inflammation", label: "Deep teal" },
    cardiovascular: { hsl: "225 45% 50%", category: "cardiovascular", label: "Indigo" },
    sleep: { hsl: "265 40% 55%", category: "sleep", label: "Soft purple" },
    gut: { hsl: "145 30% 45%", category: "gut", label: "Sage" },
    stress: { hsl: "15 55% 55%", category: "stress", label: "Muted coral" },
  };

  return colorMap[topCategory[0]] || { hsl: "220 20% 50%", category: "default", label: "Slate" };
}
