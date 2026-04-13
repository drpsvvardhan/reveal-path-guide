// src/lib/clusterConfidence.test.ts
import { describe, expect, it } from 'vitest';
import {
  computeBreadth,
  computeDepth,
  computeTime,
  computeCoherenceStrength,
  computeMissingDataPenalty,
  combineConfidenceScore,
  deriveTier,
  deriveClusterConfidence,
  listMissingPlatonicItems,
  type ClusterEvidenceInput,
  type ClusterEvidenceLayer,
  type ClusterEvidenceDirection,
} from './clusterConfidence';

const e = (
  id: string,
  layer: ClusterEvidenceLayer,
  direction: ClusterEvidenceDirection = 'convergent',
  time_point: string | null = null
): ClusterEvidenceInput => ({
  evidence_kind: 'test',
  evidence_id: id,
  layer_type: layer,
  direction,
  time_point,
});

describe('computeBreadth', () => {
  it('returns 0 for zero or negative input', () => {
    expect(computeBreadth(0)).toBe(0);
    expect(computeBreadth(-1)).toBe(0);
  });
  it('matches thesis intuition at key counts', () => {
    expect(computeBreadth(2)).toBeCloseTo(0.39, 1);
    expect(computeBreadth(5)).toBeCloseTo(0.71, 1);
    expect(computeBreadth(10)).toBeCloseTo(0.92, 1);
    expect(computeBreadth(20)).toBeGreaterThan(0.98);
  });
  it('is monotonically increasing', () => {
    for (let i = 1; i < 30; i++) {
      expect(computeBreadth(i + 1)).toBeGreaterThan(computeBreadth(i));
    }
  });
});

describe('computeDepth', () => {
  it('returns 0 for zero layers', () => {
    expect(computeDepth(0)).toBe(0);
  });
  it('caps at 1.0 at 5 layers', () => {
    expect(computeDepth(5)).toBe(1);
    expect(computeDepth(10)).toBe(1);
  });
  it('is linear below 5', () => {
    expect(computeDepth(1)).toBeCloseTo(0.20);
    expect(computeDepth(3)).toBeCloseTo(0.60);
    expect(computeDepth(4)).toBeCloseTo(0.80);
  });
});

describe('computeTime', () => {
  it('non-trajectory claim with no time points returns 0.5 floor', () => {
    expect(computeTime(0, 0, false)).toBe(0.5);
  });
  it('trajectory claim with no time points returns 0', () => {
    expect(computeTime(0, 0, true)).toBe(0);
  });
  it('non-trajectory claim with 6 time points returns full credit', () => {
    expect(computeTime(6, 12, false)).toBe(1);
  });
  it('trajectory with 6 points across 12 months returns full credit', () => {
    expect(computeTime(6, 12, true)).toBeCloseTo(1.0);
  });
  it('trajectory with 6 points compressed into 1 month is penalized by window', () => {
    expect(computeTime(6, 1, true)).toBeLessThan(0.5);
  });
  it('trajectory with 3 points across 6 months is partial', () => {
    const v = computeTime(3, 6, true);
    expect(v).toBeGreaterThan(0.2);
    expect(v).toBeLessThan(0.6);
  });
});

describe('computeCoherenceStrength', () => {
  it('returns 0.5 when no directional evidence', () => {
    expect(computeCoherenceStrength(0, 0)).toBe(0.5);
  });
  it('returns 1.0 when all convergent', () => {
    expect(computeCoherenceStrength(10, 0)).toBe(1);
  });
  it('returns 0 when all divergent', () => {
    expect(computeCoherenceStrength(0, 10)).toBe(0);
  });
  it('handles 9-1 split (preserved contradiction)', () => {
    expect(computeCoherenceStrength(9, 1)).toBeCloseTo(0.9);
  });
  it('handles 50-50 tie', () => {
    expect(computeCoherenceStrength(5, 5)).toBe(0.5);
  });
});

describe('computeMissingDataPenalty', () => {
  it('returns mild penalty for unknown cluster kind', () => {
    const r = computeMissingDataPenalty('unknown_kind', [e('foo', 'lab')]);
    expect(r.platonic_set_known).toBe(false);
    expect(r.penalty).toBe(0.4);
    expect(r.platonic_set_size).toBe(0);
  });
  it('returns near-zero penalty for fully complete cardiovascular_particle', () => {
    const evidence = [
      e('apob_serum', 'lab'),
      e('ldl_p_nmr', 'lab'),
      e('ldl_small_dense_pct', 'lab'),
      e('apoa1_serum', 'lab'),
      e('hdl_p_nmr', 'lab'),
      e('lpa_mass', 'lab'),
      e('hs_crp_serum', 'lab'),
      e('tmao_metabolomics', 'omics'),
      e('cac_score_ct', 'imaging'),
    ];
    const r = computeMissingDataPenalty('cardiovascular_particle', evidence);
    expect(r.platonic_set_known).toBe(true);
    expect(r.platonic_set_size).toBe(9);
    expect(r.platonic_items_present).toBe(9);
    expect(r.penalty).toBe(0);
  });
  it('returns high penalty for sparse cardiovascular_particle', () => {
    const r = computeMissingDataPenalty('cardiovascular_particle', [e('apob', 'lab')]);
    expect(r.platonic_set_known).toBe(true);
    expect(r.platonic_items_present).toBe(1);
    expect(r.penalty).toBeGreaterThan(0.7);
  });
});

describe('combineConfidenceScore', () => {
  it('returns near-zero for all-low dimensions', () => {
    const d = {
      breadth: 0.05, depth: 0.05, time: 0.05,
      coherence_strength: 0.05, missing_data_penalty: 0.95,
    };
    expect(combineConfidenceScore(d)).toBeLessThan(0.1);
  });
  it('returns near-1 for all-high dimensions', () => {
    const d = {
      breadth: 0.99, depth: 0.99, time: 0.99,
      coherence_strength: 0.99, missing_data_penalty: 0.01,
    };
    expect(combineConfidenceScore(d)).toBeGreaterThan(0.95);
  });
  it('penalizes a single low dimension (geometric mean property)', () => {
    const allHigh = {
      breadth: 0.9, depth: 0.9, time: 0.9,
      coherence_strength: 0.9, missing_data_penalty: 0.1,
    };
    const oneLow = {
      breadth: 0.9, depth: 0.05, time: 0.9,
      coherence_strength: 0.9, missing_data_penalty: 0.1,
    };
    expect(combineConfidenceScore(oneLow)).toBeLessThan(
      combineConfidenceScore(allHigh) * 0.7
    );
  });
});

describe('deriveTier (structural floors)', () => {
  const fullDims = {
    breadth: 1, depth: 1, time: 1,
    coherence_strength: 1, missing_data_penalty: 0,
  };

  it('emerging when only 2 nodes', () => {
    const t = deriveTier(
      { n_nodes: 2, n_distinct_layers: 1, has_imaging_or_omics: false, n_time_points: 1, trajectory_dependent: false },
      fullDims
    );
    expect(t).toBe('emerging');
  });

  it('tentative at exactly 4 nodes 1 layer', () => {
    const t = deriveTier(
      { n_nodes: 4, n_distinct_layers: 1, has_imaging_or_omics: false, n_time_points: 1, trajectory_dependent: false },
      fullDims
    );
    expect(t).toBe('tentative');
  });

  it('developing at 6 nodes 2 layers', () => {
    const t = deriveTier(
      { n_nodes: 6, n_distinct_layers: 2, has_imaging_or_omics: false, n_time_points: 1, trajectory_dependent: false },
      fullDims
    );
    expect(t).toBe('developing');
  });

  it('does NOT reach supported with only 2 layers even if n_nodes high', () => {
    const t = deriveTier(
      { n_nodes: 20, n_distinct_layers: 2, has_imaging_or_omics: false, n_time_points: 5, trajectory_dependent: false },
      fullDims
    );
    expect(t).toBe('developing');
  });

  it('supported at 10 nodes 3 layers coherence 0.75 completeness 0.75', () => {
    const t = deriveTier(
      { n_nodes: 10, n_distinct_layers: 3, has_imaging_or_omics: false, n_time_points: 3, trajectory_dependent: false },
      { breadth: 1, depth: 1, time: 1, coherence_strength: 0.75, missing_data_penalty: 0.25 }
    );
    expect(t).toBe('supported');
  });

  it('does NOT reach supported when coherence is 0.74', () => {
    const t = deriveTier(
      { n_nodes: 10, n_distinct_layers: 3, has_imaging_or_omics: false, n_time_points: 3, trajectory_dependent: false },
      { breadth: 1, depth: 1, time: 1, coherence_strength: 0.74, missing_data_penalty: 0.25 }
    );
    expect(t).toBe('developing');
  });

  it('does NOT reach supported when completeness is 0.74 (penalty 0.26)', () => {
    const t = deriveTier(
      { n_nodes: 10, n_distinct_layers: 3, has_imaging_or_omics: false, n_time_points: 3, trajectory_dependent: false },
      { breadth: 1, depth: 1, time: 1, coherence_strength: 0.85, missing_data_penalty: 0.26 }
    );
    expect(t).toBe('developing');
  });

  it('robust requires imaging OR omics (without it, falls to supported)', () => {
    const without = deriveTier(
      { n_nodes: 15, n_distinct_layers: 4, has_imaging_or_omics: false, n_time_points: 3, trajectory_dependent: false },
      { breadth: 1, depth: 1, time: 1, coherence_strength: 0.85, missing_data_penalty: 0.15 }
    );
    expect(without).toBe('supported');

    const withIt = deriveTier(
      { n_nodes: 15, n_distinct_layers: 4, has_imaging_or_omics: true, n_time_points: 3, trajectory_dependent: false },
      { breadth: 1, depth: 1, time: 1, coherence_strength: 0.85, missing_data_penalty: 0.15 }
    );
    expect(withIt).toBe('robust');
  });

  it('robust trajectory cluster requires 3+ time points (with 2 falls to supported)', () => {
    const t = deriveTier(
      { n_nodes: 15, n_distinct_layers: 4, has_imaging_or_omics: true, n_time_points: 2, trajectory_dependent: true },
      { breadth: 1, depth: 1, time: 1, coherence_strength: 0.85, missing_data_penalty: 0.15 }
    );
    expect(t).toBe('supported');
  });

  it('robust non-trajectory cluster does not need time points', () => {
    const t = deriveTier(
      { n_nodes: 15, n_distinct_layers: 4, has_imaging_or_omics: true, n_time_points: 1, trajectory_dependent: false },
      { breadth: 1, depth: 1, time: 1, coherence_strength: 0.85, missing_data_penalty: 0.15 }
    );
    expect(t).toBe('robust');
  });
});

describe('deriveClusterConfidence (end-to-end)', () => {
  it('emerging cluster: 2 nodes, single layer, single date', () => {
    const r = deriveClusterConfidence({
      cluster_kind: 'unknown_kind',
      evidence: [e('a', 'lab'), e('b', 'lab')],
      trajectory_dependent: false,
    });
    expect(r.confidence_tier).toBe('emerging');
    expect(r.audit.n_nodes).toBe(2);
    expect(r.audit.n_distinct_layers).toBe(1);
  });

  it('high-breadth single-layer cluster cannot exceed tentative', () => {
    const evidence = Array.from({ length: 20 }, (_, i) => e(`m${i}`, 'lab'));
    const r = deriveClusterConfidence({
      cluster_kind: 'unknown_kind',
      evidence,
      trajectory_dependent: false,
    });
    expect(r.confidence_tier).toBe('tentative');
  });

  it('20 nodes 2 layers reaches developing not supported', () => {
    const evidence = [
      ...Array.from({ length: 10 }, (_, i) => e(`l${i}`, 'lab')),
      ...Array.from({ length: 10 }, (_, i) => e(`s${i}`, 'sensor')),
    ];
    const r = deriveClusterConfidence({
      cluster_kind: 'unknown_kind',
      evidence,
      trajectory_dependent: false,
    });
    expect(r.confidence_tier).toBe('developing');
  });

  it('cardiovascular_particle robust example (Harsha-style multi-omics with imaging)', () => {
    const dates = ['2024-01-15', '2024-06-15', '2024-12-15'];
    const evidence: ClusterEvidenceInput[] = [
      e('apob_serum', 'lab', 'convergent', dates[0]),
      e('apob_serum', 'lab', 'convergent', dates[1]),
      e('apob_serum', 'lab', 'convergent', dates[2]),
      e('ldl_p_nmr', 'lab', 'convergent', dates[0]),
      e('ldl_p_nmr', 'lab', 'convergent', dates[1]),
      e('ldl_p_nmr', 'lab', 'convergent', dates[2]),
      e('ldl_small_dense', 'lab', 'convergent', dates[0]),
      e('apoa1_serum', 'lab', 'divergent', dates[0]),
      e('hdl_p_nmr', 'lab', 'convergent', dates[0]),
      e('lpa_mass', 'lab', 'convergent', dates[0]),
      e('hs_crp_serum', 'lab', 'convergent', dates[0]),
      e('tmao_metabolomics', 'omics', 'convergent', dates[0]),
      e('cac_score_ct', 'imaging', 'convergent', dates[0]),
      e('cie_b4_endothelium', 'cie', 'convergent', dates[0]),
      e('cie_b6_vascular_inflammation', 'cie', 'convergent', dates[0]),
      e('inbody_visceral_fat_area', 'inbody', 'convergent', dates[0]),
    ];
    const r = deriveClusterConfidence({
      cluster_kind: 'cardiovascular_particle',
      evidence,
      trajectory_dependent: true,
    });
    expect(r.audit.n_nodes).toBe(16);
    expect(r.audit.n_distinct_layers).toBeGreaterThanOrEqual(4);
    expect(r.audit.has_imaging_or_omics).toBe(true);
    expect(r.audit.n_time_points).toBe(3);
    expect(r.audit.platonic_set_known).toBe(true);
    expect(r.audit.platonic_items_present).toBe(9);
    expect(r.confidence_tier).toBe('robust');
  });

  it('all-divergent cluster has 0 coherence and cannot reach supported', () => {
    const dates = ['2024-01-15', '2024-06-15'];
    const evidence: ClusterEvidenceInput[] = [
      e('a', 'lab', 'divergent', dates[0]),
      e('b', 'lab', 'divergent', dates[1]),
      e('c', 'sensor', 'divergent', dates[0]),
      e('d', 'sensor', 'divergent', dates[1]),
      e('f', 'cie', 'divergent', dates[0]),
      e('g', 'inbody', 'divergent', dates[0]),
      e('h', 'lab', 'divergent', dates[0]),
      e('i', 'sensor', 'divergent', dates[1]),
      e('j', 'cie', 'divergent', dates[0]),
      e('k', 'lab', 'divergent', dates[1]),
    ];
    const r = deriveClusterConfidence({
      cluster_kind: 'unknown_kind',
      evidence,
      trajectory_dependent: false,
    });
    expect(r.confidence_dimensions.coherence_strength).toBe(0);
    expect(['emerging', 'tentative', 'developing']).toContain(r.confidence_tier);
  });

  it('trajectory cluster with only 2 time points cannot reach robust', () => {
    const dates = ['2024-01-15', '2024-12-15'];
    const evidence: ClusterEvidenceInput[] = [
      e('apob', 'lab', 'convergent', dates[0]),
      e('apob', 'lab', 'convergent', dates[1]),
      e('ldl_p', 'lab', 'convergent', dates[0]),
      e('ldl_p', 'lab', 'convergent', dates[1]),
      e('ldl_small_dense', 'lab', 'convergent', dates[0]),
      e('apoa1', 'lab', 'convergent', dates[0]),
      e('hdl_p', 'lab', 'convergent', dates[0]),
      e('lpa', 'lab', 'convergent', dates[0]),
      e('hs_crp', 'lab', 'convergent', dates[0]),
      e('tmao', 'omics', 'convergent', dates[0]),
      e('cac', 'imaging', 'convergent', dates[0]),
      e('cie_b4', 'cie', 'convergent', dates[0]),
      e('cie_b6', 'cie', 'convergent', dates[0]),
      e('inbody_visceral', 'inbody', 'convergent', dates[0]),
      e('hrv_sensor', 'sensor', 'convergent', dates[1]),
    ];
    const r = deriveClusterConfidence({
      cluster_kind: 'cardiovascular_particle',
      evidence,
      trajectory_dependent: true,
    });
    expect(r.audit.n_nodes).toBe(15);
    expect(r.audit.n_distinct_layers).toBeGreaterThanOrEqual(4);
    expect(r.audit.has_imaging_or_omics).toBe(true);
    expect(r.audit.n_time_points).toBe(2);
    expect(r.confidence_tier).toBe('supported');
  });

  it('unknown cluster kind capped at supported even with very strong structure', () => {
    const dates = ['2024-01-15', '2024-06-15', '2024-12-15'];
    const layers: ClusterEvidenceLayer[] = ['lab', 'sensor', 'cie', 'inbody', 'imaging', 'omics'];
    const evidence: ClusterEvidenceInput[] = Array.from({ length: 24 }, (_, i) => ({
      evidence_kind: 'test',
      evidence_id: `m${i}`,
      layer_type: layers[i % layers.length],
      direction: 'convergent' as const,
      time_point: dates[i % 3],
    }));
    const r = deriveClusterConfidence({
      cluster_kind: 'unknown_kind_not_in_registry',
      evidence,
      trajectory_dependent: true,
    });
    expect(r.audit.platonic_set_known).toBe(false);
    expect(r.audit.n_nodes).toBe(24);
    expect(r.audit.n_distinct_layers).toBe(6);
    expect(r.audit.has_imaging_or_omics).toBe(true);
    expect(r.audit.n_time_points).toBe(3);
    // Would be robust on structure alone — capped to supported by unknown platonic.
    expect(r.confidence_tier).toBe('supported');
  });

  it('multiple measurements on same calendar day count as one time point', () => {
    const evidence: ClusterEvidenceInput[] = [
      e('a', 'lab', 'convergent', '2024-06-15T08:00:00Z'),
      e('b', 'lab', 'convergent', '2024-06-15T14:00:00Z'),
      e('c', 'lab', 'convergent', '2024-06-15T20:00:00Z'),
    ];
    const r = deriveClusterConfidence({
      cluster_kind: 'unknown_kind',
      evidence,
      trajectory_dependent: false,
    });
    expect(r.audit.n_time_points).toBe(1);
  });

  it('audit object captures all five dimensions plus structural counts', () => {
    const r = deriveClusterConfidence({
      cluster_kind: 'unknown_kind',
      evidence: [e('a', 'lab'), e('b', 'sensor')],
      trajectory_dependent: false,
    });
    expect(r.confidence_dimensions).toHaveProperty('breadth');
    expect(r.confidence_dimensions).toHaveProperty('depth');
    expect(r.confidence_dimensions).toHaveProperty('time');
    expect(r.confidence_dimensions).toHaveProperty('coherence_strength');
    expect(r.confidence_dimensions).toHaveProperty('missing_data_penalty');
    expect(r.audit).toHaveProperty('layer_types');
    expect(r.audit).toHaveProperty('n_convergent');
    expect(r.audit).toHaveProperty('platonic_set_known');
  });
});

describe('listMissingPlatonicItems', () => {
  it('returns empty array for unknown cluster kind', () => {
    expect(listMissingPlatonicItems('unknown', [])).toEqual([]);
  });
  it('returns full platonic set for empty evidence', () => {
    const items = listMissingPlatonicItems('cardiovascular_particle', []);
    expect(items.length).toBe(9);
    expect(items.some((i) => i.id === 'apob')).toBe(true);
    expect(items.some((i) => i.id === 'cac')).toBe(true);
  });
  it('omits items that are matched by evidence', () => {
    const items = listMissingPlatonicItems('cardiovascular_particle', [
      { evidence_kind: 'lab', evidence_id: 'apob_serum', layer_type: 'lab', direction: 'convergent' },
      { evidence_kind: 'imaging', evidence_id: 'cac_score_ct', layer_type: 'imaging', direction: 'convergent' },
    ]);
    expect(items.some((i) => i.id === 'apob')).toBe(false);
    expect(items.some((i) => i.id === 'cac')).toBe(false);
    expect(items.some((i) => i.id === 'lpa')).toBe(true);
  });
});
