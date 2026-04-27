// src/lib/definitionTemplates.ts
//
// Patient-grounded contextual hover composer — registry for ~10 known
// concept words. Each entry holds the Vizzhy definition (matches the voice
// of shipped tooltips: intelligent, non-clinical, second-person, never
// wellness-app phrasing) and a function that composes the patient's own
// numbers into a second sentence. If grounding data is unavailable the
// composer renders the Vizzhy definition followed by `fallbackWhenDataNull`.
//
// `scar` and `plasticity` ship with `patientGroundingTemplate` returning
// null — the substrate doesn't store them yet. They render Vizzhy-only
// with their fallback line. Do not fabricate data.

import type {
  DefinitionContext,
  DefinitionAxis,
} from "@/types/definitionContext";

export interface DefinitionTemplate {
  conceptId: string;
  vizzhyDefinition: string;
  patientGroundingTemplate: (ctx: DefinitionContext) => string | null;
  fallbackWhenDataNull: string;
}

function joinPlain(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return items.slice(0, -1).join(", ") + " and " + items.slice(-1);
}

function topByValue(axes: DefinitionAxis[], n: number, dir: "high" | "low") {
  const sorted = [...axes].sort((a, b) =>
    dir === "high" ? b.value - a.value : a.value - b.value
  );
  return sorted.slice(0, n);
}

const TEMPLATES: Record<string, DefinitionTemplate> = {
  axis: {
    conceptId: "axis",
    vizzhyDefinition:
      "An axis is one of the seven coordinates Vizzhy reads to describe your terrain — each one a different angle on the same biology.",
    patientGroundingTemplate: (ctx) => {
      if (!ctx.axes || ctx.axes.length === 0) return null;
      const named = ctx.axes
        .map((a) => `${a.label} ${a.value}`)
        .join(" · ");
      return `Right now your seven read: ${named}.`;
    },
    fallbackWhenDataNull:
      "Your seven coordinates appear once your assessment is in.",
  },

  terrain: {
    conceptId: "terrain",
    vizzhyDefinition:
      "Your terrain is the living shape of your biology — not a score, but the seven coordinates read together as one picture.",
    patientGroundingTemplate: (ctx) => {
      if (!ctx.axes || ctx.axes.length === 0 || !ctx.terrainAxesSummary)
        return null;
      const status =
        ctx.terrainOverallStatus === "coherent"
          ? "Right now your terrain reads coherent overall"
          : ctx.terrainOverallStatus === "needs-attention"
          ? "Right now your terrain has a few areas asking for attention"
          : "Right now your terrain is mixed";
      return `${status} — ${ctx.terrainAxesSummary}`;
    },
    fallbackWhenDataNull:
      "Your terrain comes into view once Vizzhy has enough signal to draw it.",
  },

  cluster: {
    conceptId: "cluster",
    vizzhyDefinition:
      "A cluster is a pattern Vizzhy has triangulated across more than one source — a finding that several pieces of your data point to together.",
    patientGroundingTemplate: (ctx) => {
      if (ctx.clusterCount === null || ctx.clusterCount === 0) return null;
      const tb = ctx.clusterTierBreakdown;
      const robust = (tb?.robust ?? 0) + (tb?.supported ?? 0);
      const developing = tb?.developing ?? 0;
      const early = (tb?.tentative ?? 0) + (tb?.emerging ?? 0);
      const parts: string[] = [];
      if (robust > 0) parts.push(`${robust} well-supported`);
      if (developing > 0) parts.push(`${developing} still developing`);
      if (early > 0) parts.push(`${early} early`);
      const breakdown = parts.length > 0 ? ` — ${joinPlain(parts)}` : "";
      return `You currently have ${ctx.clusterCount} active cluster${
        ctx.clusterCount === 1 ? "" : "s"
      }${breakdown}.`;
    },
    fallbackWhenDataNull:
      "Clusters appear here once Vizzhy has enough overlapping evidence to name a pattern.",
  },

  gate: {
    conceptId: "gate",
    vizzhyDefinition:
      "A gate is one of the checkpoints Vizzhy uses to read a specific system in your body — each gate watches a different door.",
    patientGroundingTemplate: (ctx) => {
      if (!ctx.gates || ctx.gates.length === 0) return null;
      const total = ctx.gates.length;
      const attention = ctx.gatesAttention ?? [];
      if (attention.length === 0) {
        return `All ${total} of your gates are reading green right now.`;
      }
      const names = joinPlain(attention.slice(0, 3).map((g) => g.name));
      return `${attention.length} of your ${total} gates are asking for attention right now — ${names}.`;
    },
    fallbackWhenDataNull:
      "Your gate readings appear once your assessment is complete.",
  },

  coherence: {
    conceptId: "coherence",
    vizzhyDefinition:
      "Coherence is how strongly the different threads of your data agree with each other — a measure of how clearly your biology is speaking with one voice.",
    patientGroundingTemplate: (ctx) => {
      if (ctx.coherenceAverage === null || ctx.coherenceLabel === null)
        return null;
      const pct = Math.round(ctx.coherenceAverage * 100);
      const label =
        ctx.coherenceLabel === "high"
          ? "high — your data is telling a clear story"
          : ctx.coherenceLabel === "mixed"
          ? "mixed — some threads agree, others diverge"
          : "low — your data is still pulling in different directions";
      return `Across your active clusters that average sits at ${pct}%, which Vizzhy reads as ${label}.`;
    },
    fallbackWhenDataNull:
      "Coherence becomes readable once you have a few active clusters to compare.",
  },

  contradiction: {
    conceptId: "contradiction",
    vizzhyDefinition:
      "Vizzhy holds contradictions as first-class evidence — when two parts of your data disagree, that disagreement itself is a finding worth naming.",
    patientGroundingTemplate: (ctx) => {
      const named = ctx.contradictions?.length ?? 0;
      const tensions = ctx.tensionCount ?? 0;
      if (named === 0 && tensions === 0) return null;
      if (named === 0) {
        return `Right now you have no named contradictions, with ${tensions} cluster tension${
          tensions === 1 ? "" : "s"
        } sitting alongside.`;
      }
      return `Right now you have ${named} named contradiction${
        named === 1 ? "" : "s"
      } across ${tensions} cluster tension${tensions === 1 ? "" : "s"}.`;
    },
    fallbackWhenDataNull:
      "Contradictions surface here as Vizzhy finds threads in your data that don't agree.",
  },

  scar: {
    conceptId: "scar",
    vizzhyDefinition:
      "A scar, in Vizzhy's reading, is a long-lived imprint on your biology — something past that still shapes how your body behaves now.",
    // Substrate not yet in place. Render Vizzhy-only, no fabricated data.
    patientGroundingTemplate: () => null,
    fallbackWhenDataNull:
      "Vizzhy doesn't yet name your specific scars; that read is on the way.",
  },

  plasticity: {
    conceptId: "plasticity",
    vizzhyDefinition:
      "Plasticity is how willing your biology is to change — the room your body has to move from where it is now toward where it could be.",
    // First-class plasticity index doesn't exist yet; do not synthesize.
    patientGroundingTemplate: () => null,
    fallbackWhenDataNull:
      "A direct plasticity read isn't surfaced yet; for now, see your reversibility horizons.",
  },

  reversibility: {
    conceptId: "reversibility",
    vizzhyDefinition:
      "Reversibility is Vizzhy's read on which findings can move quickly, which take time, and which are likely to stay — sorted by realistic horizon.",
    patientGroundingTemplate: (ctx) => {
      const r = ctx.reversibility;
      if (!r) return null;
      const total =
        r.weeksCount + r.monthsCount + r.slowCount + r.permanentCount;
      if (total === 0) return null;
      const parts: string[] = [];
      if (r.weeksCount) parts.push(`${r.weeksCount} in weeks`);
      if (r.monthsCount) parts.push(`${r.monthsCount} in months`);
      if (r.slowCount) parts.push(`${r.slowCount} slower`);
      if (r.permanentCount) parts.push(`${r.permanentCount} likely to stay`);
      return `Across your findings, ${joinPlain(parts)}.`;
    },
    fallbackWhenDataNull:
      "Reversibility horizons appear here once Vizzhy has named the findings to sort.",
  },

  confidence: {
    conceptId: "confidence",
    vizzhyDefinition:
      "Confidence is how sure Vizzhy is about a finding — sorted into what we know clearly, what we're investigating, and what wants a retest before we commit.",
    patientGroundingTemplate: (ctx) => {
      const c = ctx.confidence;
      if (!c) return null;
      const total = c.confidentCount + c.investigatingCount + c.retestCount;
      if (total === 0) return null;
      return `Right now ${c.confidentCount} read clearly, ${c.investigatingCount} are still being investigated, and ${c.retestCount} want a retest.`;
    },
    fallbackWhenDataNull:
      "Your confidence breakdown comes into view as findings settle.",
  },
};

/** Map a tapped word (already lowercased + stripped) to a known concept id.
 *  Uses singular/plural normalization and a tiny synonym set. Returns null
 *  when the word is not a known concept — caller falls through to the
 *  unchanged define-term edge path. */
export function resolveConceptId(rawWord: string): string | null {
  const w = rawWord.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return null;
  const direct = (id: string) => (TEMPLATES[id] ? id : null);

  // Plural → singular
  const singular = w.endsWith("s") ? w.slice(0, -1) : w;

  // Direct hits
  if (TEMPLATES[w]) return w;
  if (TEMPLATES[singular]) return singular;

  // Synonyms / variants
  const map: Record<string, string> = {
    coordinate: "axis",
    coordinates: "axis",
    cluster: "cluster",
    pattern: "cluster",
    patterns: "cluster",
    gate: "gate",
    gates: "gate",
    coherence: "coherence",
    coherent: "coherence",
    contradiction: "contradiction",
    contradictions: "contradiction",
    tension: "contradiction",
    tensions: "contradiction",
    scar: "scar",
    scars: "scar",
    plasticity: "plasticity",
    plastic: "plasticity",
    reversibility: "reversibility",
    reversible: "reversibility",
    confidence: "confidence",
    confident: "confidence",
    terrain: "terrain",
  };
  return map[w] ?? map[singular] ?? direct(w);
}

export function getDefinitionTemplate(
  conceptId: string
): DefinitionTemplate | null {
  return TEMPLATES[conceptId] ?? null;
}

/** Compose the final tooltip text for a known concept.
 *  Returns `{ vizzhy, grounding }` where `grounding` is either the
 *  patient-grounded sentence or the fallback line (never null). */
export function composeDefinition(
  conceptId: string,
  ctx: DefinitionContext
): { vizzhy: string; grounding: string; grounded: boolean } | null {
  const t = getDefinitionTemplate(conceptId);
  if (!t) return null;
  const grounded = t.patientGroundingTemplate(ctx);
  return {
    vizzhy: t.vizzhyDefinition,
    grounding: grounded ?? t.fallbackWhenDataNull,
    grounded: grounded !== null,
  };
}

export const KNOWN_CONCEPT_IDS = Object.keys(TEMPLATES);

/**
 * Multi-word concept phrases. Order matters — longer phrases first so the
 * matcher tries 3-grams before 2-grams. Each phrase maps to a `conceptId`
 * that may exist in TEMPLATES (uses its grounding) or be a phrase-only
 * pseudo-concept (Vizzhy-only definition, no grounding).
 *
 * Vizzhy-only entries use `phraseOnlyDefinition`; matched as known so the
 * tapped span is highlighted as a single unit and the edge-function call
 * is bypassed.
 */
export interface PhraseEntry {
  phrase: string; // lowercased, single space between words
  conceptId?: string; // resolves to TEMPLATES entry
  phraseOnlyDefinition?: string; // used when no conceptId match
}

export const KNOWN_PHRASES: PhraseEntry[] = [
  // Mapped to existing concepts
  { phrase: "biological terrain", conceptId: "terrain" },
  { phrase: "your terrain", conceptId: "terrain" },
  { phrase: "named contradiction", conceptId: "contradiction" },
  { phrase: "named contradictions", conceptId: "contradiction" },
  { phrase: "cluster tension", conceptId: "contradiction" },
  { phrase: "cluster tensions", conceptId: "contradiction" },
  { phrase: "active cluster", conceptId: "cluster" },
  { phrase: "active clusters", conceptId: "cluster" },

  // Phrase-only Vizzhy definitions (no grounding yet)
  {
    phrase: "advanced glycation",
    phraseOnlyDefinition:
      "Advanced glycation is the slow caramelizing of proteins by sugar — a marker of how much wear your tissues are carrying from years of glucose exposure.",
  },
  {
    phrase: "advanced glycation end products",
    phraseOnlyDefinition:
      "Advanced glycation end products are the residues left when sugar bonds permanently to your tissues — Vizzhy reads them as accumulated metabolic wear.",
  },
  {
    phrase: "phase angle",
    phraseOnlyDefinition:
      "Phase angle is a single number that reads cell-membrane integrity — how electrically intact your cells are. Higher means younger-behaving tissue.",
  },
  {
    phrase: "visceral fat",
    phraseOnlyDefinition:
      "Visceral fat is the deep abdominal fat wrapped around your organs — metabolically louder than the fat under your skin, and the one Vizzhy watches.",
  },
  {
    phrase: "insulin resistance",
    phraseOnlyDefinition:
      "Insulin resistance is when your cells stop hearing insulin's signal — your pancreas has to shout louder to get glucose into the cell.",
  },
  {
    phrase: "metabolic flexibility",
    phraseOnlyDefinition:
      "Metabolic flexibility is your body's ability to switch fuel sources — burning fat or glucose as needed without getting stuck on one.",
  },
  {
    phrase: "muscle mass",
    phraseOnlyDefinition:
      "Muscle mass is your active tissue reservoir — not strength alone, but the metabolic engine Vizzhy watches as a marker of resilience.",
  },
  {
    phrase: "lean mass",
    phraseOnlyDefinition:
      "Lean mass is everything in you that isn't fat — muscle, bone, organs, water. Vizzhy reads it as the structural side of your composition.",
  },
  {
    phrase: "body composition",
    phraseOnlyDefinition:
      "Body composition is the ratio of what you're made of — fat, muscle, water, bone — read together rather than collapsed into one weight number.",
  },
  {
    phrase: "intracellular water",
    phraseOnlyDefinition:
      "Intracellular water is the fluid held inside your cells — a quiet read on cellular health and how well-hydrated your tissue actually is.",
  },
  {
    phrase: "extracellular water",
    phraseOnlyDefinition:
      "Extracellular water is the fluid sitting outside your cells. When the ratio shifts upward, Vizzhy reads it as inflammation or fluid stress.",
  },
  {
    phrase: "liver stiffness",
    phraseOnlyDefinition:
      "Liver stiffness is a measure of how much scar tissue your liver carries — the firmer the read, the more remodeling has happened.",
  },
  {
    phrase: "liver fat",
    phraseOnlyDefinition:
      "Liver fat is fat stored inside the liver itself, not around it — a quieter signal than weight, but a louder one for metabolic health.",
  },
  {
    phrase: "fatty liver",
    phraseOnlyDefinition:
      "Fatty liver is fat accumulating inside liver cells — often silent, often early, and one of the more reversible findings Vizzhy tracks.",
  },
  {
    phrase: "controlled attenuation parameter",
    phraseOnlyDefinition:
      "Controlled attenuation parameter is the FibroScan number for liver fat — measured in dB/m, read alongside liver stiffness.",
  },
  {
    phrase: "calcium score",
    phraseOnlyDefinition:
      "A calcium score is a CT-derived count of calcified plaque in your coronary arteries — Vizzhy reads it as cumulative cardiovascular history.",
  },
  {
    phrase: "coronary calcium",
    phraseOnlyDefinition:
      "Coronary calcium is hardened plaque in the arteries that feed your heart — present means there's been remodeling, regardless of current symptoms.",
  },
  {
    phrase: "biological age",
    phraseOnlyDefinition:
      "Biological age is what your body reads as, separate from your chronological age — a synthesis Vizzhy builds from the seven coordinates.",
  },
  {
    phrase: "heart rate variability",
    phraseOnlyDefinition:
      "Heart rate variability is the small beat-to-beat changes in your heart rhythm — a read on how flexibly your nervous system is operating.",
  },
  {
    phrase: "vo2 max",
    phraseOnlyDefinition:
      "VO2 max is the ceiling of how much oxygen your body can use under load — the single strongest signal of cardiopulmonary capacity.",
  },
  {
    phrase: "resting metabolic rate",
    phraseOnlyDefinition:
      "Resting metabolic rate is the energy your body burns at rest — the metabolic baseline Vizzhy uses to interpret intake and recovery.",
  },
  {
    phrase: "blood pressure",
    phraseOnlyDefinition:
      "Blood pressure is the force your circulating blood exerts on artery walls — read as a daily snapshot of vascular load.",
  },
];

/** Try matching a phrase starting at `startIndex` in a token array.
 *  Returns { length, conceptId?, phraseOnlyDefinition? } for the longest
 *  match (greedy 3-gram → 2-gram), or null. */
export function matchPhrase(
  tokensLower: string[],
  startIndex: number
): { length: number; conceptId?: string; phraseOnlyDefinition?: string } | null {
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
  // Try 4 → 3 → 2 word windows
  for (const len of [4, 3, 2]) {
    if (startIndex + len > tokensLower.length) continue;
    const window = tokensLower
      .slice(startIndex, startIndex + len)
      .map(norm)
      .filter(Boolean);
    if (window.length !== len) continue;
    const candidate = window.join(" ");
    const hit = KNOWN_PHRASES.find((p) => p.phrase === candidate);
    if (hit) {
      return {
        length: len,
        conceptId: hit.conceptId,
        phraseOnlyDefinition: hit.phraseOnlyDefinition,
      };
    }
  }
  return null;
}