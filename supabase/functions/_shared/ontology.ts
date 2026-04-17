// ============================================================================
// _shared/ontology.ts
// Loads the biomarker ontology and provides helpers for:
//   - injecting the ontology as a constrained vocabulary into LLM prompts
//   - validating LLM-returned canonical_concept_id against the vocabulary
//   - enriching accepted observations with canonical metadata
// ============================================================================

export type OntologyConcept = {
  id: string;
  label: string;
  unit: string | null;
  domain: string | null;
  biomarker_class: string | null;
  source_systems: string[];
  known_aliases: string[];
};

export type Ontology = {
  ontology_version: string;
  generated_at: string;
  description: string;
  concepts: OntologyConcept[];
};

// ----------------------------------------------------------------------------
// Load the ontology (embedded in deno deploy via fetch from Supabase Storage
// or inlined at build time).
// For the edge function, we inline it via a fetch from a public URL, or the
// simplest deploy pattern: paste the JSON into the function file.
// ----------------------------------------------------------------------------

let _ontologyCache: Ontology | null = null;

export async function loadOntology(supabaseUrl: string): Promise<Ontology> {
  if (_ontologyCache) return _ontologyCache;

  // Option A: fetch from public storage bucket
  // (Preferred — ontology is versioned in the bucket and can be updated without redeploying.)
  const url = `${supabaseUrl}/storage/v1/object/public/ontology/biomarker_ontology.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ontology_load_failed: ${res.status} from ${url}. Upload biomarker_ontology.json to the 'ontology' public bucket.`);
  }
  _ontologyCache = await res.json();
  return _ontologyCache!;
}

// ----------------------------------------------------------------------------
// Format the ontology as a constrained vocabulary list for the LLM prompt.
// Keeps the output compact to save tokens — just id, label, unit, and 2-3
// aliases per concept so the LLM has examples.
// ----------------------------------------------------------------------------
export function formatOntologyForPrompt(
  ontology: Ontology,
  sourceSystem: "lab" | "inbody" | "fibroscan" = "lab",
): string {
  const relevant = ontology.concepts.filter((c) =>
    c.source_systems.includes(sourceSystem),
  );

  const lines = relevant.map((c) => {
    const sampleAliases = c.known_aliases.slice(0, 3).join(" | ");
    const unit = c.unit ?? "?";
    const domain = c.domain ?? "?";
    return `  ${c.id}  (${c.label}, unit=${unit}, domain=${domain}, e.g.: ${sampleAliases})`;
  });

  return [
    `=== BIOMARKER ONTOLOGY (constrained vocabulary, version ${ontology.ontology_version}) ===`,
    `You MUST pick canonical_concept_id from this list. If no concept matches, return "unknown" and use proposed_concept_id to suggest one.`,
    "",
    ...lines,
    "",
    "=== END ONTOLOGY ===",
  ].join("\n");
}

// ----------------------------------------------------------------------------
// Validate that an LLM-returned canonical_concept_id is in the ontology.
// ----------------------------------------------------------------------------
export function validateConceptId(
  ontology: Ontology,
  conceptId: string | null | undefined,
): { valid: boolean; concept?: OntologyConcept } {
  if (!conceptId || conceptId === "unknown") {
    return { valid: false };
  }
  const c = ontology.concepts.find((x) => x.id === conceptId);
  return c ? { valid: true, concept: c } : { valid: false };
}

// ----------------------------------------------------------------------------
// Enrich an observation with canonical unit from the ontology.
// Used at ingest after the LLM returns its classification.
// ----------------------------------------------------------------------------
export function enrichWithCanonical(
  ontology: Ontology,
  conceptId: string,
  rawValue: number | null,
  sourceUnit: string | null,
  llmProvidedFactor: number | null,
  llmProvidedOffset: number | null,
): {
  canonical_concept_id: string;
  canonical_label: string;
  canonical_unit: string | null;
  canonical_value: number | null;
  biomarker_class: string | null;
  domain: string | null;
} | null {
  const concept = ontology.concepts.find((c) => c.id === conceptId);
  if (!concept) return null;

  const factor = llmProvidedFactor ?? 1;
  const offset = llmProvidedOffset ?? 0;
  const canonicalValue = rawValue !== null && rawValue !== undefined
    ? rawValue * factor + offset
    : null;

  return {
    canonical_concept_id: concept.id,
    canonical_label: concept.label,
    canonical_unit: concept.unit,
    canonical_value: canonicalValue,
    biomarker_class: concept.biomarker_class,
    domain: concept.domain,
  };
}
