import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Activity, Eye, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { color: string; label: string }> = {
  attention: { color: "bg-destructive/15 text-destructive border-destructive/20", label: "Attention" },
  coherent: { color: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Coherent" },
  monitor: { color: "bg-amber-100 text-amber-700 border-amber-200", label: "Monitor" },
};

const trafficDot: Record<string, string> = {
  RED: "bg-red-500", ORANGE: "bg-orange-500", YELLOW: "bg-amber-500", GREEN: "bg-emerald-500",
};

const ClinicalShare: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [cs, setCs] = useState<any>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        // Find user by terrain_share_token
        const { data: profile, error: pErr } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("terrain_share_token", token)
          .maybeSingle();

        if (pErr) throw pErr;
        if (!profile) { setError("Invalid or expired link."); return; }

        // Fetch active terrain render
        const { data: render, error: rErr } = await supabase
          .from("terrain_renders")
          .select("clinician_summary, generated_at")
          .eq("user_id", profile.user_id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (rErr) throw rErr;
        if (!render?.clinician_summary) { setError("No clinical summary available yet."); return; }

        setCs(render.clinician_summary as any);
        setGeneratedAt(render.generated_at);
      } catch (e: any) {
        setError(e.message || "Failed to load summary.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F5F2]">
        <Loader2 className="h-6 w-6 animate-spin text-[#3A2F3F]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F5F2] px-6">
        <div className="text-center max-w-md">
          <p className="font-serif text-xl text-[#3A2F3F] mb-2">Unable to load summary</p>
          <p className="text-sm text-[#5B4A5F]">{error}</p>
        </div>
      </div>
    );
  }

  const dateStr = generatedAt ? new Date(generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Unknown date";

  return (
    <div className="min-h-screen bg-[#F7F5F2] text-[#1E1A1F]">
      {/* Header */}
      <header className="border-b border-[#D9D5CF] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="font-serif text-lg font-medium text-[#3A2F3F] tracking-tight">Vizzhy</span>
          <span className="text-xs text-[#5B4A5F]">Clinical terrain summary</span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <h1 className="font-serif text-2xl text-[#3A2F3F]">Clinical handoff</h1>

        {/* Terrain overview */}
        <p className="text-base text-[#1E1A1F]/85 leading-relaxed">{cs.terrain_overview}</p>

        {/* Axis breakdown */}
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5B4A5F] mb-3 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Axis breakdown
          </h3>
          <div className="divide-y divide-[#D9D5CF] rounded-xl border border-[#D9D5CF] bg-white overflow-hidden">
            {cs.axis_breakdown?.map((ax: any, i: number) => {
              const sc = statusConfig[ax.status] || statusConfig.monitor;
              return (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <span className="font-semibold text-sm text-[#1E1A1F] min-w-[120px] shrink-0">{ax.axis}</span>
                  <span className="text-sm text-[#5B4A5F] flex-1 leading-relaxed">{ax.interpretation}</span>
                  <Badge className={`${sc.color} text-[10px] shrink-0`}>{sc.label}</Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Perception gaps */}
        {cs.perception_gaps?.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5B4A5F] flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" /> Perception gaps
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {cs.perception_gaps.map((gap: any, i: number) => (
                <div key={i} className="rounded-xl border border-[#D9D5CF] bg-white p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{gap.domain}</span>
                    <span className="text-xs text-[#5B4A5F]">Score: {gap.patient_score}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${trafficDot[gap.gate_traffic_light] || trafficDot.YELLOW}`} />
                    <span className="text-xs text-[#5B4A5F]">{gap.gate}</span>
                  </div>
                  <p className="text-xs text-[#5B4A5F] leading-relaxed">{gap.summary}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggested questions */}
        {cs.suggested_questions?.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5B4A5F] flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" /> Questions for the next encounter
            </h3>
            <div className="rounded-xl border border-[#D9D5CF] bg-white divide-y divide-[#D9D5CF] overflow-hidden">
              {cs.suggested_questions.map((q: string, i: number) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <span className="text-xs font-semibold text-[#5B4A5F] mt-0.5 min-w-[20px]">{i + 1}.</span>
                  <span className="text-sm flex-1 leading-relaxed">{q}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#D9D5CF] px-6 py-6 mt-8">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs text-[#5B4A5F] leading-relaxed">
            This summary was generated by Vizzhy on {dateStr}. The patient's terrain updates as new data arrives — bookmark this link to always see the most recent version.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default ClinicalShare;
