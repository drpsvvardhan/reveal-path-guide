import React, { useState } from "react";
import { useTerrainRender } from "@/context/TerrainRenderContext";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Check, Share2, AlertCircle, Activity, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const statusConfig: Record<string, { color: string; label: string }> = {
  attention: { color: "bg-destructive/15 text-destructive border-destructive/20", label: "Attention" },
  coherent: { color: "bg-[hsl(var(--teal-light))] text-[hsl(var(--teal))] border-[hsl(var(--teal))]/20", label: "Coherent" },
  monitor: { color: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20", label: "Monitor" },
};

const trafficDot: Record<string, string> = {
  RED: "bg-destructive",
  ORANGE: "bg-[hsl(var(--warning))]",
  YELLOW: "bg-[hsl(var(--amber))]",
  GREEN: "bg-[hsl(var(--teal))]",
};

const ClinicalHandoffPanel: React.FC = () => {
  const { activeRender } = useTerrainRender();
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);

  const cs = activeRender?.clinician_summary;
  if (!cs) return null;

  const handleShare = async () => {
    setSharing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/get-or-create-terrain-share-token`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!res.ok) throw new Error("Failed to get share token");
      const { token } = await res.json();
      const url = `${window.location.origin}/clinical/${token}`;
      await navigator.clipboard.writeText(url);
      toast.success("Link copied. Send this to your physician — they can read your terrain summary on any device, no login required.");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate share link");
    } finally {
      setSharing(false);
    }
  };

  const copyQuestion = async (q: string, idx: number) => {
    await navigator.clipboard.writeText(q);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl text-foreground">Clinical handoff</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          disabled={sharing}
          className="gap-2"
        >
          <Share2 className="h-3.5 w-3.5" />
          {sharing ? "Generating…" : "Share with your physician"}
        </Button>
      </div>

      {/* Block 1: Terrain overview */}
      <p className="text-base text-foreground/85 leading-relaxed">{cs.terrain_overview}</p>

      {/* Block 2: Axis breakdown */}
      <div className="space-y-1">
        <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" /> Axis breakdown
        </h3>
        <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
          {cs.axis_breakdown?.map((ax: any, i: number) => {
            const sc = statusConfig[ax.status] || statusConfig.monitor;
            return (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <span className="font-sans font-semibold text-sm text-foreground min-w-[120px] shrink-0">{ax.axis}</span>
                <span className="text-sm text-muted-foreground flex-1 leading-relaxed">{ax.interpretation}</span>
                <Badge className={`${sc.color} text-[10px] shrink-0`}>{sc.label}</Badge>
              </div>
            );
          })}
        </div>
      </div>

      {/* Block 3: Perception gaps */}
      {cs.perception_gaps?.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" /> Perception gaps
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {cs.perception_gaps.map((gap: any, i: number) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-sans font-semibold text-sm text-foreground">{gap.domain}</span>
                  <span className="text-xs text-muted-foreground">Score: {gap.patient_score}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${trafficDot[gap.gate_traffic_light] || trafficDot.YELLOW}`} />
                  <span className="text-xs text-muted-foreground">{gap.gate}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{gap.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Block 4: Suggested questions */}
      {cs.suggested_questions?.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" /> Questions for the next encounter
          </h3>
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {cs.suggested_questions.map((q: string, i: number) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 group">
                <span className="text-xs font-sans font-semibold text-muted-foreground mt-0.5 min-w-[20px]">{i + 1}.</span>
                <span className="text-sm text-foreground flex-1 leading-relaxed">{q}</span>
                <button
                  onClick={() => copyQuestion(q, i)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                  title="Copy question"
                >
                  {copiedIdx === i ? (
                    <Check className="h-3.5 w-3.5 text-[hsl(var(--teal))]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClinicalHandoffPanel;
