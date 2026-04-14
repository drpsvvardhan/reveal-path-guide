// Client-side voice validation helpers — mirrors supabase/functions/_shared/framework_v2.ts
// Keep in sync manually; if they drift, add a shared-source build step.

export type ClusterTier = 'emerging' | 'tentative' | 'developing' | 'supported' | 'robust';

export const TIER_VOCABULARY_LICENSES: Record<ClusterTier, {
  allowed_verbs: string[];
  forbidden_verbs: string[];
  required_hedging?: string[];
}> = {
  robust: {
    allowed_verbs: ['shows', 'demonstrates', 'confirms', 'establishes', 'is'],
    forbidden_verbs: ['might', 'could', 'may suggest', 'is worth watching'],
  },
  supported: {
    allowed_verbs: ['shows', 'indicates', 'demonstrates', 'is consistent with'],
    forbidden_verbs: ['might', 'could be', 'is worth watching'],
  },
  developing: {
    allowed_verbs: ['indicates', 'is consistent with', 'suggests', 'points toward'],
    forbidden_verbs: ['confirms', 'establishes', 'is definitively'],
    required_hedging: ['the pattern has structure', 'evidence converges', 'consistent with', 'across'],
  },
  tentative: {
    allowed_verbs: ['suggests', 'points toward', 'is consistent with', 'may indicate'],
    forbidden_verbs: ['confirms', 'establishes', 'shows definitively', 'you have'],
    required_hedging: ['starting to', 'softly', 'early signal', 'pattern is forming'],
  },
  emerging: {
    allowed_verbs: ['hints at', 'is worth watching', 'might', 'could'],
    forbidden_verbs: ['shows', 'indicates', 'suggests', 'is consistent with', 'confirms'],
    required_hedging: ['hint', 'worth watching', 'too early', 'only', 'so far'],
  },
};

export const FORBIDDEN_VOCABULARY_GLOBAL: string[] = [
  'biotype', 'phenotype', 'metabolic type', 'inflammatory phenotype',
  'your biotype is', 'you fit the profile of', 'patients like you',
  'your archetype', "based on your pattern, you're a",
  'wellness journey', 'healing journey', 'transformation', 'holistic',
  'mindfulness', 'harmony', 'optimize your', 'wellness', 'thrive',
  'flourish', 'self-care', 'lifestyle upgrade',
  'the average person', 'the typical patient', 'most people',
  'the general population', 'compared to others',
  'your risk of', 'you will develop', 'this will lead to',
  'you are likely to', 'in x years you will',
  'you have diabetes', 'this means you are',
  'should stop', 'must stop', 'you need to', 'you must',
  'looks great', 'all clear', 'nothing to worry about',
  "you're doing amazing", "you're in trouble",
  'everything looks great',
];

export interface VocabularyViolation {
  sentence: string;
  cluster_id: string | null;
  cluster_tier: ClusterTier | null;
  rule_violated: 'global_forbidden' | 'tier_forbidden_verb' | 'tier_missing_hedging';
  matched_phrase: string;
  suggested_rephrase?: string;
}

export function validateVocabularyLicense(
  sentence: string,
  sourceClusterTier: ClusterTier | null,
  sourceClusterId: string | null,
): VocabularyViolation | null {
  const lowered = sentence.toLowerCase();

  for (const phrase of FORBIDDEN_VOCABULARY_GLOBAL) {
    if (lowered.includes(phrase.toLowerCase())) {
      return {
        sentence,
        cluster_id: sourceClusterId,
        cluster_tier: sourceClusterTier,
        rule_violated: 'global_forbidden',
        matched_phrase: phrase,
      };
    }
  }

  if (!sourceClusterTier) return null;

  const license = TIER_VOCABULARY_LICENSES[sourceClusterTier];

  for (const verb of license.forbidden_verbs) {
    if (lowered.includes(verb.toLowerCase())) {
      return {
        sentence,
        cluster_id: sourceClusterId,
        cluster_tier: sourceClusterTier,
        rule_violated: 'tier_forbidden_verb',
        matched_phrase: verb,
      };
    }
  }

  if (license.required_hedging && license.required_hedging.length > 0) {
    const hasHedging = license.required_hedging.some((phrase) =>
      lowered.includes(phrase.toLowerCase())
    );
    if (!hasHedging) {
      return {
        sentence,
        cluster_id: sourceClusterId,
        cluster_tier: sourceClusterTier,
        rule_violated: 'tier_missing_hedging',
        matched_phrase: '(no hedging phrase found)',
      };
    }
  }

  return null;
}

export interface ProseValidationResult {
  valid: boolean;
  violations: VocabularyViolation[];
  sentences_checked: number;
}

export function validateProseAgainstClusters(
  prose: string,
  clusterTierMap: Map<string, ClusterTier>,
  sentenceToClusterMap: Map<string, string | null>,
): ProseValidationResult {
  const cleanProse = prose.replace(/\{cluster:[^}]+\}/g, '');
  const sentences = cleanProse.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);

  const violations: VocabularyViolation[] = [];
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    const clusterId = sentenceToClusterMap.get(trimmed) ?? null;
    const tier = clusterId ? (clusterTierMap.get(clusterId) ?? null) : null;
    const violation = validateVocabularyLicense(trimmed, tier, clusterId);
    if (violation) violations.push(violation);
  }

  return {
    valid: violations.length === 0,
    violations,
    sentences_checked: sentences.length,
  };
}

export function stripClusterMarkers(prose: string): string {
  return prose.replace(/\s*\{cluster:[^}]+\}/g, '').replace(/\s{2,}/g, ' ').trim();
}

export function parseProseAndCitations(rawProse: string): {
  prose: string;
  sentenceToClusterMap: Map<string, string | null>;
} {
  const sentenceToClusterMap = new Map<string, string | null>();
  const sentences = rawProse.split(/(?<=[.!?])\s+/);

  for (const raw of sentences) {
    const markerMatch = raw.match(/\{cluster:([^}]+)\}[.!?]?\s*$/);
    const clusterId = markerMatch ? (markerMatch[1] === 'none' ? null : markerMatch[1]) : null;
    const cleanSentence = raw.replace(/\s*\{cluster:[^}]+\}[.!?]?\s*$/, '').trim();
    if (cleanSentence.length > 0) {
      sentenceToClusterMap.set(cleanSentence, clusterId);
    }
  }

  return { prose: rawProse, sentenceToClusterMap };
}
