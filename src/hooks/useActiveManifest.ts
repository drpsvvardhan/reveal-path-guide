import { useMemo } from "react";
import { useManifest } from "@/context/ManifestContext";
import { useNarrative } from "@/context/NarrativeContext";
import { useLabUploads } from "@/context/LabUploadsContext";
import { useCIEAssessment } from "@/context/CIEAssessmentContext";
import { CIE_DOMAINS, CIE_GATES } from "@/lib/cieSeedData";
import { PatientRevealManifest, HelpingFeedingItem, LabObservationRow } from "@/types/manifest";

// State-vector coordinate labels for CIE axes
const AXIS_COORDINATE_MAP: Record<string, string> = {
  A: "Energy (E)", B: "Vascular (V)", C: "Neuroendocrine (R)",
  D: "Inflammation (I)", E: "Regulation (R)", F: "Scar memory (Σ)",
  G: "Regulation (R)", H: "Regulation (R)", I: "Vascular (V)", J: "Regulation (R)",
};

// Key biomarkers to highlight when in healthy range
const HEALTHY_RANGE_MARKERS: Record<string, { display: string; coordinate: string }> = {
  hdl_cholesterol: { display: "HDL cholesterol", coordinate: "Vascular (V)" },
  hdl: { display: "HDL cholesterol", coordinate: "Vascular (V)" },
  fasting_glucose: { display: "Fasting glucose", coordinate: "Energy (E)" },
  glucose: { display: "Fasting glucose", coordinate: "Energy (E)" },
  hs_crp: { display: "hs-CRP", coordinate: "Inflammation (I)" },
  hba1c: { display: "HbA1c", coordinate: "Energy (E)" },
  hemoglobin_a1c: { display: "HbA1c", coordinate: "Energy (E)" },
  vitamin_d: { display: "Vitamin D", coordinate: "Regulation (R)" },
  "25_oh_vitamin_d": { display: "Vitamin D", coordinate: "Regulation (R)" },
  apob: { display: "ApoB", coordinate: "Vascular (V)" },
  apolipoprotein_b: { display: "ApoB", coordinate: "Vascular (V)" },
  phase_angle_whole_body: { display: "Phase angle", coordinate: "Inflammation (I) / Scar memory (Σ)" },
  ecw_tbw_ratio: { display: "ECW/TBW ratio", coordinate: "Inflammation (I)" },
  basal_metabolic_rate: { display: "Basal metabolic rate", coordinate: "Energy (E)" },
  visceral_fat_area: { display: "Visceral fat area", coordinate: "Energy (E)" },
};

/**
 * Deterministically compute helping factors from CIE high-scoring domains
 * and healthy-range lab observations.
 */
function computeDeterministicHelping(
  domainScores: Record<string, { final_score: number }>,
  observations: LabObservationRow[]
): HelpingFeedingItem[] {
  const items: HelpingFeedingItem[] = [];

  // 1. CIE domains scored 80+ — top 3 highest-scoring axes
  if (Object.keys(domainScores).length > 0) {
    const axisAverages: { axis: string; axisName: string; avg: number }[] = [];
    const AXES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    for (const axisId of AXES) {
      const axisDomains = CIE_DOMAINS.filter((d) => d.axis === axisId);
      const scores = axisDomains
        .map((d) => domainScores[d.id]?.final_score)
        .filter((s): s is number => s !== undefined);
      if (scores.length === 0) continue;
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avg >= 80) {
        axisAverages.push({ axis: axisId, axisName: axisDomains[0]?.axisName || axisId, avg });
      }
    }
    axisAverages.sort((a, b) => b.avg - a.avg);
    for (const entry of axisAverages.slice(0, 3)) {
      const coord = AXIS_COORDINATE_MAP[entry.axis] || entry.axis;
      items.push({
        label: `${entry.axisName} axis (${Math.round(entry.avg)}/100)`,
        mechanism: `Your ${entry.axisName.toLowerCase()} function is performing well — this supports your ${coord} coordinate and provides a stable foundation.`,
      });
    }
  }

  // 2. Lab biomarkers in healthy range — top 3
  if (observations.length > 0) {
    const healthyLabs: HelpingFeedingItem[] = [];
    const seen = new Set<string>();
    for (const obs of observations) {
      const key = obs.canonical_name.toLowerCase().replace(/[\s\-\/]+/g, "_");
      const marker = HEALTHY_RANGE_MARKERS[key] || HEALTHY_RANGE_MARKERS[obs.canonical_name];
      if (!marker || seen.has(marker.display)) continue;
      // Check if in healthy range
      const isNormal = obs.flag === "normal" || obs.flag === null;
      const inRange = obs.ref_low != null && obs.ref_high != null
        ? obs.value >= obs.ref_low && obs.value <= obs.ref_high
        : isNormal;
      if (inRange) {
        seen.add(marker.display);
        healthyLabs.push({
          label: `${marker.display}: ${obs.value} ${obs.unit}`,
          mechanism: `Your ${marker.display} is in the optimal range, which supports your ${marker.coordinate}.`,
        });
      }
    }
    items.push(...healthyLabs.slice(0, 3));
  }

  return items;
}

/**
 * Cap and rank feeding factors by severity keywords.
 */
function capFeeding(feeding: HelpingFeedingItem[], maxItems: number = 5): HelpingFeedingItem[] {
  // Simple severity ranking by keyword presence
  const severityOrder = (item: HelpingFeedingItem) => {
    const text = (item.label + item.mechanism).toLowerCase();
    if (text.includes("critical") || text.includes("significant")) return 0;
    if (text.includes("high") || text.includes("elevated")) return 1;
    if (text.includes("moderate")) return 2;
    return 3;
  };
  return [...feeding].sort((a, b) => severityOrder(a) - severityOrder(b)).slice(0, maxItems);
}

/**
 * Returns the active manifest with generated narrative, uploaded lab data,
 * and CIE assessment data merged in.
 */
export function useActiveManifest(): PatientRevealManifest {
  const { manifest: baseManifest } = useManifest();
  const { activeNarrative } = useNarrative();
  const { observationsAsTimeline, observations } = useLabUploads();
  const { currentAssessment, domainScores, gateScores } = useCIEAssessment();

  return useMemo(() => {
    let merged: PatientRevealManifest = baseManifest;

    // Step 2: overlay generated narrative if available
    if (activeNarrative) {
      merged = {
        ...merged,
        patientThesis: activeNarrative.patientThesis || merged.patientThesis,
        layerFindings: activeNarrative.layerFindings || merged.layerFindings,
        helpingVsFeeding: activeNarrative.helpingVsFeeding || merged.helpingVsFeeding,
        symptomBridges: activeNarrative.symptomBridges || merged.symptomBridges,
        reversibility: activeNarrative.reversibility || merged.reversibility,
        sequencedActions: activeNarrative.sequencedActions || merged.sequencedActions,
        expectedProgress: activeNarrative.expectedProgress || merged.expectedProgress,
        confidenceBreakdown: activeNarrative.confidenceBreakdown || merged.confidenceBreakdown,
      };
    }

    // Step 3: overlay uploaded lab observations
    if (observations.length > 0) {
      const timeline = observationsAsTimeline();
      merged = {
        ...merged,
        rawData: {
          ...(merged.rawData || {}),
          biomarkerTimeline: timeline,
        },
      };
    }

    // Step 4: overlay CIE assessment data
    if (currentAssessment && Object.keys(domainScores).length > 0) {
      // Build layerFindings from highest-priority domain per axis
      const AXES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
      const cieLayerFindings: Record<string, string> = { ...merged.layerFindings };

      for (const axis of AXES) {
        const axisDomains = CIE_DOMAINS.filter((d) => d.axis === axis);
        let worstDomain: { id: string; name: string; score: number } | null = null;

        for (const ad of axisDomains) {
          const ds = domainScores[ad.id];
          if (ds && (!worstDomain || ds.final_score < worstDomain.score)) {
            worstDomain = { id: ad.id, name: ad.name, score: ds.final_score };
          }
        }

        if (worstDomain) {
          const axisName = axisDomains[0]?.axisName || axis;
          const scoreLabel = worstDomain.score >= 80 ? "healthy range" :
            worstDomain.score >= 60 ? "mild concern" :
            worstDomain.score >= 40 ? "moderate concern" : "significant concern";
          cieLayerFindings[axisName] = `${worstDomain.name} scored ${Math.round(worstDomain.score)}/100 (${scoreLabel}). This is the primary finding in your ${axisName} axis.`;
        }
      }

      // Build studyOverview.layers from 10 axes
      const cieStudyLayers = AXES.map((axisId) => {
        const axisDomains = CIE_DOMAINS.filter((d) => d.axis === axisId);
        const axisName = axisDomains[0]?.axisName || axisId;
        const scores = axisDomains.map((d) => domainScores[d.id]?.final_score).filter((s): s is number => s !== undefined);
        const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

        return {
          id: axisId,
          icon: "🔬",
          title: `Axis ${axisId}: ${axisName}`,
          description: `Average score: ${avgScore}/100 across ${axisDomains.length} domains`,
          status: (avgScore >= 80 ? "complete" : avgScore >= 60 ? "in-progress" : "pending") as "complete" | "in-progress" | "pending",
        };
      });

      // Build confidenceBreakdown from gate traffic lights
      const confident: string[] = [];
      const investigating: string[] = [];
      const retest: string[] = [];

      for (const gate of CIE_GATES) {
        const gs = gateScores[gate.id];
        if (!gs) continue;
        const entry = `${gs.gate_name} (${Math.round(gs.score)}/100)`;
        if (gs.traffic_light === "GREEN") confident.push(entry);
        else if (gs.traffic_light === "YELLOW" || gs.traffic_light === "ORANGE") investigating.push(entry);
        else if (gs.traffic_light === "RED") retest.push(entry);
      }

      merged = {
        ...merged,
        layerFindings: cieLayerFindings,
        studyOverview: {
          ...merged.studyOverview,
          layers: cieStudyLayers,
        },
        confidenceBreakdown: {
          confident: confident.length > 0 ? confident : merged.confidenceBreakdown.confident,
          investigating: investigating.length > 0 ? investigating : merged.confidenceBreakdown.investigating,
          retest: retest.length > 0 ? retest : merged.confidenceBreakdown.retest,
        },
      };
    }

    // Step 5: Deterministic helping/feeding overlay
    // Ensure helping is never empty for a user with CIE data or lab data
    const existingHelping = merged.helpingVsFeeding?.helping || [];
    const existingFeeding = merged.helpingVsFeeding?.feeding || [];

    const deterministicHelping = computeDeterministicHelping(domainScores, observations);

    // Deduplicate: skip deterministic items whose labels overlap with LLM-generated ones
    const existingLabels = new Set(existingHelping.map((h) => h.label.toLowerCase()));
    const newHelping = deterministicHelping.filter(
      (h) => !existingLabels.has(h.label.toLowerCase())
    );

    const combinedHelping = [...existingHelping, ...newHelping];
    const cappedFeeding = capFeeding(existingFeeding, 5);

    if (combinedHelping.length === 0 && (Object.keys(domainScores).length > 0 || observations.length > 0)) {
      console.warn("[useActiveManifest] WARNING: 0 helping factors for a user with data. Extraction may be broken.");
    }

    merged = {
      ...merged,
      helpingVsFeeding: {
        helping: combinedHelping,
        feeding: cappedFeeding,
      },
    };

    return merged;
  }, [baseManifest, activeNarrative, observations, observationsAsTimeline, currentAssessment, domainScores, gateScores]);
}
