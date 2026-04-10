import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { LabUpload, LabObservationRow, LabUploadProcessResult, BiomarkerObservation } from "@/types/manifest";

interface LabUploadsContextValue {
  uploads: LabUpload[];
  observations: LabObservationRow[];
  loading: boolean;
  uploading: boolean;
  processing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  uploadAndProcess: (file: File) => Promise<LabUploadProcessResult>;
  deleteUpload: (uploadId: string) => Promise<void>;
  correctObservation: (observationId: string, newValue: number) => Promise<void>;
  observationsAsTimeline: () => BiomarkerObservation[];
}

const LabUploadsContext = createContext<LabUploadsContextValue | null>(null);

export const useLabUploads = () => {
  const ctx = useContext(LabUploadsContext);
  if (!ctx) throw new Error("useLabUploads must be used within LabUploadsProvider");
  return ctx;
};

const PROCESS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-lab-pdf`;

export const LabUploadsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [uploads, setUploads] = useState<LabUpload[]>([]);
  const [observations, setObservations] = useState<LabObservationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setUploads([]);
      setObservations([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [uploadsRes, obsRes] = await Promise.all([
        supabase
          .from("patient_lab_uploads")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("patient_lab_observations")
          .select("*")
          .eq("user_id", user.id)
          .order("collection_date", { ascending: false }),
      ]);

      if (uploadsRes.error) throw uploadsRes.error;
      if (obsRes.error) throw obsRes.error;

      setUploads((uploadsRes.data || []) as LabUpload[]);
      setObservations((obsRes.data || []) as LabObservationRow[]);
    } catch (e: any) {
      console.error("Lab uploads refresh failed:", e);
      setError(e.message || "Failed to load lab data");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const uploadAndProcess = useCallback(
    async (file: File): Promise<LabUploadProcessResult> => {
      if (!user) return { success: false, error: "Not authenticated" };
      if (file.type !== "application/pdf") {
        return { success: false, error: "Only PDF files are supported" };
      }
      if (file.size > 10 * 1024 * 1024) {
        return { success: false, error: "File too large (10 MB max)" };
      }

      setUploading(true);
      setError(null);

      try {
        // Step 1: Insert upload row to get an ID
        const { data: uploadRow, error: insertError } = await supabase
          .from("patient_lab_uploads")
          .insert({
            user_id: user.id,
            original_filename: file.name,
            storage_path: "pending",
            file_size_bytes: file.size,
            status: "uploaded",
          })
          .select("*")
          .single();

        if (insertError || !uploadRow) {
          throw new Error(insertError?.message || "Failed to create upload row");
        }

        // Step 2: Upload file to storage at {user_id}/{upload_id}.pdf
        const storagePath = `${user.id}/${uploadRow.id}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from("lab-uploads")
          .upload(storagePath, file, {
            contentType: "application/pdf",
            upsert: false,
          });

        if (uploadError) {
          await supabase.from("patient_lab_uploads").delete().eq("id", uploadRow.id);
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        // Step 3: Update the row with the actual storage path
        await supabase
          .from("patient_lab_uploads")
          .update({ storage_path: storagePath })
          .eq("id", uploadRow.id);

        setUploading(false);
        setProcessing(true);

        // Step 4: Trigger the edge function to process
        const resp = await fetch(PROCESS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ uploadId: uploadRow.id }),
        });

        const result = await resp.json();

        if (!resp.ok) {
          throw new Error(result.error || `Processing failed (${resp.status})`);
        }

        await refresh();

        return {
          success: true,
          observations_extracted: result.observations_extracted,
          observations_inserted: result.observations_inserted,
          observations_duplicates: result.observations_duplicates,
          source_lab: result.source_lab,
          collection_date: result.collection_date,
        };
      } catch (e: any) {
        console.error("Upload and process failed:", e);
        setError(e.message || "Upload failed");
        await refresh();
        return { success: false, error: e.message || "Upload failed" };
      } finally {
        setUploading(false);
        setProcessing(false);
      }
    },
    [user, refresh]
  );

  const deleteUpload = useCallback(
    async (uploadId: string) => {
      if (!user) return;
      const upload = uploads.find((u) => u.id === uploadId);
      if (!upload) return;

      if (upload.storage_path && upload.storage_path !== "pending") {
        await supabase.storage.from("lab-uploads").remove([upload.storage_path]);
      }

      await supabase.from("patient_lab_observations").delete().eq("upload_id", uploadId);
      await supabase.from("patient_lab_uploads").delete().eq("id", uploadId);

      await refresh();
    },
    [user, uploads, refresh]
  );

  const correctObservation = useCallback(
    async (observationId: string, newValue: number) => {
      const obs = observations.find((o) => o.id === observationId);
      if (!obs) return;

      const { error: dbError } = await supabase
        .from("patient_lab_observations")
        .update({
          value: newValue,
          original_value: obs.corrected ? obs.original_value : obs.value,
          corrected: true,
          corrected_at: new Date().toISOString(),
        })
        .eq("id", observationId);

      if (dbError) throw dbError;
      await refresh();
    },
    [observations, refresh]
  );

  const observationsAsTimeline = useCallback((): BiomarkerObservation[] => {
    return observations.map((o) => ({
      name: o.canonical_name,
      displayName: o.display_name || o.canonical_name,
      value: o.value,
      unit: o.unit,
      timestamp: o.collection_date,
      refLow: o.ref_low ?? undefined,
      refHigh: o.ref_high ?? undefined,
      flag: o.flag ?? undefined,
      source: o.source ?? undefined,
    }));
  }, [observations]);

  return (
    <LabUploadsContext.Provider
      value={{
        uploads,
        observations,
        loading,
        uploading,
        processing,
        error,
        refresh,
        uploadAndProcess,
        deleteUpload,
        correctObservation,
        observationsAsTimeline,
      }}
    >
      {children}
    </LabUploadsContext.Provider>
  );
};
