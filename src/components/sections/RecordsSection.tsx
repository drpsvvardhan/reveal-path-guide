import React, { useRef, useState } from "react";
import { useDocuments, PatientDocument } from "@/context/DocumentContext";
import { Upload, FileText, X, Trash2, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB for PDFs
const ACCEPTED_EXTENSIONS = [".txt", ".csv", ".json", ".pdf", ".lab", ".hl7", ".xml", ".html"];
const PARSE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-document`;

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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix to get pure base64
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const RecordsSection: React.FC = () => {
  const { documents, addDocument, removeDocument, clearDocuments } = useDocuments();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState<string | null>(null); // filename being parsed

  const processFile = async (file: File) => {
    setError(null);
    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large: ${file.name}. Maximum size is 20MB.`);
      return;
    }

    const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";

    if (isPdf) {
      // Send PDF to edge function for AI-powered extraction
      setParsing(file.name);
      try {
        const base64 = await fileToBase64(file);
        const resp = await fetch(PARSE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            fileBase64: base64,
            fileName: file.name,
            mimeType: file.type,
          }),
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.error || `Parse failed (${resp.status})`);
        }

        const { text } = await resp.json();
        const docType = classifyDocument(file.name);
        addDocument({
          name: file.name,
          type: docType,
          content: text.slice(0, 50000),
          size: file.size,
        });
      } catch (e: any) {
        console.error("PDF parse error:", e);
        setError(`Could not parse PDF: ${file.name}. ${e.message || "Please try again."}`);
      } finally {
        setParsing(null);
      }
    } else {
      // Text-based files — read directly
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
        PDFs are automatically parsed and extracted so the AI can reference your actual values.
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
            disabled={!!parsing}
            className="rounded-lg border border-border bg-card p-3 text-center hover:bg-muted/60 hover:border-secondary/30 transition-all disabled:opacity-50"
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
        onClick={() => !parsing && fileRef.current?.click()}
        className={`relative rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          parsing ? "opacity-50 cursor-wait" :
          dragOver
            ? "border-secondary bg-teal-light cursor-pointer"
            : "border-border hover:border-secondary/40 hover:bg-muted/30 cursor-pointer"
        }`}
      >
        {parsing ? (
          <>
            <Loader2 className="h-6 w-6 mx-auto mb-2 text-secondary animate-spin" />
            <p className="font-sans font-medium text-foreground text-sm mb-1">
              Parsing {parsing}...
            </p>
            <p className="text-xs text-muted-foreground">
              Extracting text, values, and structure from your document
            </p>
          </>
        ) : (
          <>
            <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="font-sans font-medium text-foreground text-sm mb-1">
              Drop files here or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, TXT, CSV, JSON, XML, HTML · Max 20MB
            </p>
          </>
        )}
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
                    {doc.name.toLowerCase().endsWith(".pdf") && (
                      <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
                        AI-parsed
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-secondary">
                    <CheckCircle2 className="h-3 w-3" />
                    Extracted and integrated into AI context
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
