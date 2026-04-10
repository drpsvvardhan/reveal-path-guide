import { useMemo } from "react";
import { useManifest } from "@/context/ManifestContext";
import { useNarrative } from "@/context/NarrativeContext";
import { PatientRevealManifest } from "@/types/manifest";

/**
 * Returns the active manifest with any generated narrative merged in.
 * If a generated narrative exists, its fields override the hand-authored
 * fields in the base manifest. If not, returns the base manifest as-is.
 */
export function useActiveManifest(): PatientRevealManifest {
  const { manifest: baseManifest } = useManifest();
  const { activeNarrative } = useNarrative();

  return useMemo(() => {
    if (!activeNarrative) return baseManifest;

    return {
      ...baseManifest,
      patientThesis: activeNarrative.patientThesis || baseManifest.patientThesis,
      layerFindings: activeNarrative.layerFindings || baseManifest.layerFindings,
      helpingVsFeeding: activeNarrative.helpingVsFeeding || baseManifest.helpingVsFeeding,
      symptomBridges: activeNarrative.symptomBridges || baseManifest.symptomBridges,
      reversibility: activeNarrative.reversibility || baseManifest.reversibility,
      sequencedActions: activeNarrative.sequencedActions || baseManifest.sequencedActions,
      expectedProgress: activeNarrative.expectedProgress || baseManifest.expectedProgress,
      confidenceBreakdown: activeNarrative.confidenceBreakdown || baseManifest.confidenceBreakdown,
    };
  }, [baseManifest, activeNarrative]);
}
