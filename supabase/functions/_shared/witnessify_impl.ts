// ============================================================================
// supabase/functions/_shared/witnessify_impl.ts
// ----------------------------------------------------------------------------
// P1a — Artifact 4 — Witnessify Implementation
//
// Purpose:
//   Pure transformation library. Takes observations (lab / InBody / FibroScan
//   / full CIE assessments) and returns validated WitnessObjects with
//   ancestry wiring complete. No I/O. No Supabase client dependency.
//
// Design decisions (locked in with CodexOS, 20 Apr 2026):
//
//   Z — Hybrid scoping. Direct measures are witnessified one at a time;
//       full CIE assessments are witnessified as a single batch so the
//       three-tier compression ancestry (response → domain → gate) can be
//       wired in memory before any insert.
//
//   C — Configurable registry-miss strictness via
//       WitnessifyOptions.onRegistryMiss ∈ { 'throw' | 'skip_with_warning' |
//       'skip_silent' }. Live intake uses 'throw'. Backfill uses
//       'skip_with_warning'. Controlled recovery uses 'skip_silent'.
//
//   UUIDs generated here. Every returned WitnessObject carries a
//   witness_id. This is load-bearing for CIE batch ancestry wiring.
//
//   Inputs fully materialized. No assessment_id lookups. Callers pass in
//   the data structure directly. Keeps this module pure and unit-testable.
//
//   Provenance required. Every input must supply derived_from_packet_id OR
//   (source_table, source_row_id). Witnessify does not invent provenance.
//
// What this file does NOT do:
//   - Read from Supabase
//   - Write to Supabase
//   - Compute CIE scores (caller does that and passes computed results in)
//   - Produce trajectory witnesses (P1b)
//   - Produce intervention witnesses (P1b)
//   - Produce protocol witnesses (P1b)
//
// Hold: P1a does not make the system smarter. It makes future intelligence
// lawful.
// ============================================================================

import {
  type WitnessObject,
  type WitnessSignalRegistryEntry,
  type WitnessSourceWindow,
  type WitnessDomainOfAccess,
  type WitnessEpistemicRole,
  type WitnessReliabilityClass,
  type CompressionDepth,
  P1A_RESERVED_DOMAINS,
  EPISTEMIC_ROLES_REQUIRING_ANCESTRY,
  EPISTEMIC_ROLES_FORBIDDING_ANCESTRY,
  compressionDepthForRole,
  validateWitness,
  WitnessValidationError,
  WitnessAncestryError,
  WitnessMappingIncompleteError,
  WITNESS_TRANSFORMATION_VERSION,
  type WitnessWarningSink,
} from "./witness.ts";

// ============================================================================
// PUBLIC TYPES
// ============================================================================

/**
 * Registry miss strictness (Option C). Set per call site.
 *
 *   'throw'             — raise RegistryMissError on any unknown signal.
 *                         Use for live intake flows where unknown signals
 *                         indicate drift that should block ingestion.
 *
 *   'skip_with_warning' — skip the unknown signal, emit a structured
 *                         RegistryMiss entry in the result. Use for
 *                         historical backfill where partial success is
 *                         preferable to halting.
 *
 *   'skip_silent'       — skip without emitting warning. Use only for
 *                         controlled recovery flows where the caller has
 *                         already acknowledged and will reconcile later.
 */
export type OnRegistryMissPolicy = "throw" | "skip_with_warning" | "skip_silent";

export interface WitnessifyOptions {
  /** How to handle signals not found in the registry. */
  onRegistryMiss: OnRegistryMissPolicy;

  /**
   * Optional sink for soft warnings (e.g. testimony brevity heuristics).
   * If not provided, warnings are captured in WitnessifyResult.softWarnings
   * and the default console warning is suppressed.
   */
  warningSink?: WitnessWarningSink;

  /**
   * If true, catastrophic errors (ancestry cycles, schema impossibilities)
   * are still thrown. Set false only for exploratory diagnostic runs.
   * Default: true.
   */
  throwOnCatastrophic?: boolean;
}

/**
 * Abstraction over registry access. Tests provide a Map-backed impl; live
 * code provides a Supabase-backed impl (or a cached variant).
 *
 * Keyed by `${source_window}:${signal}`.
 */
export interface RegistryAccessor {
  /** Look up a signal. Returns null if not in registry. */
  get(source_window: WitnessSourceWindow, signal: string): WitnessSignalRegistryEntry | null;

  /** Total registry entry count (used for sanity checks and warnings). */
  size(): number;
}

/**
 * Build a RegistryAccessor from a fully-materialized list of entries.
 * Use this for tests or for call sites that load the registry once per
 * request.
 */
export function makeRegistryAccessor(
  entries: WitnessSignalRegistryEntry[]
): RegistryAccessor {
  const map = new Map<string, WitnessSignalRegistryEntry>();
  for (const e of entries) {
    map.set(`${e.source_window}:${e.signal}`, e);
  }
  return {
    get(source_window, signal) {
      return map.get(`${source_window}:${signal}`) ?? null;
    },
    size() {
      return map.size;
    },
  };
}

/** Structured record of a registry miss. */
export interface RegistryMiss {
  source_window: WitnessSourceWindow;
  signal: string;
  reason: string;
  input_ref: InputRef;
}

/**
 * Captures what input an error or miss came from, so callers can surface
 * the problem cleanly to the user or log with attribution.
 */
export type InputRef =
  | { kind: "direct_observation"; source_table: string; source_row_id: string }
  | { kind: "cie_response"; assessment_id: string; question_id: string }
  | { kind: "cie_domain_score"; assessment_id: string; domain_id: string }
  | { kind: "cie_gate_score"; assessment_id: string; gate_id: string };

/** Structured validation failure (doesn't throw in non-catastrophic mode). */
export interface ValidationFailure {
  input_ref: InputRef;
  error_name: string;
  message: string;
}

/** Uniform return shape. */
export interface WitnessifyResult<T> {
  /** Successfully produced and validated witnesses. */
  witnesses: T;
  /** Signals encountered that were not in the registry. */
  registry_misses: RegistryMiss[];
  /** Inputs that reached the validator and failed (non-catastrophic). */
  validation_failures: ValidationFailure[];
  /** Soft warnings from validateWitness (testimony brevity heuristic). */
  soft_warnings: Array<{ signal: string; rule: string; detail: string }>;
}

// ============================================================================
// PUBLIC ERRORS
// ============================================================================

export class RegistryMissError extends Error {
  readonly source_window: WitnessSourceWindow;
  readonly signal: string;
  readonly input_ref: InputRef;
  constructor(source_window: WitnessSourceWindow, signal: string, input_ref: InputRef) {
    super(
      `Registry miss for ${source_window}:${signal}. The signal is not present in the witness registry. ` +
        `Under strict ingestion policy this halts the flow. ` +
        `Either (a) add the signal to the ontology + regenerate the registry seed, ` +
        `or (b) switch the call site to 'skip_with_warning' if partial success is acceptable.`
    );
    this.name = "RegistryMissError";
    this.source_window = source_window;
    this.signal = signal;
    this.input_ref = input_ref;
  }
}

export class CatastrophicWitnessifyError extends Error {
  readonly cause_error_name: string;
  constructor(detail: string, causeName: string) {
    super(`Catastrophic witnessify error: ${detail}`);
    this.name = "CatastrophicWitnessifyError";
    this.cause_error_name = causeName;
  }
}

// ============================================================================
// PUBLIC INPUTS
// ============================================================================

/**
 * A single direct observation: lab value, InBody metric, FibroScan
 * reading, etc. Source_window and signal must be provided by the caller;
 * the caller is responsible for mapping from raw table columns to the
 * canonical signal key.
 */
export interface DirectObservationInput {
  user_id: string;

  /** Which source class this came from. */
  source_window: WitnessSourceWindow;
  /** Canonical signal key, must match a registry entry under that window. */
  signal: string;

  /** The measured value in native shape. */
  observed_value: unknown;
  /** The unit as reported by the source (not canonicalized). */
  observed_unit: string | null;

  /** ISO 8601 timestamp of biological event (collection / measurement). */
  biological_timestamp: string;

  /**
   * Provenance — one of these must be set. Enforced by schema; validated here
   * before construction.
   */
  derived_from_packet_id: string | null;
  source_table: string | null;
  source_row_id: string | null;

  /**
   * Human-visible testimony string. The caller constructs it with knowledge
   * of the observation context. If empty or too short, validation rejects
   * the witness (routed per options.onRegistryMiss semantics? No — through
   * validation_failures because it's a data-quality issue, not a registry
   * miss).
   */
  testimony: string;

  /**
   * Optional override for confidence_value / confidence_basis / limitations.
   * Omitted fields default from the registry entry. Providing overrides is
   * the exception, not the rule — used for known-off-protocol samples,
   * historical readings of uncertain provenance, etc.
   */
  overrides?: {
    confidence_value?: number;
    confidence_basis?: string;
    limitations?: string[];
    validity_window_seconds?: number | null;
  };

  /** Conflict candidates (populated by later passes; may be null here). */
  conflict_candidates?: string[] | null;
}

/**
 * A full CIE assessment for one user at one intake timepoint. The caller
 * has already computed domain scores and gate scores using the canonical
 * CIE v2.2 scoring methodology; witnessify does not do the math.
 */
export interface CieAssessmentInput {
  user_id: string;
  assessment_id: string;
  biological_timestamp: string;     // intake completion time
  source_table: string;             // e.g. "cie_assessments"
  assessment_row_id: string;        // the assessment row's primary key

  /** The raw responses. */
  responses: CieResponseInput[];

  /**
   * Computed domain scores. Each domain score references the responses that
   * went into it by question_id. Witnessify uses this mapping to wire
   * ancestry in-memory.
   */
  domain_scores: CieDomainScoreInput[];

  /**
   * Computed gate scores. Each gate score references the domain scores that
   * went into it by domain_id.
   */
  gate_scores: CieGateScoreInput[];
}

export interface CieResponseInput {
  question_id: string;              // e.g. "A1Q1", "A3D5"
  response_value: unknown;          // number, boolean, category, etc.
  response_unit: string | null;
  source_row_id: string;            // cie_responses row PK
  testimony: string;                // caller-constructed; structured per question
}

export interface CieDomainScoreInput {
  domain_id: string;                // e.g. "A1"
  score_value: number;
  score_unit: string | null;        // typically "score_0_100"
  source_row_id: string;            // cie_domain_scores row PK
  testimony: string;
  /** IDs of the responses that contributed to this domain score. */
  contributing_question_ids: string[];
}

export interface CieGateScoreInput {
  gate_id: string;                  // e.g. "CLI"
  score_value: number;
  score_unit: string | null;
  source_row_id: string;            // cie_gate_scores row PK
  testimony: string;
  /** IDs of the domain scores that contributed to this gate. */
  contributing_domain_ids: string[];
}

// ============================================================================
// PUBLIC ENTRY POINTS
// ============================================================================

/**
 * Transform a single direct observation (lab / InBody / FibroScan / etc)
 * into a validated WitnessObject.
 *
 * Returns a WitnessifyResult whose `witnesses` field is either a single
 * WitnessObject or null (on registry miss under skip policy, or on
 * validation failure). Catastrophic errors throw; non-catastrophic
 * failures are captured in `registry_misses` or `validation_failures`.
 */
export function witnessifyObservation(
  input: DirectObservationInput,
  registry: RegistryAccessor,
  options: WitnessifyOptions
): WitnessifyResult<WitnessObject | null> {
  const result: WitnessifyResult<WitnessObject | null> = {
    witnesses: null,
    registry_misses: [],
    validation_failures: [],
    soft_warnings: [],
  };

  const inputRef: InputRef = {
    kind: "direct_observation",
    source_table: input.source_table ?? "<unspecified>",
    source_row_id: input.source_row_id ?? "<unspecified>",
  };

  // Pre-validate provenance. Schema requires one of these to be set.
  if (!input.derived_from_packet_id && !(input.source_table && input.source_row_id)) {
    result.validation_failures.push({
      input_ref: inputRef,
      error_name: "ProvenanceIncomplete",
      message:
        "derived_from_packet_id is null AND (source_table, source_row_id) are not both set. " +
        "Witnessify requires explicit provenance.",
    });
    return result;
  }

  // Registry lookup
  const entry = registry.get(input.source_window, input.signal);
  if (!entry) {
    return handleRegistryMiss(
      input.source_window,
      input.signal,
      inputRef,
      options,
      result,
      "Signal not found in registry"
    );
  }

  // Reject P1a-reserved domains at the gate (defence-in-depth; schema
  // rejects them too, but we want the clean error path).
  if (P1A_RESERVED_DOMAINS.has(entry.domain_of_access)) {
    result.validation_failures.push({
      input_ref: inputRef,
      error_name: "P1aReservedDomain",
      message:
        `Registry entry for ${input.source_window}:${input.signal} declares ` +
        `domain_of_access='${entry.domain_of_access}', which is reserved out of P1a. ` +
        `This indicates a registry seed that was generated outside P1a discipline.`,
    });
    return result;
  }

  // Build the witness
  let witness: WitnessObject;
  try {
    witness = buildWitnessFromRegistry({
      entry,
      user_id: input.user_id,
      observed_value: input.observed_value,
      observed_unit: input.observed_unit,
      biological_timestamp: input.biological_timestamp,
      derived_from_packet_id: input.derived_from_packet_id,
      source_table: input.source_table,
      source_row_id: input.source_row_id,
      testimony: input.testimony,
      ancestry_witness_ids: null,      // direct observations have no ancestry
      overrides: input.overrides,
      conflict_candidates: input.conflict_candidates ?? null,
    });
  } catch (err) {
    return handleBuildError(err, inputRef, result, options);
  }

  // Validate
  try {
    validateWitness(witness, makeWarningCapture(result));
  } catch (err) {
    return handleValidationError(err, inputRef, result, options);
  }

  result.witnesses = witness;
  return result;
}

/**
 * Transform a full CIE assessment into a validated batch of WitnessObjects.
 *
 * Produces, in order:
 *   1. Response witnesses (compression_depth = 0, epistemic_role = self_report)
 *   2. Domain score witnesses (compression_depth = 1, derived_score)
 *      with ancestry_witness_ids = [response witness IDs for that domain]
 *   3. Gate score witnesses (compression_depth = 2, compressed_label)
 *      with ancestry_witness_ids = [domain witness IDs for that gate]
 *
 * Registry misses at any layer are handled per options.onRegistryMiss.
 * Domain scores whose contributing responses all missed the registry
 * still get produced if the domain signal itself is registered — but
 * their ancestry will reflect only the response witnesses that actually
 * landed. This preserves forward compatibility with CIE evolution: new
 * questions can be added to an existing domain before the registry is
 * bumped, and the domain score still witnesses correctly against the
 * responses it has.
 *
 * The returned array has all three tiers interleaved in canonical order
 * (all responses first, all domain scores next, all gate scores last)
 * so callers can insert in one transaction with FK integrity preserved.
 */
export function witnessifyCieAssessment(
  input: CieAssessmentInput,
  registry: RegistryAccessor,
  options: WitnessifyOptions
): WitnessifyResult<WitnessObject[]> {
  const result: WitnessifyResult<WitnessObject[]> = {
    witnesses: [],
    registry_misses: [],
    validation_failures: [],
    soft_warnings: [],
  };

  // ---- Pass 1: response witnesses --------------------------------------

  // Map from question_id to the produced response witness_id (for ancestry
  // wiring in pass 2). Only populated for responses that successfully
  // witnessified.
  const responseWitnessIdByQuestionId = new Map<string, string>();
  const responseWitnessById = new Map<string, WitnessObject>();

  for (const r of input.responses) {
    const signal = `cie.response.${r.question_id}`;
    const inputRef: InputRef = {
      kind: "cie_response",
      assessment_id: input.assessment_id,
      question_id: r.question_id,
    };

    const entry = registry.get("cie", signal);
    if (!entry) {
      const sub = handleRegistryMiss(
        "cie",
        signal,
        inputRef,
        options,
        { witnesses: null, registry_misses: [], validation_failures: [], soft_warnings: [] },
        "CIE response signal not in registry (likely a new question not yet in the registry seed)"
      );
      mergeSubResult(result, sub);
      if (options.onRegistryMiss === "throw") return result;
      continue;
    }

    let witness: WitnessObject;
    try {
      witness = buildWitnessFromRegistry({
        entry,
        user_id: input.user_id,
        observed_value: r.response_value,
        observed_unit: r.response_unit,
        biological_timestamp: input.biological_timestamp,
        derived_from_packet_id: null,
        source_table: "cie_responses",
        source_row_id: r.source_row_id,
        testimony: r.testimony,
        ancestry_witness_ids: null,
        conflict_candidates: null,
      });
    } catch (err) {
      const sub = handleBuildError<null>(err, inputRef, { witnesses: null, registry_misses: [], validation_failures: [], soft_warnings: [] }, options);
      mergeSubResult(result, sub);
      continue;
    }

    try {
      validateWitness(witness, makeWarningCapture(result));
    } catch (err) {
      const sub = handleValidationError<null>(err, inputRef, { witnesses: null, registry_misses: [], validation_failures: [], soft_warnings: [] }, options);
      mergeSubResult(result, sub);
      continue;
    }

    const wid = witness.witness_id!;
    responseWitnessIdByQuestionId.set(r.question_id, wid);
    responseWitnessById.set(wid, witness);
    result.witnesses.push(witness);
  }

  // ---- Pass 2: domain score witnesses ----------------------------------

  const domainWitnessIdByDomainId = new Map<string, string>();

  for (const d of input.domain_scores) {
    const signal = `cie.domain_score.${d.domain_id}`;
    const inputRef: InputRef = {
      kind: "cie_domain_score",
      assessment_id: input.assessment_id,
      domain_id: d.domain_id,
    };

    const entry = registry.get("cie", signal);
    if (!entry) {
      const sub = handleRegistryMiss(
        "cie",
        signal,
        inputRef,
        options,
        { witnesses: null, registry_misses: [], validation_failures: [], soft_warnings: [] },
        "CIE domain score signal not in registry"
      );
      mergeSubResult(result, sub);
      if (options.onRegistryMiss === "throw") return result;
      continue;
    }

    // Wire ancestry from the response witnesses that *did* land.
    const ancestry: string[] = [];
    const missingContributingQuestions: string[] = [];
    for (const qid of d.contributing_question_ids) {
      const wid = responseWitnessIdByQuestionId.get(qid);
      if (wid) {
        ancestry.push(wid);
      } else {
        missingContributingQuestions.push(qid);
      }
    }

    // If NO contributing responses witnessified, we cannot produce a
    // lawful depth-1 witness (ancestry must be non-empty per schema
    // check constraint). Route this through validation_failures.
    if (ancestry.length === 0) {
      result.validation_failures.push({
        input_ref: inputRef,
        error_name: "EmptyDomainAncestry",
        message:
          `Cannot produce witness for ${signal}: all ${d.contributing_question_ids.length} ` +
          `contributing responses either failed to witnessify or were not in the registry. ` +
          `Depth-1 witnesses require non-empty ancestry per schema.`,
      });
      continue;
    }

    // If SOME contributing responses missed but at least one landed, the
    // witness is producible but its scope is narrower than the caller
    // intended. Record a soft warning so the caller can decide whether
    // to accept.
    if (missingContributingQuestions.length > 0) {
      result.soft_warnings.push({
        signal,
        rule: "domain_ancestry_partial",
        detail:
          `Domain score witness produced with ${ancestry.length} of ` +
          `${d.contributing_question_ids.length} contributing responses. ` +
          `Missing: [${missingContributingQuestions.slice(0, 5).join(", ")}]` +
          `${missingContributingQuestions.length > 5 ? "..." : ""}. ` +
          `This typically indicates CIE evolution: new questions exist in the assessment ` +
          `but are not yet in the registry.`,
      });
    }

    let witness: WitnessObject;
    try {
      witness = buildWitnessFromRegistry({
        entry,
        user_id: input.user_id,
        observed_value: d.score_value,
        observed_unit: d.score_unit,
        biological_timestamp: input.biological_timestamp,
        derived_from_packet_id: null,
        source_table: "cie_domain_scores",
        source_row_id: d.source_row_id,
        testimony: d.testimony,
        ancestry_witness_ids: ancestry,
        conflict_candidates: null,
      });
    } catch (err) {
      const sub = handleBuildError<null>(err, inputRef, { witnesses: null, registry_misses: [], validation_failures: [], soft_warnings: [] }, options);
      mergeSubResult(result, sub);
      continue;
    }

    try {
      validateWitness(witness, makeWarningCapture(result));
    } catch (err) {
      const sub = handleValidationError<null>(err, inputRef, { witnesses: null, registry_misses: [], validation_failures: [], soft_warnings: [] }, options);
      mergeSubResult(result, sub);
      continue;
    }

    const wid = witness.witness_id!;
    domainWitnessIdByDomainId.set(d.domain_id, wid);
    result.witnesses.push(witness);
  }

  // ---- Pass 3: gate score witnesses ------------------------------------

  for (const g of input.gate_scores) {
    const signal = `cie.gate_score.${g.gate_id}`;
    const inputRef: InputRef = {
      kind: "cie_gate_score",
      assessment_id: input.assessment_id,
      gate_id: g.gate_id,
    };

    const entry = registry.get("cie", signal);
    if (!entry) {
      const sub = handleRegistryMiss(
        "cie",
        signal,
        inputRef,
        options,
        { witnesses: null, registry_misses: [], validation_failures: [], soft_warnings: [] },
        "CIE gate score signal not in registry"
      );
      mergeSubResult(result, sub);
      if (options.onRegistryMiss === "throw") return result;
      continue;
    }

    // Ancestry from domain witnesses that landed.
    const ancestry: string[] = [];
    const missingContributingDomains: string[] = [];
    for (const did of g.contributing_domain_ids) {
      const wid = domainWitnessIdByDomainId.get(did);
      if (wid) {
        ancestry.push(wid);
      } else {
        missingContributingDomains.push(did);
      }
    }

    if (ancestry.length === 0) {
      result.validation_failures.push({
        input_ref: inputRef,
        error_name: "EmptyGateAncestry",
        message:
          `Cannot produce witness for ${signal}: all ${g.contributing_domain_ids.length} ` +
          `contributing domain scores either failed to witnessify or were not in the registry. ` +
          `Depth-2 witnesses require non-empty ancestry per schema.`,
      });
      continue;
    }

    if (missingContributingDomains.length > 0) {
      result.soft_warnings.push({
        signal,
        rule: "gate_ancestry_partial",
        detail:
          `Gate score witness produced with ${ancestry.length} of ` +
          `${g.contributing_domain_ids.length} contributing domains. ` +
          `Missing: [${missingContributingDomains.join(", ")}].`,
      });
    }

    let witness: WitnessObject;
    try {
      witness = buildWitnessFromRegistry({
        entry,
        user_id: input.user_id,
        observed_value: g.score_value,
        observed_unit: g.score_unit,
        biological_timestamp: input.biological_timestamp,
        derived_from_packet_id: null,
        source_table: "cie_gate_scores",
        source_row_id: g.source_row_id,
        testimony: g.testimony,
        ancestry_witness_ids: ancestry,
        conflict_candidates: null,
      });
    } catch (err) {
      const sub = handleBuildError<null>(err, inputRef, { witnesses: null, registry_misses: [], validation_failures: [], soft_warnings: [] }, options);
      mergeSubResult(result, sub);
      continue;
    }

    try {
      validateWitness(witness, makeWarningCapture(result));
    } catch (err) {
      const sub = handleValidationError<null>(err, inputRef, { witnesses: null, registry_misses: [], validation_failures: [], soft_warnings: [] }, options);
      mergeSubResult(result, sub);
      continue;
    }

    result.witnesses.push(witness);
  }

  // ---- Structural integrity check on the emitted batch ----------------

  runBatchIntegrityCheck(result.witnesses, options);

  return result;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

interface BuildWitnessArgs {
  entry: WitnessSignalRegistryEntry;
  user_id: string;
  observed_value: unknown;
  observed_unit: string | null;
  biological_timestamp: string;
  derived_from_packet_id: string | null;
  source_table: string | null;
  source_row_id: string | null;
  testimony: string;
  ancestry_witness_ids: string[] | null;
  overrides?: DirectObservationInput["overrides"];
  conflict_candidates: string[] | null;
}

/**
 * Construct a WitnessObject from a registry entry + observation data.
 * This is the single source of truth for how registry fields hydrate a
 * witness. Compression depth and epistemic role come from the registry
 * (not inferred), enforcing the contract the registry represents.
 */
function buildWitnessFromRegistry(args: BuildWitnessArgs): WitnessObject {
  const { entry } = args;

  // Ancestry must match depth per schema check constraint. We check here
  // before handing to validateWitness so the error message is more
  // meaningful than a generic validation failure.
  const expectedDepth = compressionDepthForRole(entry.epistemic_role);
  const hasAncestry = !!args.ancestry_witness_ids && args.ancestry_witness_ids.length > 0;

  if (expectedDepth === 0 && hasAncestry) {
    throw new WitnessAncestryError(
      `buildWitnessFromRegistry: registry entry ${entry.source_window}:${entry.signal} has ` +
        `compression_depth=0 (source) but caller supplied ancestry_witness_ids. ` +
        `Source witnesses forbid ancestry.`
    );
  }
  if (expectedDepth > 0 && !hasAncestry) {
    throw new WitnessAncestryError(
      `buildWitnessFromRegistry: registry entry ${entry.source_window}:${entry.signal} has ` +
        `compression_depth=${expectedDepth} but caller supplied no ancestry_witness_ids. ` +
        `Compression witnesses require ancestry.`
    );
  }

  const witness: WitnessObject = {
    witness_id: generateUuid(),
    user_id: args.user_id,

    derived_from_packet_id: args.derived_from_packet_id,
    source_table: args.source_table,
    source_row_id: args.source_row_id,

    ancestry_witness_ids: args.ancestry_witness_ids,

    source_window: entry.source_window,
    signal: entry.signal,
    domain_of_access: entry.domain_of_access,
    epistemic_role: entry.epistemic_role,
    reliability_class: entry.reliability_class,
    compression_depth: expectedDepth,

    observed_value: args.observed_value,
    observed_unit: args.observed_unit,

    testimony: args.testimony,
    limitations: args.overrides?.limitations ?? entry.default_limitations,
    confidence_value: args.overrides?.confidence_value ?? entry.default_confidence_value,
    confidence_basis: args.overrides?.confidence_basis ?? entry.default_confidence_basis,

    biological_timestamp: args.biological_timestamp,
    validity_window_seconds:
      args.overrides?.validity_window_seconds !== undefined
        ? args.overrides.validity_window_seconds
        : entry.default_validity_window_seconds,

    conflict_candidates: args.conflict_candidates,

    transformation_version: WITNESS_TRANSFORMATION_VERSION,
    registry_seed_version: entry.registry_seed_version,
  };

  return witness;
}

/** Generate a UUID v4. Uses Web Crypto — available in Deno and modern Node. */
function generateUuid(): string {
  // `crypto.randomUUID()` is standard as of Node 14.17+/18+ and Deno.
  return crypto.randomUUID();
}

/**
 * Structural integrity check on the emitted batch. Asserts:
 *   - No duplicate witness_ids
 *   - Every ancestry_witness_id references a witness_id present in the batch
 *   - Ancestry depth-consistency: depth-1 witnesses reference depth-0,
 *     depth-2 witnesses reference depth-1
 *
 * On failure in throwOnCatastrophic=true mode (default), raises. These
 * are structural bugs in this function; they should never happen, and
 * if they do we want loud failure.
 */
function runBatchIntegrityCheck(
  witnesses: WitnessObject[],
  options: WitnessifyOptions
): void {
  const throwOnCatastrophic = options.throwOnCatastrophic !== false;

  const byId = new Map<string, WitnessObject>();
  for (const w of witnesses) {
    const id = w.witness_id!;
    if (byId.has(id)) {
      const msg = `Duplicate witness_id in batch: ${id}`;
      if (throwOnCatastrophic) {
        throw new CatastrophicWitnessifyError(msg, "DuplicateWitnessId");
      }
      return;
    }
    byId.set(id, w);
  }

  for (const w of witnesses) {
    if (!w.ancestry_witness_ids) continue;
    for (const ancestorId of w.ancestry_witness_ids) {
      const ancestor = byId.get(ancestorId);
      if (!ancestor) {
        const msg =
          `Witness ${w.witness_id} (${w.signal}, depth ${w.compression_depth}) ` +
          `references ancestor ${ancestorId} which is not in the batch.`;
        if (throwOnCatastrophic) {
          throw new CatastrophicWitnessifyError(msg, "DanglingAncestry");
        }
        continue;
      }
      // Depth rule: ancestor depth must be exactly one level below
      if (ancestor.compression_depth !== w.compression_depth - 1) {
        const msg =
          `Witness ${w.witness_id} (${w.signal}, depth ${w.compression_depth}) ` +
          `has ancestor ${ancestorId} (${ancestor.signal}, depth ${ancestor.compression_depth}). ` +
          `Ancestor depth must be exactly ${w.compression_depth - 1}.`;
        if (throwOnCatastrophic) {
          throw new CatastrophicWitnessifyError(msg, "AncestryDepthMismatch");
        }
      }
    }
  }
}

/** Route a registry miss through the configured policy. */
function handleRegistryMiss<T extends WitnessObject | WitnessObject[] | null>(
  source_window: WitnessSourceWindow,
  signal: string,
  input_ref: InputRef,
  options: WitnessifyOptions,
  result: WitnessifyResult<T>,
  reason: string
): WitnessifyResult<T> {
  if (options.onRegistryMiss === "throw") {
    throw new RegistryMissError(source_window, signal, input_ref);
  }
  if (options.onRegistryMiss === "skip_with_warning") {
    result.registry_misses.push({ source_window, signal, reason, input_ref });
  }
  // skip_silent: do nothing
  return result;
}

/** Route a build-time error (ancestry / mapping) to the result or throw. */
function handleBuildError<T extends WitnessObject | WitnessObject[] | null>(
  err: unknown,
  input_ref: InputRef,
  result: WitnessifyResult<T>,
  options: WitnessifyOptions
): WitnessifyResult<T> {
  const throwOnCatastrophic = options.throwOnCatastrophic !== false;
  if (err instanceof WitnessAncestryError || err instanceof WitnessMappingIncompleteError) {
    // These are catastrophic — they indicate a logic bug in the caller.
    if (throwOnCatastrophic) {
      throw err;
    }
    result.validation_failures.push({
      input_ref,
      error_name: err.name,
      message: err.message,
    });
    return result;
  }
  // Unknown error — catastrophic by default.
  if (throwOnCatastrophic) throw err;
  result.validation_failures.push({
    input_ref,
    error_name: (err as Error).name ?? "UnknownError",
    message: (err as Error).message ?? String(err),
  });
  return result;
}

/** Route a validateWitness failure to the result. Non-catastrophic. */
function handleValidationError<T extends WitnessObject | WitnessObject[] | null>(
  err: unknown,
  input_ref: InputRef,
  result: WitnessifyResult<T>,
  _options: WitnessifyOptions
): WitnessifyResult<T> {
  if (err instanceof WitnessValidationError || err instanceof WitnessAncestryError) {
    result.validation_failures.push({
      input_ref,
      error_name: err.name,
      message: err.message,
    });
    return result;
  }
  throw err;
}

/** Build a WitnessWarningSink that captures into the result object. */
function makeWarningCapture(result: WitnessifyResult<unknown>): WitnessWarningSink {
  return (signal, rule, detail) => {
    result.soft_warnings.push({ signal, rule, detail });
  };
}

/** Merge a sub-result's misses/failures/warnings into the main result. */
function mergeSubResult<T, U>(main: WitnessifyResult<T>, sub: WitnessifyResult<U>): void {
  main.registry_misses.push(...sub.registry_misses);
  main.validation_failures.push(...sub.validation_failures);
  main.soft_warnings.push(...sub.soft_warnings);
}

// ============================================================================
// END OF witnessify_impl.ts
// ============================================================================
