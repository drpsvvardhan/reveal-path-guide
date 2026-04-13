// src/lib/clusterConfidence.ts
//
// CANONICAL CONFIDENCE COMPUTATION FOR THE CLUSTER GRAPH
//
// This is the single most load-bearing piece of code in the cluster graph
// architecture. It is the mechanism that prevents LLM drift into uniform
// certainty prose. No other code path in the application computes cluster
// confidence — only this function. Every cluster written to the database
// MUST have its confidence_score, confidence_tier, and confidence_dimensions
// computed by deriveClusterConfidence().
//
// Five dimensions per Cluster Graph Thesis Part 4:
//   - breadth: how many evidence nodes contribute
//   - depth: how many distinct data layer types contribute
//   - time: how many distinct time points support trajectory claims
//   - coherence_strength: fraction of convergent vs (convergent + divergent)
//   - missing_data_penalty: 1 - (platonic items present / platonic set size)
//
// Five tiers per Cluster Graph Thesis Part 5 and Framework v2 Part 10:
//   - emerging:   2-3 nodes (or any 1-3 node cluster)
//   - tentative:  >=4 nodes
//   - developing: >=6 nodes, >=2 distinct layer types
//   - supported:  >=10 nodes, >=3 distinct layer types,
//                 coherence_strength >=0.75, completeness >=0.75
//   - robust:     >=15 nodes, >=4 distinct layer types,
//                 has_imaging_or_omics=true, coherence_strength >=0.85,
//                 completeness >=0.85, time_points >=3 if trajectory_dependent
//
// Tier assignment is STRUCTURAL — it requires meeting the floors, not the
// continuous score. The continuous score is preserved alongside for ranking
// within tier and for the UI confidence indicator.

export type ClusterEvidenceLayer =
  | 'cie'
  | 'lab'
  | 'inbody'
  | 'emr'
  | 'medication'
  | 'sensor'
  | 'food_log'
  | 'imaging'
  | 'omics'
  | 'narrative';

export type ClusterEvidenceDirection = 'convergent' | 'divergent' | 'neutral';

export type ClusterConfidenceTier =
  | 'emerging'
  | 'tentative'
  | 'developing'
  | 'supported'
  | 'robust';

export interface ClusterEvidenceInput {
  evidence_kind: string;
  evidence_id: string;
  layer_type: ClusterEvidenceLayer;
  direction: ClusterEvidenceDirection;
  weight?: number;
  time_point?: string | Date | null;
}

export interface ClusterConfidenceDimensions {
  breadth: number;
  depth: number;
  time: number;
  coherence_strength: number;
  missing_data_penalty: number;
}

export interface ClusterConfidenceAudit {
  n_nodes: number;
  n_distinct_layers: number;
  layer_types: ClusterEvidenceLayer[];
  has_imaging_or_omics: boolean;
  n_time_points: number;
  time_window_months: number;
  n_convergent: number;
  n_divergent: number;
  n_neutral: number;
  platonic_set_known: boolean;
  platonic_set_size: number;
  platonic_items_present: number;
  trajectory_dependent: boolean;
  structural_floor_tier: ClusterConfidenceTier;
  score_based_tier: ClusterConfidenceTier;
}

export interface ClusterConfidenceResult {
  confidence_score: number;
  confidence_tier: ClusterConfidenceTier;
  confidence_dimensions: ClusterConfidenceDimensions;
  audit: ClusterConfidenceAudit;
}

export interface DeriveClusterConfidenceInput {
  cluster_kind: string;
  evidence: ClusterEvidenceInput[];
  trajectory_dependent?: boolean;
}

// ============================================================================
// PLATONIC EVIDENCE SETS
// ============================================================================
//
// Each cluster_kind has an "ideal" set of evidence items that would fully
// characterize the cluster. The completeness score is the fraction of platonic
// items present in the cluster's actual evidence. When a cluster_kind is not
// in the registry, the completeness defaults to 0.6 (mild penalty) and
// platonic_set_known is false — this prevents unknown clusters from trivially
// reaching supported or robust while not blocking them entirely.
//
// Each platonic item carries a matcher function that inspects the evidence's
// evidence_id (and sometimes layer_type) to decide whether the item is
// represented. Matchers are deliberately loose because evidence_id is
// polymorphic and the triangulation system populates it with various source
// row identifiers.

export interface PlatonicEvidenceItem {
  id: string;
  description: string;
  match: (e: ClusterEvidenceInput) => boolean;
}

export const PLATONIC_EVIDENCE_SETS: Record<string, PlatonicEvidenceItem[]> = {
  cardiovascular_particle: [
    { id: 'apob', description: 'ApoB measurement', match: (e) => /apob/i.test(e.evidence_id) },
    { id: 'ldl_p', description: 'LDL particle count (LDL-P)', match: (e) => /ldl[\s_-]*p(?:[_\s-]|$)|ldl[\s_-]*particle/i.test(e.evidence_id) },
    { id: 'ldl_small', description: 'LDL small dense fraction', match: (e) => /ldl.*small|small.*ldl/i.test(e.evidence_id) },
    { id: 'apoa1', description: 'Apo A1', match: (e) => /apoa1|apo[\s_-]*a[\s_-]*1/i.test(e.evidence_id) },
    { id: 'hdl_p', description: 'HDL particle count', match: (e) => /hdl[\s_-]*p(?:[_\s-]|$)|hdl[\s_-]*particle/i.test(e.evidence_id) },
    { id: 'lpa', description: 'Lp(a)', match: (e) => /\blpa(?:[_\s-]|$)|lp\(a\)|lipoprotein.*a/i.test(e.evidence_id) },
    { id: 'hs_crp', description: 'high-sensitivity CRP', match: (e) => /hs[\s_-]*crp|hscrp/i.test(e.evidence_id) },
    { id: 'tmao', description: 'TMAO', match: (e) => /tmao/i.test(e.evidence_id) },
    { id: 'cac', description: 'coronary artery calcium score', match: (e) => /\bcac(?:[_\s-]|$)|calcium.*score|coronary.*calcium/i.test(e.evidence_id) },
  ],
  hepatic_lipid_handling: [
    { id: 'alt', description: 'ALT', match: (e) => /\balt\b/i.test(e.evidence_id) },
    { id: 'ast', description: 'AST', match: (e) => /\bast\b/i.test(e.evidence_id) },
    { id: 'ggt', description: 'GGT', match: (e) => /\bggt\b/i.test(e.evidence_id) },
    { id: 'tg', description: 'triglycerides', match: (e) => /trig|\btg\b/i.test(e.evidence_id) },
    { id: 'fib4', description: 'FIB-4 score', match: (e) => /fib[\s_-]*4/i.test(e.evidence_id) },
    { id: 'fibroscan', description: 'FibroScan elastography', match: (e) => /fibroscan|elastography/i.test(e.evidence_id) },
    { id: 'cie_liver', description: 'CIE A1 liver domain score', match: (e) => e.layer_type === 'cie' && /\ba1\b|liver|hepatic/i.test(e.evidence_id) },
    { id: 'inbody_visceral', description: 'visceral fat area', match: (e) => e.layer_type === 'inbody' && /visceral/i.test(e.evidence_id) },
  ],
  glucose_dynamics: [
    { id: 'hba1c', description: 'HbA1c', match: (e) => /hba1c|\ba1c\b/i.test(e.evidence_id) },
    { id: 'fasting_glucose', description: 'fasting glucose', match: (e) => /fasting.*gluc|gluc.*fasting/i.test(e.evidence_id) },
    { id: 'fasting_insulin', description: 'fasting insulin', match: (e) => /fasting.*insulin|insulin.*fasting/i.test(e.evidence_id) },
    { id: 'homa_ir', description: 'HOMA-IR', match: (e) => /homa/i.test(e.evidence_id) },
    { id: 'cgm_tir', description: 'CGM time in range', match: (e) => /\bcgm\b|\btir\b|time.*in.*range/i.test(e.evidence_id) || (e.layer_type === 'sensor' && /gluc/i.test(e.evidence_id)) },
    { id: 'cgm_variability', description: 'CGM glucose variability', match: (e) => /variability|sd.*gluc|cv.*gluc/i.test(e.evidence_id) },
    { id: 'cie_pancreas', description: 'CIE A2 pancreas domain', match: (e) => e.layer_type === 'cie' && /\ba2\b|pancreas|insulin.*rhythm/i.test(e.evidence_id) },
  ],
  inflammation_buffered: [
    { id: 'hs_crp', description: 'high-sensitivity CRP', match: (e) => /hs[\s_-]*crp|hscrp/i.test(e.evidence_id) },
    { id: 'il6', description: 'IL-6', match: (e) => /il[\s_-]*6\b/i.test(e.evidence_id) },
    { id: 'tnf', description: 'TNF-alpha', match: (e) => /\btnf\b/i.test(e.evidence_id) },
    { id: 'vcam1', description: 'VCAM-1 (proteomics)', match: (e) => /vcam/i.test(e.evidence_id) },
    { id: 'ccl2', description: 'CCL2 / MCP-1 (proteomics)', match: (e) => /ccl2|mcp[\s_-]*1/i.test(e.evidence_id) },
    { id: 'microbiome_diversity', description: 'gut microbiome alpha diversity', match: (e) => e.layer_type === 'omics' && /microbiom|diversity/i.test(e.evidence_id) },
    { id: 'scfa', description: 'short-chain fatty acid panel', match: (e) => /scfa|butyrate|propionate|acetate/i.test(e.evidence_id) },
    { id: 'cie_immune', description: 'CIE D11 immune tolerance', match: (e) => e.layer_type === 'cie' && /\bd11\b|immune.*tolerance/i.test(e.evidence_id) },
  ],
  autonomic_balance: [
    { id: 'hrv', description: 'heart rate variability', match: (e) => /\bhrv\b/i.test(e.evidence_id) || (e.layer_type === 'sensor' && /heart.*rate.*var/i.test(e.evidence_id)) },
    { id: 'resting_hr', description: 'resting heart rate', match: (e) => /\brhr\b|resting.*heart.*rate/i.test(e.evidence_id) },
    { id: 'recovery_score', description: 'recovery score (WHOOP / Oura)', match: (e) => /recovery.*score|\brecovery\b/i.test(e.evidence_id) },
    { id: 'sleep_architecture', description: 'sleep architecture (deep, REM)', match: (e) => /sleep.*arch|\brem\b|deep.*sleep/i.test(e.evidence_id) },
    { id: 'cie_autonomic', description: 'CIE C9 autonomic balance', match: (e) => e.layer_type === 'cie' && /\bc9\b|autonomic/i.test(e.evidence_id) },
    { id: 'cie_stress', description: 'CIE C7 adrenal/stress', match: (e) => e.layer_type === 'cie' && /\bc7\b|adrenal|stress.*response/i.test(e.evidence_id) },
  ],
  mitochondrial_capacity: [
    { id: 'vo2', description: 'VO2 max or estimate', match: (e) => /vo2/i.test(e.evidence_id) },
    { id: 'lactate', description: 'lactate', match: (e) => /lactate/i.test(e.evidence_id) },
    { id: 'acylcarnitines', description: 'acylcarnitine panel (metabolomics)', match: (e) => /acylcarnitine/i.test(e.evidence_id) },
    { id: 'phase_angle', description: 'phase angle (InBody)', match: (e) => e.layer_type === 'inbody' && /phase.*angle/i.test(e.evidence_id) },
    { id: 'smm', description: 'skeletal muscle mass', match: (e) => /\bsmm\b|skeletal.*muscle/i.test(e.evidence_id) },
    { id: 'cie_mito', description: 'CIE C8 mitochondrial energy', match: (e) => e.layer_type === 'cie' && /\bc8\b|mitochondri/i.test(e.evidence_id) },
  ],
  regulatory_axis: [
    { id: 'tsh', description: 'TSH', match: (e) => /\btsh\b/i.test(e.evidence_id) },
    { id: 'free_t3', description: 'free T3', match: (e) => /free.*t3|\bft3\b/i.test(e.evidence_id) },
    { id: 'free_t4', description: 'free T4', match: (e) => /free.*t4|\bft4\b/i.test(e.evidence_id) },
    { id: 'cortisol_morning', description: 'morning cortisol', match: (e) => /cortisol/i.test(e.evidence_id) },
    { id: 'dhea', description: 'DHEA-S', match: (e) => /dhea/i.test(e.evidence_id) },
    { id: 'cie_thyroid', description: 'CIE G19 thyroid', match: (e) => e.layer_type === 'cie' && /\bg19\b|thyroid/i.test(e.evidence_id) },
    { id: 'cie_sleep', description: 'CIE E13 sleep/circadian', match: (e) => e.layer_type === 'cie' && /\be13\b|sleep|circadian/i.test(e.evidence_id) },
  ],
};

// ============================================================================
// DIMENSION FUNCTIONS (each pure, each unit-testable in isolation)
// ============================================================================

/**
 * Breadth: how many evidence nodes contribute to the cluster.
 * Diminishing returns curve: 1 - exp(-n / 4)
 *   n=2  -> 0.39 | n=5  -> 0.71 | n=10 -> 0.92 | n=20 -> 0.99
 * The thesis says: "Two markers is thin. Five is moderate. Ten is strong.
 * Twenty is robust." This curve maps cleanly to that intuition.
 */
export function computeBreadth(nNodes: number): number {
  if (nNodes <= 0) return 0;
  return 1 - Math.exp(-nNodes / 4);
}

/**
 * Depth: how many distinct data layer types contribute.
 * Linear up to 5 layers, then capped at 1.0.
 *   1 layer -> 0.20 | 3 -> 0.60 | 5+ -> 1.00
 * Cross-layer convergence is the strongest single signal of an authentic
 * pattern because different layers measure different properties using
 * different instruments — when they agree they corroborate the finding
 * in a way that within-layer convergence cannot match.
 */
export function computeDepth(nDistinctLayers: number): number {
  if (nDistinctLayers <= 0) return 0;
  return Math.min(1, nDistinctLayers / 5);
}

/**
 * Time: distinct time points supporting the cluster, modulated by the
 * window across which they span and by whether the cluster's claim is
 * trajectory-dependent.
 *
 * Trajectory-dependent claims (the cluster says something is rising,
 * falling, drifting, stabilizing) need real temporal support: 6 points
 * across 12+ months earns full credit.
 *
 * Non-trajectory claims (current state) need less temporal support.
 * The function returns a 0.5 floor for static-state clusters with
 * one or zero time points so they aren't unfairly penalized.
 */
export function computeTime(
  nTimePoints: number,
  windowMonths: number,
  trajectoryDependent: boolean
): number {
  if (nTimePoints <= 0) return trajectoryDependent ? 0 : 0.5;
  const pointScore = Math.min(1, nTimePoints / 6);
  if (!trajectoryDependent) {
    return Math.max(0.5, pointScore);
  }
  // Window factor: <3 months earns 0.3 floor; 12+ months earns full credit.
  const windowFactor = Math.max(0.3, Math.min(1, windowMonths / 12));
  return pointScore * windowFactor;
}

/**
 * Coherence strength: fraction of convergent / (convergent + divergent).
 * Neutral evidence does not count toward direction.
 * Default 0.5 if no directional evidence at all.
 *
 * Divergent evidence is preserved as a first-class field (tensions_held
 * in the cluster schema) — it is NOT penalized to zero. The thesis says
 * explicitly: "10 markers where 9 converge and 1 contradicts is a
 * high-coherence cluster with a preserved contradiction."
 */
export function computeCoherenceStrength(
  nConvergent: number,
  nDivergent: number
): number {
  const directional = nConvergent + nDivergent;
  if (directional === 0) return 0.5;
  return nConvergent / directional;
}

/**
 * Missing data penalty: 1 - (platonic items present / platonic set size).
 * Returns 0 = nothing missing (complete), 1 = nothing present.
 *
 * If the cluster_kind is not in the platonic registry, returns penalty=0.4
 * (completeness ~0.6) with platonic_set_known=false. This is a mild
 * structural penalty that prevents unknown clusters from trivially reaching
 * supported or robust while not blocking them entirely.
 */
export function computeMissingDataPenalty(
  clusterKind: string,
  evidence: ClusterEvidenceInput[]
): {
  penalty: number;
  platonic_set_known: boolean;
  platonic_set_size: number;
  platonic_items_present: number;
} {
  const platonic = PLATONIC_EVIDENCE_SETS[clusterKind];
  if (!platonic || platonic.length === 0) {
    return {
      penalty: 0.4,
      platonic_set_known: false,
      platonic_set_size: 0,
      platonic_items_present: 0,
    };
  }
  const present = platonic.filter((item) => evidence.some((e) => item.match(e)));
  const completeness = present.length / platonic.length;
  return {
    penalty: 1 - completeness,
    platonic_set_known: true,
    platonic_set_size: platonic.length,
    platonic_items_present: present.length,
  };
}

// ============================================================================
// COMBINING FUNCTION (weighted geometric mean)
// ============================================================================

/**
 * Combine the five dimensions into a single continuous confidence score
 * via geometric mean. Geometric mean ensures that low scores on any single
 * dimension pull the overall down — a cluster cannot compensate for missing
 * temporal depth with extra breadth, which is correct because more markers
 * at the same time point is not the same finding as the same markers across
 * time. A small floor (0.05) is applied to each factor to avoid the geometric
 * mean collapsing to literal zero on a single-dimension miss.
 *
 * Note: the continuous score is preserved for ranking and for the UI
 * confidence indicator. It does NOT gate tier assignment — that is structural,
 * see deriveTier().
 */
export function combineConfidenceScore(d: ClusterConfidenceDimensions): number {
  const completeness = 1 - d.missing_data_penalty;
  const factors = [d.breadth, d.depth, d.time, d.coherence_strength, completeness];
  const floored = factors.map((f) => Math.max(0.05, Math.min(1, f)));
  const product = floored.reduce((a, b) => a * b, 1);
  return Math.pow(product, 1 / floored.length);
}

// ============================================================================
// TIER ASSIGNMENT (structural)
// ============================================================================

/**
 * Tier is assigned STRUCTURALLY. The cluster must meet the floor counts
 * for n_nodes, n_distinct_layers, has_imaging_or_omics, coherence, and
 * completeness for a given tier to be granted that tier. This is the
 * enforcement mechanism the thesis specifies and Framework v2 Part 10
 * binds the rendering vocabulary to: tier comes from deterministic rules,
 * not from LLM judgment, and the rendering layer cannot override.
 */
export function deriveTier(
  audit: {
    n_nodes: number;
    n_distinct_layers: number;
    has_imaging_or_omics: boolean;
    n_time_points: number;
    trajectory_dependent: boolean;
    platonic_set_known?: boolean;
  },
  dimensions: ClusterConfidenceDimensions
): ClusterConfidenceTier {
  const completeness = 1 - dimensions.missing_data_penalty;

  // Robust floor
  if (
    audit.n_nodes >= 15 &&
    audit.n_distinct_layers >= 4 &&
    audit.has_imaging_or_omics &&
    dimensions.coherence_strength >= 0.85 &&
    completeness >= 0.85 &&
    (!audit.trajectory_dependent || audit.n_time_points >= 3)
  ) {
    return 'robust';
  }

  // Supported floor
  // When platonic_set_known is false, skip the completeness check —
  // the mild penalty (0.4) is not meant to block supported, only robust.
  const completenessMetForSupported = audit.platonic_set_known === false || completeness >= 0.75;
  if (
    audit.n_nodes >= 10 &&
    audit.n_distinct_layers >= 3 &&
    dimensions.coherence_strength >= 0.75 &&
    completenessMetForSupported
  ) {
    return 'supported';
  }

  // Developing floor
  if (audit.n_nodes >= 6 && audit.n_distinct_layers >= 2) {
    return 'developing';
  }

  // Tentative floor
  if (audit.n_nodes >= 4) {
    return 'tentative';
  }

  // Emerging is the minimum
  return 'emerging';
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Compute the full confidence reading for a cluster.
 *
 * This is the ONLY function that should be called to produce
 * confidence_score, confidence_tier, and confidence_dimensions for a
 * cluster being written to the clusters table. The triangulation pipeline
 * (5c) calls this after the reconciler pass produces the final cluster
 * set, and writes the result into the cluster row before INSERT.
 */
export function deriveClusterConfidence(
  input: DeriveClusterConfidenceInput
): ClusterConfidenceResult {
  const trajectoryDependent = input.trajectory_dependent ?? true;
  const evidence = input.evidence ?? [];

  // Structural counts
  const nNodes = evidence.length;
  const layerSet = new Set<ClusterEvidenceLayer>();
  for (const e of evidence) layerSet.add(e.layer_type);
  const layerTypes = Array.from(layerSet);
  const nDistinctLayers = layerTypes.length;
  const hasImagingOrOmics = layerSet.has('imaging') || layerSet.has('omics');

  // Time points (deduped to UTC day, window in months)
  const dateSet = new Set<string>();
  let minDate: number | null = null;
  let maxDate: number | null = null;
  for (const e of evidence) {
    if (e.time_point == null) continue;
    const d = e.time_point instanceof Date ? e.time_point : new Date(e.time_point);
    if (Number.isNaN(d.getTime())) continue;
    const dayKey = d.toISOString().slice(0, 10);
    dateSet.add(dayKey);
    const t = d.getTime();
    if (minDate === null || t < minDate) minDate = t;
    if (maxDate === null || t > maxDate) maxDate = t;
  }
  const nTimePoints = dateSet.size;
  const windowMonths =
    minDate !== null && maxDate !== null
      ? (maxDate - minDate) / (1000 * 60 * 60 * 24 * 30.44)
      : 0;

  // Direction counts
  let nConvergent = 0;
  let nDivergent = 0;
  let nNeutral = 0;
  for (const e of evidence) {
    if (e.direction === 'convergent') nConvergent++;
    else if (e.direction === 'divergent') nDivergent++;
    else nNeutral++;
  }

  // Dimensions
  const breadth = computeBreadth(nNodes);
  const depth = computeDepth(nDistinctLayers);
  const time = computeTime(nTimePoints, windowMonths, trajectoryDependent);
  const coherence = computeCoherenceStrength(nConvergent, nDivergent);
  const missingResult = computeMissingDataPenalty(input.cluster_kind, evidence);

  const dimensions: ClusterConfidenceDimensions = {
    breadth: Number(breadth.toFixed(4)),
    depth: Number(depth.toFixed(4)),
    time: Number(time.toFixed(4)),
    coherence_strength: Number(coherence.toFixed(4)),
    missing_data_penalty: Number(missingResult.penalty.toFixed(4)),
  };

  // Continuous score
  const score = combineConfidenceScore(dimensions);

  // Tier (structural)
  let tier = deriveTier(
    {
      n_nodes: nNodes,
      n_distinct_layers: nDistinctLayers,
      has_imaging_or_omics: hasImagingOrOmics,
      n_time_points: nTimePoints,
      trajectory_dependent: trajectoryDependent,
    },
    dimensions
  );

  // Cap unknown-platonic clusters at 'supported' to avoid trivially reaching
  // robust without a registered evidence set. This is a structural pressure
  // on the platform to grow the platonic registry as new cluster_kinds
  // emerge from the triangulation system.
  if (!missingResult.platonic_set_known && tier === 'robust') {
    tier = 'supported';
  }

  // Score-based tier (audit only — not used for assignment)
  const scoreBasedTier: ClusterConfidenceTier =
    score >= 0.85 ? 'robust'
    : score >= 0.70 ? 'supported'
    : score >= 0.50 ? 'developing'
    : score >= 0.30 ? 'tentative'
    : 'emerging';

  const audit: ClusterConfidenceAudit = {
    n_nodes: nNodes,
    n_distinct_layers: nDistinctLayers,
    layer_types: layerTypes,
    has_imaging_or_omics: hasImagingOrOmics,
    n_time_points: nTimePoints,
    time_window_months: Number(windowMonths.toFixed(2)),
    n_convergent: nConvergent,
    n_divergent: nDivergent,
    n_neutral: nNeutral,
    platonic_set_known: missingResult.platonic_set_known,
    platonic_set_size: missingResult.platonic_set_size,
    platonic_items_present: missingResult.platonic_items_present,
    trajectory_dependent: trajectoryDependent,
    structural_floor_tier: tier,
    score_based_tier: scoreBasedTier,
  };

  return {
    confidence_score: Number(score.toFixed(4)),
    confidence_tier: tier,
    confidence_dimensions: dimensions,
    audit,
  };
}

/**
 * Produce a "what would sharpen this" list from the platonic registry,
 * naming the items that are NOT present in the cluster's current evidence.
 * Surfaces directly into the cluster's missing_evidence field.
 */
export function listMissingPlatonicItems(
  clusterKind: string,
  evidence: ClusterEvidenceInput[]
): Array<{ id: string; description: string }> {
  const platonic = PLATONIC_EVIDENCE_SETS[clusterKind];
  if (!platonic) return [];
  return platonic
    .filter((item) => !evidence.some((e) => item.match(e)))
    .map((item) => ({ id: item.id, description: item.description }));
}
