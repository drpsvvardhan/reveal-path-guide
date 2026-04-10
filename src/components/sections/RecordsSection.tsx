import React, { useState, useRef } from "react";
import { useLabUploads } from "@/context/LabUploadsContext";
import { useDocuments } from "@/context/DocumentContext";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Calendar,
  Building2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LabUpload, LabObservationRow } from "@/types/manifest";

const StatusBadge: React.FC<{ status: LabUpload["status"] }> = ({ status }) => {
  const styles: Record<string, { bg: string; text: string; label: string; Icon: React.FC<any> }> = {
    uploaded: { bg: "bg-muted/40", text: "text-muted-foreground", label: "Uploaded", Icon: FileText },
    processing: {
      bg: "bg-blue-50 border-blue-200",
      text: "text-blue-700",
      label: "Processing",
      Icon: Loader2,
    },
    complete: {
      bg: "bg-teal-50 border-teal-200",
      text: "text-teal-700",
      label: "Complete",
      Icon: CheckCircle2,
    },
    failed: {
      bg: "bg-orange-50 border-orange-200",
      text: "text-orange-700",
      label: "Failed",
      Icon: XCircle,
    },
  };
  const s = styles[status] || styles.uploaded;
  const Icon = s.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium border ${s.bg} ${s.text}`}
    >
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
    <span className={`text-[9px] uppercase font-medium px-1.5 py-0.5 rounded border ${styles[flag]}`}>
      {flag}
    </span>
  );
};

const RecordsSection: React.FC = () => {
  const {
    uploads,
    observations,
    loading,
    uploading,
    processing,
    error,
    uploadAndProcess,
    deleteUpload,
    correctObservation,
  } = useLabUploads();
  const { documents } = useDocuments();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const [expandedUploads, setExpandedUploads] = useState<Set<string>>(new Set());
  const [editingObs, setEditingObs] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLastResult(null);
    const result = await uploadAndProcess(file);
    setLastResult(result);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const triggerFilePicker = () => fileInputRef.current?.click();

  const toggleExpanded = (uploadId: string) => {
    setExpandedUploads((prev) => {
      const next = new Set(prev);
      if (next.has(uploadId)) next.delete(uploadId);
      else next.add(uploadId);
      return next;
    });
  };

  const handleStartEdit = (obs: LabObservationRow) => {
    setEditingObs(obs.id);
    setEditValue(obs.value.toString());
  };

  const handleSaveEdit = async () => {
    if (!editingObs) return;
    const newValue = parseFloat(editValue);
    if (isNaN(newValue)) return;
    await correctObservation(editingObs, newValue);
    setEditingObs(null);
    setEditValue("");
  };

  const handleCancelEdit = () => {
    setEditingObs(null);
    setEditValue("");
  };

  const getObservationsForUpload = (uploadId: string): LabObservationRow[] => {
    return observations.filter((o) => o.upload_id === uploadId);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <section className="animate-fade-in space-y-5">
      <div>
        <h2 className="text-sm font-sans font-medium uppercase tracking-widest text-secondary">
          Records
        </h2>
        <p className="text-muted-foreground text-sm max-w-xl mt-1">
          Upload lab reports from Quest, LabCorp, or your hospital — as PDFs or photos.
          Each file gets automatically read, with every biomarker extracted and added to
          your timeline. Upload one at a time — start with your most recent labs.
        </p>
      </div>

      {/* Upload button */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={triggerFilePicker}
          disabled={uploading || processing}
          className="flex items-center gap-1.5 rounded-lg bg-secondary text-secondary-foreground px-3 py-1.5 text-xs hover:bg-secondary/90 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Uploading...
            </>
          ) : processing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Reading PDF...
            </>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5" />
              Upload lab PDF
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
        <span className="text-xs text-muted-foreground">PDF only, 10 MB max</span>
      </div>

      {/* Last result feedback */}
      {lastResult && !uploading && !processing && (
        <div className="text-xs">
          {lastResult.success ? (
            <div className="flex items-center gap-2 text-teal-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>
                Extracted {lastResult.observations_extracted} biomarker
                {lastResult.observations_extracted !== 1 ? "s" : ""}
                {lastResult.observations_inserted > 0 && ` · ${lastResult.observations_inserted} new`}
                {lastResult.observations_duplicates > 0 &&
                  ` · ${lastResult.observations_duplicates} duplicates skipped`}
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

      {error && !lastResult && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && uploads.length === 0 && (
        <div className="text-xs text-muted-foreground italic py-4">Loading your records...</div>
      )}

      {!loading && uploads.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-foreground font-medium mb-1">No lab PDFs uploaded yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Click <span className="font-medium">Upload lab PDF</span> to add your first set of
            results. The system will read the PDF, extract every biomarker, and add them to your
            timeline.
          </p>
        </div>
      )}

      {/* Upload list */}
      <div className="space-y-3">
        {uploads.map((upload) => {
          const uploadObs = getObservationsForUpload(upload.id);
          const isExpanded = expandedUploads.has(upload.id);

          return (
            <motion.div
              key={upload.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-border bg-card overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 group">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground truncate">
                        {upload.original_filename}
                      </p>
                      <StatusBadge status={upload.status} />
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1 flex-wrap">
                      {upload.source_lab && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {upload.source_lab}
                        </span>
                      )}
                      {upload.collection_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Collected {formatDate(upload.collection_date)}
                        </span>
                      )}
                      {upload.observations_inserted != null && (
                        <span>
                          {upload.observations_inserted} biomarker
                          {upload.observations_inserted !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    {upload.error_message && (
                      <p className="text-[11px] text-orange-700 mt-1.5 italic">
                        {upload.error_message}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {upload.status === "complete" && uploadObs.length > 0 && (
                      <button
                        onClick={() => toggleExpanded(upload.id)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors"
                        title={isExpanded ? "Collapse" : "Show observations"}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm("Delete this upload and all its observations?")) {
                          deleteUpload(upload.id);
                        }
                      }}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors"
                      title="Delete upload"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded observations */}
              <AnimatePresence>
                {isExpanded && uploadObs.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t border-border bg-muted/10 overflow-hidden"
                  >
                    <div className="p-4 space-y-1.5">
                      {uploadObs.map((obs) => (
                        <div
                          key={obs.id}
                          className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-card transition-colors group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground font-medium">
                              {obs.canonical_name}
                              {obs.canonical_name !== obs.raw_name && (
                                <span className="text-muted-foreground font-normal ml-1">
                                  ({obs.raw_name})
                                </span>
                              )}
                            </p>
                            {obs.ref_low != null && obs.ref_high != null && (
                              <p className="text-[10px] text-muted-foreground">
                                normal: {obs.ref_low}–{obs.ref_high} {obs.unit}
                              </p>
                            )}
                          </div>
                          <FlagPill flag={obs.flag} />
                          {editingObs === obs.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-20 rounded border border-border bg-background px-2 py-1 text-xs"
                                autoFocus
                              />
                              <button
                                onClick={handleSaveEdit}
                                className="p-1 rounded hover:bg-muted"
                              >
                                <Check className="h-3.5 w-3.5 text-teal-600" />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="p-1 rounded hover:bg-muted"
                              >
                                <X className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="text-xs font-mono text-foreground">
                                {obs.value} {obs.unit}
                                {obs.corrected && (
                                  <span
                                    className="text-[9px] text-amber-600 ml-1"
                                    title={`Originally ${obs.original_value}`}
                                  >
                                    (corrected)
                                  </span>
                                )}
                              </span>
                              <button
                                onClick={() => handleStartEdit(obs)}
                                className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Correct misread value"
                              >
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

      {/* Total observations summary */}
      {observations.length > 0 && (
        <div className="text-xs text-muted-foreground border-t border-border pt-3">
          Total: <span className="font-medium text-foreground">{observations.length}</span>{" "}
          biomarker{observations.length !== 1 ? "s" : ""} across{" "}
          {new Set(observations.map((o) => o.canonical_name)).size} distinct tests, from{" "}
          {uploads.filter((u) => u.status === "complete").length} processed upload
          {uploads.filter((u) => u.status === "complete").length !== 1 ? "s" : ""}.
        </div>
      )}
    </section>
  );
};

export default RecordsSection;
