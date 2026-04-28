// src/lib/allowedVizzhyConcepts.ts
//
// Canonical list of Vizzhy-named concepts the resolver may surface as
// branded framing. Anything outside this list still gets a plain
// biological explanation — but the resolver MUST NOT invent new
// Vizzhy-named compound constructs (e.g. "mitochondrial resilience
// index"). See docs/UCDE_DEFINITION_CONTEXT_MAPPING_v1.md (Phase B v2).
//
// `vizzhy_concept_mapped = true` means the hovered term resolves to one
// of these concepts. It does NOT mean the term is medically valid, nor
// that the resolver should refuse to answer terms outside the list.

export const ALLOWED_VIZZHY_CONCEPTS = [
  "terrain",
  "axis",
  "cluster",
  "gate",
  "coherence",
  "contradiction",
  "scar",
  "plasticity",
  "reversibility",
  "confidence",
  "witness",
  "closure",
  "slope",
  "trajectory",
  "phase ledger",
  "breadth",
  "depth",
  "cluster tension",
  "named contradiction",
  "biotype",
  "compass mode",
  "readiness gate",
  "ccri zone",
  "retest",
  "sequence",
  "protocol",
  "checkpoint",
] as const;

export type AllowedVizzhyConcept = typeof ALLOWED_VIZZHY_CONCEPTS[number];