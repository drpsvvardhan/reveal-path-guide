// supabase/functions/generate-clusters/validator.ts
//
// Validates the reconciler output and produces cluster-write payloads.
// Pure function. No LLM. No database writes.
//
// IMPORTANT: This file imports clusterConfidence from a relative path
// that works in the Deno edge function runtime because Supabase bundles
// the full repo. The import resolves to src/lib/clusterConfidence.ts.

// Types replicated here to avoid cross-boundary import issues in Deno.
// These MUST stay in sync with src/lib/clusterConfidence.ts.

type ClusterEvidenceLayer =
  | 'cie' | 'lab' | 'inbody' | 'emr' | 'medication'
  | 'sensor' | 'food_log' | 'imaging' | 'omics' | 'narrative';

type ClusterEvidenceDirection = 'convergent' | 'divergent' | 'neutral';

type ClusterConfidenceTier = 'emerging' | 'tentative' | 'developing' | 'supported' | 'robust';

interface ClusterEvidenceInput {
  evidence_kind: string;
  evidence_id: string;
  layer_type: ClusterEvidenceLayer;
  direction: ClusterEvidenceDirection;
  weight?: number;
  time_point?: string | Date | null;
  text_for_matching?: string;
}

const matchText = (e: ClusterEvidenceInput): string =>
  (e.text_for_matching ?? e.evidence_id ?? "").toLowerCase();

interface ClusterConfidenceDimensions {
  breadth: number;
  depth: number;
  time: number;
  coherence_strength: number;
  missing_data_penalty: number;
}

interface ClusterConfidenceAudit {
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

interface ClusterConfidenceResult {
  confidence_score: number;
  confidence_tier: ClusterConfidenceTier;
  confidence_dimensions: ClusterConfidenceDimensions;
  audit: ClusterConfidenceAudit;
}

// ============================================================================
// Inline the confidence computation functions from src/lib/clusterConfidence.ts
// because Deno edge functions cannot import from src/ at runtime.
// These are exact copies — any change to clusterConfidence.ts must be mirrored.
// ============================================================================

const PLATONIC_EVIDENCE_SETS: Record<string, Array<{ id: string; description: string; match: (e: ClusterEvidenceInput) => boolean }>> = {
  cardiovascular_particle: [
    { id: 'apob', description: 'ApoB measurement', match: (e) => /apob/i.test(matchText(e)) },
    { id: 'ldl_p', description: 'LDL particle count (LDL-P)', match: (e) => /ldl[\s_-]*p(?:[_\s-]|$)|ldl[\s_-]*particle/i.test(matchText(e)) },
    { id: 'ldl_small', description: 'LDL small dense fraction', match: (e) => /ldl.*small|small.*ldl/i.test(matchText(e)) },
    { id: 'apoa1', description: 'Apo A1', match: (e) => /apoa1|apo[\s_-]*a[\s_-]*1/i.test(matchText(e)) },
    { id: 'hdl_p', description: 'HDL particle count', match: (e) => /hdl[\s_-]*p(?:[_\s-]|$)|hdl[\s_-]*particle/i.test(matchText(e)) },
    { id: 'lpa', description: 'Lp(a)', match: (e) => /\blpa(?:[_\s-]|$)|lp\(a\)|lipoprotein.*a/i.test(matchText(e)) },
    { id: 'hs_crp', description: 'high-sensitivity CRP', match: (e) => /hs[\s_-]*crp|hscrp/i.test(matchText(e)) },
    { id: 'tmao', description: 'TMAO', match: (e) => /tmao/i.test(matchText(e)) },
    { id: 'cac', description: 'coronary artery calcium score', match: (e) => /\bcac(?:[_\s-]|$)|calcium.*score|coronary.*calcium/i.test(matchText(e)) },
  ],
  hepatic_lipid_handling: [
    { id: 'alt', description: 'ALT', match: (e) => /\balt\b/i.test(matchText(e)) },
    { id: 'ast', description: 'AST', match: (e) => /\bast\b/i.test(matchText(e)) },
    { id: 'ggt', description: 'GGT', match: (e) => /\bggt\b/i.test(matchText(e)) },
    { id: 'tg', description: 'triglycerides', match: (e) => /trig|\btg\b/i.test(matchText(e)) },
    { id: 'fib4', description: 'FIB-4 score', match: (e) => /fib[\s_-]*4/i.test(matchText(e)) },
    { id: 'fibroscan', description: 'FibroScan elastography', match: (e) => /fibroscan|elastography/i.test(matchText(e)) },
    { id: 'cie_liver', description: 'CIE A1 liver domain score', match: (e) => e.layer_type === 'cie' && /\ba1\b|liver|hepatic/i.test(matchText(e)) },
    { id: 'inbody_visceral', description: 'visceral fat area', match: (e) => e.layer_type === 'inbody' && /visceral/i.test(matchText(e)) },
  ],
  glucose_dynamics: [
    { id: 'hba1c', description: 'HbA1c', match: (e) => /hba1c|\ba1c\b/i.test(matchText(e)) },
    { id: 'fasting_glucose', description: 'fasting glucose', match: (e) => /fasting.*gluc|gluc.*fasting/i.test(matchText(e)) },
    { id: 'fasting_insulin', description: 'fasting insulin', match: (e) => /fasting.*insulin|insulin.*fasting/i.test(matchText(e)) },
    { id: 'homa_ir', description: 'HOMA-IR', match: (e) => /homa/i.test(matchText(e)) },
    { id: 'cgm_tir', description: 'CGM time in range', match: (e) => /\bcgm\b|\btir\b|time.*in.*range/i.test(matchText(e)) || (e.layer_type === 'sensor' && /gluc/i.test(matchText(e))) },
    { id: 'cgm_variability', description: 'CGM glucose variability', match: (e) => /variability|sd.*gluc|cv.*gluc/i.test(matchText(e)) },
    { id: 'cie_pancreas', description: 'CIE A2 pancreas domain', match: (e) => e.layer_type === 'cie' && /\ba2\b|pancreas|insulin.*rhythm/i.test(matchText(e)) },
  ],
  inflammation_buffered: [
    { id: 'hs_crp', description: 'high-sensitivity CRP', match: (e) => /hs[\s_-]*crp|hscrp/i.test(matchText(e)) },
    { id: 'il6', description: 'IL-6', match: (e) => /il[\s_-]*6\b/i.test(matchText(e)) },
    { id: 'tnf', description: 'TNF-alpha', match: (e) => /\btnf\b/i.test(matchText(e)) },
    { id: 'vcam1', description: 'VCAM-1 (proteomics)', match: (e) => /vcam/i.test(matchText(e)) },
    { id: 'ccl2', description: 'CCL2 / MCP-1 (proteomics)', match: (e) => /ccl2|mcp[\s_-]*1/i.test(matchText(e)) },
    { id: 'microbiome_diversity', description: 'gut microbiome alpha diversity', match: (e) => e.layer_type === 'omics' && /microbiom|diversity/i.test(matchText(e)) },
    { id: 'scfa', description: 'short-chain fatty acid panel', match: (e) => /scfa|butyrate|propionate|acetate/i.test(matchText(e)) },
    { id: 'cie_immune', description: 'CIE D11 immune tolerance', match: (e) => e.layer_type === 'cie' && /\bd11\b|immune.*tolerance/i.test(matchText(e)) },
  ],
  autonomic_balance: [
    { id: 'hrv', description: 'heart rate variability', match: (e) => /\bhrv\b/i.test(matchText(e)) || (e.layer_type === 'sensor' && /heart.*rate.*var/i.test(matchText(e))) },
    { id: 'resting_hr', description: 'resting heart rate', match: (e) => /\brhr\b|resting.*heart.*rate/i.test(matchText(e)) },
    { id: 'recovery_score', description: 'recovery score (WHOOP / Oura)', match: (e) => /recovery.*score|\brecovery\b/i.test(matchText(e)) },
    { id: 'sleep_architecture', description: 'sleep architecture (deep, REM)', match: (e) => /sleep.*arch|\brem\b|deep.*sleep/i.test(matchText(e)) },
    { id: 'cie_autonomic', description: 'CIE C9 autonomic balance', match: (e) => e.layer_type === 'cie' && /\bc9\b|autonomic/i.test(matchText(e)) },
    { id: 'cie_stress', description: 'CIE C7 adrenal/stress', match: (e) => e.layer_type === 'cie' && /\bc7\b|adrenal|stress.*response/i.test(matchText(e)) },
  ],
  mitochondrial_capacity: [
    { id: 'vo2', description: 'VO2 max or estimate', match: (e) => /vo2/i.test(matchText(e)) },
    { id: 'lactate', description: 'lactate', match: (e) => /lactate/i.test(matchText(e)) },
    { id: 'acylcarnitines', description: 'acylcarnitine panel (metabolomics)', match: (e) => /acylcarnitine/i.test(matchText(e)) },
    { id: 'phase_angle', description: 'phase angle (InBody)', match: (e) => e.layer_type === 'inbody' && /phase.*angle/i.test(matchText(e)) },
    { id: 'smm', description: 'skeletal muscle mass', match: (e) => /\bsmm\b|skeletal.*muscle/i.test(matchText(e)) },
    { id: 'cie_mito', description: 'CIE C8 mitochondrial energy', match: (e) => e.layer_type === 'cie' && /\bc8\b|mitochondri/i.test(matchText(e)) },
  ],
  regulatory_axis: [
    { id: 'tsh', description: 'TSH', match: (e) => /\btsh\b/i.test(matchText(e)) },
    { id: 'free_t3', description: 'free T3', match: (e) => /free.*t3|\bft3\b/i.test(matchText(e)) },
    { id: 'free_t4', description: 'free T4', match: (e) => /free.*t4|\bft4\b/i.test(matchText(e)) },
    { id: 'cortisol_morning', description: 'morning cortisol', match: (e) => /cortisol/i.test(matchText(e)) },
    { id: 'dhea', description: 'DHEA-S', match: (e) => /dhea/i.test(matchText(e)) },
    { id: 'cie_thyroid', description: 'CIE G19 thyroid', match: (e) => e.layer_type === 'cie' && /\bg19\b|thyroid/i.test(matchText(e)) },
    { id: 'cie_sleep', description: 'CIE E13 sleep/circadian', match: (e) => e.layer_type === 'cie' && /\be13\b|sleep|circadian/i.test(matchText(e)) },
  ],
};

function computeBreadth(nNodes: number): number {
  if (nNodes <= 0) return 0;
  return 1 - Math.exp(-nNodes / 4);
}

function computeDepth(nDistinctLayers: number): number {
  if (nDistinctLayers <= 0) return 0;
  return Math.min(1, nDistinctLayers / 5);
}

function computeTime(nTimePoints: number, windowMonths: number, trajectoryDependent: boolean): number {
  if (nTimePoints <= 0) return trajectoryDependent ? 0 : 0.5;
  const pointScore = Math.min(1, nTimePoints / 6);
  if (!trajectoryDependent) return Math.max(0.5, pointScore);
  const windowFactor = Math.max(0.3, Math.min(1, windowMonths / 12));
  return pointScore * windowFactor;
}

function computeCoherenceStrength(nConvergent: number, nDivergent: number): number {
  const directional = nConvergent + nDivergent;
  if (directional === 0) return 0.5;
  return nConvergent / directional;
}

function computeMissingDataPenalty(clusterKind: string, evidence: ClusterEvidenceInput[]): {
  penalty: number; platonic_set_known: boolean; platonic_set_size: number; platonic_items_present: number;
} {
  const platonic = PLATONIC_EVIDENCE_SETS[clusterKind];
  if (!platonic || platonic.length === 0) {
    return { penalty: 0.4, platonic_set_known: false, platonic_set_size: 0, platonic_items_present: 0 };
  }
  const present = platonic.filter((item) => evidence.some((e) => item.match(e)));
  return {
    penalty: 1 - present.length / platonic.length,
    platonic_set_known: true,
    platonic_set_size: platonic.length,
    platonic_items_present: present.length,
  };
}

function combineConfidenceScore(d: ClusterConfidenceDimensions): number {
  const completeness = 1 - d.missing_data_penalty;
  const factors = [d.breadth, d.depth, d.time, d.coherence_strength, completeness];
  const floored = factors.map((f) => Math.max(0.05, Math.min(1, f)));
  const product = floored.reduce((a, b) => a * b, 1);
  return Math.pow(product, 1 / floored.length);
}

function deriveTier(
  audit: { n_nodes: number; n_distinct_layers: number; has_imaging_or_omics: boolean; n_time_points: number; trajectory_dependent: boolean; platonic_set_known?: boolean },
  dimensions: ClusterConfidenceDimensions
): ClusterConfidenceTier {
  const completeness = 1 - dimensions.missing_data_penalty;
  if (audit.n_nodes >= 15 && audit.n_distinct_layers >= 4 && audit.has_imaging_or_omics && dimensions.coherence_strength >= 0.85 && completeness >= 0.85 && (!audit.trajectory_dependent || audit.n_time_points >= 3)) return 'robust';
  const completenessMetForSupported = audit.platonic_set_known === false || completeness >= 0.75;
  if (audit.n_nodes >= 10 && audit.n_distinct_layers >= 3 && dimensions.coherence_strength >= 0.75 && completenessMetForSupported) return 'supported';
  if (audit.n_nodes >= 6 && audit.n_distinct_layers >= 2) return 'developing';
  if (audit.n_nodes >= 4) return 'tentative';
  return 'emerging';
}

function deriveClusterConfidence(input: { cluster_kind: string; evidence: ClusterEvidenceInput[]; trajectory_dependent?: boolean }): ClusterConfidenceResult {
  const trajectoryDependent = input.trajectory_dependent ?? true;
  const evidence = input.evidence ?? [];
  const nNodes = evidence.length;
  const layerSet = new Set<ClusterEvidenceLayer>();
  for (const e of evidence) layerSet.add(e.layer_type);
  const layerTypes = Array.from(layerSet);
  const nDistinctLayers = layerTypes.length;
  const hasImagingOrOmics = layerSet.has('imaging') || layerSet.has('omics');

  const dateSet = new Set<string>();
  let minDate: number | null = null;
  let maxDate: number | null = null;
  for (const e of evidence) {
    if (e.time_point == null) continue;
    const d = e.time_point instanceof Date ? e.time_point : new Date(String(e.time_point));
    if (Number.isNaN(d.getTime())) continue;
    dateSet.add(d.toISOString().slice(0, 10));
    const t = d.getTime();
    if (minDate === null || t < minDate) minDate = t;
    if (maxDate === null || t > maxDate) maxDate = t;
  }
  const nTimePoints = dateSet.size;
  const windowMonths = minDate !== null && maxDate !== null ? (maxDate - minDate) / (1000 * 60 * 60 * 24 * 30.44) : 0;

  let nConvergent = 0, nDivergent = 0, nNeutral = 0;
  for (const e of evidence) {
    if (e.direction === 'convergent') nConvergent++;
    else if (e.direction === 'divergent') nDivergent++;
    else nNeutral++;
  }

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

  const score = combineConfidenceScore(dimensions);
  let tier = deriveTier(
    { n_nodes: nNodes, n_distinct_layers: nDistinctLayers, has_imaging_or_omics: hasImagingOrOmics, n_time_points: nTimePoints, trajectory_dependent: trajectoryDependent, platonic_set_known: missingResult.platonic_set_known },
    dimensions
  );
  if (!missingResult.platonic_set_known && tier === 'robust') tier = 'supported';

  const scoreBasedTier: ClusterConfidenceTier =
    score >= 0.85 ? 'robust' : score >= 0.70 ? 'supported' : score >= 0.50 ? 'developing' : score >= 0.30 ? 'tentative' : 'emerging';

  return {
    confidence_score: Number(score.toFixed(4)),
    confidence_tier: tier,
    confidence_dimensions: dimensions,
    audit: {
      n_nodes: nNodes, n_distinct_layers: nDistinctLayers, layer_types: layerTypes,
      has_imaging_or_omics: hasImagingOrOmics, n_time_points: nTimePoints,
      time_window_months: Number(windowMonths.toFixed(2)),
      n_convergent: nConvergent, n_divergent: nDivergent, n_neutral: nNeutral,
      platonic_set_known: missingResult.platonic_set_known, platonic_set_size: missingResult.platonic_set_size,
      platonic_items_present: missingResult.platonic_items_present, trajectory_dependent: trajectoryDependent,
      structural_floor_tier: tier, score_based_tier: scoreBasedTier,
    },
  };
}

function listMissingPlatonicItems(clusterKind: string, evidence: ClusterEvidenceInput[]): Array<{ id: string; description: string }> {
  const platonic = PLATONIC_EVIDENCE_SETS[clusterKind];
  if (!platonic) return [];
  return platonic.filter((item) => !evidence.some((e) => item.match(e))).map((item) => ({ id: item.id, description: item.description }));
}

// ============================================================================
// VALIDATOR TYPES AND FUNCTION
// ============================================================================

export interface ReconciledCluster {
  cluster_kind: string;
  claim: string;
  constituent_evidence: Array<{
    evidence_kind: string;
    evidence_id: string;
    layer_type: string;
    direction: string;
    value_summary: string;
    time_point: string | null;
  }>;
  tensions_held: Array<{ evidence_id: string; description: string }>;
  missing_evidence: Array<{ item: string; why_it_would_sharpen: string }>;
  trajectory_dependent: boolean;
  rationale_for_grouping: string;
}

export interface ReconcilerOutput {
  clusters: ReconciledCluster[];
  reconciliation_notes: string;
}

export interface ValidatedClusterWritePayload {
  cluster_row: {
    patient_id: string;
    cluster_kind: string;
    claim: string;
    constituent_evidence: any;
    coherence_signals: any;
    tensions_held: any;
    missing_evidence: any;
    confidence_score: number;
    confidence_tier: string;
    confidence_dimensions: any;
    provenance: any;
    linked_intervention_ids: string[];
    linked_surfaces: any;
    status: string;
    generation_run_id: string | null;
    notes: string | null;
  };
  evidence_rows: Array<{
    cluster_id?: string;
    evidence_kind: string;
    evidence_id: string;
    layer_type: ClusterEvidenceLayer;
    direction: ClusterEvidenceDirection;
    weight: number;
    time_point: string | null;
  }>;
  validation: {
    confidence: ClusterConfidenceResult;
    rejected: boolean;
    rejection_reasons: string[];
  };
}

const VALID_LAYERS: ClusterEvidenceLayer[] = [
  "cie", "lab", "inbody", "emr", "medication", "sensor", "food_log", "imaging", "omics", "narrative",
];
const VALID_DIRECTIONS: ClusterEvidenceDirection[] = ["convergent", "divergent", "neutral"];

export function validateReconcilerOutput(
  output: ReconcilerOutput,
  patientId: string,
  generationRunId: string | null
): ValidatedClusterWritePayload[] {
  if (!output || !Array.isArray(output.clusters)) {
    throw new Error("Reconciler output is missing 'clusters' array");
  }

  return output.clusters.map((cluster, idx) => {
    const rejectionReasons: string[] = [];

    if (!cluster.cluster_kind || typeof cluster.cluster_kind !== "string") {
      rejectionReasons.push(`cluster ${idx}: missing or invalid cluster_kind`);
    }
    if (!cluster.claim || typeof cluster.claim !== "string") {
      rejectionReasons.push(`cluster ${idx}: missing or invalid claim`);
    }
    if (!Array.isArray(cluster.constituent_evidence) || cluster.constituent_evidence.length < 2) {
      rejectionReasons.push(`cluster ${idx}: constituent_evidence must have at least 2 rows`);
    }
    if (!Array.isArray(cluster.missing_evidence) || cluster.missing_evidence.length === 0) {
      rejectionReasons.push(`cluster ${idx}: missing_evidence must be non-empty (Principle 4)`);
    }

    const normalizedEvidence: ClusterEvidenceInput[] = (cluster.constituent_evidence ?? [])
      .map((e) => {
        const layer = VALID_LAYERS.includes(e.layer_type as ClusterEvidenceLayer)
          ? (e.layer_type as ClusterEvidenceLayer)
          : null;
        const direction = VALID_DIRECTIONS.includes(e.direction as ClusterEvidenceDirection)
          ? (e.direction as ClusterEvidenceDirection)
          : "neutral";
        if (!layer) {
          rejectionReasons.push(`cluster ${idx}: invalid layer_type "${e.layer_type}" on evidence ${e.evidence_id}`);
          return null;
        }
        return {
          evidence_kind: e.evidence_kind,
          evidence_id: e.evidence_id,
          layer_type: layer,
          direction,
          time_point: (e.time_point ?? null) as string | null,
          text_for_matching: e.value_summary,
        } as ClusterEvidenceInput;
      })
      .filter((e): e is ClusterEvidenceInput => e !== null);

    const confidence = deriveClusterConfidence({
      cluster_kind: cluster.cluster_kind,
      evidence: normalizedEvidence,
      trajectory_dependent: cluster.trajectory_dependent ?? true,
    });

    const coherenceSignals = cluster.constituent_evidence.filter((e) => e.direction === "convergent");

    // The LLM's authored missing_evidence is the source of truth for the
    // user-facing list. We do NOT auto-augment from the platonic registry
    // because the boilerplate text "Standard cluster evidence for X" reads
    // poorly next to the LLM-authored items and the platonic registry's
    // matchers were producing false positives before the text_for_matching
    // fix landed. The platonic registry remains the source of truth for
    // the missing_data_penalty in the confidence math (computed inside
    // deriveClusterConfidence), but it no longer writes user-facing text.
    const augmentedMissing = cluster.missing_evidence;

    return {
      cluster_row: {
        patient_id: patientId,
        cluster_kind: cluster.cluster_kind,
        claim: cluster.claim,
        constituent_evidence: cluster.constituent_evidence,
        coherence_signals: coherenceSignals,
        tensions_held: cluster.tensions_held ?? [],
        missing_evidence: augmentedMissing,
        confidence_score: confidence.confidence_score,
        confidence_tier: confidence.confidence_tier,
        confidence_dimensions: confidence.confidence_dimensions,
        provenance: {
          generator_pass: true,
          critic_pass: true,
          reconciler_pass: true,
          confidence_audit: confidence.audit,
        },
        linked_intervention_ids: [],
        linked_surfaces: [],
        status: "active",
        generation_run_id: generationRunId,
        notes: cluster.rationale_for_grouping ?? null,
      },
      evidence_rows: normalizedEvidence.map((e) => ({
        evidence_kind: e.evidence_kind,
        evidence_id: e.evidence_id,
        layer_type: e.layer_type,
        direction: e.direction,
        weight: 1.0,
        time_point: e.time_point ? String(e.time_point) : null,
      })),
      validation: {
        confidence,
        rejected: rejectionReasons.length > 0,
        rejection_reasons: rejectionReasons,
      },
    };
  });
}
