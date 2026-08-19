import type {
  NewsItem,
  Player,
  RumorEvidence,
  RumorSourceInfo,
  SourceDistribution,
  TransferRumor,
  RumorsApiMeta,
} from '@/types/transfer';
import { fetchAllFeeds } from '@/lib/news/rss';
import { FALLBACK_REAL_NEWS } from '@/lib/news/fallback-news';
import { deduplicateArticles, isGalatasarayRelevant, type TransferDirection } from '@/lib/news/parser';
import { extractCandidateSpans, matchPlayerWithSpan } from '@/lib/players/matcher';
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
  candidateSpan: string;
  resolvedPlayerId?: number | string;
  resolvedCanonicalName?: string;
  currentClub?: string;
  position?: string;
  status: 'VERIFIED' | 'UNRESOLVED';
}

export interface AggregationResult {
  rumors: TransferRumor[];
  meta: RumorsApiMeta;
  diagnostics?: {
    season: number;
    squadStatus: SquadResolutionStatus;
    squadSize: number;
    squadEndpoint: string;
    rawSquadResponseCount: number;
    paginationPages: number;
    fetchedArticles: number;
    transferRelevantArticles: number;
    uniqueArticles: number;
    extractedCandidatesCount: number;
    verifiedPlayersCount: number;
    unresolvedCandidatesCount: number;
    activeIncomingRumors: number;
    activeOutgoingRumors: number;
    discoveredCandidates: CandidateDiscoveryDiagnostic[];
    rejected: RejectedRumorDiagnostic[];
  };
}

interface PlayerArticleBucket {
  player: Player;
  direction: TransferDirection;
  evidence: RumorEvidence[];
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
 * Check if a transfer rumor is an active, valid INCOMING transfer rumor
 * evaluated against complete authoritative squad data and fail-closed status.
 */
export function isActiveIncomingRumor(
  rumor: TransferRumor,
  currentSquadMap: Map<number, Player>,
  currentSquadNames: Set<string>,
  squadStatus: SquadResolutionStatus,
  windowDays: number = RUMOR_WINDOW_DAYS,
): { isActive: boolean; reason?: RejectionReason; details?: string } {
  // 1. Fail-closed: Only VERIFIED squad resolution authorizes incoming rumors
  if (squadStatus !== 'VERIFIED') {
    return {
      isActive: false,
      reason: 'SQUAD_UNAVAILABLE',
      details: `Galatasaray squad verification status is ${squadStatus}.`,
    };
  }

  // 2. Authoritative External ID matching against current squad
  if (typeof rumor.player.externalId === 'number' && currentSquadMap.has(rumor.player.externalId)) {
    return {
      isActive: false,
      reason: 'CURRENT_SQUAD',
      details: `${rumor.player.name} (External ID: ${rumor.player.externalId}) is in current Galatasaray squad.`,
    };
  }

  // 3. Normalized Name & Club matching
  const playerNameLower = rumor.player.name.toLowerCase();
  const isCurrentPlayerByName =
    currentSquadNames.has(playerNameLower) ||
    rumor.player.currentClub?.toLowerCase().includes('galatasaray') ||
    rumor.player.aliases.some((alias) => currentSquadNames.has(alias.toLowerCase()));

  if (isCurrentPlayerByName) {
    return {
      isActive: false,
      reason: 'CURRENT_SQUAD',
      details: `${rumor.player.name} matches resolved current Galatasaray squad roster.`,
    };
  }

  // 4. Recency window check
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

  // 5. Confidence threshold check
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
 * Article Ingestion -> Exact Text-Span NER -> API-Football Entity Resolution -> Complete Squad Filtering -> Evidence Binding -> Scoring
 */
export async function aggregateLiveRumors(): Promise<AggregationResult> {
  const rejectedDiagnostics: RejectedRumorDiagnostic[] = [];
  const discoveredCandidates: CandidateDiscoveryDiagnostic[] = [];

  // Step 1: Dynamically resolve complete official 2026-2027 Galatasaray squad
  await globalPlayerRegistry.initializeSquad();
  const squadResolution = await getGalatasaraySquadDetailed(undefined, CURRENT_SEASON);

  const currentSquadMap = new Map<number, Player>();
  const currentSquadNames = new Set<string>();

  squadResolution.squad.forEach((p) => {
    if (typeof p.externalId === 'number') {
      currentSquadMap.set(p.externalId, p);
    }
    currentSquadNames.add(p.name.toLowerCase());
    p.aliases.forEach((a) => currentSquadNames.add(a.toLowerCase()));
  });

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

  // Step 5: Dynamic Player Discovery with Exact Text Spans & Authoritative Resolution
  const playerBuckets = new Map<string, PlayerArticleBucket>();
  let extractedCandidatesCount = 0;
  let verifiedPlayersCount = 0;
  let unresolvedCandidatesCount = 0;

  for (const article of uniqueArticles) {
    const articleEvidenceMap = new Map<string, { player: Player; evidence: RumorEvidence; confidence: number }>();

    // A. Match against already verified in-memory player entities
    const currentRegistered = globalPlayerRegistry.getAllPlayers();
    for (const player of currentRegistered) {
      const match = matchPlayerWithSpan(article.searchableText, player);
      if (match.matched) {
        const evidence: RumorEvidence = {
          articleId: article.canonicalId,
          articleTitle: article.title,
          candidateTextSpan: match.matchedSpan || player.name,
          candidateCanonicalName: player.name,
          matchMethod: match.matchMethod || 'EXACT_FULL_NAME',
          matchConfidence: match.confidence,
          publishedAt: article.publishedAt,
          source: article.sources[0] || 'RSS',
          url: article.url,
        };
        articleEvidenceMap.set(player.id, { player, evidence, confidence: match.confidence });
      }
    }

    // B. Extract candidate person text spans from article text
    const candidateSpans = extractCandidateSpans(article.searchableText);
    extractedCandidatesCount += candidateSpans.length;

    for (const span of candidateSpans) {
      const resolved = await globalPlayerRegistry.resolveCandidatePlayer(span.rawText);

      if (resolved && typeof resolved.externalId === 'number') {
        verifiedPlayersCount++;
        discoveredCandidates.push({
          articleTitle: article.title,
          candidateSpan: span.rawText,
          resolvedPlayerId: resolved.externalId,
          resolvedCanonicalName: resolved.name,
          currentClub: resolved.currentClub,
          position: resolved.position,
          status: 'VERIFIED',
        });

        const match = matchPlayerWithSpan(article.searchableText, resolved);
        if (match.matched) {
          const evidence: RumorEvidence = {
            articleId: article.canonicalId,
            articleTitle: article.title,
            candidateTextSpan: span.rawText,
            candidateCanonicalName: resolved.name,
            matchMethod: match.matchMethod || 'EXACT_FULL_NAME',
            matchConfidence: match.confidence,
            publishedAt: article.publishedAt,
            source: article.sources[0] || 'RSS',
            url: article.url,
          };
          articleEvidenceMap.set(resolved.id, { player: resolved, evidence, confidence: match.confidence });
        }
      } else {
        unresolvedCandidatesCount++;
        discoveredCandidates.push({
          articleTitle: article.title,
          candidateSpan: span.rawText,
          status: 'UNRESOLVED',
        });
        rejectedDiagnostics.push({
          playerName: span.rawText,
          reason: 'UNRESOLVED_PLAYER',
          details: `Candidate "${span.rawText}" is not an authoritative API-Football player entity.`,
        });
      }
    }

    // Associate article only with players with verified text-span evidence
    for (const { player, evidence, confidence } of articleEvidenceMap.values()) {
      let bucket = playerBuckets.get(player.id);
      if (!bucket) {
        bucket = { player, direction: article.direction, evidence: [], articles: [] };
        playerBuckets.set(player.id, bucket);
      }

      bucket.evidence.push(evidence);
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

  // Step 6: Compute metrics and rumors for verified players
  const allRumors: TransferRumor[] = [];

  for (const bucket of playerBuckets.values()) {
    const { player, articles, evidence } = bucket;
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

    const avgMatchConfidence = articles.reduce((acc, a) => acc + a.matchConfidence, 0) / articles.length;

    const rumorConfidence = calculateConfidence(
      uniqueArticleCount,
      totalSourceCount,
      avgMatchConfidence,
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
      confidenceScore: Math.round(rumorConfidence * 100) / 100,
      entityResolutionConfidence: player.entityResolutionConfidence || 1.0,
      rumorConfidence: Math.round(rumorConfidence * 100) / 100,
      recencyScore,
      sourceDiversityScore,
      sourceDistribution: distribution,
      sources: sourcesList,
      latestNews,
      evidence,
    });
  }

  // Step 7: Apply Fail-Closed Active Incoming Rumor Filter
  const incomingRumors: TransferRumor[] = [];
  let outgoingCount = 0;

  for (const rumor of allRumors) {
    const eligibility = isActiveIncomingRumor(
      rumor,
      currentSquadMap,
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

  incomingRumors.sort((a, b) => b.score - a.score);

  // Step 8: Compute active UI counters
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
      squadSize: squadResolution.normalizedSquadCount,
      squadEndpoint: squadResolution.endpoint,
      rawSquadResponseCount: squadResolution.rawResponseCount,
      paginationPages: squadResolution.paginationPages,
      fetchedArticles: activeNewsItems.length,
      transferRelevantArticles: relevantRawItems.length,
      uniqueArticles: uniqueArticles.length,
      extractedCandidatesCount,
      verifiedPlayersCount,
      unresolvedCandidatesCount,
      activeIncomingRumors: incomingRumors.length,
      activeOutgoingRumors: outgoingCount,
      discoveredCandidates,
      rejected: rejectedDiagnostics,
    },
  };
}
