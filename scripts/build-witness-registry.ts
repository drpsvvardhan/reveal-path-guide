#!/usr/bin/env node
/**
 * ============================================================================
 * scripts/build-witness-registry.ts
 * ----------------------------------------------------------------------------
 * P1a — Witness Signal Registry Build Script
 *
 * Reads the living ontology and CIE definitions. Emits a committable
 * migration SQL with deterministic INSERT ordering. Once the emitted SQL is
 * committed to the repo, that SQL becomes the constitutional artifact for
 * the registry version; the live bucket becomes irrelevant for this
 * migration.
 *
 * Per CodexOS (20 Apr 2026):
 *   Approach A — generate once, freeze as the constitutional seed.
 *
 * Deterministic ordering (required):
 *   Block 1: CIE responses      (sorted by signal key)
 *   Block 2: CIE domain scores  (sorted by signal key)
 *   Block 3: CIE gate scores    (sorted by signal key)
 *   Block 4: lab ontology       (sorted by signal key)
 *   Block 5: InBody signals     (sorted by signal key)
 *   Block 6: FibroScan signals  (sorted by signal key)
 *
 * Usage:
 *
 *   # 1. Download the live ontology from Supabase Storage:
 *   #    curl -o ontology.json \
 *   #      "https://<project>.supabase.co/storage/v1/object/public/ontology/biomarker_ontology.json"
 *   #
 *   # 2. Run the generator (from repo root):
 *   npx tsx scripts/build-witness-registry.ts \
 *     --ontology ./ontology.json \
 *     --cie-seed ./src/lib/cieSeedData.ts \
 *     --inbody-map ./src/lib/inbodyToTerrainMap.ts \
 *     --output ./supabase/migrations/20260420134700_p1a_witness_registry_seed.sql
 *
 *   # 3. Review the emitted SQL. Commit it. That SQL is now the
 *   #    constitutional artifact; this script regenerates it identically
 *   #    if re-run against the same inputs.
 *
 * Hold: P1a does not make the system smarter. It makes future intelligence
 * lawful.
 * ============================================================================
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ============================================================================
// Types — mirror _shared/witness.ts. Kept local to avoid a dependency on the
// edge-function module from a build script.
// ============================================================================

type WitnessSourceWindow =
  | "cie" | "lab" | "inbody" | "fibroscan" | "sensor" | "wearable"
  | "omics" | "imaging" | "medication" | "emr" | "history" | "narrative";

type WitnessDomainOfAccess =
  | "embodied_perception" | "symptom_continuity" | "biochemical_state_snapshot"
  | "biochemical_state_dynamic" | "body_composition" | "hepatic_mechanical_state"
  | "temporal_physiology" | "protein_abundance" | "gene_expression"
  | "genomic_variant" | "metabolic_flux" | "microbial_ecology"
  | "lipid_composition" | "structural_anatomy" | "clinical_compression"
  | "intervention_layer" | "environmental_exposure" | "psychosocial_context";

type WitnessEpistemicRole =
  | "direct_measure" | "self_report" | "dynamic_sensor" | "derived_score"
  | "compressed_label" | "intervention_context" | "historical_event";

type WitnessReliabilityClass = "high" | "medium" | "low" | "unknown";

type CompressionDepth = 0 | 1 | 2;

interface RegistryEntry {
  source_window: WitnessSourceWindow;
  signal: string;
  domain_of_access: WitnessDomainOfAccess;
  epistemic_role: WitnessEpistemicRole;
  reliability_class: WitnessReliabilityClass;
  compression_depth: CompressionDepth;
  label: string;
  unit: string | null;
  description: string | null;
  default_limitations: string[];
  default_confidence_basis: string;
  default_confidence_value: number;
  default_validity_window_seconds: number | null;
  ontology_version: string | null;
  ontology_concept_id: string | null;
  registry_seed_version: string;
}

// ============================================================================
// Constants
// ============================================================================

const REGISTRY_SEED_VERSION = "p1a_initial";
const MIGRATION_DATE_PREFIX = "20260420000100";

// ----------------------------------------------------------------------------
// Reserved-domain set (per CodexOS correction 1, 20 Apr 2026).
// No P1a registry row may use these domains. Schema check constraints
// enforce this; the build-time validator below mirrors the rule so we fail
// fast with clear messages rather than as Postgres constraint violations at
// migration-apply time.
// ----------------------------------------------------------------------------
const P1A_RESERVED_DOMAINS: ReadonlySet<WitnessDomainOfAccess> = new Set([
  "clinical_compression",
]);

// ----------------------------------------------------------------------------
// Canonical role → compression_depth mapping. Mirrors the SQL check
// constraints witness_*_depth_role_consistency and the TypeScript function
// compressionDepthForRole() in _shared/witness.ts.
// ----------------------------------------------------------------------------
function depthForRole(role: WitnessEpistemicRole): CompressionDepth {
  switch (role) {
    case "direct_measure":
    case "self_report":
    case "dynamic_sensor":
    case "intervention_context":
    case "historical_event":
      return 0;
    case "derived_score": return 1;
    case "compressed_label": return 2;
  }
}

// Validity windows (seconds). These are defaults; witnessify() can override
// per-witness based on value-specific context. Justifications live in the
// limitations and confidence_basis fields of each entry.
const ONE_DAY = 86400;
const ONE_WEEK = 7 * ONE_DAY;
const ONE_MONTH = 30 * ONE_DAY;
const THREE_MONTHS = 90 * ONE_DAY;
const ONE_YEAR = 365 * ONE_DAY;

// Sensible defaults by question type — applied to CIE response entries.
const CIE_QUESTION_TYPE_DEFAULTS: Record<
  string,
  {
    validity: number;
    limitation_addendum: string[];
  }
> = {
  frequency: {
    validity: ONE_MONTH,
    limitation_addendum: [
      "Frequency self-judgment is influenced by recency bias and baseline drift",
    ],
  },
  yesno: {
    validity: ONE_YEAR,
    limitation_addendum: [
      "Binary self-report does not capture severity or duration",
    ],
  },
  severity: {
    validity: ONE_WEEK,
    limitation_addendum: [
      "Subjective severity scales vary across individuals and contexts",
    ],
  },
  effectiveness: {
    validity: ONE_MONTH,
    limitation_addendum: [
      "Perceived effectiveness does not equal measured outcome",
    ],
  },
  comparison: {
    validity: ONE_MONTH,
    limitation_addendum: [
      "Comparative self-report depends on accurate recall of prior state",
    ],
  },
  chronotype: {
    validity: ONE_YEAR,
    limitation_addendum: [
      "Chronotype self-classification captures preference, not enforced sleep schedule",
    ],
  },
  activity: {
    validity: ONE_MONTH,
    limitation_addendum: [
      "Activity self-classification does not capture duration, intensity, or consistency",
    ],
  },
};

const CIE_RESPONSE_BASE_LIMITATIONS = [
  "Cannot detect subclinical biochemical state",
  "Reflects the patient's interpretive frame at the moment of answering",
  "Single-intake response; trajectory requires repeated assessment",
];

const CIE_DOMAIN_SCORE_BASE_LIMITATIONS = [
  "Aggregate of response witnesses; independent contribution must not be counted alongside constituent responses",
  "Inherits all limitations of its constituent response witnesses",
  "Cannot adjudicate biochemistry or downstream clinical interpretation",
];

const CIE_GATE_SCORE_BASE_LIMITATIONS = [
  "Aggregate of domain-score witnesses; independent contribution must not be counted alongside constituent domain scores or their underlying responses",
  "Gate-level traffic-light classification compresses graded information into three bins",
  "Represents a specific clinical lens (defined by constituent domains); does not replace system-wide reading",
];

// ============================================================================
// Argv parsing
// ============================================================================

interface Args {
  ontology: string;
  cieSeed: string;
  inbodyMap: string;
  output: string;
  dryRun: boolean;
  diffAgainst: string | null;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const out: Partial<Args> = { dryRun: false, diffAgainst: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === "--ontology") {
      out.ontology = v;
      i++;
    } else if (k === "--cie-seed") {
      out.cieSeed = v;
      i++;
    } else if (k === "--inbody-map") {
      out.inbodyMap = v;
      i++;
    } else if (k === "--output") {
      out.output = v;
      i++;
    } else if (k === "--dry-run") {
      out.dryRun = true;
    } else if (k === "--diff-against") {
      out.diffAgainst = v;
      i++;
    } else if (k === "-h" || k === "--help") {
      printHelp();
      process.exit(0);
    } else if (k.startsWith("--")) {
      console.error(`Unknown flag: ${k}`);
      printHelp();
      process.exit(2);
    }
  }
  // Required inputs (always needed to build the registry):
  const missing = ["ontology", "cieSeed", "inbodyMap"].filter(
    (k) => !(out as Record<string, unknown>)[k]
  );
  if (missing.length) {
    console.error(`Missing required arguments: ${missing.join(", ")}\n`);
    printHelp();
    process.exit(2);
  }
  // Must have at least one output mode: --output, --dry-run, or --diff-against.
  if (!out.output && !out.dryRun && !out.diffAgainst) {
    console.error(
      "Must specify one of: --output <path>, --dry-run, or --diff-against <path>\n"
    );
    printHelp();
    process.exit(2);
  }
  // Fill required-but-unused output with empty string when in dry-run/diff modes,
  // so downstream code can rely on the field existing.
  if (!out.output) {
    (out as Args).output = "";
  }
  return out as Args;
}

function printHelp(): void {
  console.error(
    `Usage:\n` +
      `  npx tsx scripts/build-witness-registry.ts \\\n` +
      `    --ontology ./ontology.json \\\n` +
      `    --cie-seed ./src/lib/cieSeedData.ts \\\n` +
      `    --inbody-map ./src/lib/inbodyToTerrainMap.ts \\\n` +
      `    [--output ./supabase/migrations/<timestamp>_p1a_witness_registry_seed.sql] \\\n` +
      `    [--dry-run] \\\n` +
      `    [--diff-against <existing-sql-path>]\n` +
      `\n` +
      `Output modes (choose one):\n` +
      `  --output <path>         Write generated SQL to this path.\n` +
      `  --dry-run               Print generated SQL to stdout without writing.\n` +
      `  --diff-against <path>   Compare generated SQL against an existing file.\n` +
      `                          Exit 0 if byte-identical, exit 1 otherwise.\n` +
      `                          Use this to verify constitutional determinism.\n`
  );
}

// ============================================================================
// CIE seed parsing
// ----------------------------------------------------------------------------
// We read cieSeedData.ts as source text and extract structure via a tightly-
// scoped regex + eval strategy. The seed file has a stable, hand-curated
// shape; we do NOT attempt general TS parsing. If the shape drifts, this
// script fails loudly and we update the extractor deliberately.
// ============================================================================

interface CieQuestionDef {
  id: string;
  text: string;
  type: keyof typeof CIE_QUESTION_TYPE_DEFAULTS;
}

interface CieDomainDef {
  id: string;
  name: string;
  axis: string;
  axisName: string;
  layer1: CieQuestionDef[];
  layer2: CieQuestionDef[];
}

interface CieGateDef {
  id: string;
  name: string;
  domains: string[];
}

function parseCieSeed(source: string): {
  domains: CieDomainDef[];
  gates: CieGateDef[];
} {
  // Extract CIE_DOMAINS array body. We must skip past the TypeScript type
  // annotation `: CieDomain[] = ` before looking for the opening `[` of the
  // array literal. Anchor on `=` first.
  const domainsDecl = source.indexOf("export const CIE_DOMAINS");
  if (domainsDecl < 0) {
    throw new Error("Cannot find CIE_DOMAINS in CIE seed source");
  }
  const domainsEq = source.indexOf("=", domainsDecl);
  if (domainsEq < 0) {
    throw new Error("Malformed CIE_DOMAINS declaration (no =)");
  }
  const domainsBodyStart = source.indexOf("[", domainsEq);
  const domainsBodyEnd = findMatchingBracket(source, domainsBodyStart, "[", "]");
  const domainsBody = source.slice(domainsBodyStart, domainsBodyEnd + 1);

  const gatesDecl = source.indexOf("export const CIE_GATES");
  if (gatesDecl < 0) {
    throw new Error("Cannot find CIE_GATES in CIE seed source");
  }
  const gatesEq = source.indexOf("=", gatesDecl);
  if (gatesEq < 0) {
    throw new Error("Malformed CIE_GATES declaration (no =)");
  }
  const gatesBodyStart = source.indexOf("[", gatesEq);
  const gatesBodyEnd = findMatchingBracket(source, gatesBodyStart, "[", "]");
  const gatesBody = source.slice(gatesBodyStart, gatesBodyEnd + 1);

  // Parse via eval-in-sandbox. The seed file uses plain object literals,
  // no imports, no computation. Safe enough for a build script we control.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const domains = Function(
    `"use strict"; return (${domainsBody});`
  )() as CieDomainDef[];
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const gates = Function(
    `"use strict"; return (${gatesBody});`
  )() as CieGateDef[];

  // Sanity checks
  if (!Array.isArray(domains) || domains.length !== 25) {
    throw new Error(
      `Expected 25 CIE domains; extracted ${domains?.length ?? "nothing"}`
    );
  }
  if (!Array.isArray(gates) || gates.length < 9) {
    throw new Error(
      `Expected at least 9 CIE gates; extracted ${gates?.length ?? "nothing"}`
    );
  }

  // Validate shape of each domain
  for (const d of domains) {
    if (!d.id || !d.name || !d.axis) {
      throw new Error(`Malformed domain: ${JSON.stringify(d)}`);
    }
    if (!Array.isArray(d.layer1) || d.layer1.length !== 3) {
      throw new Error(
        `Domain ${d.id} has ${d.layer1?.length ?? "no"} L1 questions; expected 3`
      );
    }
    if (!Array.isArray(d.layer2) || d.layer2.length !== 10) {
      throw new Error(
        `Domain ${d.id} has ${d.layer2?.length ?? "no"} L2 questions; expected 10`
      );
    }
    for (const q of [...d.layer1, ...d.layer2]) {
      if (!q.id || !q.text || !q.type) {
        throw new Error(
          `Malformed question in ${d.id}: ${JSON.stringify(q)}`
        );
      }
      if (!(q.type in CIE_QUESTION_TYPE_DEFAULTS)) {
        throw new Error(
          `Unknown question type "${q.type}" in ${q.id}. Extend CIE_QUESTION_TYPE_DEFAULTS.`
        );
      }
    }
  }
  return { domains, gates };
}

function findMatchingBracket(
  source: string,
  openIdx: number,
  open: string,
  close: string
): number {
  let depth = 0;
  let inString: "'" | '"' | "`" | null = null;
  let escape = false;
  for (let i = openIdx; i < source.length; i++) {
    const c = source[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === "\\") escape = true;
      else if (c === inString) inString = null;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      inString = c;
      continue;
    }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error(`Unmatched ${open} starting at offset ${openIdx}`);
}

// ============================================================================
// Ontology loading
// ============================================================================

interface OntologyConcept {
  id: string;
  label: string;
  unit: string | null;
  domain: string | null;
  biomarker_class: string | null;
  source_systems: string[];
  known_aliases: string[];
}

interface Ontology {
  ontology_version: string;
  generated_at: string;
  description: string;
  concepts: OntologyConcept[];
}

function loadOntology(p: string): Ontology {
  const raw = fs.readFileSync(p, "utf-8");
  const parsed = JSON.parse(raw) as Ontology;
  if (!parsed.ontology_version || !Array.isArray(parsed.concepts)) {
    throw new Error(`Malformed ontology JSON at ${p}`);
  }
  return parsed;
}

// ============================================================================
// InBody map loading (if used — currently overlaps with ontology's
// source_systems: ["inbody"] entries; we emit InBody entries from the
// ontology, not from inbodyToTerrainMap.ts. The InBody map is kept as a
// frontend display helper; registry authority is the ontology.)
//
// We still load the file to validate that every InBody signal referenced in
// the frontend exists in the ontology as a "inbody" concept; otherwise the
// script fails loudly.
// ============================================================================

function extractInBodySignalKeys(source: string): string[] {
  // Find the exported INBODY_TERRAIN_MAP record and extract top-level keys.
  const mapStart = source.indexOf("export const INBODY_TERRAIN_MAP");
  if (mapStart < 0) {
    throw new Error("Cannot find INBODY_TERRAIN_MAP in InBody map source");
  }
  const bodyStart = source.indexOf("{", mapStart);
  const bodyEnd = findMatchingBracket(source, bodyStart, "{", "}");
  const body = source.slice(bodyStart, bodyEnd + 1);
  // Top-level keys are declared as `  <key>: {` at 2-space indent.
  const keys: string[] = [];
  const lines = body.split("\n");
  for (const line of lines) {
    const m = line.match(/^  ([a-z_][a-z0-9_]*):\s*\{/);
    if (m) keys.push(m[1]);
  }
  if (keys.length === 0) {
    throw new Error("No InBody signal keys extracted");
  }
  return keys;
}

// ============================================================================
// Entry builders
// ============================================================================

function buildCieResponseEntries(domains: CieDomainDef[]): RegistryEntry[] {
  const entries: RegistryEntry[] = [];
  for (const d of domains) {
    const axisLabel = `${d.axis} — ${d.axisName}`;
    for (const layer of [1, 2] as const) {
      const qs = layer === 1 ? d.layer1 : d.layer2;
      for (const q of qs) {
        const typeDef = CIE_QUESTION_TYPE_DEFAULTS[q.type];
        const baseLimitations = [...CIE_RESPONSE_BASE_LIMITATIONS];
        const limitations = [...baseLimitations, ...typeDef.limitation_addendum];
        entries.push({
          source_window: "cie",
          signal: `cie.response.${q.id}`,
          domain_of_access: "embodied_perception",
          epistemic_role: "self_report",
          reliability_class: "medium",
          compression_depth: 0,
          label: `CIE ${q.id}: ${q.text.replace(/"/g, "'")}`,
          unit: null,
          description:
            `Individual CIE ${q.type} response, domain ${d.id} (${d.name}), ` +
            `axis ${axisLabel}, layer ${layer}.`,
          default_limitations: limitations,
          default_confidence_basis:
            `Self-report via a structured ${q.type} scale. Confidence is ` +
            `for the perception claim made, not for the underlying ` +
            `biochemistry or downstream clinical interpretation.`,
          default_confidence_value: 0.85,
          default_validity_window_seconds: typeDef.validity,
          ontology_version: null,
          ontology_concept_id: null,
          registry_seed_version: REGISTRY_SEED_VERSION,
        });
      }
    }
  }
  return entries;
}

function buildCieDomainScoreEntries(domains: CieDomainDef[]): RegistryEntry[] {
  return domains.map((d) => ({
    source_window: "cie",
    signal: `cie.domain_score.${d.id}`,
    domain_of_access: "embodied_perception",
    epistemic_role: "derived_score",
    reliability_class: "medium",
    compression_depth: 1,
    label: `CIE Domain Score — ${d.id}: ${d.name}`,
    unit: "score_0_100",
    description:
      `Aggregate domain score for ${d.id} (${d.name}), axis ${d.axis} ` +
      `(${d.axisName}). Weighted blend of L1 and L2 responses per CIE v2.2 ` +
      `scoring rules.`,
    default_limitations: [...CIE_DOMAIN_SCORE_BASE_LIMITATIONS],
    default_confidence_basis:
      `Aggregate of CIE responses within this domain, weighted per CIE v2.2. ` +
      `Confidence reflects aggregation coherence, not biochemical correlation.`,
    default_confidence_value: 0.8,
    default_validity_window_seconds: THREE_MONTHS,
    ontology_version: null,
    ontology_concept_id: null,
    registry_seed_version: REGISTRY_SEED_VERSION,
  }));
}

function buildCieGateScoreEntries(gates: CieGateDef[]): RegistryEntry[] {
  return gates.map((g) => ({
    source_window: "cie",
    signal: `cie.gate_score.${g.id}`,
    domain_of_access: "embodied_perception",
    epistemic_role: "compressed_label",
    reliability_class: "medium",
    compression_depth: 2,
    label: `CIE Gate — ${g.id}: ${g.name}`,
    unit: "score_0_100",
    description:
      `Gate-level CIE score for ${g.id} (${g.name}), aggregating domain ` +
      `scores: ${g.domains.join(", ")}. Produces a traffic-light ` +
      `classification (green/yellow/orange/red) per CIE v2.2 thresholds.`,
    default_limitations: [...CIE_GATE_SCORE_BASE_LIMITATIONS],
    default_confidence_basis:
      `Composition of domain-score witnesses into a gate-level lens. ` +
      `Confidence is for the compressed signal within its stated clinical ` +
      `lens, not for independent biological fact.`,
    default_confidence_value: 0.75,
    default_validity_window_seconds: THREE_MONTHS,
    ontology_version: null,
    ontology_concept_id: null,
    registry_seed_version: REGISTRY_SEED_VERSION,
  }));
}

function buildLabOntologyEntries(
  ontology: Ontology,
  sourceSystem: "lab" | "inbody" | "fibroscan"
): RegistryEntry[] {
  // One registry entry per (source_window, concept) pair. A concept with
  // source_systems: ["lab", "inbody"] produces two entries — one per window.
  const concepts = ontology.concepts.filter((c) =>
    c.source_systems.includes(sourceSystem)
  );
  return concepts.map((c) => {
    const domain: WitnessDomainOfAccess =
      sourceSystem === "lab"
        ? "biochemical_state_snapshot"
        : sourceSystem === "inbody"
        ? "body_composition"
        : "hepatic_mechanical_state";
    const reliability: WitnessReliabilityClass =
      sourceSystem === "lab" ? "high" : "high";
    const validity: number =
      sourceSystem === "lab"
        ? ONE_MONTH // most blood labs reflect days-to-weeks dynamics
        : sourceSystem === "inbody"
        ? THREE_MONTHS // body composition changes slowly
        : THREE_MONTHS; // hepatic elastography longitudinal
    return {
      source_window: sourceSystem,
      signal: `${sourceSystem}.${c.id}`,
      domain_of_access: domain,
      epistemic_role: "direct_measure",
      reliability_class: reliability,
      compression_depth: 0,
      label: c.label,
      unit: c.unit,
      description: buildLabDescription(c, sourceSystem),
      default_limitations: buildLabLimitations(c, sourceSystem),
      default_confidence_basis: buildLabConfidenceBasis(c, sourceSystem),
      default_confidence_value: 0.95,
      default_validity_window_seconds: validity,
      ontology_version: ontology.ontology_version,
      ontology_concept_id: c.id,
      registry_seed_version: REGISTRY_SEED_VERSION,
    };
  });
}

function buildLabDescription(
  c: OntologyConcept,
  sourceSystem: "lab" | "inbody" | "fibroscan"
): string {
  const parts: string[] = [];
  parts.push(`Canonical ${sourceSystem} concept ${c.id} — ${c.label}.`);
  if (c.domain) parts.push(`Clinical domain: ${c.domain}.`);
  if (c.biomarker_class) parts.push(`Biomarker class: ${c.biomarker_class}.`);
  return parts.join(" ");
}

function buildLabLimitations(
  c: OntologyConcept,
  sourceSystem: "lab" | "inbody" | "fibroscan"
): string[] {
  const base: string[] = [];
  if (sourceSystem === "lab") {
    base.push(
      "Single timepoint measurement; cannot speak to trajectory without repeated draws",
      "Snapshot biochemistry; cannot confirm causal driver without corroboration",
      "Does not speak to the patient's subjective experience or symptom burden",
      "Clinical interpretation requires additional witnesses from other domains"
    );
  } else if (sourceSystem === "inbody") {
    base.push(
      "Bioimpedance-derived estimate; accuracy depends on hydration and fasting state",
      "Does not distinguish metabolic drivers of body composition",
      "Cannot adjudicate intramuscular or visceral composition without imaging confirmation"
    );
  } else {
    base.push(
      "Elastography at one timepoint; cannot establish fibrosis trajectory without repeat",
      "Measures mechanical stiffness; does not identify etiology",
      "Probe-dependent; inter-operator and inter-device variability exists"
    );
  }
  if (c.domain) {
    base.push(
      `Speaks to ${c.domain} within its source domain; cannot adjudicate unrelated systems`
    );
  }
  return base;
}

function buildLabConfidenceBasis(
  c: OntologyConcept,
  sourceSystem: "lab" | "inbody" | "fibroscan"
): string {
  if (sourceSystem === "lab") {
    return (
      `Standard lab assay with established precision for ${c.label}. ` +
      `Confidence is in the measurement itself; clinical interpretation ` +
      `requires additional witnesses and temporal context.`
    );
  }
  if (sourceSystem === "inbody") {
    return (
      `InBody bioimpedance measurement for ${c.label}. Confidence is in ` +
      `the measurement given standard fasting and hydration protocol; ` +
      `interpretation requires comparison with reference ranges and trend.`
    );
  }
  return (
    `FibroScan elastography measurement for ${c.label}. Confidence is in ` +
    `the mechanical reading given standard probe placement; etiology ` +
    `requires additional witnesses from lab and history.`
  );
}

// ============================================================================
// SQL emission
// ============================================================================

function escapeSqlText(s: string): string {
  return s.replace(/'/g, "''");
}

function arrayToSql(arr: string[]): string {
  const escaped = arr.map((x) => `'${escapeSqlText(x)}'`);
  return `ARRAY[${escaped.join(", ")}]::TEXT[]`;
}

function nullableText(s: string | null): string {
  if (s === null || s === undefined) return "NULL";
  return `'${escapeSqlText(s)}'`;
}

function nullableBigint(n: number | null): string {
  if (n === null || n === undefined) return "NULL";
  return String(n);
}

function emitInsertForBlock(
  header: string,
  entries: RegistryEntry[]
): string[] {
  // Lexicographic sort by signal key. This is intentional and canonical:
  //   - deterministic across machines and locales (no Intl collation)
  //   - stable against future additions (new signals land in the right place)
  //   - diff-clean (adding a new domain inserts a contiguous block)
  //
  // Note: this produces "A1D1, A1D10, A1D2" ordering rather than numeric
  // "A1D1, A1D2, ..., A1D10". That is correct. Human-readable numeric
  // order would require locale-aware collation which is not byte-stable
  // across machines. Tool-readability > human-browseability for a
  // constitutional artifact.
  const sortedEntries = [...entries].sort((a, b) =>
    a.signal < b.signal ? -1 : a.signal > b.signal ? 1 : 0
  );
  const lines: string[] = [];
  lines.push("");
  lines.push(`-- ${"=".repeat(72)}`);
  lines.push(`-- BLOCK: ${header}`);
  lines.push(`-- Count: ${sortedEntries.length}`);
  lines.push(`-- ${"=".repeat(72)}`);
  lines.push("");
  for (const e of sortedEntries) {
    lines.push(`INSERT INTO public.witness_signal_registry (`);
    lines.push(
      `  source_window, signal, domain_of_access, epistemic_role, reliability_class,`
    );
    lines.push(
      `  compression_depth, label, unit, description,`
    );
    lines.push(
      `  default_limitations, default_confidence_basis, default_confidence_value,`
    );
    lines.push(
      `  default_validity_window_seconds, ontology_version, ontology_concept_id,`
    );
    lines.push(`  registry_seed_version`);
    lines.push(`) VALUES (`);
    lines.push(`  '${e.source_window}',`);
    lines.push(`  '${escapeSqlText(e.signal)}',`);
    lines.push(`  '${e.domain_of_access}',`);
    lines.push(`  '${e.epistemic_role}',`);
    lines.push(`  '${e.reliability_class}',`);
    lines.push(`  ${e.compression_depth},`);
    lines.push(`  '${escapeSqlText(e.label)}',`);
    lines.push(`  ${nullableText(e.unit)},`);
    lines.push(`  ${nullableText(e.description)},`);
    lines.push(`  ${arrayToSql(e.default_limitations)},`);
    lines.push(`  '${escapeSqlText(e.default_confidence_basis)}',`);
    lines.push(`  ${e.default_confidence_value.toFixed(3)},`);
    lines.push(
      `  ${nullableBigint(e.default_validity_window_seconds)},`
    );
    lines.push(`  ${nullableText(e.ontology_version)},`);
    lines.push(`  ${nullableText(e.ontology_concept_id)},`);
    lines.push(`  '${e.registry_seed_version}'`);
    lines.push(`);`);
    lines.push("");
  }
  return lines;
}

function emitHeader(stats: {
  cieResponses: number;
  cieDomainScores: number;
  cieGateScores: number;
  labs: number;
  inbody: number;
  fibroscan: number;
  ontologyVersion: string;
  cieVersion: string;
}): string[] {
  // Note: no generation timestamp is emitted. The constitutional artifact
  // must be byte-identical across regenerations from the same inputs. Use
  // git blame / commit metadata for authorship-date provenance instead.
  return [
    "-- ============================================================================",
    "-- P1a — WITNESS SIGNAL REGISTRY SEED",
    "-- ============================================================================",
    `-- Generator: scripts/build-witness-registry.ts`,
    `-- CIE seed version: ${stats.cieVersion}`,
    `-- Ontology version: ${stats.ontologyVersion}`,
    `-- Registry seed version: ${REGISTRY_SEED_VERSION}`,
    "--",
    "-- This SQL is the constitutional artifact for the P1a witness signal",
    "-- registry. Once committed, it freezes the canonical seed. The live",
    "-- ontology bucket is source for generation but is no longer source of",
    "-- truth for this migration.",
    "--",
    "-- Regeneration from the same ontology version + CIE seed version MUST",
    "-- produce a byte-identical file. Use --diff-against to verify.",
    "--",
    "-- Entry counts:",
    `--   CIE responses:      ${stats.cieResponses}`,
    `--   CIE domain scores:  ${stats.cieDomainScores}`,
    `--   CIE gate scores:    ${stats.cieGateScores}`,
    `--   Lab concepts:       ${stats.labs}`,
    `--   InBody concepts:    ${stats.inbody}`,
    `--   FibroScan concepts: ${stats.fibroscan}`,
    `--   Total:              ${
      stats.cieResponses +
      stats.cieDomainScores +
      stats.cieGateScores +
      stats.labs +
      stats.inbody +
      stats.fibroscan
    }`,
    "--",
    "-- Hold: P1a does not make the system smarter. It makes future",
    "-- intelligence lawful.",
    "-- ============================================================================",
    "",
    "BEGIN;",
    "",
    "-- ----------------------------------------------------------------------------",
    "-- Double-seed guard: if any rows already exist for this registry_seed_version,",
    "-- fail loudly rather than silently insert duplicates. A partial registry is",
    "-- worse than no registry; the migration must be a clean idempotent commit.",
    "-- ----------------------------------------------------------------------------",
    "DO $$",
    "DECLARE",
    "  existing_count INTEGER;",
    "BEGIN",
    "  SELECT COUNT(*) INTO existing_count",
    "  FROM public.witness_signal_registry",
    `  WHERE registry_seed_version = '${REGISTRY_SEED_VERSION}';`,
    "  IF existing_count > 0 THEN",
    `    RAISE EXCEPTION 'registry_seed_version ${REGISTRY_SEED_VERSION} already has % rows in witness_signal_registry. Aborting to avoid duplicate seeding.', existing_count;`,
    "  END IF;",
    "END $$;",
    "",
  ];
}

function emitFooter(): string[] {
  return [
    "",
    "COMMIT;",
    "",
    "-- ============================================================================",
    "-- END OF REGISTRY SEED",
    "-- ============================================================================",
    "",
  ];
}

// ============================================================================
// Pre-emit validation
// ----------------------------------------------------------------------------
// Mirrors the SQL check constraints so we catch violations at build time
// with clear error messages rather than as Postgres constraint violations
// when the migration is applied. Runs against the fully assembled entry
// list just before SQL emission.
// ============================================================================

function validateEntries(entries: RegistryEntry[]): void {
  const seenKeys = new Set<string>();
  let errorCount = 0;

  const reportError = (e: RegistryEntry, field: string, msg: string) => {
    console.error(
      `  ✗ [${e.source_window}:${e.signal}] ${field}: ${msg}`
    );
    errorCount++;
  };

  for (const e of entries) {
    const key = `${e.source_window}:${e.signal}`;

    // 1. Duplicate composite-key detection.
    if (seenKeys.has(key)) {
      reportError(e, "duplicate_key", `(source_window, signal) pair already present`);
      continue;
    }
    seenKeys.add(key);

    // 2. Reserved-domain guard (CodexOS correction 1).
    if (P1A_RESERVED_DOMAINS.has(e.domain_of_access)) {
      reportError(
        e,
        "domain_of_access",
        `uses reserved P1a domain "${e.domain_of_access}" — see P1A_RESERVED_DOMAINS and schema constraint witness_signal_registry_no_clinical_compression_in_p1a`
      );
    }

    // 3. Non-empty limitations; no blank entries.
    if (!e.default_limitations || e.default_limitations.length === 0) {
      reportError(e, "default_limitations", "empty array — violates schema constraint");
    } else {
      for (const [i, lim] of e.default_limitations.entries()) {
        if (!lim || lim.trim().length === 0) {
          reportError(e, "default_limitations", `entry [${i}] is blank`);
        }
      }
    }

    // 4. Confidence basis ≥ 20 chars.
    if (!e.default_confidence_basis || e.default_confidence_basis.length < 20) {
      reportError(
        e,
        "default_confidence_basis",
        `< 20 chars (got ${e.default_confidence_basis?.length ?? 0}) — violates schema constraint`
      );
    }

    // 5. Confidence in [0, 1].
    if (
      e.default_confidence_value < 0 ||
      e.default_confidence_value > 1 ||
      !Number.isFinite(e.default_confidence_value)
    ) {
      reportError(
        e,
        "default_confidence_value",
        `out of [0, 1]: ${e.default_confidence_value}`
      );
    }

    // 6. compression_depth ∈ {0, 1, 2}.
    if (![0, 1, 2].includes(e.compression_depth)) {
      reportError(
        e,
        "compression_depth",
        `out of {0, 1, 2}: ${e.compression_depth}`
      );
    }

    // 7. compression_depth consistent with epistemic_role (CodexOS correction 3).
    const expected = depthForRole(e.epistemic_role);
    if (e.compression_depth !== expected) {
      reportError(
        e,
        "compression_depth",
        `depth ${e.compression_depth} inconsistent with epistemic_role "${e.epistemic_role}" (expected ${expected})`
      );
    }

    // 8. Signal non-empty.
    if (!e.signal || e.signal.length === 0) {
      reportError(e, "signal", "empty string");
    }

    // 9. Label non-empty.
    if (!e.label || e.label.length === 0) {
      reportError(e, "label", "empty string");
    }
  }

  if (errorCount > 0) {
    throw new Error(
      `[validate] ${errorCount} entry-level violation(s). SQL emission aborted. ` +
      `Fix the builder functions (buildCieResponseEntries / buildCieDomainScoreEntries / ` +
      `buildCieGateScoreEntries / buildLabOntologyEntries) before re-running.`
    );
  }

  console.log(`[validate] ${entries.length} entries passed all pre-emit checks`);
}

// ============================================================================
// Main
// ============================================================================

function main(): void {
  const args = parseArgs();

  console.log("[p1a-registry-build] Loading inputs...");
  const cieSource = fs.readFileSync(args.cieSeed, "utf-8");
  const { domains, gates } = parseCieSeed(cieSource);
  console.log(
    `  CIE seed: ${domains.length} domains, ${gates.length} gates`
  );

  const ontology = loadOntology(args.ontology);
  console.log(
    `  Ontology: version ${ontology.ontology_version}, ${ontology.concepts.length} concepts`
  );

  const inbodySource = fs.readFileSync(args.inbodyMap, "utf-8");
  const inbodyFrontendKeys = extractInBodySignalKeys(inbodySource);
  console.log(
    `  InBody frontend keys: ${inbodyFrontendKeys.length}`
  );

  // Extract CIE seed version from source.
  const cieVersionMatch = cieSource.match(/version:\s*"([^"]+)"/);
  const cieVersion = cieVersionMatch ? cieVersionMatch[1] : "unknown";

  console.log("[p1a-registry-build] Building entries...");

  const cieResponses = buildCieResponseEntries(domains);
  const cieDomainScores = buildCieDomainScoreEntries(domains);
  const cieGateScores = buildCieGateScoreEntries(gates);
  const labs = buildLabOntologyEntries(ontology, "lab");
  const inbody = buildLabOntologyEntries(ontology, "inbody");
  const fibroscan = buildLabOntologyEntries(ontology, "fibroscan");

  // Sanity check: every InBody frontend key must have an ontology concept.
  const inbodyConceptIds = new Set(inbody.map((e) => e.ontology_concept_id));
  const missingInbody = inbodyFrontendKeys.filter(
    (k) => !inbodyConceptIds.has(k)
  );
  if (missingInbody.length > 0) {
    console.warn(
      `[p1a-registry-build] WARNING: ${missingInbody.length} InBody frontend keys have no ontology concept:\n` +
        missingInbody.map((k) => `    - ${k}`).join("\n") +
        `\n  Either add these concepts to the ontology with source_systems: ["inbody"], ` +
        `or accept that they are frontend-display-only and will not be witnessed.`
    );
  }

  console.log(
    `  Entries: ${cieResponses.length} responses, ${cieDomainScores.length} domain scores, ` +
      `${cieGateScores.length} gate scores, ${labs.length} labs, ${inbody.length} inbody, ` +
      `${fibroscan.length} fibroscan`
  );

  // Pre-emit validation: catch doctrinal violations before SQL is written.
  // Mirrors the SQL check constraints; fails fast with clear messages if any
  // entry would be rejected at migration-apply time.
  console.log("[p1a-registry-build] Validating entries...");
  const allEntries: RegistryEntry[] = [
    ...cieResponses,
    ...cieDomainScores,
    ...cieGateScores,
    ...labs,
    ...inbody,
    ...fibroscan,
  ];
  validateEntries(allEntries);

  console.log("[p1a-registry-build] Emitting SQL...");

  const lines: string[] = [];
  lines.push(
    ...emitHeader({
      cieResponses: cieResponses.length,
      cieDomainScores: cieDomainScores.length,
      cieGateScores: cieGateScores.length,
      labs: labs.length,
      inbody: inbody.length,
      fibroscan: fibroscan.length,
      ontologyVersion: ontology.ontology_version,
      cieVersion,
    })
  );
  lines.push(
    ...emitInsertForBlock(
      "CIE responses (direct self-report, compression_depth = 0)",
      cieResponses
    )
  );
  lines.push(
    ...emitInsertForBlock(
      "CIE domain scores (derived_score, compression_depth = 1)",
      cieDomainScores
    )
  );
  lines.push(
    ...emitInsertForBlock(
      "CIE gate scores (compressed_label, compression_depth = 2)",
      cieGateScores
    )
  );
  lines.push(
    ...emitInsertForBlock(
      "Lab ontology concepts (direct_measure, biochemical_state_snapshot)",
      labs
    )
  );
  lines.push(
    ...emitInsertForBlock(
      "InBody concepts (direct_measure, body_composition)",
      inbody
    )
  );
  lines.push(
    ...emitInsertForBlock(
      "FibroScan concepts (direct_measure, hepatic_mechanical_state)",
      fibroscan
    )
  );
  lines.push(...emitFooter());

  const sql = lines.join("\n");

  // --diff-against: regeneration determinism check.
  // Exit 0 if byte-identical, exit 1 if not. This is how we verify the
  // constitutional invariant: "Re-running the generator against the same
  // inputs MUST produce a byte-identical file."
  if (args.diffAgainst) {
    const existing = fs.readFileSync(args.diffAgainst, "utf-8");
    if (existing === sql) {
      console.log(
        `[p1a-registry-build] ✓ Byte-identical: generated output matches ${args.diffAgainst}`
      );
      console.log(
        `[p1a-registry-build]   length: ${sql.length.toLocaleString()} bytes, entries: ${allEntries.length}`
      );
      process.exit(0);
    } else {
      console.error(
        `[p1a-registry-build] ✗ DIFFERENCE DETECTED against ${args.diffAgainst}`
      );
      console.error(
        `  existing: ${existing.length.toLocaleString()} bytes`
      );
      console.error(
        `  generated: ${sql.length.toLocaleString()} bytes`
      );
      // Find first diverging line number to localize the drift.
      const existingLines = existing.split("\n");
      const generatedLines = sql.split("\n");
      const maxCompare = Math.min(existingLines.length, generatedLines.length);
      for (let i = 0; i < maxCompare; i++) {
        if (existingLines[i] !== generatedLines[i]) {
          console.error(`  first divergence at line ${i + 1}:`);
          console.error(`    existing:  ${existingLines[i]}`);
          console.error(`    generated: ${generatedLines[i]}`);
          break;
        }
      }
      if (existingLines.length !== generatedLines.length) {
        console.error(
          `  line count differs: existing=${existingLines.length}, generated=${generatedLines.length}`
        );
      }
      process.exit(1);
    }
  }

  // --dry-run: print to stdout without writing.
  if (args.dryRun) {
    process.stdout.write(sql);
    console.error(
      `[p1a-registry-build] (dry-run) ${sql.length.toLocaleString()} bytes, ${allEntries.length} entries — nothing written`
    );
    return;
  }

  // Default path: write to --output.
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, sql, "utf-8");

  console.log(
    `[p1a-registry-build] Wrote ${sql.length.toLocaleString()} bytes to ${args.output}`
  );
  console.log(
    `[p1a-registry-build] Done. Review, commit, and do not regenerate without a migration version bump.`
  );
}

main();
