import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadLabFile, removeLabFiles } from "@/lib/files";
import { getAccessToken } from "@/lib/session";
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
  uploadAndProcess: (file: File, options?: { confirmedName?: string }) => Promise<LabUploadProcessResult>;
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
  "image/heic",
  "image/heif",
  // Text-based formats parsed server-side
  "text/csv",
  "application/vnd.ms-excel", // some browsers report .csv as this
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
];

// Some browsers (Safari especially) leave file.type empty for less common
// extensions. We use the filename as a fallback check.
const SUPPORTED_EXTENSIONS = [
  ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif",
  ".csv", ".tsv", ".txt", ".md", ".markdown", ".xlsx", ".docx",
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function getFileExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "text/csv": ".csv",
    "application/vnd.ms-excel": ".csv",
    "text/plain": ".txt",
    "text/markdown": ".md",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  };
  return map[mimeType] || ".bin";
}

function extFromFilename(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

function isSupportedFile(file: File): boolean {
  if (file.type && SUPPORTED_TYPES.includes(file.type)) return true;
  return SUPPORTED_EXTENSIONS.includes(extFromFilename(file.name));
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
    async (file: File, options?: { confirmedName?: string }): Promise<LabUploadProcessResult> => {
      if (!user) return { success: false, error: "Not authenticated" };
      const targetUserId = effectiveUserId || user.id;
      if (!isSupportedFile(file)) {
        return {
          success: false,
          error:
            "Unsupported file type. Upload a PDF, image (JPG/PNG/WebP/HEIC), spreadsheet (CSV/XLSX), Word doc (DOCX), or text file (TXT/MD).",
        };
      }
      if (file.size > MAX_FILE_SIZE) {
        return { success: false, error: "File too large (20 MB max)" };
      }

      setUploading(true);
      setError(null);

      try {
        // Step 1: Upload the file to storage FIRST under a pre-generated UUID.
        // We avoid the previous insert-then-update flow because a race or a
        // silently-dropped update left rows stuck at storage_path='pending',
        // and the edge function then failed with "Object not found".
        const ext =
          getFileExtension(file.type) !== ".bin"
            ? getFileExtension(file.type)
            : extFromFilename(file.name) || ".bin";
        const fileId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const storagePath = `${targetUserId}/${fileId}${ext}`;

        // The storage bucket only whitelists PDF + common images. For text-based
        // formats (CSV/XLSX/DOCX/MD/TXT) and HEIC images we upload with an
        // allowed content-type so storage accepts the bytes. The edge function
        // recovers the true type from the file extension in storage_path.
        const BUCKET_ALLOWED = new Set([
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/webp",
        ]);
        const realType = file.type || "application/octet-stream";
        const uploadContentType = BUCKET_ALLOWED.has(realType)
          ? realType
          : "application/pdf"; // safe placeholder; real type derived from extension server-side
        const uploadBody = uploadContentType === realType
          ? file
          : new Blob([file], { type: uploadContentType });

        const { error: uploadError } = await uploadLabFile(storagePath, uploadBody, {
            contentType: uploadContentType,
            upsert: false,
          });
        if (uploadError) {
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        // Step 2: Insert the upload row with the real storage_path already set.
        const { data: uploadRow, error: insertError } = await supabase
          .from("patient_lab_uploads")
          .insert({
            user_id: targetUserId,
            original_filename: file.name,
            storage_path: storagePath,
            file_size_bytes: file.size,
            status: "uploaded",
          })
          .select("*")
          .single();

        if (insertError || !uploadRow) {
          // Roll back the storage object so we don't leak orphaned files.
          await removeLabFiles([storagePath]);
          throw new Error(insertError?.message || "Failed to create upload row");
        }

        setUploading(false);
        setProcessing(true);

        // Step 4: Trigger the edge function (returns 202 immediately)
        const reqBody: Record<string, unknown> = { uploadId: uploadRow.id };
        if (options?.confirmedName && options.confirmedName.trim().length > 0) {
          reqBody.pre_confirmed = { confirmed_name: options.confirmedName.trim() };
        }
        // process-lab-pdf binds the upload to the caller identity, so the
        // request must carry the user's access token, not the public key.
        const processToken = await getAccessToken();
        if (!processToken) throw new Error("Not authenticated");
        const resp = await fetch(PROCESS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${processToken}`,
          },
          body: JSON.stringify(reqBody),
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
              supabase.functions
                .invoke("generate-clusters", { body: { patient_id: targetUserId } })
                .catch((err) => console.warn("[auto-clusters] fire-and-forget failed:", err));
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

          if (updated.status === "awaiting_identity_confirmation") {
            // Stop polling — RecordsSection will surface a confirmation modal driven by `uploads`.
            await refresh();
            return {
              success: false,
              awaiting_identity_confirmation: true,
              upload_id: uploadRow.id,
            } as any;
          }

          if (updated.status === "rejected_identity") {
            await refresh();
            return { success: false, error: "Report rejected: name does not match your account." };
          }

          if (updated.status === "rejected_duplicate") {
            await refresh();
            return { success: false, error: "You already uploaded this file." };
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
    [user, effectiveUserId, refresh]
  );

  const deleteUpload = useCallback(
    async (uploadId: string) => {
      if (!user) return;
      const upload = uploads.find((u) => u.id === uploadId);
      if (!upload) return;

      if (upload.storage_path && upload.storage_path !== "pending") {
        await removeLabFiles([upload.storage_path]);
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
