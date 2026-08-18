import type { ScoringWeights, SourceDistribution, TrendDirection } from '@/types/transfer';

// ─── Default Configurable Weights ───────────────────────────────────────────

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  mentionVolume: 0.45,
  uniqueArticles: 0.25,
  sourceDiversity: 0.15,
  recency: 0.15,
};

const RECENCY_HALF_LIFE_DAYS = 3;
const MAX_VOLUME_CEILING = 20; // 20+ mentions gives full volume score

// ─── Pure Scoring Functions ─────────────────────────────────────────────────

/**
 * Calculate recency score with exponential decay.
 * Returns 0..1 where 1.0 is published just now and 0.0 is very old.
 */
export function calculateRecency(publishedAtStr: string): number {
  if (!publishedAtStr) return 0.5;

  const now = Date.now();
  const timestamp = new Date(publishedAtStr).getTime();

  if (isNaN(timestamp)) return 0.5;

  // Handle future-dated feeds gracefully
  if (timestamp > now) return 1.0;

  const ageDays = (now - timestamp) / (1000 * 60 * 60 * 24);
  const decay = Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);

  return Math.max(0, Math.min(1, decay));
}

/**
 * Calculate source diversity score based on unique source counts and channels.
 * Returns 0..1.
 */
export function calculateSourceDiversity(
  sourceCount: number,
  distribution: SourceDistribution,
): number {
  let channels = 0;
  if (distribution.rss > 0) channels++;
  if (distribution.press > 0) channels++;
  if (distribution.x > 0) channels++;
  if (distribution.forum > 0) channels++;

  const channelScore = Math.min(channels / 2, 1);
  const sourceCountScore = Math.min(sourceCount / 4, 1);

  return channelScore * 0.4 + sourceCountScore * 0.6;
}

/**
 * Calculate volume score with logarithmic scale.
 * Returns 0..1.
 */
export function calculateVolumeScore(mentionCount: number): number {
  if (mentionCount <= 0) return 0;
  const score = Math.log(mentionCount + 1) / Math.log(MAX_VOLUME_CEILING + 1);
  return Math.max(0, Math.min(1, score));
}

/**
 * Calculate unique articles score.
 * Returns 0..1.
 */
export function calculateUniqueArticlesScore(uniqueArticles: number): number {
  if (uniqueArticles <= 0) return 0;
  return Math.min(uniqueArticles / 10, 1);
}

/**
 * Trend calculation abstraction.
 * In Phase 1 without database persistence, returns NEUTRAL (0%).
 */
export function calculateTrend(
  currentCount: number,
  previousCount?: number,
): { trend: TrendDirection; trendPercentage: number } {
  if (previousCount === undefined || previousCount === null) {
    return { trend: 'NEUTRAL', trendPercentage: 0 };
  }

  if (previousCount === 0) {
    if (currentCount > 0) {
      return { trend: 'UP', trendPercentage: 100 };
    }
    return { trend: 'NEUTRAL', trendPercentage: 0 };
  }

  const delta = ((currentCount - previousCount) / previousCount) * 100;
  const rounded = Math.round(delta * 10) / 10;

  if (rounded > 10) {
    return { trend: 'UP', trendPercentage: Math.min(rounded, 500) };
  }
  if (rounded < -10) {
    return { trend: 'DOWN', trendPercentage: Math.max(rounded, -100) };
  }
  return { trend: 'NEUTRAL', trendPercentage: rounded };
}

/**
 * Calculate confidence score based on match certainty, Galatasaray context, and independent sources.
 * Returns 0..1.
 */
export function calculateConfidence(
  uniqueArticleCount: number,
  sourceCount: number,
  avgMatchConfidence: number,
): number {
  // HIGH: resolved player, >= 2 independent sources
  if (sourceCount >= 2 && avgMatchConfidence >= 0.85) {
    return Math.min(0.85 + uniqueArticleCount * 0.03, 1.0);
  }
  // MEDIUM: resolved player, single source with strong match
  if (avgMatchConfidence >= 0.8) {
    return Math.min(0.65 + (sourceCount - 1) * 0.1, 0.84);
  }
  // LOW: ambiguous or single low-confidence match
  return Math.max(0.3, avgMatchConfidence * 0.6);
}

/**
 * Composite rumor score calculator.
 * Returns normalized score between 0.00 and 1.00.
 */
export function calculateRumorScore(
  params: {
    mentionCount: number;
    uniqueArticleCount: number;
    sourceCount: number;
    distribution: SourceDistribution;
    latestPublishedAt: string;
  },
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
): {
  score: number;
  recencyScore: number;
  sourceDiversityScore: number;
} {
  const volumeScore = calculateVolumeScore(params.mentionCount);
  const articleScore = calculateUniqueArticlesScore(params.uniqueArticleCount);
  const sourceDiversityScore = calculateSourceDiversity(params.sourceCount, params.distribution);
  const recencyScore = calculateRecency(params.latestPublishedAt);

  const weighted =
    volumeScore * weights.mentionVolume +
    articleScore * weights.uniqueArticles +
    sourceDiversityScore * weights.sourceDiversity +
    recencyScore * weights.recency;

  const score = Math.round(Math.max(0, Math.min(1, weighted)) * 100) / 100;

  return {
    score,
    recencyScore: Math.round(recencyScore * 100) / 100,
    sourceDiversityScore: Math.round(sourceDiversityScore * 100) / 100,
  };
}
