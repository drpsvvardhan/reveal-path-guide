import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, UserPlus, Upload, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface ProfileOption {
  user_id: string;
  display_name: string | null;
  first_name: string | null;
  preferred_name: string | null;
  email: string | null;
}

const randomPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
};

const readJsonFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsText(file);
  });

const AdminAccounts: React.FC = () => {
  /* ── create account ───────────────────────────────────────────────── */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(randomPassword);
  const [displayName, setDisplayName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [role, setRole] = useState("user");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  /* ── twin upload ──────────────────────────────────────────────────── */
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [targetUserId, setTargetUserId] = useState("");
  const [mode, setMode] = useState<"compiled" | "raw">("compiled");
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [twinFile, setTwinFile] = useState<File | null>(null);
  const [decisionFile, setDecisionFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const [cieFile, setCieFile] = useState<File | null>(null);
  const [cieTakenAt, setCieTakenAt] = useState("");
  const [cieUploading, setCieUploading] = useState(false);
  const [cieResult, setCieResult] = useState<Record<string, unknown> | null>(null);

  const loadProfiles = async () => {
    setLoadingProfiles(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-list-profiles");
      if (error) throw error;
      setProfiles(data?.profiles ?? []);
    } catch (e: any) {
      toast.error(`Could not load accounts: ${e?.message ?? e}`);
    } finally {
      setLoadingProfiles(false);
    }
  };

  useEffect(() => { loadProfiles(); }, []);

  const labelFor = (p: ProfileOption) =>
    `${p.preferred_name || p.first_name || p.display_name || "Unnamed"}${p.email ? ` · ${p.email}` : ""}`;

  const sortedProfiles = useMemo(
    () => [...profiles].sort((a, b) => labelFor(a).localeCompare(labelFor(b))),
    [profiles],
  );

  const createAccount = async () => {
    if (!email.trim() || password.length < 10) {
      toast.error("An email and a password of at least 10 characters are required.");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-account", {
        body: {
          email: email.trim(),
          password,
          display_name: displayName.trim() || null,
          first_name: firstName.trim() || null,
          age: age ? Number(age) : null,
          sex: sex || null,
          role,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.message ?? data.error);
      toast.success("Account created and confirmed.");
      setTargetUserId(data.user_id);
      setEmail("");
      setDisplayName("");
      setFirstName("");
      setAge("");
      setSex("");
      setRole("user");
      await loadProfiles();
    } catch (e: any) {
      toast.error(`Could not create account: ${e?.message ?? e}`);
    } finally {
      setCreating(false);
    }
  };

  const uploadTwin = async () => {
    if (!targetUserId) {
      toast.error("Choose the account this Twin belongs to.");
      return;
    }
    setUploading(true);
    setResult(null);
    try {
      const body: Record<string, unknown> = { user_id: targetUserId };
      if (mode === "compiled") {
        if (!reportFile) throw new Error("Select the compiled clinical evidence report.");
        body.report = JSON.parse(await readJsonFile(reportFile));
      } else {
        if (!twinFile || !decisionFile) {
          throw new Error("Select both the raw v18 Twin and its release decision.");
        }
        // The raw bytes must be passed through untouched — the compiler binds
        // the release decision to this exact text by SHA-256.
        body.runtime_twin_json = await readJsonFile(twinFile);
        body.release_decision = JSON.parse(await readJsonFile(decisionFile));
      }

      const { data, error } = await supabase.functions.invoke("admin-import-biotwin", { body });
      if (error) throw error;
      setResult(data ?? null);
      if (data?.imported) {
        toast.success(`Imported as version ${data.version}.`);
      } else if (data?.idempotent) {
        toast.info("That exact report was already imported. Nothing changed.");
      } else {
        toast.error(data?.message ?? data?.error ?? "Not imported. See diagnostics below.");
      }
    } catch (e: any) {
      toast.error(`Upload failed: ${e?.message ?? e}`);
    } finally {
      setUploading(false);
    }
  };

  const uploadCie = async () => {
    if (!targetUserId) {
      toast.error("Choose the account this CIE belongs to.");
      return;
    }
    if (!cieFile) {
      toast.error("Select the factory CIE export (question.json).");
      return;
    }
    setCieUploading(true);
    setCieResult(null);
    try {
      const body: Record<string, unknown> = {
        user_id: targetUserId,
        cie_json: JSON.parse(await readJsonFile(cieFile)),
      };
      if (cieTakenAt) body.taken_at = cieTakenAt;

      const { data, error } = await supabase.functions.invoke("admin-import-cie", { body });
      if (error) throw error;
      setCieResult(data ?? null);
      if (data?.imported) {
        toast.success(`CIE imported as assessment version ${data.version}.`);
      } else {
        toast.error(data?.message ?? data?.error ?? "Not imported. See diagnostics below.");
      }
    } catch (e: any) {
      toast.error(`CIE upload failed: ${e?.message ?? e}`);
    } finally {
      setCieUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1360px] mx-auto px-5 py-8 md:px-10 md:py-12 min-w-0">
        <Link
          to="/admin/profiles"
          className="inline-flex items-center gap-2 text-xs font-sans text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All profiles
        </Link>

        <div className="mb-8">
          <h1 className="font-serif text-3xl mb-1">Provision accounts and Twins</h1>
          <p className="text-sm text-muted-foreground font-sans max-w-prose">
            Create a confirmed account for a new outlay, then install its Twin. Imports are
            deterministic — the report is read exactly as written and never interpreted by a model.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 min-w-0">
          {/* ── create account ─────────────────────────────────────────── */}
          <Card className="p-5 min-w-0">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="h-4 w-4 text-muted-foreground shrink-0" />
              <h2 className="font-serif text-lg">New account</h2>
            </div>

            <div className="space-y-4 min-w-0">
              <div>
                <Label className="font-sans text-xs">Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="patient@example.com"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="font-sans text-xs">Temporary password</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="flex-1 min-w-[200px] font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(password);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    className="min-h-[44px]"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPassword(randomPassword())}
                    className="min-h-[44px] font-sans text-xs"
                  >
                    Regenerate
                  </Button>
                </div>
                <p className="mt-1 font-sans text-[11px] text-muted-foreground">
                  Share it with the person directly; they can change it from Account.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 min-w-0">
                <div>
                  <Label className="font-sans text-xs">Display name</Label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="font-sans text-xs">First name</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="font-sans text-xs">Age</Label>
                  <Input
                    type="number"
                    min={1}
                    max={129}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="font-sans text-xs">Sex</Label>
                  <Select value={sex} onValueChange={setSex}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Not set" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female">female</SelectItem>
                      <SelectItem value="male">male</SelectItem>
                      <SelectItem value="other">other</SelectItem>
                      <SelectItem value="prefer_not_to_say">prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="font-sans text-xs">Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">user (patient)</SelectItem>
                    <SelectItem value="moderator">moderator</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={createAccount} disabled={creating} className="min-h-[44px] w-full">
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                Create account
              </Button>
            </div>
          </Card>

          {/* ── upload twin ────────────────────────────────────────────── */}
          <Card className="p-5 min-w-0">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
              <h2 className="font-serif text-lg">Install a Twin</h2>
            </div>

            <div className="space-y-4 min-w-0">
              <div>
                <Label className="font-sans text-xs">Account</Label>
                <Select value={targetUserId} onValueChange={setTargetUserId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={loadingProfiles ? "Loading accounts…" : "Choose an account"} />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedProfiles.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{labelFor(p)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={mode === "compiled" ? "default" : "outline"}
                  onClick={() => setMode("compiled")}
                  className="min-h-[44px] font-sans text-xs"
                >
                  Compiled report
                </Button>
                <Button
                  type="button"
                  variant={mode === "raw" ? "default" : "outline"}
                  onClick={() => setMode("raw")}
                  className="min-h-[44px] font-sans text-xs"
                >
                  Raw v18 + decision
                </Button>
              </div>

              {mode === "compiled" ? (
                <div>
                  <Label className="font-sans text-xs">Clinical evidence report (JSON)</Label>
                  <Input
                    type="file"
                    accept="application/json,.json"
                    onChange={(e) => setReportFile(e.target.files?.[0] ?? null)}
                    className="mt-1"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label className="font-sans text-xs">RUNTIME_TWIN_FINAL v18 (JSON)</Label>
                    <Input
                      type="file"
                      accept="application/json,.json"
                      onChange={(e) => setTwinFile(e.target.files?.[0] ?? null)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="font-sans text-xs">Release decision (JSON)</Label>
                    <Input
                      type="file"
                      accept="application/json,.json"
                      onChange={(e) => setDecisionFile(e.target.files?.[0] ?? null)}
                      className="mt-1"
                    />
                  </div>
                  <p className="font-sans text-[11px] text-muted-foreground break-words">
                    The decision must be bound to these exact Twin bytes. A hash mismatch is
                    refused rather than compiled.
                  </p>
                </div>
              )}

              <Button onClick={uploadTwin} disabled={uploading} className="min-h-[44px] w-full">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                {mode === "compiled" ? "Import report" : "Compile and import"}
              </Button>

              {result && (
                <div className="rounded-md border border-border bg-muted/30 p-3 min-w-0 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={result.imported ? "secondary" : "outline"} className="text-[10px]">
                      {result.imported ? "imported" : result.idempotent ? "already imported" : "not imported"}
                    </Badge>
                    {typeof result.statement_count === "number" && (
                      <Badge variant="outline" className="text-[10px]">
                        {result.statement_count} statements
                      </Badge>
                    )}
                    {typeof result.witnesses_created === "number" && (
                      <Badge variant="outline" className="text-[10px]">
                        {result.witnesses_created} witnesses
                      </Badge>
                    )}
                    {result.clinician_review_required ? (
                      <Badge variant="outline" className="text-[10px]">clinician review required</Badge>
                    ) : null}
                  </div>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] text-muted-foreground">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </Card>

          {/* ── import completed CIE ───────────────────────────────────── */}
          <Card className="p-5 min-w-0">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
              <h2 className="font-serif text-lg">Import a completed CIE</h2>
            </div>

            <div className="space-y-4 min-w-0">
              <p className="font-sans text-xs text-muted-foreground break-words">
                Bootstrap an assessment already taken in the factory pipeline
                (question.json) for the account selected above — the patient
                never retakes Layer 1. Factory scores are imported exactly as
                scored; in-app retakes remain available and version alongside.
              </p>

              <div>
                <Label className="font-sans text-xs">Factory CIE export (question.json)</Label>
                <Input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => setCieFile(e.target.files?.[0] ?? null)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="font-sans text-xs">Date taken (optional)</Label>
                <Input
                  type="date"
                  value={cieTakenAt}
                  onChange={(e) => setCieTakenAt(e.target.value)}
                  className="mt-1"
                />
                <p className="mt-1 font-sans text-[11px] text-muted-foreground">
                  The intake date, if known — it becomes the assessment's
                  biological timestamp. Left empty, the import date is used.
                </p>
              </div>

              <Button onClick={uploadCie} disabled={cieUploading} className="min-h-[44px] w-full">
                {cieUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                Import CIE
              </Button>

              {cieResult && (
                <div className="rounded-md border border-border bg-muted/30 p-3 min-w-0 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={cieResult.imported ? "secondary" : "outline"} className="text-[10px]">
                      {cieResult.imported ? "imported" : "not imported"}
                    </Badge>
                    {typeof cieResult.responses === "number" && (
                      <Badge variant="outline" className="text-[10px]">
                        {cieResult.responses} responses
                      </Badge>
                    )}
                    {typeof cieResult.version === "number" && (
                      <Badge variant="outline" className="text-[10px]">
                        version {cieResult.version}
                      </Badge>
                    )}
                  </div>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] text-muted-foreground">
                    {JSON.stringify(cieResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminAccounts;