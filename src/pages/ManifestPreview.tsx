import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Upload, FileJson, AlertCircle, CheckCircle2,
  RotateCcw, Sparkles, Download,
} from "lucide-react";
import {
  parseManifestJson,
  type FriendlyIssue,
  type ManifestPreview as ManifestData,
} from "@/lib/manifestSchema";
import {
  RenderManifest,
  sectionMeta,
  sectionAnchorId,
} from "@/components/manifest-preview/SectionRenderer";
import { sampleManifestPreview } from "@/lib/sampleManifestPreview";

type PreviewState =
  | { kind: "empty" }
  | { kind: "loading" }
  | { kind: "error"; parseError?: string; issues?: FriendlyIssue[] }
  | { kind: "success"; data: ManifestData };

const MAX_BYTES = 2 * 1024 * 1024; // 2MB safety cap for paste/upload

export default function ManifestPreviewPage() {
  const [text, setText] = useState("");
  const [state, setState] = useState<PreviewState>({ kind: "empty" });
  const fileRef = useRef<HTMLInputElement | null>(null);

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
    setText("");
    setState({ kind: "empty" });
    if (fileRef.current) fileRef.current.value = "";
  };

  const issuesByPath = useMemo(() => {
    if (state.kind !== "error" || !state.issues) return null;
    return state.issues;
  }, [state]);

  const onLoadSample = useCallback(() => {
    const raw = JSON.stringify(sampleManifestPreview, null, 2);
    setText(raw);
    validate(raw);
  }, [validate]);

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

  const scrollToSection = (key: string) => {
    const el = document.getElementById(sectionAnchorId(key));
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
            {state.kind === "success" && state.data.schema_version && (
              <Badge variant="secondary">
                schema v{state.data.schema_version}
              </Badge>
            )}
            <Badge variant="outline">Local preview · no data is sent</Badge>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* INPUT */}
        <section className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Input</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={onLoadSample}>
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Load sample manifest
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
                <Button size="sm" variant="ghost" onClick={onReset}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Clear
                </Button>
              </div>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder='{ "schema_version": "1.0.0", "patient": { "firstName": "...", "age": 0, "sex": "..." } }'
                className="font-mono text-xs min-h-[360px]"
                spellCheck={false}
              />
              <p className="text-[11px] text-muted-foreground">
                Required: <code>patient.firstName</code>, <code>patient.age</code>,{" "}
                <code>patient.sex</code>. Optional <code>schema_version</code> like <code>1.0.0</code>.
                All other sections are optional and render fallbacks when missing.
              </p>
            </CardContent>
          </Card>

          {state.kind === "error" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Validation failed</AlertTitle>
              <AlertDescription className="space-y-2 mt-1">
                {state.parseError && (
                  <p className="text-xs">{state.parseError}</p>
                )}
                {issuesByPath && issuesByPath.length > 0 && (
                  <ul className="text-xs space-y-1 max-h-48 overflow-auto">
                    {issuesByPath.map((iss, i) => (
                      <li key={i}>
                        <code className="font-mono">{iss.path}</code> — {iss.message}
                      </li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
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

              {/* Sticky section nav (shown alongside the input column on lg+). */}
              <Card className="lg:sticky lg:top-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                    Sections
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <nav>
                    <ul className="space-y-1">
                      {sectionMeta.map(({ key, label }) => {
                        const present = (state.data as Record<string, unknown>)[key] != null
                          || key === "patient";
                        return (
                          <li key={key}>
                            <button
                              type="button"
                              onClick={() => scrollToSection(key)}
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
            </>
          )}
        </section>

        {/* PREVIEW */}
        <section>
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