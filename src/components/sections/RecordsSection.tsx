import React, { useRef, useState } from "react";
import { useDocuments, PatientDocument } from "@/context/DocumentContext";
import { Upload, FileText, X, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".txt", ".csv", ".json", ".pdf", ".lab", ".hl7", ".xml", ".html"];

function classifyDocument(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("lab") || lower.includes("blood") || lower.includes("cbc") || lower.includes("cmp"))
    return "Lab Results";
  if (lower.includes("imaging") || lower.includes("mri") || lower.includes("ct") || lower.includes("xray") || lower.includes("ultrasound"))
    return "Imaging";
  if (lower.includes("pathology") || lower.includes("biopsy"))
    return "Pathology";
  if (lower.includes("rx") || lower.includes("prescription") || lower.includes("med"))
    return "Medications";
  if (lower.includes("note") || lower.includes("visit") || lower.includes("consult"))
    return "Clinical Notes";
  if (lower.includes("genetic") || lower.includes("genom"))
    return "Genomics";
  return "Medical Record";
}

const RecordsSection: React.FC = () => {
  const { documents, addDocument, removeDocument, clearDocuments } = useDocuments();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = async (file: File) => {
    setError(null);
    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large: ${file.name}. Maximum size is 5MB.`);
      return;
    }
    try {
      const text = await file.text();
      const docType = classifyDocument(file.name);
      addDocument({
        name: file.name,
        type: docType,
        content: text.slice(0, 50000),
        size: file.size,
      });
    } catch {
      setError(`Could not read file: ${file.name}. Please try a text-based format.`);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(processFile);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <section className="animate-fade-in space-y-6">
      <h2 className="text-sm font-sans font-medium uppercase tracking-widest text-secondary">
        Medical Records
      </h2>
      <p className="text-muted-foreground text-sm max-w-xl">
        Upload your lab results, imaging reports, clinical notes, or any medical records.
        These will be used to give you more personalized guidance in the AI console.
      </p>

      {/* Quick upload cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Lab results", icon: "🩸" },
          { label: "Imaging", icon: "📷" },
          { label: "Prescription", icon: "💊" },
          { label: "Clinical notes", icon: "📋" },
        ].map((card) => (
          <button
            key={card.label}
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-border bg-card p-3 text-center hover:bg-muted/60 hover:border-secondary/30 transition-all"
          >
            <span className="text-lg block mb-1">{card.icon}</span>
            <span className="text-xs font-sans font-medium text-foreground">{card.label}</span>
          </button>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`relative rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-secondary bg-teal-light"
            : "border-border hover:border-secondary/40 hover:bg-muted/30"
        }`}
      >
        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
        <p className="font-sans font-medium text-foreground text-sm mb-1">
          Drop files here or click to browse
        </p>
        <p className="text-xs text-muted-foreground">
          TXT, CSV, JSON, XML, HTML · Max 5MB
        </p>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".txt,.csv,.json,.pdf,.lab,.hl7,.xml,.html"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Uploaded documents */}
      {documents.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg text-foreground">
              Uploaded Records ({documents.length})
            </h3>
            <button
              onClick={clearDocuments}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3 w-3" /> Clear all
            </button>
          </div>

          <AnimatePresence>
            {documents.map((doc) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-lg border border-border bg-card p-4 flex items-start gap-3"
              >
                <div className="h-9 w-9 rounded-lg bg-navy-light flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-sans font-medium text-foreground text-sm truncate">{doc.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs bg-secondary/10 text-secondary rounded-full px-2 py-0.5">
                      {doc.type}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatSize(doc.size)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-secondary">
                    <CheckCircle2 className="h-3 w-3" />
                    Reviewed and integrated into your plan
                  </div>
                </div>
                <button
                  onClick={() => removeDocument(doc.id)}
                  className="p-1 rounded-md hover:bg-muted transition-colors shrink-0"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
};

export default RecordsSection;
