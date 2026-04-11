import React, { useRef, useCallback, useState } from "react";
import { useManifest } from "@/context/ManifestContext";
import { Upload, RotateCcw, FileJson } from "lucide-react";
import { PatientRevealManifest } from "@/types/manifest";
import { sampleManifest } from "@/data/sampleManifest";

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

const ManifestSwitcher: React.FC = () => {
  const { manifest, isDemoMode } = useManifest();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // In the new architecture, ManifestSwitcher is only useful in demo mode
  // For real users, the manifest comes from Supabase via useActiveManifest
  if (!isDemoMode) return null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        const parsed = JSON.parse(text);
        if (!validateManifest(parsed)) {
          setError("Invalid manifest: missing required fields.");
          return;
        }
        setError(null);
        // In demo mode, we could reload with a custom manifest via URL or state
        // For now, just validate and show success
        console.log("Valid manifest loaded:", parsed.patient.firstName);
      } catch {
        setError("Invalid JSON format.");
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 md:bottom-auto md:top-4 md:right-4">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card/95 backdrop-blur-sm px-3 py-2 shadow-lg">
        <FileJson className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-sans hidden sm:inline">
          {manifest.patient.firstName}, {manifest.patient.age}
        </span>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1 rounded-md bg-secondary/20 px-2 py-1 text-xs text-secondary hover:bg-secondary/30 transition-colors"
        >
          <Upload className="h-3 w-3" />
          <span className="hidden sm:inline">Load</span>
        </button>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
      </div>
      {error && (
        <div className="mt-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive max-w-xs">
          {error}
        </div>
      )}
    </div>
  );
};

export default ManifestSwitcher;
