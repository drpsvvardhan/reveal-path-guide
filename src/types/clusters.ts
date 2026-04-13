export type ClusterTier = 'emerging' | 'tentative' | 'developing' | 'supported' | 'robust';

export interface ClusterEvidenceItem {
  evidence_kind: string;
  evidence_id: string;
  layer_type: string;
  direction: 'convergent' | 'divergent' | 'neutral';
  value_summary: string;
  time_point: string | null;
}

export interface TensionHeld {
  evidence_id: string;
  description: string;
}

export interface MissingEvidenceItem {
  item: string;
  why_it_would_sharpen: string;
}

export interface ConfidenceDimensions {
  breadth: number;
  depth: number;
  time: number;
  coherence_strength: number;
  missing_data_penalty: number;
}

export interface ClusterRow {
  id: string;
  patient_id: string;
  cluster_kind: string;
  claim: string;
  constituent_evidence: ClusterEvidenceItem[];
  coherence_signals: ClusterEvidenceItem[];
  tensions_held: TensionHeld[];
  missing_evidence: MissingEvidenceItem[];
  confidence_score: number;
  confidence_tier: ClusterTier;
  confidence_dimensions: ConfidenceDimensions;
  provenance: any;
  linked_intervention_ids: string[];
  linked_surfaces: any[];
  status: string;
  notes: string | null;
  generation_run_id: string | null;
  created_at: string;
  updated_at: string;
}
