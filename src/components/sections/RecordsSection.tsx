import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useLabUploads } from "@/context/LabUploadsContext";
import { useDocuments } from "@/context/DocumentContext";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";
import { useClusters } from "@/hooks/useClusters";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload, FileText, Loader2, CheckCircle2, XCircle, Trash2, Pencil, Check, X,
  ChevronDown, ChevronUp, Calendar, Building2, RefreshCw, Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LabUpload, LabObservationRow } from "@/types/manifest";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import AsideInfoPanel from "@/components/layout/AsideInfoPanel";
import BiomarkerTimeline from "@/components/visuals/BiomarkerTimeline";
import CoherenceMap from "@/components/clusters/CoherenceMap";
import ClusterCard from "@/components/clusters/ClusterCard";
import { ClusterTier } from "@/types/clusters";
import { useNavigation } from "@/context/NavigationContext";
import { ArrowRight } from "lucide-react";
import { CelfExportButton } from "@/components/CelfExportButton";
import IdentityConfirmModal, { IdentityConfirmRequest } from "@/components/records/IdentityConfirmModal";
import PreUploadConfirmModal from "@/components/records/PreUploadConfirmModal";

/* ── Tier ordering ── */
const TIER_ORDER: { tier: ClusterTier; label: string }[] = [
  { tier: "robust", label: "Robust" },
  { tier: "supported", label: "Supported" },
  { tier: "developing", label: "Developing" },
  { tier: "tentative", label: "Tentative" },
  { tier: "emerging", label: "Emerging" },
];

/* ── Small reusable bits ── */
const StatusBadge: React.FC<{ status: LabUpload["status"] }> = ({ status }) => {
  const styles: Record<string, { bg: string; text: string; label: string; Icon: React.FC<any> }> = {
    uploaded: { bg: "bg-muted/40", text: "text-muted-foreground", label: "Uploaded", Icon: FileText },
    processing: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", label: "Processing", Icon: Loader2 },
    complete: { bg: "bg-teal-50 border-teal-200", text: "text-teal-700", label: "Complete", Icon: CheckCircle2 },
    failed: { bg: "bg-orange-50 border-orange-200", text: "text-orange-700", label: "Failed", Icon: XCircle },
  };
  const s = styles[status] || styles.uploaded;
  const Icon = s.Icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium border ${s.bg} ${s.text}`}>
      <Icon className={`h-3 w-3 ${status === "processing" ? "animate-spin" : ""}`} />
      {s.label}
    </span>
  );
};

const FlagPill: React.FC<{ flag: string | null }> = ({ flag }) => {
  if (!flag || flag === "normal") return null;
  const styles: Record<string, string> = {
    low: "bg-blue-50 text-blue-700 border-blue-200",
    high: "bg-amber-50 text-amber-700 border-amber-200",
    critical: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`text-[9px] uppercase font-medium px-1.5 py-0.5 rounded border ${styles[flag] || ""}`}>
      {flag}
    </span>
  );
};

/* ══════════════════════════════════════════════════════════════════
   RecordsSection — cluster terrain reading + full upload management
   ══════════════════════════════════════════════════════════════════ */
const RecordsSection: React.FC = () => {
  const {
    uploads, observations, loading: labsLoading, uploading, processing, error: labError,
    uploadAndProcess, deleteUpload, correctObservation,
  } = useLabUploads();
  const { documents } = useDocuments();
  const { clusters, loading: clustersLoading, error: clustersError, refetch } = useClusters();
  const { isAdmin, isViewingAs, effectiveUserId } = useViewAs();
  const { user } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fibroFileInputRef = useRef<HTMLInputElement>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const [fibroUploading, setFibroUploading] = useState(false);
  const [fibroResult, setFibroResult] = useState<{ success: boolean; message: string } | null>(null);
  const [expandedUploads, setExpandedUploads] = useState<Set<string>>(new Set());
  const [editingObs, setEditingObs] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [uploadsOpen, setUploadsOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateMsg, setRegenerateMsg] = useState<string | null>(null);
  const [identityRequest, setIdentityRequest] = useState<IdentityConfirmRequest | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{ file: File; kind: "lab" | "fibro" } | null>(null);
  const { navigateTo } = useNavigation();

  // Surface confirmation modal whenever an upload lands in awaiting state.
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
    const { error } = await supabase.functions.invoke(req.processor, { body });
    if (error) throw new Error(error.message ?? "Could not confirm");
    setIdentityRequest(null);
    // small delay then refresh so the new status propagates
    setTimeout(() => { window.location.reload(); }, 1500);
  }, []);

  const handleIdentityReject = useCallback(async (req: IdentityConfirmRequest) => {
    const { error } = await supabase.functions.invoke("reject-upload-identity", {
      body: { upload_id: req.uploadId },
    });
    if (error) throw new Error(error.message ?? "Could not reject");
    setIdentityRequest(null);
    window.location.reload();
  }, []);

  /* ── Deep-link scroll-and-highlight from #cluster-{id} ── */
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#cluster-")) return;
    const clusterId = hash.replace("#cluster-", "");
    const timer = setTimeout(() => {
      const el = document.getElementById(`cluster-${clusterId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-secondary/60", "ring-offset-2", "ring-offset-background");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-secondary/60", "ring-offset-2", "ring-offset-background");
          window.history.replaceState(null, "", window.location.pathname);
        }, 2000);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [clusters]);

  const handleRegenerateClusters = useCallback(async () => {
    const uid = effectiveUserId || user?.id;
    if (!uid) return;
    setRegenerating(true);
    setRegenerateMsg(null);
    try {
      const clusterUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-clusters`;
      const resp = await fetch(clusterUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ patient_id: uid }),
      });
      if (!resp.ok && resp.status !== 202) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Failed (${resp.status})`);
      }
      setRegenerateMsg("Cluster generation started. Results will appear in a few minutes.");
      // Poll for new clusters after a delay
      setTimeout(() => refetch(), 60_000);
    } catch (e: any) {
      setRegenerateMsg(`Error: ${e.message}`);
    } finally {
      setRegenerating(false);
    }
  }, [effectiveUserId, user?.id, refetch]);

  // Stage the picked file and open the ownership-confirmation modal.
  // Actual upload runs only after the user explicitly confirms.
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    setLastResult(null);
    setPendingUpload({ file, kind: "lab" });
  };

  const runLabUpload = async (file: File, confirmedName: string) => {
    const result = await uploadAndProcess(file, { confirmedName });
    setLastResult(result);
  };

  const handleFibroFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fibroFileInputRef.current) fibroFileInputRef.current.value = "";
    if (!file) return;
    setFibroResult(null);
    if (file.type !== "application/pdf") {
      setFibroResult({ success: false, message: "FibroScan reports must be PDF files." });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setFibroResult({ success: false, message: "File too large (20 MB max)." });
      return;
    }
    setPendingUpload({ file, kind: "fibro" });
  };

  const runFibroUpload = async (file: File, confirmedName: string) => {
    const targetUserId = effectiveUserId || user?.id;
    if (!targetUserId) {
      setFibroResult({ success: false, message: "Not authenticated." });
      return;
    }

    setFibroUploading(true);
    try {
      // 1. Insert upload row (filename prefixed so it's discoverable as FibroScan)
      const { data: uploadRow, error: insertError } = await supabase
        .from("patient_lab_uploads")
        .insert({
          user_id: targetUserId,
          original_filename: `[FibroScan] ${file.name}`,
          storage_path: "pending",
          file_size_bytes: file.size,
          status: "uploaded",
        })
        .select("*")
        .single();
      if (insertError || !uploadRow) {
        throw new Error(insertError?.message || "Failed to create upload row");
      }

      // 2. Upload to storage bucket (same bucket the lab flow uses)
      const storagePath = `${targetUserId}/${uploadRow.id}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("lab-uploads")
        .upload(storagePath, file, { contentType: "application/pdf", upsert: false });
      if (uploadError) {
        await supabase.from("patient_lab_uploads").delete().eq("id", uploadRow.id);
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }
      await supabase
        .from("patient_lab_uploads")
        .update({ storage_path: storagePath })
        .eq("id", uploadRow.id);

      // 3. Invoke the FibroScan processor (with pre-upload ownership confirmation)
      const fibroBody: Record<string, unknown> = { upload_id: uploadRow.id, storage_path: storagePath };
      if (confirmedName && confirmedName.trim().length > 0) {
        fibroBody.pre_confirmed = { confirmed_name: confirmedName.trim() };
      }
      const { data, error: invokeError } = await supabase.functions.invoke(
        "process-fibroscan",
        { body: fibroBody },
      );

      if (invokeError) {
        // Try to read the response body for our 422 identity_mismatch case
        const ctx: any = (invokeError as any).context;
        let payload: any = null;
        try {
          if (ctx && typeof ctx.json === "function") payload = await ctx.json();
        } catch { /* noop */ }
        const status = ctx?.status as number | undefined;
        const code = payload?.error;

        if (status === 422 && code === "identity_mismatch") {
          const name = payload?.extracted_name || "someone else";
          setFibroResult({
            success: false,
            message: `This report appears to be for ${name}, not you. We can't add it to your account.`,
          });
        } else if (status === 409 && code === "duplicate_upload") {
          setFibroResult({
            success: false,
            message: payload?.message || "You already uploaded this file.",
          });
        } else {
          setFibroResult({
            success: false,
            message: payload?.message || invokeError.message || "FibroScan processing failed.",
          });
        }
      } else {
        const written = (data as any)?.extracted?.measurements_written ?? 0;
        setFibroResult({
          success: true,
          message: `FibroScan extracted${written ? `: ${written} measurement${written !== 1 ? "s" : ""}` : ""}.`,
        });
      }
    } catch (err: any) {
      console.error("FibroScan upload failed:", err);
      setFibroResult({ success: false, message: err.message || "Upload failed" });
    } finally {
      setFibroUploading(false);
    }
  };

  // Called when the user confirms ownership in PreUploadConfirmModal.
  const handlePendingConfirm = useCallback(async () => {
    if (!pendingUpload) return;
    const { file, kind } = pendingUpload;
    setPendingUpload(null);
    if (kind === "lab") {
      await runLabUpload(file);
    } else {
      await runFibroUpload(file);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingUpload]);

  const triggerFilePicker = () => fileInputRef.current?.click();
  const triggerFibroFilePicker = () => fibroFileInputRef.current?.click();
  const toggleExpanded = (uploadId: string) => {
    setExpandedUploads((prev) => {
      const next = new Set(prev);
      if (next.has(uploadId)) next.delete(uploadId); else next.add(uploadId);
      return next;
    });
  };
  const handleStartEdit = (obs: LabObservationRow) => { setEditingObs(obs.id); setEditValue(obs.value.toString()); };
  const handleSaveEdit = async () => {
    if (!editingObs) return;
    const newValue = parseFloat(editValue);
    if (isNaN(newValue)) return;
    await correctObservation(editingObs, newValue);
    setEditingObs(null); setEditValue("");
  };
  const handleCancelEdit = () => { setEditingObs(null); setEditValue(""); };
  const getObservationsForUpload = (uploadId: string) => observations.filter((o) => o.upload_id === uploadId);
  const formatDate = (dateStr: string | null) => { if (!dateStr) return "—"; return new Date(dateStr).toLocaleDateString(); };

  const distinctTestCount = new Set(observations.map((o) => o.canonical_name)).size;
  const timelineData = observations.map((o) => ({
    name: o.canonical_name,
    displayName: o.display_name || undefined,
    value: o.value,
    unit: o.unit,
    timestamp: o.collection_date,
    refLow: o.ref_low || undefined,
    refHigh: o.ref_high || undefined,
    flag: o.flag || undefined,
    source: o.source || undefined,
  })) as import("@/types/manifest").BiomarkerObservation[];

  const hasTimelineData = timelineData.length > 0;
  const hasClusters = clusters.length > 0;

  /* ── Cluster grouping ── */
  const clustersByTier = useMemo(() => {
    const map: Record<ClusterTier, typeof clusters> = {
      robust: [], supported: [], developing: [], tentative: [], emerging: [],
    };
    clusters.forEach((c) => map[c.confidence_tier].push(c));
    return map;
  }, [clusters]);

  const presentTiers = TIER_ORDER.filter((t) => clustersByTier[t.tier].length > 0);
  const showTierHeaders = presentTiers.length > 1;

  const lastUpdated = useMemo(() => {
    if (clusters.length === 0) return null;
    return clusters.reduce((latest, c) =>
      c.updated_at > latest ? c.updated_at : latest, clusters[0].updated_at);
  }, [clusters]);

  /* ── Unclustered observations ── */
  const clusteredEvidenceIds = useMemo(() => {
    const ids = new Set<string>();
    clusters.forEach((c) => {
      c.constituent_evidence.forEach((ev) => ids.add(ev.evidence_id));
    });
    return ids;
  }, [clusters]);

  const unclusteredObs = useMemo(() => {
    return observations.filter((o) => !clusteredEvidenceIds.has(o.id));
  }, [observations, clusteredEvidenceIds]);

  const unclusteredByPanel = useMemo(() => {
    const map: Record<string, typeof unclusteredObs> = {};
    unclusteredObs.forEach((o) => {
      const panel = o.source || "Other";
      if (!map[panel]) map[panel] = [];
      map[panel].push(o);
    });
    return map;
  }, [unclusteredObs]);

  const loading = clustersLoading || labsLoading;

  /* ── Aside ── */
  const aside = hasTimelineData ? (
    <BiomarkerTimeline observations={timelineData} />
  ) : (
    <AsideInfoPanel
      title="Records summary"
      items={[
        { label: "Uploads", value: uploads.length.toString() },
        { label: "Biomarkers", value: observations.length.toString(), tone: "accent" },
        { label: "Distinct tests", value: distinctTestCount.toString() },
      ]}
    />
  );

  return (
    <PatientSectionLayout
      eyebrow="MEDICAL RECORDS"
      title={hasClusters ? "Your terrain" : "Your lab history, extracted and organized"}
      intro={hasClusters
        ? "Your biology organized as clusters of converging evidence. Each cluster shows what your data is telling us, how confident the reading is, and what would sharpen it."
        : "Every PDF you upload gets read and turned into structured observations. Your timeline rebuilds itself as you add more."}
      aside={aside}
      asideSticky
    >
      {/* Admin controls bar — only visible in view-as / admin mode */}
      {(isViewingAs || isAdmin) && (
        <div className="flex items-center gap-3 flex-wrap rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
          <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.06em] text-muted-foreground">Admin</span>
          <button
            onClick={triggerFilePicker}
            disabled={uploading || processing}
            className="flex items-center gap-1.5 rounded-lg bg-secondary text-secondary-foreground px-3 py-1.5 text-xs hover:bg-secondary/90 transition-colors disabled:opacity-50"
          >
            {uploading ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />Uploading...</>)
             : processing ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />Reading report...</>)
             : (<><Upload className="h-3.5 w-3.5" />Upload lab report</>)}
          </button>
          <input ref={fileInputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleFileSelect} className="hidden" />

          <button
            onClick={triggerFibroFilePicker}
            disabled={fibroUploading}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card text-foreground px-3 py-1.5 text-xs hover:bg-muted/60 transition-colors disabled:opacity-50"
          >
            {fibroUploading
              ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />Reading FibroScan...</>)
              : (<><Upload className="h-3.5 w-3.5" />Upload FibroScan report</>)}
          </button>
          <input ref={fibroFileInputRef} type="file" accept="application/pdf" onChange={handleFibroFileSelect} className="hidden" />

          <button
            onClick={handleRegenerateClusters}
            disabled={regenerating}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card text-foreground px-3 py-1.5 text-xs hover:bg-muted/60 transition-colors disabled:opacity-50"
          >
            {regenerating
              ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating...</>)
              : (<><Zap className="h-3.5 w-3.5" />Regenerate clusters</>)}
          </button>
        </div>
      )}

      {/* Patient-facing upload buttons */}
      {!isViewingAs && !isAdmin && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={triggerFilePicker}
            disabled={uploading || processing}
            className="flex items-center gap-1.5 rounded-lg bg-secondary text-secondary-foreground px-3 py-1.5 text-xs hover:bg-secondary/90 transition-colors disabled:opacity-50"
          >
            {uploading ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />Uploading...</>)
             : processing ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />Reading report...</>)
             : (<><Upload className="h-3.5 w-3.5" />Upload lab report</>)}
          </button>
          <input ref={fileInputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleFileSelect} className="hidden" />

          <button
            onClick={triggerFibroFilePicker}
            disabled={fibroUploading}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card text-foreground px-3 py-1.5 text-xs hover:bg-muted/60 transition-colors disabled:opacity-50"
          >
            {fibroUploading
              ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />Reading FibroScan...</>)
              : (<><Upload className="h-3.5 w-3.5" />Upload FibroScan report</>)}
          </button>
          <input ref={fibroFileInputRef} type="file" accept="application/pdf" onChange={handleFibroFileSelect} className="hidden" />

          <span className="text-xs text-muted-foreground">PDF or image, 20 MB max</span>
        </div>
      )}

      {/* FibroScan upload feedback */}
      {fibroResult && !fibroUploading && (
        <div className="text-xs">
          {fibroResult.success ? (
            <div className="flex items-center gap-2 text-teal-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{fibroResult.message}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-orange-700">
              <XCircle className="h-3.5 w-3.5" />
              <span>{fibroResult.message}</span>
            </div>
          )}
        </div>
      )}

      {/* Regenerate feedback */}
      {regenerateMsg && (
        <div className={`text-xs ${regenerateMsg.startsWith("Error") ? "text-destructive" : "text-muted-foreground"}`}>
          {regenerateMsg}
        </div>
      )}

      {/* Last result feedback */}
      {lastResult && !uploading && !processing && (
        <div className="text-xs">
          {lastResult.success ? (
            <div className="flex items-center gap-2 text-teal-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>
                Extracted {lastResult.observations_extracted} biomarker{lastResult.observations_extracted !== 1 ? "s" : ""}
                {lastResult.observations_inserted > 0 && ` · ${lastResult.observations_inserted} new`}
                {lastResult.observations_duplicates > 0 && ` · ${lastResult.observations_duplicates} duplicates skipped`}
                {lastResult.source_lab && ` · ${lastResult.source_lab}`}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-orange-700">
              <XCircle className="h-3.5 w-3.5" />
              <span>{lastResult.error || "Upload failed"}</span>
            </div>
          )}
        </div>
      )}

      {labError && !lastResult && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">{labError}</div>
      )}

      {clustersError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <span>{clustersError}</span>
          <button onClick={refetch} className="inline-flex items-center gap-1 text-xs underline"><RefreshCw className="h-3 w-3" /> Retry</button>
        </div>
      )}

      {loading && uploads.length === 0 && clusters.length === 0 && (
        <div className="text-xs text-muted-foreground italic py-4">Loading your records...</div>
      )}

      {/* ════════════════ CLUSTER TERRAIN SECTION ════════════════ */}
      {hasClusters && (
        <>
          {/* Coherence Map — centered with breathing room */}
          <div className="py-8 flex flex-col items-center">
            <CoherenceMap clusters={clusters} />
          </div>

          {/* Cluster Cards */}
          <div className="space-y-3">
            {presentTiers.map((tierInfo) => (
              <div key={tierInfo.tier}>
                {showTierHeaders && (
                  <p className="text-[10px] font-sans font-medium uppercase tracking-[0.18em] text-muted-foreground mb-2 mt-4 first:mt-0">
                    {tierInfo.label}
                  </p>
                )}
                <div className="space-y-3">
                  {clustersByTier[tierInfo.tier].map((cluster) => (
                    <div key={cluster.id} id={`cluster-${cluster.id}`} className="transition-all duration-300">
                      <ClusterCard cluster={cluster} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.history.replaceState(null, "", `#cluster-${cluster.id}`);
                          navigateTo("noticed");
                        }}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-secondary transition-colors mt-1.5 ml-4"
                      >
                        View the reading
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Unclustered observations accordion */}
          {unclusteredObs.length > 0 && (
            <div className="pt-6 border-t border-border mt-6">
              <button
                onClick={() => setUploadsOpen((o) => !o)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                {uploadsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Everything else we're tracking ({unclusteredObs.length} markers)
              </button>
              <AnimatePresence>
                {uploadsOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mt-3"
                  >
                    <div className="space-y-4">
                      {Object.entries(unclusteredByPanel).map(([panel, obs]) => (
                        <div key={panel}>
                          <p className="text-[10px] font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground mb-1.5">
                            {panel}
                          </p>
                          <div className="space-y-1">
                            {obs.map((o) => (
                              <div key={o.id} className="flex items-center gap-3 py-1 px-2 rounded hover:bg-muted/30 transition-colors">
                                <p className="text-xs text-foreground font-medium flex-1 min-w-0 truncate">{o.canonical_name}</p>
                                <FlagPill flag={o.flag} />
                                <span className="text-xs font-mono text-foreground shrink-0">{o.value} {o.unit}</span>
                                <span className="text-[10px] text-muted-foreground shrink-0">{o.collection_date}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Terrain footer */}
          {lastUpdated && (
            <div className="text-[11px] text-muted-foreground pt-4 border-t border-border mt-6">
              This terrain reading was last updated {new Date(lastUpdated).toLocaleDateString()}.
              New labs, sensor data, or CIE responses will refine it automatically.
            </div>
          )}
        </>
      )}

      {/* ════════════════ UPLOAD LIST (always shown) ════════════════ */}
      {uploads.length > 0 && (
        <div className={hasClusters ? "pt-6 border-t border-border mt-6" : ""}>
          {hasClusters && (
            <p className="text-[10px] font-sans font-medium uppercase tracking-[0.18em] text-muted-foreground mb-3">
              Uploaded reports
            </p>
          )}
          <div className="space-y-3">
            {uploads.map((upload) => {
              const uploadObs = getObservationsForUpload(upload.id);
              const isExpanded = expandedUploads.has(upload.id);
              return (
                <motion.div key={upload.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="p-4 group">
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground truncate">{upload.original_filename}</p>
                          <StatusBadge status={upload.status} />
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1 flex-wrap">
                          {upload.source_lab && (<span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{upload.source_lab}</span>)}
                          {upload.collection_date && (<span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Collected {formatDate(upload.collection_date)}</span>)}
                          {upload.observations_inserted != null && (<span>{upload.observations_inserted} biomarker{upload.observations_inserted !== 1 ? "s" : ""}</span>)}
                        </div>
                        {upload.error_message && (<p className="text-[11px] text-orange-700 mt-1.5 italic">{upload.error_message}</p>)}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {upload.status === "complete" && uploadObs.length > 0 && (
                          <button onClick={() => toggleExpanded(upload.id)} className="p-1.5 rounded-md hover:bg-muted transition-colors" title={isExpanded ? "Collapse" : "Show observations"}>
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                          </button>
                        )}
                        <button onClick={() => { if (confirm("Delete this upload and all its observations?")) deleteUpload(upload.id); }} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Delete upload">
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && uploadObs.length > 0 && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="border-t border-border bg-muted/10 overflow-hidden">
                        <div className="p-4 space-y-1.5">
                          {uploadObs.map((obs) => (
                            <div key={obs.id} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-card transition-colors group">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-foreground font-medium">
                                  {obs.canonical_name}
                                  {obs.canonical_name !== obs.raw_name && (<span className="text-muted-foreground font-normal ml-1">({obs.raw_name})</span>)}
                                </p>
                                {obs.ref_low != null && obs.ref_high != null && (<p className="text-[10px] text-muted-foreground">normal: {obs.ref_low}–{obs.ref_high} {obs.unit}</p>)}
                              </div>
                              <FlagPill flag={obs.flag} />
                              {editingObs === obs.id ? (
                                <div className="flex items-center gap-1">
                                  <input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-20 rounded border border-border bg-background px-2 py-1 text-xs" autoFocus />
                                  <button onClick={handleSaveEdit} className="p-1 rounded hover:bg-muted"><Check className="h-3.5 w-3.5 text-teal-600" /></button>
                                  <button onClick={handleCancelEdit} className="p-1 rounded hover:bg-muted"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                                </div>
                              ) : (
                                <>
                                  <span className="text-xs font-mono text-foreground">
                                    {obs.value} {obs.unit}
                                    {obs.corrected && (<span className="text-[9px] text-amber-600 ml-1" title={`Originally ${obs.original_value}`}>(corrected)</span>)}
                                  </span>
                                  <button onClick={() => handleStartEdit(obs)} className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity" title="Correct misread value">
                                    <Pencil className="h-3 w-3 text-muted-foreground" />
                                  </button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* No uploads empty state */}
      {!loading && uploads.length === 0 && !hasClusters && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-foreground font-medium mb-1">No lab reports uploaded yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Click <span className="font-medium">Upload lab report</span> to add your first set of results. You can upload PDFs or photos of lab reports.
          </p>
        </div>
      )}

      {/* Summary footer */}
      {observations.length > 0 && (
        <div className="text-xs text-muted-foreground border-t border-border pt-3">
          Total: <span className="font-medium text-foreground">{observations.length}</span> biomarker{observations.length !== 1 ? "s" : ""} across {distinctTestCount} distinct tests, from {uploads.filter((u) => u.status === "complete").length} processed upload{uploads.filter((u) => u.status === "complete").length !== 1 ? "s" : ""}.
        </div>
      )}

      {/* CELF export */}
      <div className="border-t border-border pt-6 mt-6">
        <CelfExportButton />
      </div>

      <IdentityConfirmModal
        request={identityRequest}
        onConfirm={handleIdentityConfirm}
        onReject={handleIdentityReject}
        onClose={() => setIdentityRequest(null)}
      />

      <PreUploadConfirmModal
        open={!!pendingUpload}
        fileName={pendingUpload?.file.name ?? null}
        onConfirm={handlePendingConfirm}
        onCancel={() => setPendingUpload(null)}
      />

    </PatientSectionLayout>
  );
};

export default RecordsSection;
