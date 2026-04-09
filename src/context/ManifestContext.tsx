import React, { createContext, useContext, useState, useCallback } from "react";
import { PatientRevealManifest } from "@/types/manifest";
import { sampleManifest } from "@/data/sampleManifest";

interface ManifestContextValue {
  manifest: PatientRevealManifest;
  setManifest: (m: PatientRevealManifest) => void;
  resetManifest: () => void;
  error: string | null;
  loadFromJson: (json: string) => boolean;
}

const ManifestContext = createContext<ManifestContextValue | null>(null);

export const useManifest = () => {
  const ctx = useContext(ManifestContext);
  if (!ctx) throw new Error("useManifest must be used within ManifestProvider");
  return ctx;
};

const requiredKeys: (keyof PatientRevealManifest)[] = [
  "patient", "studyOverview", "patientThesis",
];

function validateManifest(data: any): data is PatientRevealManifest {
  if (!data || typeof data !== "object") return false;
  for (const key of requiredKeys) {
    if (!(key in data)) return false;
  }
  if (!data.patient?.firstName) return false;
  return true;
}

export const ManifestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [manifest, setManifest] = useState<PatientRevealManifest>(sampleManifest);
  const [error, setError] = useState<string | null>(null);

  const resetManifest = useCallback(() => {
    setManifest(sampleManifest);
    setError(null);
  }, []);

  const loadFromJson = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (!validateManifest(parsed)) {
        setError("Invalid manifest: missing required fields (patient, studyOverview, patientThesis).");
        return false;
      }
      setManifest(parsed);
      setError(null);
      return true;
    } catch {
      setError("Invalid JSON format. Please check the file and try again.");
      return false;
    }
  }, []);

  return (
    <ManifestContext.Provider value={{ manifest, setManifest, resetManifest, error, loadFromJson }}>
      {children}
    </ManifestContext.Provider>
  );
};
