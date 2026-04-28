// src/lib/terrainAxes.ts
//
// Single source of truth for the 7 high-level terrain coordinates and how
// to derive each one's numeric value (0–100) from CIE gate scores.
//
// Two callers:
//   1. src/components/visuals/TerrainRadar.tsx (via ThesisSection)
//   2. src/hooks/useDefinitionContext.ts (the patient-grounded definition
//      composer)
//
// Calibration note: the gate→axis label set is a v1 hardcode mirroring the
// terrain radar mapping rule. If/when CIE adds gates or relabels coords,
// update this file in one place.

export interface RadarGateMapping {
  gateId: string;
  label: string;
}

export const RADAR_GATES: ReadonlyArray<RadarGateMapping> = [
  { gateId: "BRI", label: "Brain" },
  { gateId: "BCS", label: "Barrier" },
  { gateId: "FPIS", label: "Fuel" },
  { gateId: "TIS", label: "Tissue" },
  { gateId: "CLI", label: "Longevity" },
  { gateId: "HPI", label: "Potential" },
  { gateId: "GRIP", label: "Risk" },
];

export interface GateScoreLike {
  score: number;
  traffic_light?: string;
}

export interface TerrainAxisValue {
  id: string;          // gate id, e.g. "BRI"
  label: string;       // human label, e.g. "Brain"
  score: number;       // 0–100, rounded
  trafficLight: string | null;
}

/**
 * Derive the seven-axis terrain values from the gate score map produced by
 * `useCIEAssessment().gateScores`. Returns an empty array when no gate
 * scores are present so callers can render a fallback. When some gates are
 * present but a specific gate is missing, that axis defaults to score 50
 * with a null trafficLight, matching the existing radar fallback.
 */
export function deriveTerrainAxes(
  gateScores: Record<string, GateScoreLike>
): TerrainAxisValue[] {
  if (!gateScores || Object.keys(gateScores).length === 0) return [];
  // Defensive dedupe: guarantee each gateId / label appears exactly once on
  // the rendered radar, even if RADAR_GATES is ever extended with overlap.
  const seenIds = new Set<string>();
  const seenLabels = new Set<string>();
  return RADAR_GATES.filter((rg) => {
    if (seenIds.has(rg.gateId) || seenLabels.has(rg.label)) return false;
    seenIds.add(rg.gateId);
    seenLabels.add(rg.label);
    return true;
  }).map((rg) => {
    const gs = gateScores[rg.gateId];
    return {
      id: rg.gateId,
      label: rg.label,
      score: gs ? Math.round(gs.score) : 50,
      trafficLight: gs?.traffic_light ?? null,
    };
  });
}