import { ClusterRow, ClusterTier } from "@/types/clusters";

export function averageCoherence(clusters: ClusterRow[]): number | null {
  if (clusters.length === 0) return null;
  const sum = clusters.reduce(
    (acc, c) => acc + (c.confidence_dimensions?.coherence_strength ?? 0),
    0
  );
  return sum / clusters.length;
}

export function totalTensions(clusters: ClusterRow[]): {
  totalTensions: number;
  clustersWithTensions: number;
} {
  const total = clusters.reduce((acc, c) => acc + c.tensions_held.length, 0);
  const withTensions = clusters.filter((c) => c.tensions_held.length > 0).length;
  return { totalTensions: total, clustersWithTensions: withTensions };
}

export function tierDistribution(clusters: ClusterRow[]): Record<ClusterTier, number> {
  const counts: Record<ClusterTier, number> = {
    emerging: 0,
    tentative: 0,
    developing: 0,
    supported: 0,
    robust: 0,
  };
  clusters.forEach((c) => {
    counts[c.confidence_tier]++;
  });
  return counts;
}

export function topMissingData(
  clusters: ClusterRow[],
  topN: number = 3
): Array<{ item: string; count: number }> {
  const counts = new Map<string, number>();
  clusters.forEach((c) => {
    c.missing_evidence.forEach((m) => {
      const key = m.item.trim().toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([item, count]) => ({ item, count }));
}
