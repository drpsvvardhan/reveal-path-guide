// supabase/functions/generate-clusters/validator.ts
//
// Validates the reconciler output and produces cluster-write payloads.
// Pure function. No LLM. No database writes.
//
// Confidence computation is imported from the canonical substrate at
// supabase/functions/_shared/clusterConfidence.ts. The client mirrors this
// via the @shared path alias / src/lib/clusterConfidence.ts shim.

import {
  deriveClusterConfidence,
  type ClusterEvidenceInput,
  type ClusterEvidenceLayer,
  type ClusterEvidenceDirection,
  type ClusterConfidenceResult,
} from "../_shared/clusterConfidence.ts";

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
