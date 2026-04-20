// ============================================================================
// supabase/functions/_shared/witness.ts
// ----------------------------------------------------------------------------
// P1a — Canonical Witness Contracts
//
// This module is the sole source of truth for WitnessObject types and the
// witnessify() transformation contract. All edge functions that need to
// produce or consume witnesses MUST import from here.
//
// What this file provides:
//   - ObservationPacket type (canonical pre-witness form)
//   - WitnessObject type (the sacred object)
//   - All supporting enum types mirroring SQL schema
//   - witnessify() and witnessifyBatch() contracts
//   - Strict validators (applied at runtime by witnessify implementations)
//   - Version constants
//
// What this file does NOT provide:
//   - The witnessify() implementation against the registry — that lives in
//     _shared/witnessify_impl.ts (next artifact) because it requires DB
//     access to the registry table.
//   - Storage adapters — those live in consumer-specific code.
//
// Hold: P1a does not make the system smarter. It makes future intelligence
// lawful.
// ============================================================================

export const WITNESS_TRANSFORMATION_VERSION = "witnessify-v1.0.0";
export const WITNESS_REGISTRY_SEED_VERSION = "p1a_initial";

// ----------------------------------------------------------------------------
// ENUM types — mirror SQL enums exactly. Do not add values here without also
// adding them via migration to the corresponding PostgreSQL ENUM.
// ----------------------------------------------------------------------------

export type WitnessSourceWindow =
  | "cie"
  | "lab"
  | "inbody"
  | "fibroscan"
  | "sensor"      // RESERVED — no P1a registry entries
  | "wearable"    // RESERVED
  | "omics"       // RESERVED
  | "imaging"     // RESERVED
  | "medication"  // RESERVED
  | "emr"         // RESERVED
  | "history"     // RESERVED — not witnessed in P1a
  | "narrative";  // RESERVED — not witnessed in P1a

export type WitnessDomainOfAccess =
  | "embodied_perception"
  | "symptom_continuity"
  | "biochemical_state_snapshot"
  | "biochemical_state_dynamic"  // RESERVED
  | "body_composition"
  | "hepatic_mechanical_state"
  | "temporal_physiology"        // RESERVED
  | "protein_abundance"          // RESERVED
  | "gene_expression"            // RESERVED
  | "genomic_variant"            // RESERVED
  | "metabolic_flux"             // RESERVED
  | "microbial_ecology"          // RESERVED
  | "lipid_composition"          // RESERVED
  | "structural_anatomy"         // RESERVED
  | "clinical_compression"       // RESERVED OUT OF P1a — see below
  | "intervention_layer"         // RESERVED
  | "environmental_exposure"     // RESERVED
  | "psychosocial_context";      // RESERVED

// ----------------------------------------------------------------------------
// P1a RESERVATION (per CodexOS correction 1, 20 Apr 2026):
//
// clinical_compression is reserved out of P1a registry usage. The enum value
// remains in this file for forward compatibility in later phases that
// explicitly witness compressed clinical artifacts (diagnosis codes,
// narrative summaries). During P1a:
//   - no registry entry may use clinical_compression
//   - no WitnessObject may use clinical_compression
//   - the schema enforces this via check constraints on both
//     witness_signal_registry and witness_objects
//   - validateWitness() rejects it at runtime with a clear message
//
// When P1a clinical_compression reservation is lifted, remove the SQL
// check constraints and the P1A_RESERVED_DOMAINS set below.
// ----------------------------------------------------------------------------

export const P1A_RESERVED_DOMAINS: ReadonlySet<WitnessDomainOfAccess> = new Set([
  "clinical_compression",
]);

export type WitnessEpistemicRole =
  | "direct_measure"
  | "self_report"
  | "dynamic_sensor"
  | "derived_score"       // CIE domain scores — aggregates responses
  | "compressed_label"    // CIE gate scores — aggregates domain scores
  | "intervention_context"
  | "historical_event";

export type WitnessReliabilityClass =
  | "high"
  | "medium"
  | "low"
  | "unknown";

// Epistemic roles that MUST declare ancestry (enforced by SQL check
// constraint and runtime validator).
export const EPISTEMIC_ROLES_REQUIRING_ANCESTRY: readonly WitnessEpistemicRole[] = [
  "derived_score",
  "compressed_label",
];

// Epistemic roles that MUST NOT declare ancestry — they are source witnesses,
// not compressions.
export const EPISTEMIC_ROLES_FORBIDDING_ANCESTRY: readonly WitnessEpistemicRole[] = [
  "direct_measure",
  "self_report",
  "dynamic_sensor",
  "intervention_context",
  "historical_event",
];

// ----------------------------------------------------------------------------
// Compression depth (per CodexOS correction 3, 20 Apr 2026).
//
// Explicit metadata for the compression stack. Downstream reasoning filters
// by compression_depth = 0 to get source witnesses when no-double-counting
// matters, or joins across depths using ancestry_witness_ids when working
// with the full stack.
// ----------------------------------------------------------------------------

export type CompressionDepth = 0 | 1 | 2;

/**
 * Canonical mapping from epistemic_role to compression_depth. Matches the
 * PostgreSQL check constraint on both witness_signal_registry and
 * witness_objects (witness_*_depth_role_consistency).
 */
export function compressionDepthForRole(role: WitnessEpistemicRole): CompressionDepth {
  switch (role) {
    case "direct_measure":
    case "self_report":
    case "dynamic_sensor":
    case "intervention_context":
    case "historical_event":
      return 0;
    case "derived_score":
      return 1;
    case "compressed_label":
      return 2;
  }
}

// ----------------------------------------------------------------------------
// Registry entry — mirrors the witness_signal_registry table shape.
// Used by witnessify() to look up canonical defaults for a signal.
// ----------------------------------------------------------------------------

export interface WitnessSignalRegistryEntry {
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

// ----------------------------------------------------------------------------
// ObservationPacket — canonical pre-witness form.
// ----------------------------------------------------------------------------

export interface ObservationPacket {
  packet_id?: string;            // assigned by DB if materialized
  user_id: string;
  source_window: WitnessSourceWindow;
  signal: string;                // must match a registry entry
  value: unknown;                // raw value in native shape (stored as JSONB)
  unit: string | null;
  biological_timestamp: string;  // ISO 8601
  system_timestamp?: string;     // ISO 8601, defaults to now()

  // Provenance
  source_id: string | null;
  source_operator: string | null;
  source_method: string | null;
  source_table: string | null;   // raw table this shadows
  source_row_id: string | null;  // row id in that raw table

  // Context
  context: Record<string, unknown> | null;
}

// ----------------------------------------------------------------------------
// WitnessObject — the sacred object. Scoped testimony.
// ----------------------------------------------------------------------------

export interface WitnessObject {
  witness_id?: string;           // assigned by DB on insert
  user_id: string;

  // Derivation: EITHER a packet_id OR source_table+source_row_id must exist.
  derived_from_packet_id: string | null;
  source_table: string | null;
  source_row_id: string | null;

  // Ancestry: for compression witnesses (derived_score, compressed_label),
  // must be a non-empty array of witness_ids at the next level down.
  // For source witnesses, must be null or empty.
  ancestry_witness_ids: string[] | null;

  // Canonical fields
  source_window: WitnessSourceWindow;
  signal: string;
  domain_of_access: WitnessDomainOfAccess;
  epistemic_role: WitnessEpistemicRole;
  reliability_class: WitnessReliabilityClass;

  // Compression depth — carried forward from registry. Must be consistent
  // with epistemic_role via compressionDepthForRole(). 0 = source, 1 =
  // derived_score, 2 = compressed_label.
  compression_depth: CompressionDepth;

  // The observed value and its unit.
  observed_value: unknown;
  observed_unit: string | null;

  // The four load-bearing content fields.
  testimony: string;             // >= 20 chars AND >= 2× value length
  limitations: string[];         // non-empty
  confidence_value: number;      // [0, 1]
  confidence_basis: string;      // >= 20 chars

  // Temporal scope
  biological_timestamp: string;  // ISO 8601
  validity_window_seconds: number | null;

  // Structural conflict hints (for P1b1's Contradiction Graph)
  conflict_candidates: string[] | null;

  // System metadata
  transformation_version: string;
  registry_seed_version: string;
  created_at?: string;
}

// ----------------------------------------------------------------------------
// witnessify() — canonical transformation contract.
//
// Implementations live in _shared/witnessify_impl.ts (next artifact). This
// file declares the shape of what implementations must provide.
// ----------------------------------------------------------------------------

export interface WitnessifyContext {
  // The signal registry, keyed by `${source_window}:${signal}`.
  registry: Map<string, WitnessSignalRegistryEntry>;

  // Optional lookup: given a child witness (by source identity), find its
  // registered ancestors. Used when producing compression witnesses
  // (domain scores → response ancestries; gate scores → domain ancestries).
  getAncestors?: (
    childWitnessIds: string[]
  ) => Promise<string[]>;
}

// The transformation signature. Takes one packet, returns one witness.
export type WitnessifyFn = (
  packet: ObservationPacket,
  ctx: WitnessifyContext,
  // Optional ancestry override — only used when packet does not itself
  // carry ancestry metadata but the caller knows the ancestral witness IDs
  // (e.g., the batch processor pre-computes ancestries for compression levels).
  ancestryOverride?: string[]
) => WitnessObject;

// Batch signature. Order-preserving; accepts ancestry lookup for compression.
export type WitnessifyBatchFn = (
  packets: ObservationPacket[],
  ctx: WitnessifyContext
) => Promise<WitnessObject[]>;

// ----------------------------------------------------------------------------
// Structured errors. Implementations throw these; callers catch and decide.
// ----------------------------------------------------------------------------

export class WitnessMappingIncompleteError extends Error {
  public readonly source_window: WitnessSourceWindow;
  public readonly signal: string;

  constructor(source_window: WitnessSourceWindow, signal: string, detail?: string) {
    super(
      `witness_mapping_incomplete: no registry entry for ${source_window}:${signal}` +
        (detail ? ` — ${detail}` : "")
    );
    this.name = "WitnessMappingIncompleteError";
    this.source_window = source_window;
    this.signal = signal;
  }
}

export class WitnessValidationError extends Error {
  public readonly field: string;
  public readonly witness_signal: string;

  constructor(field: string, witness_signal: string, detail: string) {
    super(
      `witness_validation_failed: ${field} invalid for ${witness_signal} — ${detail}`
    );
    this.name = "WitnessValidationError";
    this.field = field;
    this.witness_signal = witness_signal;
  }
}

export class WitnessAncestryError extends Error {
  constructor(detail: string) {
    super(`witness_ancestry_error: ${detail}`);
    this.name = "WitnessAncestryError";
  }
}

// ----------------------------------------------------------------------------
// Runtime validators. Shared across witnessify implementations and the
// boundaryValidator's runtime checks.
// ----------------------------------------------------------------------------

const MIN_CONFIDENCE_BASIS_LEN = 20;
const MIN_TESTIMONY_LEN = 20;

/**
 * Emit a soft warning (non-throwing). Implementations can override by
 * injecting a logger; default routes to console.warn in dev contexts.
 */
export type WitnessWarningSink = (
  signal: string,
  rule: string,
  detail: string
) => void;

const DEFAULT_WARNING_SINK: WitnessWarningSink = (signal, rule, detail) => {
  // eslint-disable-next-line no-console
  console.warn(`witness_warning [${rule}] ${signal}: ${detail}`);
};

/**
 * Validate a WitnessObject against all doctrinal rules. Throws
 * WitnessValidationError or WitnessAncestryError on any HARD violation.
 * Soft rules (prose-quality heuristics, per CodexOS correction 2) emit
 * warnings via warningSink but do not throw.
 *
 * This runs before the DB insert as a defence-in-depth against schema
 * bypass attempts. The schema has the same HARD constraints encoded; a
 * validation error at this layer gives a clean error message instead of
 * a Postgres constraint violation.
 */
export function validateWitness(
  w: WitnessObject,
  warningSink: WitnessWarningSink = DEFAULT_WARNING_SINK
): void {
  const sig = `${w.source_window}:${w.signal}`;

  // 1. Derivation source present
  const hasPacket = !!w.derived_from_packet_id;
  const hasRow = !!w.source_table && !!w.source_row_id;
  if (!hasPacket && !hasRow) {
    throw new WitnessValidationError(
      "derivation",
      sig,
      "must have either derived_from_packet_id or (source_table, source_row_id)"
    );
  }

  // 2. Limitations non-empty
  if (!w.limitations || w.limitations.length === 0) {
    throw new WitnessValidationError(
      "limitations",
      sig,
      "must contain at least one explicit limitation"
    );
  }
  // Reject blank limitation strings
  for (const [i, lim] of w.limitations.entries()) {
    if (!lim || lim.trim().length === 0) {
      throw new WitnessValidationError(
        "limitations",
        sig,
        `entry ${i} is blank`
      );
    }
  }

  // 3. Confidence in [0, 1]
  if (w.confidence_value < 0 || w.confidence_value > 1 || !Number.isFinite(w.confidence_value)) {
    throw new WitnessValidationError(
      "confidence_value",
      sig,
      `out of [0, 1]: ${w.confidence_value}`
    );
  }

  // 4. Confidence basis meaningful
  if (!w.confidence_basis || w.confidence_basis.length < MIN_CONFIDENCE_BASIS_LEN) {
    throw new WitnessValidationError(
      "confidence_basis",
      sig,
      `< ${MIN_CONFIDENCE_BASIS_LEN} chars (got ${w.confidence_basis?.length ?? 0})`
    );
  }

  // 5. HARD: testimony has a minimum floor (schema-enforced too).
  //    SOFT: testimony-vs-value-length heuristic is advisory only (per
  //    CodexOS correction 2). Edge cases like long JSON values or tiny
  //    values with legitimate short testimony make a 2× coupling too
  //    brittle to treat as constitutional truth.
  if (!w.testimony || w.testimony.length < MIN_TESTIMONY_LEN) {
    throw new WitnessValidationError(
      "testimony",
      sig,
      `< ${MIN_TESTIMONY_LEN} chars (got ${w.testimony?.length ?? 0})`
    );
  }
  const valStr = typeof w.observed_value === "string"
    ? w.observed_value
    : JSON.stringify(w.observed_value);
  const heuristicFloor = 2 * valStr.length;
  if (heuristicFloor > MIN_TESTIMONY_LEN && w.testimony.length < heuristicFloor) {
    // Not thrown — soft signal.
    warningSink(
      sig,
      "testimony_brevity_heuristic",
      `testimony length ${w.testimony.length} < 2× value string length ${heuristicFloor}; possible lazy witness generation`
    );
  }

  // 6. Ancestry discipline (role-based). Depth-based enforcement is below
  //    in step 10 and is the primary structural rule; this is a role-based
  //    double-check.
  const mustHaveAncestry = EPISTEMIC_ROLES_REQUIRING_ANCESTRY.includes(w.epistemic_role);
  const mustNotHaveAncestry = EPISTEMIC_ROLES_FORBIDDING_ANCESTRY.includes(w.epistemic_role);
  const hasAncestry = !!w.ancestry_witness_ids && w.ancestry_witness_ids.length > 0;

  if (mustHaveAncestry && !hasAncestry) {
    throw new WitnessAncestryError(
      `epistemic_role ${w.epistemic_role} requires non-empty ancestry_witness_ids (signal: ${sig})`
    );
  }
  if (mustNotHaveAncestry && hasAncestry) {
    throw new WitnessAncestryError(
      `epistemic_role ${w.epistemic_role} must not declare ancestry — it is a source witness, not a compression (signal: ${sig})`
    );
  }

  // 7. No self-reference in ancestry
  if (hasAncestry && w.witness_id && w.ancestry_witness_ids!.includes(w.witness_id)) {
    throw new WitnessAncestryError(
      `witness_id ${w.witness_id} cannot be its own ancestor`
    );
  }

  // 8. Domain of access is a real canonical value (enum parse check)
  //    AND is not a P1a-reserved value (per CodexOS correction 1).
  const canonicalDomains: ReadonlyArray<WitnessDomainOfAccess> = [
    "embodied_perception", "symptom_continuity", "biochemical_state_snapshot",
    "biochemical_state_dynamic", "body_composition", "hepatic_mechanical_state",
    "temporal_physiology", "protein_abundance", "gene_expression",
    "genomic_variant", "metabolic_flux", "microbial_ecology",
    "lipid_composition", "structural_anatomy", "clinical_compression",
    "intervention_layer", "environmental_exposure", "psychosocial_context",
  ];
  if (!canonicalDomains.includes(w.domain_of_access)) {
    throw new WitnessValidationError(
      "domain_of_access",
      sig,
      `not a canonical domain value: "${w.domain_of_access}" — no 'general' or 'unknown' allowed`
    );
  }
  if (P1A_RESERVED_DOMAINS.has(w.domain_of_access)) {
    throw new WitnessValidationError(
      "domain_of_access",
      sig,
      `domain "${w.domain_of_access}" is reserved out of P1a. See P1A_RESERVED_DOMAINS and the SQL check constraint witness_objects_no_clinical_compression_in_p1a.`
    );
  }

  // 9. Transformation / registry version present
  if (!w.transformation_version || w.transformation_version.length === 0) {
    throw new WitnessValidationError(
      "transformation_version",
      sig,
      "must be set"
    );
  }
  if (!w.registry_seed_version || w.registry_seed_version.length === 0) {
    throw new WitnessValidationError(
      "registry_seed_version",
      sig,
      "must be set"
    );
  }

  // 10. Compression-depth consistency (per CodexOS correction 3).
  //     Hard structural rule. Mirrors both SQL check constraints
  //     (depth_role_consistency + ancestry_depth_consistency).
  const expectedDepth = compressionDepthForRole(w.epistemic_role);
  if (w.compression_depth !== expectedDepth) {
    throw new WitnessValidationError(
      "compression_depth",
      sig,
      `compression_depth=${w.compression_depth} inconsistent with epistemic_role=${w.epistemic_role} (expected depth ${expectedDepth})`
    );
  }
  // Depth 0 forbids ancestry; depths > 0 require it.
  if (w.compression_depth === 0 && hasAncestry) {
    throw new WitnessAncestryError(
      `compression_depth=0 source witness must not declare ancestry (signal: ${sig})`
    );
  }
  if (w.compression_depth > 0 && !hasAncestry) {
    throw new WitnessAncestryError(
      `compression_depth=${w.compression_depth} witness must declare non-empty ancestry (signal: ${sig})`
    );
  }
}

/**
 * Validate an ObservationPacket before witnessify is called. Catches gross
 * errors early with clear messages.
 */
export function validateObservationPacket(p: ObservationPacket): void {
  const sig = `${p.source_window}:${p.signal}`;
  if (!p.user_id) {
    throw new WitnessValidationError("user_id", sig, "must be set");
  }
  if (!p.signal || p.signal.length === 0) {
    throw new WitnessValidationError("signal", sig, "must be non-empty");
  }
  if (p.value === undefined) {
    throw new WitnessValidationError("value", sig, "must be defined (null is ok)");
  }
  if (!p.biological_timestamp) {
    throw new WitnessValidationError(
      "biological_timestamp",
      sig,
      "must be set"
    );
  }
  if (Number.isNaN(Date.parse(p.biological_timestamp))) {
    throw new WitnessValidationError(
      "biological_timestamp",
      sig,
      `not a valid ISO 8601 timestamp: ${p.biological_timestamp}`
    );
  }
}

/**
 * Build a registry lookup key.
 */
export function registryKey(source_window: WitnessSourceWindow, signal: string): string {
  return `${source_window}:${signal}`;
}

/**
 * Find a registry entry, throwing WitnessMappingIncompleteError if missing.
 */
export function requireRegistryEntry(
  ctx: WitnessifyContext,
  source_window: WitnessSourceWindow,
  signal: string
): WitnessSignalRegistryEntry {
  const entry = ctx.registry.get(registryKey(source_window, signal));
  if (!entry) {
    throw new WitnessMappingIncompleteError(source_window, signal);
  }
  return entry;
}

// ============================================================================
// END OF CANONICAL CONTRACTS
// ----------------------------------------------------------------------------
// The witnessify() implementation is in _shared/witnessify_impl.ts (next
// artifact). It uses these types and validators; any edge function producing
// or consuming witnesses imports from THIS file, not from _impl.
// ============================================================================
