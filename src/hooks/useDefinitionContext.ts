// src/hooks/useDefinitionContext.ts
//
// Aggregates the per-patient state needed by the contextual hover composer.
// Reads from existing contexts + hooks only — no new substrate. Every
// missing source surfaces as an explicit `null` in the returned shape.

import { useMemo } from "react";
import { useTerrainRender } from "@/context/TerrainRenderContext";
import { useCIEAssessment } from "@/context/CIEAssessmentContext";
import { useDerivedPatterns } from "@/context/DerivedPatternsContext";
import { useManifest } from "@/context/ManifestContext";
import { useClusters } from "@/hooks/useClusters";
import { deriveTerrainAxes } from "@/lib/terrainAxes";
import {
  averageCoherence,
  totalTensions,
  tierDistribution,
} from "@/lib/clusterAggregations";
import {
  bandCoherence,
  type DefinitionContext,
  type DefinitionAxis,
  type DefinitionGate,
  type TerrainOverallStatus,
} from "@/types/definitionContext";

function summarizeTerrain(axes: DefinitionAxis[]): {
  status: TerrainOverallStatus;
  summary: string;
} {
  const attention: string[] = [];
  const coherent: string[] = [];
  for (const a of axes) {
    const tl = (a.trafficLight || "").toUpperCase();
    if (tl === "RED" || tl === "ORANGE") attention.push(a.label);
    else if (tl === "GREEN") coherent.push(a.label);
  }

  let status: TerrainOverallStatus = "mixed";
  if (attention.length === 0 && coherent.length > 0) status = "coherent";
  else if (attention.length >= Math.max(2, Math.ceil(axes.length / 2)))
    status = "needs-attention";

  const join = (xs: string[]) =>
    xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs.slice(-1);

  let summary: string;
  if (coherent.length > 0 && attention.length > 0) {
    summary = `${join(coherent)} look coherent, ${join(attention)} need attention.`;
  } else if (attention.length > 0) {
    summary = `${join(attention)} need attention.`;
  } else if (coherent.length > 0) {
    summary = `${join(coherent)} look coherent.`;
  } else {
    summary = "Your seven coordinates are still settling in.";
  }
  return { status, summary };
}

export function useDefinitionContext(): DefinitionContext {
  // Each provider may be absent on routes outside the patient shell
  // (Auth, ClinicalShare, NotFound, etc.). Tolerate missing providers
  // by treating their absence as "no data" rather than throwing.
  // Hook call order is preserved — only the post-useContext throw is caught.
  const safe = <T,>(fn: () => T, fallback: T): T => {
    try { return fn(); } catch { return fallback; }
  };
  const { gateScores } = safe(() => useCIEAssessment(), { gateScores: {} } as ReturnType<typeof useCIEAssessment>);
  const { manifest } = safe(() => useManifest(), { manifest: undefined } as unknown as ReturnType<typeof useManifest>);
  const { patterns } = safe(() => useDerivedPatterns(), { patterns: [] } as unknown as ReturnType<typeof useDerivedPatterns>);
  const { clusters } = safe(() => useClusters(), { clusters: [] } as unknown as ReturnType<typeof useClusters>);
  safe(() => useTerrainRender(), null);

  return useMemo<DefinitionContext>(() => {
    // 1. axes
    const derivedAxes = deriveTerrainAxes(gateScores);
    const axes: DefinitionAxis[] | null = derivedAxes.length === 0
      ? null
      : derivedAxes.map((a) => ({
          id: a.id,
          label: a.label,
          value: a.score,
          trafficLight: a.trafficLight,
        }));

    // 2. terrain summary
    let terrainOverallStatus: DefinitionContext["terrainOverallStatus"] = null;
    let terrainAxesSummary: string | null = null;
    if (axes && axes.length > 0) {
      const s = summarizeTerrain(axes);
      terrainOverallStatus = s.status;
      terrainAxesSummary = s.summary;
    }

    // 3. clusters
    const clusterCount = clusters.length === 0 ? null : clusters.length;
    const clusterTierBreakdown =
      clusters.length === 0 ? null : tierDistribution(clusters);

    // 4. gates
    const gateEntries = Object.values(gateScores);
    const gates: DefinitionGate[] | null =
      gateEntries.length === 0
        ? null
        : gateEntries.map((g) => ({
            id: g.gate_id,
            name: g.gate_name,
            score: Math.round(g.score),
            trafficLight: g.traffic_light,
          }));
    const gatesAttention =
      gates === null
        ? null
        : gates
            .filter((g) => (g.trafficLight || "").toUpperCase() !== "GREEN")
            .map((g) => ({ id: g.id, name: g.name }));

    // 5. coherence
    const coherenceAverage = averageCoherence(clusters);
    const coherenceLabel = bandCoherence(coherenceAverage);

    // 6. contradictions
    const contradictionPatterns = patterns.filter(
      (p) => p.category === "contradiction"
    );
    const contradictions =
      contradictionPatterns.length === 0
        ? null
        : contradictionPatterns.slice(0, 3).map((p) => ({
            id: p.id,
            title: p.title,
            severity: p.severity,
          }));
    const tensionCount =
      clusters.length === 0 ? null : totalTensions(clusters).totalTensions;

    // 8/9. reversibility (shared source for plasticity proxy + reversibility)
    const r = manifest?.reversibility;
    const reversibility = r
      ? {
          weeksCount: r.weeks?.length ?? 0,
          monthsCount: r.months?.length ?? 0,
          slowCount: r.slow?.length ?? 0,
          permanentCount: r.permanent?.length ?? 0,
        }
      : null;
    const plasticityProxy = reversibility;

    // 10. confidence
    const cb = manifest?.confidenceBreakdown;
    const confidence = cb
      ? {
          confidentCount: cb.confident?.length ?? 0,
          investigatingCount: cb.investigating?.length ?? 0,
          retestCount: cb.retest?.length ?? 0,
        }
      : null;
    const clusterRobustCount = clusterTierBreakdown
      ? clusterTierBreakdown.robust + clusterTierBreakdown.supported
      : null;

    return {
      axes,
      terrainOverallStatus,
      terrainAxesSummary,
      clusterCount,
      clusterTierBreakdown,
      gates,
      gatesAttention,
      coherenceAverage,
      coherenceLabel,
      contradictions,
      tensionCount,
      scars: null,
      plasticityIndex: null,
      plasticityProxy,
      reversibility,
      confidence,
      clusterRobustCount,
    };
  }, [gateScores, clusters, patterns, manifest]);
}