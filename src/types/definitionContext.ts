// src/types/definitionContext.ts
//
// Shape returned by useDefinitionContext(). One stable interface; every
// absent source is represented by an explicit `null`.
// See docs/UCDE_DEFINITION_CONTEXT_MAPPING_v1.md for the per-field source
// of truth. Coherence banding thresholds (≥0.7 high, 0.4–0.7 mixed, <0.4
// low) are v1 defaults — calibration-tunable.

import type { ClusterTier } from "@/types/clusters";
import type { PatternSeverity } from "@/types/manifest";

export type CoherenceLabel = "high" | "mixed" | "low";
export type TerrainOverallStatus = "coherent" | "mixed" | "needs-attention";

export interface DefinitionAxis {
  id: string;
  label: string;
  value: number;
  trafficLight: string | null;
}

export interface DefinitionGate {
  id: string;
  name: string;
  score: number;
  trafficLight: string;
}

export interface DefinitionContradiction {
  id: string;
  title: string;
  severity: PatternSeverity;
}

export interface DefinitionReversibility {
  weeksCount: number;
  monthsCount: number;
  slowCount: number;
  permanentCount: number;
}

export interface DefinitionConfidence {
  confidentCount: number;
  investigatingCount: number;
  retestCount: number;
}

export interface DefinitionContext {
  // 1. axis
  axes: DefinitionAxis[] | null;

  // 2. terrain (derived from axes)
  terrainOverallStatus: TerrainOverallStatus | null;
  terrainAxesSummary: string | null;

  // 3. cluster
  clusterCount: number | null;
  clusterTierBreakdown: Record<ClusterTier, number> | null;

  // 4. gate
  gates: DefinitionGate[] | null;
  gatesAttention: Array<{ id: string; name: string }> | null;

  // 5. coherence
  coherenceAverage: number | null;
  coherenceLabel: CoherenceLabel | null;

  // 6. contradiction
  contradictions: DefinitionContradiction[] | null;
  tensionCount: number | null;

  // 7. scar — no source today
  scars: null;

  // 8. plasticity — no first-class source; proxy via reversibility counts
  plasticityIndex: null;
  plasticityProxy: DefinitionReversibility | null;

  // 9. reversibility
  reversibility: DefinitionReversibility | null;

  // 10. confidence
  confidence: DefinitionConfidence | null;
  clusterRobustCount: number | null;
}

/** v1 coherence banding — calibration-tunable; matches the D-4
 *  longitudinal-threshold pattern of carrying a single hardcoded constant
 *  with a documented tuning hook. */
export const COHERENCE_BANDS = {
  highMin: 0.7,
  mixedMin: 0.4,
} as const;

export function bandCoherence(avg: number | null): CoherenceLabel | null {
  if (avg === null || Number.isNaN(avg)) return null;
  if (avg >= COHERENCE_BANDS.highMin) return "high";
  if (avg >= COHERENCE_BANDS.mixedMin) return "mixed";
  return "low";
}