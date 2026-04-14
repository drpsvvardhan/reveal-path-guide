import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";
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

const SUPPORTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function getFileExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
  };
  return map[mimeType] || ".bin";
}

export const LabUploadsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { effectiveUserId } = useViewAs();
  const [uploads, setUploads] = useState<LabUpload[]>([]);
  const [observations, setObservations] = useState<LabObservationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const uid = effectiveUserId || user?.id;
    if (!uid) {
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
          .eq("user_id", uid)
          .order("created_at", { ascending: false }),
        supabase
          .from("patient_lab_observations")
          .select("*")
          .eq("user_id", uid)
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
  }, [effectiveUserId, user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const uploadAndProcess = useCallback(
    async (file: File): Promise<LabUploadProcessResult> => {
      if (!user) return { success: false, error: "Not authenticated" };
      const targetUserId = effectiveUserId || user.id;
      if (!SUPPORTED_TYPES.includes(file.type)) {
        return { success: false, error: "Unsupported file type. Upload a PDF, JPEG, PNG, or WebP." };
      }
      if (file.size > MAX_FILE_SIZE) {
        return { success: false, error: "File too large (20 MB max)" };
      }

      setUploading(true);
      setError(null);

      try {
        // Step 1: Insert upload row to get an ID
        const { data: uploadRow, error: insertError } = await supabase
          .from("patient_lab_uploads")
          .insert({
            user_id: targetUserId,
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

        // Step 2: Upload file to storage at {user_id}/{upload_id}{ext}
        const ext = getFileExtension(file.type);
        const storagePath = `${targetUserId}/${uploadRow.id}${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("lab-uploads")
          .upload(storagePath, file, {
            contentType: file.type,
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

        // Step 4: Trigger the edge function (returns 202 immediately)
        const resp = await fetch(PROCESS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ uploadId: uploadRow.id }),
        });

        if (!resp.ok && resp.status !== 202) {
          const result = await resp.json().catch(() => ({}));
          throw new Error(result.error || `Processing failed (${resp.status})`);
        }

        // Step 5: Poll for completion (background processing)
        const maxPollAttempts = 60; // 60 * 3s = 3 minutes max
        let pollAttempts = 0;

        while (pollAttempts < maxPollAttempts) {
          await new Promise((r) => setTimeout(r, 3000)); // wait 3 seconds
          pollAttempts++;

          const { data: updated } = await supabase
            .from("patient_lab_uploads")
            .select("status, observations_extracted, observations_inserted, observations_duplicates, source_lab, collection_date, error_message")
            .eq("id", uploadRow.id)
            .single();

          if (!updated) continue;

          if (updated.status === "complete") {
            await refresh();

            // Fire-and-forget: trigger cluster generation after successful lab processing
            try {
              const clusterUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-clusters`;
              fetch(clusterUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                },
                body: JSON.stringify({ patient_id: user.id }),
              }).catch((err) => console.warn("[auto-clusters] fire-and-forget failed:", err));
              console.log("[auto-clusters] Triggered cluster generation after lab upload");
            } catch (clusterErr) {
              console.warn("[auto-clusters] Could not trigger cluster generation:", clusterErr);
            }

            return {
              success: true,
              observations_extracted: updated.observations_extracted ?? 0,
              observations_inserted: updated.observations_inserted ?? 0,
              observations_duplicates: updated.observations_duplicates ?? 0,
              source_lab: updated.source_lab,
              collection_date: updated.collection_date,
            };
          }

          if (updated.status === "failed") {
            await refresh();
            return { success: false, error: updated.error_message || "Extraction failed" };
          }
        }

        // Timed out
        await refresh();
        return { success: false, error: "Processing is taking longer than expected. Check back shortly." };
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
