import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Upload, FileJson, AlertCircle, CheckCircle2,
  RotateCcw, Sparkles, Download, FileDown, Copy, Printer, GitCompare, Check, Search, Info,
} from "lucide-react";
import {
  parseManifestJson,
  type FriendlyIssue,
  type ManifestPreview as ManifestData,
} from "@/lib/manifestSchema";
import { lintManifest, buildLintReport, type ManifestWarning } from "@/lib/manifestLint";
import {
  RenderManifest,
  sectionMeta,
  sectionAnchorId,
} from "@/components/manifest-preview/SectionRenderer";
import { sampleManifestPreview } from "@/lib/sampleManifestPreview";
import { diffManifests, formatDiffValue, type DiffEntry } from "@/lib/manifestDiff";

type PreviewState =
  | { kind: "empty" }
  | { kind: "loading" }
  | { kind: "error"; parseError?: string; issues?: FriendlyIssue[] }
  | { kind: "success"; data: ManifestData };

const MAX_BYTES = 2 * 1024 * 1024; // 2MB safety cap for paste/upload
const LS_KEY = "manifest-preview:last-valid-v1";
const LS_LINT_FILTER_KEY = "manifest-preview:lint-filter-v1";
const DIFF_CAP = 100;

// Format a byte count compactly for the size hint (e.g. "1.2 KB").
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 2 : 1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ManifestPreviewPage() {
  const [text, setText] = useState("");
  const [state, setState] = useState<PreviewState>({ kind: "empty" });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const errorAlertRef = useRef<HTMLDivElement | null>(null);
  const diffCardRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [sampleLoaded, setSampleLoaded] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [restored, setRestored] = useState(false);
  const [diffQuery, setDiffQuery] = useState("");
  const [warningFilter, setWarningFilter] = useState<"all" | "warning" | "info">(() => {
    try {
      const v = localStorage.getItem(LS_LINT_FILTER_KEY);
      if (v === "all" || v === "warning" || v === "info") return v;
    } catch { /* noop */ }
    return "all";
  });

  // Persist the selected lint filter so it survives reloads.
  useEffect(() => {
    try {
      localStorage.setItem(LS_LINT_FILTER_KEY, warningFilter);
    } catch { /* noop */ }
  }, [warningFilter]);

  const validate = useCallback((raw: string) => {
    setState({ kind: "loading" });
    // Yield to the event loop so the loading state actually renders for
    // very large pastes; keeps the perceived state machine honest.
    setTimeout(() => {
      const result = parseManifestJson(raw);
      if (!result.ok) {
        setState({
          kind: "error",
          parseError: result.parseError,
          issues: result.issues,
        });
        return;
      }
      setState({ kind: "success", data: result.data! });
    }, 50);
  }, []);

  // ---------------------------------------------------------------------------
  // Restore last valid manifest from localStorage on first mount.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const result = parseManifestJson(raw);
      if (result.ok && result.data) {
        setText(JSON.stringify(result.data, null, 2));
        setState({ kind: "success", data: result.data });
        setRestored(true);
      }
    } catch {
      // ignore — corrupt storage is non-fatal
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist last valid manifest whenever validation succeeds.
  useEffect(() => {
    if (state.kind !== "success") return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state.data));
    } catch {
      // storage may be full / disabled — non-fatal
    }
  }, [state]);

  const onFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_BYTES) {
        setState({
          kind: "error",
          parseError: `File is ${Math.round(file.size / 1024)}KB; the previewer caps uploads at 2MB.`,
        });
        return;
      }
      try {
        const raw = await file.text();
        setText(raw);
        validate(raw);
      } catch (e) {
        setState({
          kind: "error",
          parseError: e instanceof Error ? e.message : "Could not read file",
        });
      }
    },
    [validate],
  );

  const onReset = () => {
    const hasStored = (() => {
      try { return localStorage.getItem(LS_KEY) != null; } catch { return false; }
    })();
    if (hasStored) {
      const ok = window.confirm(
        "Reset to empty?\n\nThis will clear the input and remove the last valid manifest saved in this browser's local storage.",
      );
      if (!ok) return;
    }
    setText("");
    setState({ kind: "empty" });
    setSampleLoaded(false);
    setDiffOpen(false);
    setRestored(false);
    setDiffQuery("");
    try { localStorage.removeItem(LS_KEY); } catch { /* noop */ }
    if (fileRef.current) fileRef.current.value = "";
  };

  const onLoadSample = useCallback(() => {
    const raw = JSON.stringify(sampleManifestPreview, null, 2);
    setText(raw);
    setSampleLoaded(true);
    setRestored(false);
    validate(raw);
  }, [validate]);

  const onDownloadSample = useCallback(() => {
    const blob = new Blob(
      [JSON.stringify(sampleManifestPreview, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample-manifest.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const onExport = useCallback(() => {
    if (state.kind !== "success") return;
    const blob = new Blob([JSON.stringify(state.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.download = `manifest-${state.data.patient.firstName.replace(/\s+/g, "_")}-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [state]);

  const onCopyJson = useCallback(async () => {
    if (state.kind !== "success") return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(state.data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked — silently noop; the Export button is the fallback.
    }
  }, [state]);

  const onPrint = useCallback(() => {
    document.body.classList.add("manifest-print-mode");
    // Defer so the class can apply before the print dialog snapshots layout.
    setTimeout(() => {
      window.print();
      document.body.classList.remove("manifest-print-mode");
    }, 50);
  }, []);

  const scrollToSection = (key: string) => {
    const el = document.getElementById(sectionAnchorId(key));
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ---------------------------------------------------------------------------
  // Section completion stats (success state only).
  // ---------------------------------------------------------------------------
  const sectionStats = useMemo(() => {
    if (state.kind !== "success") return null;
    const data = state.data as Record<string, unknown>;
    let present = 0;
    const flags: Record<string, boolean> = {};
    for (const { key } of sectionMeta) {
      const ok = key === "patient" ? true : data[key] != null;
      flags[key] = ok;
      if (ok) present++;
    }
    const total = sectionMeta.length;
    return {
      flags,
      present,
      total,
      pct: Math.round((present / total) * 100),
    };
  }, [state]);

  // ---------------------------------------------------------------------------
  // Group validation issues by their top-level field (e.g. "patient",
  // "careMap", "(root)") so reviewers can scan section-by-section.
  // ---------------------------------------------------------------------------
  const groupedIssues = useMemo(() => {
    if (state.kind !== "error" || !state.issues) return null;
    const groups = new Map<string, FriendlyIssue[]>();
    for (const iss of state.issues) {
      const top = iss.path === "(root)" ? "(root)" : iss.path.split(".")[0];
      const arr = groups.get(top) ?? [];
      arr.push(iss);
      groups.set(top, arr);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === "(root)") return -1;
      if (b === "(root)") return 1;
      return a.localeCompare(b);
    });
  }, [state]);

  // ---------------------------------------------------------------------------
  // Auto-scroll to the validation error alert when it appears.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (state.kind === "error" && errorAlertRef.current) {
      errorAlertRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (state.kind !== "success") {
      // Drop diff panel + sample-loaded confirmation when we leave success.
      if (state.kind === "empty") setSampleLoaded(false);
    }
  }, [state]);

  // ---------------------------------------------------------------------------
  // Diff: current valid manifest vs the bundled sample.
  // ---------------------------------------------------------------------------
  const diffEntries: DiffEntry[] | null = useMemo(() => {
    if (state.kind !== "success") return null;
    return diffManifests(sampleManifestPreview, state.data);
  }, [state]);

  const diffSummary = useMemo(() => {
    if (!diffEntries) return null;
    const added = diffEntries.filter((d) => d.kind === "added").length;
    const removed = diffEntries.filter((d) => d.kind === "removed").length;
    const changed = diffEntries.filter((d) => d.kind === "changed").length;
    return { added, removed, changed, total: diffEntries.length };
  }, [diffEntries]);

  // Clear the "Sample manifest loaded" banner whenever the validated
  // manifest no longer matches the bundled sample (e.g. user edited
  // the JSON after loading the sample).
  useEffect(() => {
    if (!sampleLoaded) return;
    if (state.kind !== "success") return;
    if ((diffSummary?.total ?? 0) > 0) {
      setSampleLoaded(false);
    }
  }, [state, diffSummary, sampleLoaded]);

  // When the diff panel is opened, smooth-scroll it into view so users
  // don't miss it sitting below the sticky Sections card.
  useEffect(() => {
    if (!diffOpen) return;
    // Defer to allow the card to mount before scrolling.
    const id = window.setTimeout(() => {
      diffCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => window.clearTimeout(id);
  }, [diffOpen]);

  // Non-blocking guidance warnings produced by the lint pass.
  const warnings: ManifestWarning[] | null = useMemo(() => {
    if (state.kind !== "success") return null;
    return lintManifest(state.data);
  }, [state]);

  const warningCounts = useMemo(() => {
    if (!warnings) return null;
    return {
      total: warnings.length,
      warning: warnings.filter((w) => w.severity === "warning").length,
      info: warnings.filter((w) => w.severity === "info").length,
    };
  }, [warnings]);

  const filteredWarnings = useMemo(() => {
    if (!warnings) return null;
    if (warningFilter === "all") return warnings;
    return warnings.filter((w) => w.severity === warningFilter);
  }, [warnings, warningFilter]);

  const onExportLintReport = useCallback(() => {
    if (state.kind !== "success" || !warnings) return;
    // Always export the FULL unfiltered list — filters are UI only.
    const report = buildLintReport(state.data, warnings);
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.download = `manifest-lint-report-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [state, warnings]);

  // Group diff entries by top-level field, capped at DIFF_CAP rows total
  // so very large manifests don't tank the panel.
  const groupedDiff = useMemo(() => {
    if (!diffEntries) return null;
    const capped = diffEntries.slice(0, DIFF_CAP);
    const truncated = diffEntries.length - capped.length;
    const groups = new Map<string, DiffEntry[]>();
    for (const d of capped) {
      const top = d.path === "(root)" ? "(root)" : d.path.split(".")[0];
      const arr = groups.get(top) ?? [];
      arr.push(d);
      groups.set(top, arr);
    }
    const ordered = Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === "(root)") return -1;
      if (b === "(root)") return 1;
      return a.localeCompare(b);
    });
    return { ordered, truncated };
  }, [diffEntries]);

  // Required-field checklist. In success state, evaluates against the
  // validated manifest. In error state, attempts a loose JSON parse so
 // reviewers can see which required fields are still missing.
  const requiredChecklist = useMemo(() => {
    let p: Record<string, unknown> | undefined;
    if (state.kind === "success") {
      p = state.data.patient as Record<string, unknown> | undefined;
    } else if (state.kind === "error" && text.trim()) {
      try {
        const obj = JSON.parse(text);
        if (obj && typeof obj === "object" && "patient" in obj) {
          p = (obj as Record<string, unknown>).patient as Record<string, unknown>;
        }
      } catch {
        p = undefined;
      }
    } else {
      return null;
    }
    return [
      { label: "patient.firstName", ok: typeof p?.firstName === "string" && (p.firstName as string).trim().length > 0 },
      { label: "patient.age", ok: typeof p?.age === "number" && Number.isFinite(p.age) },
      { label: "patient.sex", ok: typeof p?.sex === "string" && (p.sex as string).trim().length > 0 },
    ];
  }, [state, text]);

  // Manifest size hint (paste/upload byte count + JSON line count).
  const sizeHint = useMemo(() => {
    if (!text) return null;
    const bytes = new Blob([text]).size;
    const lines = text.split("\n").length;
    const pctOfCap = Math.min(100, Math.round((bytes / MAX_BYTES) * 100));
    return { bytes, lines, pctOfCap };
  }, [text]);

  // Filtered diff entries by free-text search (path or value substring).
  const filteredGroupedDiff = useMemo(() => {
    if (!groupedDiff) return null;
    const q = diffQuery.trim().toLowerCase();
    if (!q) return groupedDiff;
    const matches = (d: DiffEntry) => {
      if (d.path.toLowerCase().includes(q)) return true;
      const a = d.before !== undefined ? formatDiffValue(d.before).toLowerCase() : "";
      const b = d.after !== undefined ? formatDiffValue(d.after).toLowerCase() : "";
      return a.includes(q) || b.includes(q);
    };
    const ordered: [string, DiffEntry[]][] = [];
    let kept = 0;
    for (const [top, items] of groupedDiff.ordered) {
      const f = items.filter(matches);
      if (f.length) {
        ordered.push([top, f]);
        kept += f.length;
      }
    }
    return { ordered, truncated: groupedDiff.truncated, kept };
  }, [groupedDiff, diffQuery]);

  // Show "Reset to sample" only when current manifest is valid AND differs.
  const canResetToSample =
    state.kind === "success" && (diffSummary?.total ?? 0) > 0;

  const onResetToSample = useCallback(() => {
    onLoadSample();
  }, [onLoadSample]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <FileJson className="h-5 w-5 text-primary" />
              Manifest preview
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Paste or upload a patient manifest JSON to validate and preview its sections.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2">
            {state.kind === "success" && (
              state.data.schema_version ? (
                <Badge
                  variant="default"
                  className="font-mono tracking-tight"
                  title="schema_version declared in this manifest"
                >
                  schema_version v{state.data.schema_version}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-amber-500/50 text-amber-600"
                  title="No schema_version declared in this manifest"
                >
                  schema_version: unset
                </Badge>
              )
            )}
            <Badge variant="outline">Local preview · no data is sent</Badge>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* INPUT */}
        <section className="space-y-3 print:hidden">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Input</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Compact validation status — visible above the textarea so
                  users see success/error immediately after Validate without
                  needing to scroll past a long input. */}
              {state.kind === "success" && (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-2.5 py-1.5 text-xs text-emerald-700"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Manifest is valid</span>
                  {sectionStats && (
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {sectionStats.present}/{sectionStats.total} sections
                    </span>
                  )}
                </div>
              )}
              {state.kind === "error" && (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>
                    Validation failed
                    {state.issues?.length
                      ? ` · ${state.issues.length} issue${state.issues.length === 1 ? "" : "s"}`
                      : ""}
                  </span>
                </div>
              )}
              {state.kind === "loading" && (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Validating…</span>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={onLoadSample}>
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Load sample manifest
                </Button>
                <Button size="sm" variant="ghost" onClick={onDownloadSample}>
                  <FileDown className="h-3.5 w-3.5 mr-1.5" />
                  Download sample
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Upload .json
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onFile(f);
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => validate(text)}
                  disabled={!text.trim()}
                >
                  Validate & preview
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onExport}
                  disabled={state.kind !== "success"}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Export JSON
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onCopyJson}
                  disabled={state.kind !== "success"}
                  title="Copy validated JSON to clipboard"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {copied ? "Copied" : "Copy JSON"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onPrint}
                  disabled={state.kind !== "success"}
                  title="Open print/PDF dialog with preview-only view"
                >
                  <Printer className="h-3.5 w-3.5 mr-1.5" />
                  Print / Save PDF
                </Button>
                <Button
                  size="sm"
                  variant={diffOpen ? "default" : "secondary"}
                  onClick={() => setDiffOpen((v) => !v)}
                  disabled={state.kind !== "success"}
                  title="Compare current manifest vs the bundled sample"
                >
                  <GitCompare className="h-3.5 w-3.5 mr-1.5" />
                  {diffOpen ? "Hide diff" : "Diff vs sample"}
                </Button>
                {canResetToSample && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onResetToSample}
                    title="Replace current manifest with the bundled sample"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    Reset to sample
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onReset}
                  title="Reset input and preview to empty"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Reset to empty
                </Button>
              </div>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder='{ "schema_version": "1.0.0", "patient": { "firstName": "...", "age": 0, "sex": "..." } }'
                className="font-mono text-xs min-h-[360px]"
                spellCheck={false}
              />
              {sizeHint && (
                <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                  <span>
                    {formatBytes(sizeHint.bytes)} · {sizeHint.lines.toLocaleString()} line
                    {sizeHint.lines === 1 ? "" : "s"}
                  </span>
                  <span
                    className={
                      sizeHint.pctOfCap >= 90
                        ? "text-destructive"
                        : sizeHint.pctOfCap >= 70
                        ? "text-amber-600"
                        : ""
                    }
                    title={`Upload cap is ${formatBytes(MAX_BYTES)}`}
                  >
                    {sizeHint.pctOfCap}% of {formatBytes(MAX_BYTES)} cap
                  </span>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Required: <code>patient.firstName</code>, <code>patient.age</code>,{" "}
                <code>patient.sex</code>. Optional <code>schema_version</code> like <code>1.0.0</code>.
                All other sections are optional and render fallbacks when missing.
              </p>
            </CardContent>
          </Card>

          {sampleLoaded && state.kind === "success" && (
            <Alert className="border-emerald-500/40 bg-emerald-500/5">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              <AlertTitle>Sample manifest loaded</AlertTitle>
              <AlertDescription className="text-xs mt-1">
                You're viewing the bundled demo manifest. Edit the JSON, upload your own,
                or click <strong>Reset to empty</strong> to clear it.
              </AlertDescription>
            </Alert>
          )}

          {restored && state.kind === "success" && !sampleLoaded && (
            <Alert>
              <RotateCcw className="h-4 w-4" />
              <AlertTitle>Restored last valid manifest</AlertTitle>
              <AlertDescription className="text-xs mt-1">
                Loaded from your browser's local storage. Click <strong>Reset to empty</strong> to clear it.
              </AlertDescription>
            </Alert>
          )}

          {state.kind === "error" && (
            <Alert variant="destructive" ref={errorAlertRef}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Validation failed</AlertTitle>
              <AlertDescription className="space-y-2 mt-1">
                {state.parseError && (
                  <p className="text-xs">{state.parseError}</p>
                )}
                {groupedIssues && groupedIssues.length > 0 && (
                  <div className="text-xs max-h-64 overflow-auto space-y-3 pt-1">
                    {groupedIssues.map(([top, items]) => (
                      <div key={top}>
                        <p className="font-medium uppercase tracking-wide text-[10px] opacity-80">
                          {top}{" "}
                          <span className="opacity-70">
                            ({items.length} issue{items.length === 1 ? "" : "s"})
                          </span>
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {items.map((iss, i) => (
                            <li key={i}>
                              <code className="font-mono">{iss.path}</code> — {iss.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {state.kind === "error" && requiredChecklist && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                  Required fields
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-xs">
                  {requiredChecklist.map((r) => (
                    <li key={r.label} className="flex items-center gap-2">
                      {r.ok ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                      )}
                      <code className="font-mono">{r.label}</code>
                      <span className={r.ok ? "text-emerald-600" : "text-destructive"}>
                        {r.ok ? "present" : "missing"}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {state.kind === "success" && (
            <>
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Manifest is valid</AlertTitle>
                <AlertDescription className="text-xs mt-1">
                  Rendered {Object.keys(state.data).length} top-level field
                  {Object.keys(state.data).length === 1 ? "" : "s"}
                  {state.data.schema_version
                    ? ` · schema v${state.data.schema_version}`
                    : " · no schema_version"}
                  .
                </AlertDescription>
              </Alert>

              {warnings && warnings.length > 0 && warningCounts && filteredWarnings && (
                <Alert className="border-amber-500/40 bg-amber-500/5">
                  <Info className="h-4 w-4 text-amber-600" />
                  <AlertTitle>
                    {warnings.length} lint item{warnings.length === 1 ? "" : "s"} (non-blocking)
                  </AlertTitle>
                  <AlertDescription className="text-xs mt-1">
                    <p className="mb-2 text-muted-foreground">
                      Guidance only — the manifest is valid and will render.
                    </p>
                    <p className="mb-2 text-muted-foreground">
                      Warnings: <strong className="text-foreground">{warningCounts.warning}</strong>
                      {" · "}
                      Info: <strong className="text-foreground">{warningCounts.info}</strong>
                    </p>
                    <div className="mb-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onExportLintReport}
                        title="Export full lint report as JSON (always includes all items)"
                      >
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Export lint report
                      </Button>
                    </div>
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      {(
                        [
                          { key: "all" as const, label: "All", count: warningCounts.total },
                          { key: "warning" as const, label: "Warnings", count: warningCounts.warning },
                          { key: "info" as const, label: "Info", count: warningCounts.info },
                        ]
                      ).map((chip) => {
                        const active = warningFilter === chip.key;
                        return (
                          <button
                            key={chip.key}
                            type="button"
                            onClick={() => setWarningFilter(chip.key)}
                            className={
                              "rounded-full px-2.5 py-0.5 text-[11px] border transition-colors " +
                              (active
                                ? "bg-foreground text-background border-foreground"
                                : "bg-background text-muted-foreground border-border hover:bg-muted")
                            }
                          >
                            {chip.label}
                            <span className="ml-1 opacity-70">({chip.count})</span>
                          </button>
                        );
                      })}
                    </div>
                    {filteredWarnings.length === 0 ? (
                      <p className="text-muted-foreground italic">
                        No items match this filter.
                      </p>
                    ) : (
                      <ul className="space-y-1 max-h-48 overflow-auto">
                        {filteredWarnings.map((w, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span
                              className={
                                "mt-0.5 inline-block h-1.5 w-1.5 rounded-full shrink-0 " +
                                (w.severity === "warning"
                                  ? "bg-amber-500"
                                  : "bg-sky-500")
                              }
                              aria-label={w.severity}
                            />
                            <span>
                              <code className="font-mono">{w.path}</code> — {w.message}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {requiredChecklist && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                      Required fields
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1 text-xs">
                      {requiredChecklist.map((r) => (
                        <li key={r.label} className="flex items-center gap-2">
                          {r.ok ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                          )}
                          <code className="font-mono">{r.label}</code>
                          <span
                            className={
                              r.ok ? "text-emerald-600" : "text-destructive"
                            }
                          >
                            {r.ok ? "present" : "missing"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Sticky section nav (shown alongside the input column on lg+). */}
              <Card className="lg:sticky lg:top-4">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                      Sections
                    </CardTitle>
                    {sectionStats && (
                      <span className="text-[11px] text-muted-foreground">
                        {sectionStats.present}/{sectionStats.total} present · {sectionStats.pct}%
                      </span>
                    )}
                  </div>
                  {sectionStats && (
                    <>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${sectionStats.pct}%` }}
                        />
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Present
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                          Missing
                        </span>
                      </div>
                    </>
                  )}
                </CardHeader>
                <CardContent>
                  <nav>
                    <ul className="space-y-1">
                      {sectionMeta.map(({ key, label }) => {
                        const present = sectionStats?.flags[key] ?? false;
                        return (
                          <li key={key}>
                            <button
                              type="button"
                              onClick={() => scrollToSection(key)}
                              aria-label={`Jump to ${label} (${present ? "present" : "missing"})`}
                              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/60 transition-colors"
                            >
                              <span className="truncate">{label}</span>
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${present ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
                                title={present ? "Present" : "Missing"}
                              />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </nav>
                </CardContent>
              </Card>

              {diffOpen && diffEntries && diffSummary && filteredGroupedDiff && (
                <Card ref={diffCardRef}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                        Diff vs sample
                      </CardTitle>
                      <span className="text-[11px] text-muted-foreground">
                        {diffSummary.total === 0
                          ? "Identical"
                          : `+${diffSummary.added} ·  ~${diffSummary.changed} ·  −${diffSummary.removed}`}
                      </span>
                    </div>
                    {diffSummary.total > 0 && (
                      <div className="mt-2 relative">
                        <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          value={diffQuery}
                          onChange={(e) => setDiffQuery(e.target.value)}
                          placeholder="Search paths or values…"
                          className="w-full rounded-md border bg-background pl-7 pr-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {diffSummary.total === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Current manifest is identical to the bundled sample.
                      </p>
                    ) : filteredGroupedDiff.ordered.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No diff entries match <code className="font-mono">{diffQuery}</code>.
                      </p>
                    ) : (
                      <div className="text-xs max-h-72 overflow-auto space-y-3 font-mono">
                        {filteredGroupedDiff.ordered.map(([top, items]) => (
                          <div key={top}>
                            <p className="font-sans font-medium uppercase tracking-wide text-[10px] opacity-80">
                              {top}{" "}
                              <span className="opacity-70">({items.length})</span>
                            </p>
                            <ul className="mt-1 space-y-1">
                              {items.map((d, i) => {
                                const tone =
                                  d.kind === "added"
                                    ? "text-emerald-600"
                                    : d.kind === "removed"
                                    ? "text-rose-600"
                                    : "text-amber-600";
                                const sigil =
                                  d.kind === "added" ? "+" : d.kind === "removed" ? "−" : "~";
                                return (
                                  <li key={i} className="leading-snug">
                                    <span className={`${tone} font-semibold`}>{sigil}</span>{" "}
                                    <span>{d.path}</span>
                                    {d.kind === "changed" && (
                                      <div className="pl-4 text-muted-foreground">
                                        <span className="text-rose-600/80">−</span>{" "}
                                        {formatDiffValue(d.before)}
                                        <br />
                                        <span className="text-emerald-600/80">+</span>{" "}
                                        {formatDiffValue(d.after)}
                                      </div>
                                    )}
                                    {d.kind === "added" && (
                                      <div className="pl-4 text-emerald-700/80">
                                        + {formatDiffValue(d.after)}
                                      </div>
                                    )}
                                    {d.kind === "removed" && (
                                      <div className="pl-4 text-rose-700/80">
                                        − {formatDiffValue(d.before)}
                                      </div>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ))}
                        {filteredGroupedDiff.truncated > 0 && (
                          <p className="font-sans text-[11px] text-muted-foreground">
                            +{filteredGroupedDiff.truncated} more entr
                            {filteredGroupedDiff.truncated === 1 ? "y" : "ies"} hidden (capped at {DIFF_CAP}).
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </section>

        {/* PREVIEW */}
        <section className="manifest-print-target">
          {state.kind === "empty" && (
            <Card className="h-full border-dashed">
              <CardContent className="h-full min-h-[420px] flex flex-col items-center justify-center text-center p-10 gap-2">
                <FileJson className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">No manifest loaded</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Paste a manifest JSON on the left or upload a <code>.json</code> file.
                  The preview will render data-driven sections for any fields you provide.
                </p>
              </CardContent>
            </Card>
          )}

          {state.kind === "loading" && (
            <Card className="h-full">
              <CardContent className="h-full min-h-[420px] flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Validating…</span>
              </CardContent>
            </Card>
          )}

          {state.kind === "error" && (
            <Card className="h-full border-dashed">
              <CardContent className="h-full min-h-[420px] flex flex-col items-center justify-center text-center p-10 gap-2">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <p className="text-sm font-medium">Preview unavailable</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Fix the errors on the left, then re-validate.
                </p>
              </CardContent>
            </Card>
          )}

          {state.kind === "success" && <RenderManifest m={state.data} />}
        </section>
      </main>
    </div>
  );
}