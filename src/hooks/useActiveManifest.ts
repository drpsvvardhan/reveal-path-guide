import { useMemo } from "react";
import { useManifest } from "@/context/ManifestContext";
import { useNarrative } from "@/context/NarrativeContext";
import { useLabUploads } from "@/context/LabUploadsContext";
import { PatientRevealManifest } from "@/types/manifest";

/**
 * Returns the active manifest with generated narrative and uploaded lab data
 * merged in. The merge order:
 * 1. Start with the base manifest from ManifestContext
 * 2. Overlay generated narrative fields if a generated version exists
 * 3. Overlay uploaded lab observations into rawData.biomarkerTimeline if any exist
 */
export function useActiveManifest(): PatientRevealManifest {
  const { manifest: baseManifest } = useManifest();
  const { activeNarrative } = useNarrative();
  const { observationsAsTimeline, observations } = useLabUploads();

  return useMemo(() => {
    // Step 1: start with base manifest
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

    // Step 3: overlay uploaded lab observations into rawData.biomarkerTimeline
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

    return merged;
  }, [baseManifest, activeNarrative, observations, observationsAsTimeline]);
}
