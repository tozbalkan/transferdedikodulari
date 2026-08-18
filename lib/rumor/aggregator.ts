import type {
  NewsItem,
  Player,
  RumorSourceInfo,
  SourceDistribution,
  TransferRumor,
  RumorsApiMeta,
} from '@/types/transfer';
import { fetchAllFeeds } from '@/lib/news/rss';
import { FALLBACK_REAL_NEWS } from '@/lib/news/fallback-news';
import { deduplicateArticles, isGalatasarayRelevant, type TransferDirection } from '@/lib/news/parser';
import { matchPlayer, extractCandidateNames } from '@/lib/players/matcher';
import { globalPlayerRegistry } from '@/lib/players/registry';
import { calculateConfidence, calculateRumorScore, calculateTrend } from '@/lib/rumor/scorer';
import { GALATASARAY_CURRENT_SQUAD_2025 } from '@/lib/players/squad-data';
import { SerperSearchNewsAdapter } from '@/lib/news/search-adapter';

export const RUMOR_WINDOW_DAYS = 7;

export type RejectionReason =
  | 'CURRENT_SQUAD'
  | 'OUTGOING'
  | 'STALE'
  | 'LOW_CONFIDENCE'
  | 'UNRESOLVED_PLAYER'
  | 'NOT_TRANSFER_INTENT'
  | 'DUPLICATE';

export interface RejectedRumorDiagnostic {
  playerName: string;
  reason: RejectionReason;
  details: string;
}

export interface AggregationResult {
  rumors: TransferRumor[];
  meta: RumorsApiMeta;
  diagnostics?: {
    fetchedArticles: number;
    transferRelevantArticles: number;
    uniqueArticles: number;
    currentSquadSize: number;
    activeIncomingRumors: number;
    activeOutgoingRumors: number;
    rejected: RejectedRumorDiagnostic[];
  };
}

interface PlayerArticleBucket {
  player: Player;
  direction: TransferDirection;
  articles: Array<{
    id: string;
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    summary: string;
    sourceCount: number;
    sources: string[];
    matchConfidence: number;
    direction: TransferDirection;
  }>;
}

/**
 * Pure function to check if a transfer rumor is an active, valid INCOMING transfer rumor.
 */
export function isActiveIncomingRumor(
  rumor: TransferRumor,
  currentSquad: string[] = GALATASARAY_CURRENT_SQUAD_2025,
  windowDays: number = RUMOR_WINDOW_DAYS,
): { isActive: boolean; reason?: RejectionReason; details?: string } {
  // 1. Check if player is currently in Galatasaray squad
  const isCurrentPlayer = currentSquad.some(
    (name) => name.toLowerCase() === rumor.player.name.toLowerCase(),
  );

  if (isCurrentPlayer) {
    return {
      isActive: false,
      reason: 'CURRENT_SQUAD',
      details: `${rumor.player.name} is already a current Galatasaray squad member.`,
    };
  }

  // 2. Check recency window
  const latestDate = rumor.latestNews[0]?.publishedAt
    ? new Date(rumor.latestNews[0].publishedAt).getTime()
    : 0;
  const now = Date.now();
  const maxAgeMs = windowDays * 24 * 60 * 60 * 1000;

  if (latestDate > 0 && now - latestDate > maxAgeMs) {
    return {
      isActive: false,
      reason: 'STALE',
      details: `Latest article is older than ${windowDays} days.`,
    };
  }

  // 3. Check confidence threshold
  if ((rumor.confidenceScore ?? 0) < 0.35) {
    return {
      isActive: false,
      reason: 'LOW_CONFIDENCE',
      details: `Confidence score (${rumor.confidenceScore}) below threshold (0.35).`,
    };
  }

  return { isActive: true };
}

/**
 * Execute the complete live real data pipeline:
 * Live RSS + Search Feeds -> Deduplication -> Intent/Direction Classification -> Player Resolution -> Squad Filtering -> Scoring
 */
export async function aggregateLiveRumors(): Promise<AggregationResult> {
  const rejectedDiagnostics: RejectedRumorDiagnostic[] = [];

  // Step 1: Fetch raw feeds from RSS
  const { items: rawNewsItems, health: sourceHealth } = await fetchAllFeeds();

  // Step 2: Attempt SearchNewsAdapter queries if configured
  const searchAdapter = new SerperSearchNewsAdapter();
  const searchArticles = await searchAdapter.fetchArticles('Galatasaray transfer haberleri', RUMOR_WINDOW_DAYS);

  const combinedRawItems = [...rawNewsItems, ...searchArticles];

  // If live network feeds return 0 items (e.g. offline/DNS timeout), use verified real news archive
  const activeNewsItems = combinedRawItems.length > 0 ? combinedRawItems : FALLBACK_REAL_NEWS;

  // Step 3: Filter for Galatasaray relevance and transfer intent
  const relevantRawItems = activeNewsItems.filter((item) => {
    const content = 'content' in item ? item.content : undefined;
    const rel = isGalatasarayRelevant(item.title, item.summary, content);
    if (!rel.isRelevant) {
      if (!rel.hasTransferIntent) {
        rejectedDiagnostics.push({
          playerName: 'Unknown',
          reason: 'NOT_TRANSFER_INTENT',
          details: item.title,
        });
      }
    }
    return rel.isRelevant;
  });

  // Step 4: Deduplicate multi-source news articles
  const uniqueArticles = deduplicateArticles(relevantRawItems);

  // Step 5: Initialize player registry with squad master data
  await globalPlayerRegistry.initializeSquad();
  const registeredPlayers = globalPlayerRegistry.getAllPlayers();

  // Step 6: Map each article to verified players
  const playerBuckets = new Map<string, PlayerArticleBucket>();

  for (const article of uniqueArticles) {
    const matchedForThisArticle = new Map<string, { player: Player; confidence: number }>();

    // A. Match against registered players & transfer targets
    for (const player of registeredPlayers) {
      const match = matchPlayer(article.searchableText, player);
      if (match.matched) {
        matchedForThisArticle.set(player.id, { player, confidence: match.confidence });
      }
    }

    // B. If no candidate matched, extract entity candidates from text
    if (matchedForThisArticle.size === 0) {
      const candidateNames = extractCandidateNames(article.searchableText);

      for (const candidateName of candidateNames.slice(0, 3)) {
        const resolved = await globalPlayerRegistry.resolveCandidatePlayer(candidateName);
        if (resolved) {
          const match = matchPlayer(article.searchableText, resolved);
          if (match.matched) {
            matchedForThisArticle.set(resolved.id, {
              player: resolved,
              confidence: match.confidence,
            });
          }
        }
      }
    }

    // Associate article with all matched players
    for (const { player, confidence } of matchedForThisArticle.values()) {
      let bucket = playerBuckets.get(player.id);
      if (!bucket) {
        bucket = { player, direction: article.direction, articles: [] };
        playerBuckets.set(player.id, bucket);
      }

      bucket.articles.push({
        id: article.canonicalId,
        title: article.title,
        url: article.url,
        source: article.sources[0] || 'RSS',
        publishedAt: article.publishedAt,
        summary: article.summary,
        sourceCount: article.sourceCount,
        sources: article.sources,
        matchConfidence: confidence,
        direction: article.direction,
      });
    }
  }

  // Step 7: Compute metrics and rumors for each player
  const allRumors: TransferRumor[] = [];

  for (const bucket of playerBuckets.values()) {
    const { player, articles } = bucket;
    if (articles.length === 0) continue;

    // Sort articles by publishedAt descending
    articles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    const latestPublishedAt = articles[0]?.publishedAt || new Date().toISOString();
    const uniqueArticleCount = articles.length;
    const mentionCount = uniqueArticleCount;

    // Calculate total source count
    let totalSourceCount = 0;
    const sourceCountMap = new Map<string, number>();

    articles.forEach((a) => {
      totalSourceCount += a.sourceCount;
      a.sources.forEach((src) => {
        sourceCountMap.set(src, (sourceCountMap.get(src) || 0) + 1);
      });
    });

    const sourcesList: RumorSourceInfo[] = Array.from(sourceCountMap.entries()).map(
      ([name, count]) => ({
        name,
        type: 'PRESS',
        articleCount: count,
      }),
    );

    const distribution: SourceDistribution = {
      rss: totalSourceCount,
      press: totalSourceCount,
      x: 0,
      forum: 0,
    };

    const avgConfidence = articles.reduce((acc, a) => acc + a.matchConfidence, 0) / articles.length;

    const confidenceScore = calculateConfidence(
      uniqueArticleCount,
      totalSourceCount,
      avgConfidence,
    );

    const { score, recencyScore, sourceDiversityScore } = calculateRumorScore({
      mentionCount,
      uniqueArticleCount,
      sourceCount: totalSourceCount,
      distribution,
      latestPublishedAt,
    });

    const { trend, trendPercentage } = calculateTrend(mentionCount);

    const latestNews: NewsItem[] = articles.slice(0, 5).map((a) => ({
      id: a.id,
      title: a.title,
      url: a.url,
      source: a.source,
      publishedAt: a.publishedAt,
      summary: a.summary,
      playerId: player.id,
    }));

    allRumors.push({
      player,
      mentionCount,
      uniqueArticleCount,
      sourceCount: totalSourceCount,
      trend,
      trendPercentage,
      score,
      confidenceScore: Math.round(confidenceScore * 100) / 100,
      recencyScore,
      sourceDiversityScore,
      sourceDistribution: distribution,
      sources: sourcesList,
      latestNews,
    });
  }

  // Step 8: Apply Active Incoming Rumor Filter and collect Diagnostics
  const incomingRumors: TransferRumor[] = [];
  let outgoingCount = 0;

  for (const rumor of allRumors) {
    const eligibility = isActiveIncomingRumor(rumor, GALATASARAY_CURRENT_SQUAD_2025, RUMOR_WINDOW_DAYS);

    if (eligibility.isActive) {
      incomingRumors.push(rumor);
    } else {
      if (eligibility.reason === 'CURRENT_SQUAD') {
        outgoingCount++;
      }
      rejectedDiagnostics.push({
        playerName: rumor.player.name,
        reason: eligibility.reason || 'OUTGOING',
        details: eligibility.details || '',
      });
    }
  }

  // Sort active incoming rumors by score descending
  incomingRumors.sort((a, b) => b.score - a.score);

  // Step 9: Compute accurate active window UI counters
  // Unique articles contributing to active incoming rumors
  const activeArticleIds = new Set<string>();
  const activeSourceNames = new Set<string>();

  incomingRumors.forEach((r) => {
    r.latestNews.forEach((n) => activeArticleIds.add(n.id));
    r.sources.forEach((s) => activeSourceNames.add(s.name));
  });

  return {
    rumors: incomingRumors,
    meta: {
      totalPlayers: incomingRumors.length,
      totalMentions: incomingRumors.reduce((sum, r) => sum + r.mentionCount, 0),
      totalArticles: activeArticleIds.size || uniqueArticles.length,
      generatedAt: new Date().toISOString(),
      sourceHealth,
    },
    diagnostics: {
      fetchedArticles: activeNewsItems.length,
      transferRelevantArticles: relevantRawItems.length,
      uniqueArticles: uniqueArticles.length,
      currentSquadSize: GALATASARAY_CURRENT_SQUAD_2025.length,
      activeIncomingRumors: incomingRumors.length,
      activeOutgoingRumors: outgoingCount,
      rejected: rejectedDiagnostics,
    },
  };
}
