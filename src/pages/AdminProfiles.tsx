import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface ProfileRow {
  id: string;
  user_id: string;
  display_name: string | null;
  first_name: string | null;
  preferred_name: string | null;
  age: number | null;
  sex: string | null;
  signature_color: string | null;
  onboarding_step: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
  email: string | null;
  auth_created_at: string | null;
  last_sign_in_at: string | null;
  roles: string[];
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

const fmtRelative = (iso: string | null) => {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};

const AdminProfiles: React.FC = () => {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("admin-list-profiles");
        if (error) throw error;
        setProfiles(data?.profiles ?? []);
      } catch (e: any) {
        toast.error(`Failed to load profiles: ${e?.message ?? e}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) =>
      [p.display_name, p.first_name, p.preferred_name, p.email, p.user_id]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [profiles, search]);

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success("User ID copied");
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1360px] mx-auto px-6 py-8 md:px-10 md:py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-sans text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to app
        </Link>

        <div className="mb-6">
          <h1 className="font-serif text-3xl mb-1">All profiles</h1>
          <p className="text-sm text-muted-foreground font-sans">
            Admin view of every account on the platform.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 mb-4">
          <Input
            placeholder="Search by name, email, or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <p className="text-xs text-muted-foreground font-sans">
            {filtered.length} of {profiles.length}
          </p>
        </div>

        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Age / Sex</TableHead>
                  <TableHead>Onboarding</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead className="text-right">User ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const name = p.preferred_name || p.first_name || p.display_name || "—";
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {p.signature_color && (
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: p.signature_color }}
                            />
                          )}
                          <span className="font-sans text-sm">{name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-sans text-xs text-muted-foreground">
                        {p.email ?? "—"}
                      </TableCell>
                      <TableCell className="font-sans text-xs">
                        {p.age ?? "—"}{p.sex ? ` · ${p.sex}` : ""}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.onboarding_completed_at ? "secondary" : "outline"} className="text-[10px]">
                          {p.onboarding_completed_at ? "Complete" : (p.onboarding_step ?? "—")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {p.roles.length === 0 ? (
                            <span className="text-xs text-muted-foreground font-sans">user</span>
                          ) : (
                            p.roles.map((r) => (
                              <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-sans text-xs text-muted-foreground">
                        {fmtDate(p.auth_created_at ?? p.created_at)}
                      </TableCell>
                      <TableCell className="font-sans text-xs text-muted-foreground">
                        {fmtRelative(p.last_sign_in_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyId(p.user_id)}
                          className="h-7 px-2 font-mono text-[10px] text-muted-foreground"
                        >
                          {copiedId === p.user_id ? (
                            <Check className="h-3 w-3 mr-1" />
                          ) : (
                            <Copy className="h-3 w-3 mr-1" />
                          )}
                          {p.user_id.slice(0, 8)}…
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-sm text-muted-foreground font-sans">
                      No profiles found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminProfiles;
