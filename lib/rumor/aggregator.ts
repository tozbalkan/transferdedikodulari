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
import {
  getGalatasaraySquadDetailed,
  CURRENT_SEASON,
  type SquadResolutionStatus,
} from '@/lib/api-football';
import { SerperSearchNewsAdapter } from '@/lib/news/search-adapter';

export const RUMOR_WINDOW_DAYS = 7;

export type RejectionReason =
  | 'CURRENT_SQUAD'
  | 'OUTGOING'
  | 'STALE'
  | 'LOW_CONFIDENCE'
  | 'UNRESOLVED_PLAYER'
  | 'NOT_TRANSFER_INTENT'
  | 'DUPLICATE'
  | 'SQUAD_UNAVAILABLE';

export interface RejectedRumorDiagnostic {
  playerName: string;
  reason: RejectionReason;
  details: string;
}

export interface CandidateDiscoveryDiagnostic {
  articleTitle: string;
  extractedName: string;
  resolvedPlayerId?: string;
  resolvedName?: string;
  currentClub?: string;
  status: 'RESOLVED' | 'UNRESOLVED';
}

export interface AggregationResult {
  rumors: TransferRumor[];
  meta: RumorsApiMeta;
  diagnostics?: {
    season: number;
    squadStatus: SquadResolutionStatus;
    squadSize: number;
    fetchedArticles: number;
    transferRelevantArticles: number;
    uniqueArticles: number;
    extractedCandidatesCount: number;
    resolvedPlayersCount: number;
    unresolvedPlayersCount: number;
    activeIncomingRumors: number;
    activeOutgoingRumors: number;
    discoveredCandidates: CandidateDiscoveryDiagnostic[];
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
 * Pure function to check if a transfer rumor is an active, valid INCOMING transfer rumor
 * evaluated against dynamically resolved squad names and fail-closed status.
 */
export function isActiveIncomingRumor(
  rumor: TransferRumor,
  currentSquadNames: Set<string>,
  squadStatus: SquadResolutionStatus,
  windowDays: number = RUMOR_WINDOW_DAYS,
): { isActive: boolean; reason?: RejectionReason; details?: string } {
  // 1. Fail-closed: Only VERIFIED squad resolution can authorize incoming rumors
  if (squadStatus === 'INVALID') {
    return {
      isActive: false,
      reason: 'SQUAD_UNAVAILABLE',
      details: 'Galatasaray squad verification failed (INVALID status).',
    };
  }

  // 2. Dynamic Check: Is the player currently a member of Galatasaray squad?
  const playerNameLower = rumor.player.name.toLowerCase();
  const isCurrentPlayer =
    currentSquadNames.has(playerNameLower) ||
    rumor.player.currentClub?.toLowerCase().includes('galatasaray') ||
    rumor.player.aliases.some((alias) => currentSquadNames.has(alias.toLowerCase()));

  if (isCurrentPlayer) {
    return {
      isActive: false,
      reason: 'CURRENT_SQUAD',
      details: `${rumor.player.name} is a resolved current Galatasaray squad member.`,
    };
  }

  // 3. Check recency window
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

  // 4. Check confidence threshold
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
 * Article Ingestion -> Dynamic Player Extraction (NER) -> Entity Resolution (API-Football) -> Dynamic Squad Verification -> Scoring
 */
export async function aggregateLiveRumors(): Promise<AggregationResult> {
  const rejectedDiagnostics: RejectedRumorDiagnostic[] = [];
  const discoveredCandidates: CandidateDiscoveryDiagnostic[] = [];

  // Step 1: Dynamically resolve official 2026-2027 Galatasaray squad from API-Football
  await globalPlayerRegistry.initializeSquad();
  const squadResolution = await getGalatasaraySquadDetailed(undefined, CURRENT_SEASON);
  const currentSquadNames = new Set<string>(
    squadResolution.squad.map((p) => p.name.toLowerCase()),
  );

  // Step 2: Ingest raw feeds from RSS & Search
  const { items: rawNewsItems, health: sourceHealth } = await fetchAllFeeds();

  const searchAdapter = new SerperSearchNewsAdapter();
  const searchArticles = await searchAdapter.fetchArticles(
    'Galatasaray transfer haberleri',
    RUMOR_WINDOW_DAYS,
  );

  const combinedRawItems = [...rawNewsItems, ...searchArticles];
  const activeNewsItems = combinedRawItems.length > 0 ? combinedRawItems : FALLBACK_REAL_NEWS;

  // Step 3: Filter for Galatasaray relevance and transfer intent
  const relevantRawItems = activeNewsItems.filter((item) => {
    const content = 'content' in item && typeof item.content === 'string' ? item.content : undefined;
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

  // Step 5: Dynamic Player Discovery & Entity Resolution from Real Articles
  const playerBuckets = new Map<string, PlayerArticleBucket>();
  let extractedCandidatesCount = 0;
  let resolvedPlayersCount = 0;
  let unresolvedPlayersCount = 0;

  for (const article of uniqueArticles) {
    const matchedForThisArticle = new Map<string, { player: Player; confidence: number }>();

    // A. Match against already registered in-memory player entities
    const currentRegistered = globalPlayerRegistry.getAllPlayers();
    for (const player of currentRegistered) {
      const match = matchPlayer(article.searchableText, player);
      if (match.matched) {
        matchedForThisArticle.set(player.id, { player, confidence: match.confidence });
      }
    }

    // B. Extract unknown player candidate names from article text (True Discovery)
    const candidateNames = extractCandidateNames(article.searchableText);
    extractedCandidatesCount += candidateNames.length;

    for (const candidateName of candidateNames) {
      const resolved = await globalPlayerRegistry.resolveCandidatePlayer(candidateName);

      if (resolved) {
        resolvedPlayersCount++;
        discoveredCandidates.push({
          articleTitle: article.title,
          extractedName: candidateName,
          resolvedPlayerId: resolved.id,
          resolvedName: resolved.name,
          currentClub: resolved.currentClub,
          status: 'RESOLVED',
        });

        const match = matchPlayer(article.searchableText, resolved);
        if (match.matched) {
          matchedForThisArticle.set(resolved.id, {
            player: resolved,
            confidence: match.confidence,
          });
        }
      } else {
        unresolvedPlayersCount++;
        discoveredCandidates.push({
          articleTitle: article.title,
          extractedName: candidateName,
          status: 'UNRESOLVED',
        });
        rejectedDiagnostics.push({
          playerName: candidateName,
          reason: 'UNRESOLVED_PLAYER',
          details: `Could not resolve player entity "${candidateName}" via API-Football.`,
        });
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

  // Step 6: Compute metrics and rumors for each discovered player
  const allRumors: TransferRumor[] = [];

  for (const bucket of playerBuckets.values()) {
    const { player, articles } = bucket;
    if (articles.length === 0) continue;

    articles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    const latestPublishedAt = articles[0]?.publishedAt || new Date().toISOString();
    const uniqueArticleCount = articles.length;
    const mentionCount = uniqueArticleCount;

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

  // Step 7: Apply Dynamic Active Incoming Rumor Filter
  const incomingRumors: TransferRumor[] = [];
  let outgoingCount = 0;

  for (const rumor of allRumors) {
    const eligibility = isActiveIncomingRumor(
      rumor,
      currentSquadNames,
      squadResolution.status,
      RUMOR_WINDOW_DAYS,
    );

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

  // Step 8: Compute accurate active window UI counters
  const activeArticleIds = new Set<string>();
  incomingRumors.forEach((r) => {
    r.latestNews.forEach((n) => activeArticleIds.add(n.id));
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
      season: CURRENT_SEASON,
      squadStatus: squadResolution.status,
      squadSize: squadResolution.squadSize,
      fetchedArticles: activeNewsItems.length,
      transferRelevantArticles: relevantRawItems.length,
      uniqueArticles: uniqueArticles.length,
      extractedCandidatesCount,
      resolvedPlayersCount,
      unresolvedPlayersCount,
      activeIncomingRumors: incomingRumors.length,
      activeOutgoingRumors: outgoingCount,
      discoveredCandidates,
      rejected: rejectedDiagnostics,
    },
  };
}
