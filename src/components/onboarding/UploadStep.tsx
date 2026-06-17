import React, { useState, useRef, useEffect, useCallback } from "react";
import OnboardingLayout from "./OnboardingLayout";
import { useOnboarding } from "@/context/OnboardingContext";
import { useLabUploads } from "@/context/LabUploadsContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import IdentityConfirmModal, { IdentityConfirmRequest } from "@/components/records/IdentityConfirmModal";
import { ArrowLeft, ArrowRight, Upload, CheckCircle2, Loader2, X } from "lucide-react";

const UploadStep: React.FC = () => {
  const { advanceToStep, markProcessingMilestone, isSaving } = useOnboarding();
  const { uploadAndProcess, uploads, observations, uploading, processing, error } = useLabUploads();
  const { user } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [identityRequest, setIdentityRequest] = useState<IdentityConfirmRequest | null>(null);

  // Surface the identity-confirmation modal whenever any upload lands in
  // awaiting state. Ingestion is paused server-side until the user confirms
  // (or rejects) ownership of the report.
  useEffect(() => {
    if (identityRequest) return;
    const awaiting = uploads.find((u: any) => u.status === "awaiting_identity_confirmation");
    if (!awaiting) return;
    const a: any = awaiting;
    const kind: "unknown" | "mismatch" =
      a.name_match_status === "needs_confirmation_mismatch" ? "mismatch" : "unknown";
    const isFibro = (a.original_filename ?? "").startsWith("[FibroScan]");
    setIdentityRequest({
      uploadId: a.id,
      kind,
      extractedName: a.extracted_patient_name ?? null,
      accountName: user?.user_metadata?.full_name ?? user?.email ?? null,
      score: a.name_match_score ?? null,
      processor: isFibro ? "process-fibroscan" : "process-lab-pdf",
      storagePath: a.storage_path,
    });
  }, [uploads, identityRequest, user]);

  const handleIdentityConfirm = useCallback(async (req: IdentityConfirmRequest, confirmedName: string) => {
    const overrideKind = req.kind === "mismatch" ? "mismatch_overridden" : "unknown_accepted";
    const body: any = req.processor === "process-lab-pdf"
      ? { uploadId: req.uploadId, identity_override: { kind: overrideKind, confirmed_name: confirmedName } }
      : { upload_id: req.uploadId, storage_path: req.storagePath, identity_override: { kind: overrideKind, confirmed_name: confirmedName } };
    const { error: invokeError } = await supabase.functions.invoke(req.processor, { body });
    if (invokeError) throw new Error(invokeError.message ?? "Could not confirm");
    setIdentityRequest(null);
    setLocalError(null);
  }, []);

  const handleIdentityReject = useCallback(async (req: IdentityConfirmRequest) => {
    const { error: invokeError } = await supabase.functions.invoke("reject-upload-identity", {
      body: { upload_id: req.uploadId },
    });
    if (invokeError) throw new Error(invokeError.message ?? "Could not reject");
    setIdentityRequest(null);
    setLocalError("Report rejected — it didn't match your account. You can upload another file.");
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalError(null);

    const result = await uploadAndProcess(file);

    if (result.success) {
      markProcessingMilestone({
        pdf_uploaded: true,
        observations_extracted: result.observations_extracted || 0,
        current_status: `Extracted ${result.observations_extracted} biomarkers`,
      });
    } else if (!(result as any).awaiting_identity_confirmation) {
      setLocalError(result.error || "Upload failed");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const triggerFilePicker = () => fileInputRef.current?.click();

  const handleBack = () => {
    advanceToStep("profile");
  };

  const handleNext = () => {
    advanceToStep("processing");
  };

  // Allow advancing whenever an upload exists and we're no longer actively uploading/processing.
  // Observations may be 0 (scanned image, low-OCR PDF, awaiting identity confirmation) — the
  // user should not be trapped on this step; downstream surfaces will guide remediation.
  const completedUpload = uploads.find((u) => u.status === "complete");
  const hasAnyUpload = uploads.length > 0;
  const awaitingIdentity = uploads.some((u: any) => u.status === "awaiting_identity_confirmation");
  const canAdvance = hasAnyUpload && !uploading && !processing && !isSaving && !awaitingIdentity;
  const zeroObservations = !!completedUpload && observations.length === 0;

  return (
    <OnboardingLayout
      stepNumber={3}
      totalSteps={4}
      eyebrow="UPLOAD YOUR FIRST LAB"
      title="Bring your biology to the table"
      intro="A PDF from Quest, LabCorp, or your hospital. We read it automatically — you don't type anything. The more recent your labs, the better the twin will reflect where you are right now."
      footer={
        <>
          <button
            onClick={handleBack}
            disabled={uploading || processing || isSaving}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={!canAdvance || isSaving}
            className="flex items-center gap-2 rounded-xl bg-secondary text-secondary-foreground px-5 py-2.5 text-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Continuing…" : "Build my twin"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </>
      }
    >
      <div className="space-y-5 mt-2">
        {/* Upload area */}
        {uploads.length === 0 ? (
          <button
            onClick={triggerFilePicker}
            disabled={uploading || processing}
            className="w-full rounded-2xl border-2 border-dashed border-border hover:border-secondary/50 hover:bg-secondary/5 transition-colors p-12 text-center disabled:opacity-50"
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 text-secondary animate-spin" />
                <p className="text-base font-medium text-foreground">Uploading…</p>
              </div>
            ) : processing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 text-secondary animate-spin" />
                <p className="text-base font-medium text-foreground">Reading your PDF…</p>
                <p className="text-xs text-muted-foreground">This usually takes 15–30 seconds</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="h-14 w-14 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center">
                  <Upload className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <p className="text-base font-medium text-foreground">Choose your lab PDF</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF only · 10 MB max</p>
                </div>
              </div>
            )}
          </button>
        ) : (
          <div className="rounded-2xl border border-success/40 bg-success/5 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {uploads[0].original_filename}
                </p>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1 flex-wrap">
                  {uploads[0].source_lab && <span>{uploads[0].source_lab}</span>}
                  {uploads[0].observations_inserted != null && (
                    <span>{uploads[0].observations_inserted} biomarkers extracted</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,text/csv,text/plain,text/markdown,.md,.csv,.tsv,.txt,.xlsx,.docx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Upload another button (after first upload) */}
        {uploads.length > 0 && !uploading && !processing && (
          <div className="text-center">
            <button
              onClick={triggerFilePicker}
              className="text-xs text-secondary hover:underline"
            >
              Upload another PDF
            </button>
            <p className="text-[11px] text-muted-foreground italic mt-2">
              You can add more labs now or any time later from the Records section.
            </p>
          </div>
        )}

        {/* Error */}
        {(localError || error) && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive flex items-start gap-2">
            <X className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{localError || error}</span>
          </div>
        )}

        {/* Zero-extraction notice — let the user know they can still proceed */}
        {zeroObservations && !localError && !error && (
          <div className="rounded-lg border border-yellow-400/40 bg-yellow-400/5 px-4 py-3 text-sm text-foreground/80">
            We couldn't extract biomarkers from this file automatically — it may be a scanned image or
            non-standard format. You can upload another PDF, or continue and add labs later from the
            Records section.
          </div>
        )}

        {/* Tips */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-5 space-y-2">
          <p className="text-[11px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Tips
          </p>
          <ul className="text-xs text-foreground/80 space-y-1.5 leading-relaxed">
            <li>• Download the PDF directly from your lab's patient portal for best results</li>
            <li>• Scanned photos of paper labs work but are less accurate</li>
            <li>• Multi-page reports are fine — we read all pages</li>
            <li>• Your lab data never leaves your account</li>
          </ul>
        </div>
      </div>
      <IdentityConfirmModal
        request={identityRequest}
        onConfirm={handleIdentityConfirm}
        onReject={handleIdentityReject}
        onClose={() => setIdentityRequest(null)}
      />
    </OnboardingLayout>
  );
};

export default UploadStep;
