import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";
import { ClusterRow, ClusterTier } from "@/types/clusters";

const TIER_ORDER: Record<ClusterTier, number> = {
  robust: 1,
  supported: 2,
  developing: 3,
  tentative: 4,
  emerging: 5,
};

export function useClusters(): {
  clusters: ClusterRow[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const { user } = useAuth();
  const { effectiveUserId } = useViewAs();
  const [clusters, setClusters] = useState<ClusterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = effectiveUserId || user?.id;

  const fetchClusters = useCallback(async () => {
    if (!userId) {
      setClusters([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Look up profile id — clusters use profiles.id as patient_id
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) {
        setClusters([]);
        setLoading(false);
        return;
      }

      const { data, error: clusterError } = await supabase
        .from("clusters")
        .select("*")
        .eq("patient_id", profile.id)
        .eq("status", "active")
        .order("confidence_score", { ascending: false });

      if (clusterError) throw clusterError;

      // Sort by tier descending, then confidence_score descending within tier
      const sorted = (data || [])
        .map((row) => ({
          ...row,
          constituent_evidence: Array.isArray(row.constituent_evidence) ? row.constituent_evidence : [],
          coherence_signals: Array.isArray(row.coherence_signals) ? row.coherence_signals : [],
          tensions_held: Array.isArray(row.tensions_held) ? row.tensions_held : [],
          missing_evidence: Array.isArray(row.missing_evidence) ? row.missing_evidence : [],
          confidence_dimensions: (row.confidence_dimensions && typeof row.confidence_dimensions === "object")
            ? row.confidence_dimensions as any
            : { breadth: 0, depth: 0, time: 0, coherence_strength: 0, missing_data_penalty: 0 },
        } as unknown as ClusterRow))
        .sort((a, b) => {
          const tierDiff = TIER_ORDER[a.confidence_tier] - TIER_ORDER[b.confidence_tier];
          if (tierDiff !== 0) return tierDiff;
          return b.confidence_score - a.confidence_score;
        });

      setClusters(sorted);
    } catch (err: any) {
      setError(err.message || "Failed to load clusters");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

  return { clusters, loading, error, refetch: fetchClusters };
}
