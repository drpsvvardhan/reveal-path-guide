import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { invokeClinical } from "@/lib/clinicalFunctions";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, ShieldCheck, Ban, History } from "lucide-react";
import { toast } from "sonner";

interface ProfileOption {
  user_id: string;
  display_name: string | null;
  first_name: string | null;
  preferred_name: string | null;
  email: string | null;
}

interface Authorization {
  id: string;
  clinician_user_id: string;
  patient_user_id: string;
  clinician_name: string | null;
  patient_name: string | null;
  credential_reference: string;
  credential_attestation: string;
  granted_by: string;
  granted_at: string;
  expires_at: string;
  revoked_at: string | null;
  revocation_reason: string | null;
  status: "active" | "expired" | "revoked";
}

interface AuditRow {
  id: string;
  action: string;
  actor_user_id: string;
  occurred_at: string;
  detail: Record<string, unknown>;
}

const AdminClinicianAuthority: React.FC = () => {
  const queryClient = useQueryClient();
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [rows, setRows] = useState<Authorization[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [clinicianId, setClinicianId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [credential, setCredential] = useState("");
  const [attestation, setAttestation] = useState("");
  const [days, setDays] = useState("30");
  const [granting, setGranting] = useState(false);

  const [auditFor, setAuditFor] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);

  const call = <T,>(body: Record<string, unknown>) => invokeClinical<T>("clinician-authorization", body);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [list, people] = await Promise.all([
        call<{ authorizations: Authorization[] }>({ action: "list" }),
        invokeClinical<{ profiles: ProfileOption[] }>("admin-list-profiles"),
      ]);
      setRows(list.authorizations ?? []);
      setProfiles(people.profiles ?? []);
    } catch (e: any) {
      setRows([]);
      setProfiles([]);
      setLoadError(`Could not load review authority: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const labelFor = (p: ProfileOption) =>
    `${p.preferred_name || p.first_name || p.display_name || "Unnamed"}${p.email ? ` · ${p.email}` : ""}`;
  const sorted = useMemo(
    () => [...profiles].sort((a, b) => labelFor(a).localeCompare(labelFor(b))),
    [profiles],
  );

  const grant = async () => {
    setGranting(true);
    try {
      await call({
        action: "grant",
        clinician_user_id: clinicianId,
        patient_user_id: patientId,
        credential_reference: credential.trim(),
        credential_attestation: attestation.trim(),
        expires_in_days: Number(days),
      });
      toast.success("Clinician authorized for this patient.");
      void queryClient.invalidateQueries({ queryKey: ["clinical-work-access"] });
      setCredential("");
      setAttestation("");
      await load();
    } catch (e: any) {
      toast.error(`Could not authorize: ${e?.message ?? e}`);
    } finally {
      setGranting(false);
    }
  };

  const revoke = async (id: string) => {
    const reason = window.prompt("Reason for revoking this authority?");
    if (!reason || reason.trim().length < 3) return;
    try {
      await call({ action: "revoke", authorization_id: id, reason: reason.trim() });
      toast.success("Authority revoked.");
      void queryClient.invalidateQueries({ queryKey: ["clinical-work-access"] });
      await load();
    } catch (e: any) {
      toast.error(`Could not revoke: ${e?.message ?? e}`);
    }
  };

  const showAudit = async (id: string) => {
    if (auditFor === id) { setAuditFor(null); return; }
    try {
      const data = await call<{ audit: AuditRow[] }>({ action: "audit", authorization_id: id });
      setAudit(data.audit ?? []);
      setAuditFor(id);
    } catch (e: any) {
      toast.error(`Could not load the audit trail: ${e?.message ?? e}`);
    }
  };

  const badge = (status: Authorization["status"]) =>
    status === "active" ? "default" : status === "expired" ? "secondary" : "outline";

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-[1360px] space-y-8">
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="font-serif text-2xl">Clinical review authority</h1>
          <Link to="/admin/accounts" className="ml-auto text-sm text-muted-foreground hover:text-foreground">
            Accounts
          </Link>
        </div>

        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Administrative access alone never allows anyone to act on a paused intake.
          A clinician can only record a disposition for a patient you authorize here,
          for as long as the authorization lasts, and only after their credential has
          been checked by a person. Every grant and revocation is recorded.
        </p>

        {loadError && <Card role="alert" className="space-y-3 p-5"><p>{loadError}</p><Button variant="outline" onClick={load}>Try again</Button></Card>}

        <Card className="space-y-5 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="font-serif text-lg">Authorize a clinician for one patient</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Clinician</Label>
              <Select value={clinicianId} onValueChange={setClinicianId}>
                <SelectTrigger><SelectValue placeholder="Choose a clinician account" /></SelectTrigger>
                <SelectContent>
                  {sorted.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id} disabled={p.user_id === patientId}>{labelFor(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Patient</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger><SelectValue placeholder="Choose the patient" /></SelectTrigger>
                <SelectContent>
                  {sorted.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id} disabled={p.user_id === clinicianId}>{labelFor(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Credential-review reference</Label>
              <Input
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                placeholder="Licence or registration number checked"
              />
            </div>
            <div className="space-y-2">
              <Label>Expires in (days)</Label>
              <Input
                type="number" min={1} max={365}
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Who verified the credential, and how</Label>
              <Textarea
                value={attestation}
                onChange={(e) => setAttestation(e.target.value)}
                rows={3}
                placeholder="Named person, date, and what was checked against which register."
              />
            </div>
          </div>
          <Button
            onClick={grant}
            disabled={loading || !!loadError || granting || !clinicianId || !patientId || clinicianId === patientId || !Number.isInteger(Number(days)) || Number(days) < 1 || Number(days) > 365 || credential.trim().length < 3 || attestation.trim().length < 20}
            className="min-h-11"
          >
            {granting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Authorize for this patient
          </Button>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 font-serif text-lg">Authority register</h2>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading
            </div>
          ) : loadError ? null : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No clinician has been authorized yet. Nobody can act on a paused intake until you authorize them above.
            </p>
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => (
                <li key={r.id} className="rounded-md border border-border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.clinician_name ?? r.clinician_user_id}</span>
                    <span className="text-muted-foreground">for</span>
                    <span className="font-medium">{r.patient_name ?? r.patient_user_id}</span>
                    <Badge variant={badge(r.status)} className="uppercase">{r.status}</Badge>
                    <div className="ml-auto flex flex-wrap gap-2">
                      <Button variant="ghost" size="sm" className="min-h-11" onClick={() => showAudit(r.id)}>
                        <History className="mr-2 h-4 w-4" /> Trail
                      </Button>
                      {r.status === "active" && (
                        <Button variant="outline" size="sm" className="min-h-11" onClick={() => revoke(r.id)}>
                          <Ban className="mr-2 h-4 w-4" /> Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                  <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2">
                    <div>Credential: {r.credential_reference}</div>
                    <div>Expires: {new Date(r.expires_at).toLocaleString()}</div>
                    <div className="sm:col-span-2">Verified: {r.credential_attestation}</div>
                    {r.revoked_at && (
                      <div className="sm:col-span-2">
                        Revoked {new Date(r.revoked_at).toLocaleString()}
                        {r.revocation_reason ? ` — ${r.revocation_reason}` : ""}
                      </div>
                    )}
                  </dl>
                  {auditFor === r.id && (
                    <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
                      {audit.map((a) => (
                        <li key={a.id}>
                          {new Date(a.occurred_at).toLocaleString()} — {a.action}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminClinicianAuthority;
