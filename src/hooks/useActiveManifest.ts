import { useMemo } from "react";
import { useManifest } from "@/context/ManifestContext";
import { useNarrative } from "@/context/NarrativeContext";
import { useLabUploads } from "@/context/LabUploadsContext";
import { useCIEAssessment } from "@/context/CIEAssessmentContext";
import { CIE_DOMAINS, CIE_GATES } from "@/lib/cieSeedData";
import { PatientRevealManifest } from "@/types/manifest";

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

    return merged;
  }, [baseManifest, activeNarrative, observations, observationsAsTimeline, currentAssessment, domainScores, gateScores]);
}
