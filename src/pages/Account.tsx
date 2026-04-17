import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

const SIGNATURE_COLORS = [
  { value: "ember", label: "Ember", swatch: "hsl(15 75% 55%)" },
  { value: "moss", label: "Moss", swatch: "hsl(140 35% 40%)" },
  { value: "tide", label: "Tide", swatch: "hsl(200 55% 45%)" },
  { value: "iris", label: "Iris", swatch: "hsl(265 45% 55%)" },
  { value: "sand", label: "Sand", swatch: "hsl(35 50% 55%)" },
];

export default function Account() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState<string>("");
  const [sex, setSex] = useState<string>("");
  const [signatureColor, setSignatureColor] = useState<string>("");
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "first_name, preferred_name, display_name, age, sex, signature_color, created_at"
        )
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        toast.error("Could not load your profile");
      } else if (data) {
        setFirstName(data.first_name ?? "");
        setPreferredName(data.preferred_name ?? "");
        setDisplayName(data.display_name ?? "");
        setAge(data.age != null ? String(data.age) : "");
        setSex(data.sex ?? "");
        setSignatureColor(data.signature_color ?? "");
        setCreatedAt(data.created_at);
      }
      setLoading(false);
    })();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const ageNum = age.trim() ? Number(age) : null;
    if (ageNum !== null && (Number.isNaN(ageNum) || ageNum <= 0 || ageNum >= 130)) {
      toast.error("Age must be between 1 and 129");
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName.trim() || null,
        preferred_name: preferredName.trim() || null,
        display_name: displayName.trim() || null,
        age: ageNum,
        sex: sex || null,
        signature_color: signatureColor || null,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Could not save changes", { description: error.message });
    } else {
      toast.success("Profile updated");
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Sign in to manage your account.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4 sticky top-0 bg-background/90 backdrop-blur-sm z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-sans"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <span className="font-serif text-base">Account</span>
          <button
            onClick={() => signOut()}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors font-sans"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-10">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <h1 className="font-serif text-2xl">Your details</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                These shape how the system speaks to you and how clinicians read your
                terrain. Demographics are also embedded in any clinician export.
              </p>
            </section>

            <section className="rounded-xl border border-border bg-card p-5 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-sans">
                Signed in as
              </p>
              <p className="font-sans text-sm text-foreground">{user.email}</p>
              {createdAt && (
                <p className="text-[10px] text-muted-foreground font-sans pt-1">
                  Member since {new Date(createdAt).toLocaleDateString()}
                </p>
              )}
            </section>

            <section className="space-y-5">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-sans">
                Identity
              </h2>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="first_name" className="text-xs">First name</Label>
                  <Input
                    id="first_name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Vishnu"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="preferred_name" className="text-xs">Preferred name</Label>
                  <Input
                    id="preferred_name"
                    value={preferredName}
                    onChange={(e) => setPreferredName(e.target.value)}
                    placeholder="What we should call you"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="display_name" className="text-xs">
                  Full name <span className="text-muted-foreground">(used for lab identity matching)</span>
                </Label>
                <Input
                  id="display_name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="As it appears on your lab reports"
                />
              </div>
            </section>

            <section className="space-y-5">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-sans">
                Demographics
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="age" className="text-xs">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={129}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="—"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sex" className="text-xs">Sex</Label>
                  <Select value={sex} onValueChange={setSex}>
                    <SelectTrigger id="sex">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-sans">
                Signature color
              </h2>
              <p className="text-xs text-muted-foreground">
                Your accent color across visualizations. Picks one that feels like you.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {SIGNATURE_COLORS.map((c) => {
                  const active = signatureColor === c.value;
                  return (
                    <button
                      key={c.value}
                      onClick={() => setSignatureColor(c.value)}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-sans transition-all ${
                        active
                          ? "border-foreground bg-muted/50"
                          : "border-border hover:border-foreground/50"
                      }`}
                      type="button"
                    >
                      <span
                        className="h-3.5 w-3.5 rounded-full ring-1 ring-border"
                        style={{ background: c.swatch }}
                      />
                      {c.label}
                      {active && <Check className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="pt-4 flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
