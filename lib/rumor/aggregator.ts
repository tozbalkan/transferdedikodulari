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

import { globalPlayerRegistry, type RegisteredPlayer } from '@/lib/players/registry';
import { calculateConfidence, calculateRumorScore, calculateTrend } from '@/lib/rumor/scorer';
import {
  getGalatasaraySquadDetailed,
  getApiFootballKey,
  getResolutionTraces,
  invalidateCache,
  CURRENT_SEASON,
  GALATASARAY_DEFAULT_TEAM_ID,
  type SquadResolutionStatus,
  type PlayerResolutionTrace,
} from '@/lib/api-football';
import { SerperSearchNewsAdapter } from '@/lib/news/search-adapter';

export const RUMOR_WINDOW_DAYS = 7;

export type RejectionReason =
  | 'CURRENT_SQUAD'
  | 'DATA_CONFLICT'
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
  currentClubId?: number;
  currentClubSeason?: number;
  position?: string;
  status: 'VERIFIED' | 'UNRESOLVED';
}

export interface SafeDiagnostics {
  environment: string;
  apiKeyConfigured: boolean;
  articlesFetched: number;
  transferRelevantArticles: number;
  uniqueArticles: number;
  candidateSpansExtracted: number;
  uniqueNormalizedCandidates: number;
  identityResolution: {
    attempted: number;
    verified: number;
    unresolved: number;
  };
  currentClubResolution: {
    attempted: number;
    succeeded: number;
    failed: number;
  };
  squad: {
    status: SquadResolutionStatus;
    teamId: number;
    season: number;
    endpoint: string;
    httpStatus: number;
    count: number;
    rawResponseCount: number;
    paginationPages: number;
    goalkeepersCount: number;
    defendersCount: number;
    midfieldersCount: number;
    forwardsCount: number;
    fetchedAt: string;
    cacheHit: boolean;
    mismatchReport?: string;
  };
  rejectionCounts: {
    currentSquad: number;
    squadUnavailable: number;
    dataConflict: number;
    unresolved: number;
    lowConfidence: number;
    stale: number;
  };
  incomingBeforeSquadFilter: number;
  activeIncoming: number;
  renderedPlayers: number;
  resolutionTraces: PlayerResolutionTrace[];
  discoveredCandidates: CandidateDiscoveryDiagnostic[];
  rejected: RejectedRumorDiagnostic[];
}

export interface AggregationResult {
  rumors: TransferRumor[];
  meta: RumorsApiMeta;
  diagnostics?: SafeDiagnostics;
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
 * evaluated against complete authoritative squad data, ID comparison, and fail-closed status.
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
      details: `Galatasaray squad verification status is ${squadStatus}. External squad data unavailable or incomplete.`,
    };
  }

  const externalId = typeof rumor.player.externalId === 'number' ? rumor.player.externalId : undefined;
  const isInSquadList = externalId !== undefined && currentSquadMap.has(externalId);
  const isGalatasarayClub =
    rumor.player.currentClubId === GALATASARAY_DEFAULT_TEAM_ID ||
    (typeof rumor.player.currentClub === 'string' &&
      rumor.player.currentClub.toLowerCase().includes('galatasaray'));

  // 2. Primary: Numeric external ID in current squad and currentClub is Galatasaray
  if (isInSquadList && isGalatasarayClub) {
    return {
      isActive: false,
      reason: 'CURRENT_SQUAD',
      details: `${rumor.player.name} (External ID: ${externalId}) is in current Galatasaray squad.`,
    };
  }

  // 3. Contradiction cross-check:
  // If squad list does not contain player, but player's currentClub is Galatasaray:
  if (!isInSquadList && isGalatasarayClub) {
    return {
      isActive: false,
      reason: 'DATA_CONFLICT',
      details: `Data conflict: ${rumor.player.name} (ID: ${externalId}) is not in squad list but currentClub is reported as ${rumor.player.currentClub} (ID: ${rumor.player.currentClubId}).`,
    };
  }

  // If squad list contains player, but player's currentClub is reported as another club:
  if (isInSquadList && !isGalatasarayClub) {
    return {
      isActive: false,
      reason: 'DATA_CONFLICT',
      details: `Data conflict: ${rumor.player.name} (ID: ${externalId}) is listed in Galatasaray squad but currentClub is reported as ${rumor.player.currentClub} (ID: ${rumor.player.currentClubId}).`,
    };
  }

  // 4. Secondary fallback: Normalized Name & Aliases matching against current squad
  const playerNameLower = rumor.player.name.toLowerCase();
  const isCurrentPlayerByName =
    currentSquadNames.has(playerNameLower) ||
    rumor.player.aliases?.some((alias) => currentSquadNames.has(alias.toLowerCase()));

  if (isCurrentPlayerByName) {
    return {
      isActive: false,
      reason: 'CURRENT_SQUAD',
      details: `${rumor.player.name} matches resolved current Galatasaray squad roster by name.`,
    };
  }

  // 5. Recency window check
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

  // 6. Confidence threshold check
  if ((rumor.confidenceScore ?? 0) < 0.35) {
    return {
      isActive: false,
      reason: 'LOW_CONFIDENCE',
      details: `Confidence score (${rumor.confidenceScore}) below threshold (0.35).`,
    };
  }

  return { isActive: true };
}

export interface AggregateRumorOptions {
  forceRefresh?: boolean;
}

/**
 * Execute the complete live real data pipeline:
 * Article Ingestion -> Exact Text-Span NER -> Unique Candidate Deduplication -> Multi-Strategy Entity Resolution -> ID-First Squad Filtering -> Scoring
 */
export async function aggregateLiveRumors(options?: AggregateRumorOptions): Promise<AggregationResult> {
  const rejectedDiagnostics: RejectedRumorDiagnostic[] = [];
  const discoveredCandidates: CandidateDiscoveryDiagnostic[] = [];

  if (options?.forceRefresh) {
    globalPlayerRegistry.clear();
    invalidateCache();
  }

  // Step 1: Initialize squad from cache or dynamic resolution
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

  // Step 5: Extract & Deduplicate Candidate Spans (Task 6)
  const candidateSpansByArticle = new Map<string, Array<{ rawText: string; norm: string }>>();
  const candidateFrequencyMap = new Map<string, { rawText: string; norm: string; count: number }>();
  let extractedSpansCount = 0;

  for (const article of uniqueArticles) {
    const spans = extractCandidateSpans(article.searchableText);
    extractedSpansCount += spans.length;
    const articleSpans: Array<{ rawText: string; norm: string }> = [];

    for (const span of spans) {
      articleSpans.push({ rawText: span.rawText, norm: span.normalizedCandidate });
      const existing = candidateFrequencyMap.get(span.normalizedCandidate);
      if (existing) {
        existing.count++;
      } else {
        candidateFrequencyMap.set(span.normalizedCandidate, {
          rawText: span.rawText,
          norm: span.normalizedCandidate,
          count: 1,
        });
      }
    }
    candidateSpansByArticle.set(article.canonicalId, articleSpans);
  }

  // Sort unique candidates by frequency so high-volume transfer targets resolve first
  const sortedCandidates = Array.from(candidateFrequencyMap.values()).sort(
    (a, b) => b.count - a.count,
  );

  // Step 6: Efficient Unique Candidate Resolution (Tasks 2, 3, 4, 5, 7)
  const resolvedIdentityMap = new Map<string, RegisteredPlayer>(); // norm -> player
  let identityAttempted = 0;
  let identityVerified = 0;
  let identityUnresolved = 0;

  for (const candidate of sortedCandidates) {
    identityAttempted++;
    const resolved = await globalPlayerRegistry.resolveCandidatePlayer(candidate.rawText);

    if (resolved && typeof resolved.externalId === 'number') {
      identityVerified++;
      resolvedIdentityMap.set(candidate.norm, resolved);
    } else {
      identityUnresolved++;
      rejectedDiagnostics.push({
        playerName: candidate.rawText,
        reason: 'UNRESOLVED_PLAYER',
        details: `Candidate "${candidate.rawText}" could not be authoritatively resolved to an API-Football player profile.`,
      });
    }
  }


  // Current Club Lookup Stats (Task 7)
  const uniqueVerifiedExternalIds = new Set<number>();
  let clubAttempted = 0;
  let clubSucceeded = 0;
  let clubFailed = 0;

  for (const player of resolvedIdentityMap.values()) {
    if (typeof player.externalId === 'number' && !uniqueVerifiedExternalIds.has(player.externalId)) {
      uniqueVerifiedExternalIds.add(player.externalId);
      clubAttempted++;
      if (player.currentClub && player.currentClub !== 'Unknown Club') {
        clubSucceeded++;
      } else {
        clubFailed++;
      }
    }
  }

  // Step 7: Match Resolved Players to Article Buckets with Text-Span Evidence
  const playerBuckets = new Map<string, PlayerArticleBucket>();

  for (const article of uniqueArticles) {
    const articleEvidenceMap = new Map<string, { player: Player; evidence: RumorEvidence; confidence: number }>();
    const articleSpans = candidateSpansByArticle.get(article.canonicalId) || [];

    // A. Match against unique resolved candidates from article spans
    for (const span of articleSpans) {
      const resolved = resolvedIdentityMap.get(span.norm);
      if (resolved) {
        discoveredCandidates.push({
          articleTitle: article.title,
          candidateSpan: span.rawText,
          resolvedPlayerId: resolved.externalId,
          resolvedCanonicalName: resolved.name,
          currentClub: resolved.currentClub,
          currentClubId: resolved.currentClubId,
          currentClubSeason: resolved.currentClubSeason,
          position: resolved.position,
          status: 'VERIFIED',
        });

        const match = matchPlayerWithSpan(article.searchableText, resolved);
        const matchConfidence = match.matched ? match.confidence : resolved.entityResolutionConfidence || 0.85;

        const evidence: RumorEvidence = {
          articleId: article.canonicalId,
          articleTitle: article.title,
          candidateTextSpan: span.rawText,
          candidateCanonicalName: resolved.name,
          matchMethod: match.matchMethod || 'EXACT_FULL_NAME',
          matchConfidence,
          publishedAt: article.publishedAt,
          source: article.sources[0] || 'RSS',
          url: article.url,
        };
        articleEvidenceMap.set(resolved.id, { player: resolved, evidence, confidence: matchConfidence });
      } else {
        discoveredCandidates.push({
          articleTitle: article.title,
          candidateSpan: span.rawText,
          status: 'UNRESOLVED',
        });
      }
    }

    // B. Also match against all currently registered players
    for (const player of globalPlayerRegistry.getAllPlayers()) {
      if (articleEvidenceMap.has(player.id)) continue;
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

    // Associate article with verified players
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

  // Step 8: Compute metrics and rumors for verified players
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

  // Step 9: Apply Fail-Closed Active Incoming Rumor Filter (Task 9)
  const incomingRumors: TransferRumor[] = [];
  let outgoingCount = 0;
  let dataConflictsCount = 0;
  let squadUnavailableCount = 0;
  let lowConfidenceCount = 0;
  let staleCount = 0;

  const incomingBeforeSquadFilter = allRumors.length;

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
      } else if (eligibility.reason === 'DATA_CONFLICT') {
        dataConflictsCount++;
      } else if (eligibility.reason === 'SQUAD_UNAVAILABLE') {
        squadUnavailableCount++;
      } else if (eligibility.reason === 'LOW_CONFIDENCE') {
        lowConfidenceCount++;
      } else if (eligibility.reason === 'STALE') {
        staleCount++;
      }

      rejectedDiagnostics.push({
        playerName: rumor.player.name,
        reason: eligibility.reason || 'OUTGOING',
        details: eligibility.details || '',
      });
    }
  }

  incomingRumors.sort((a, b) => b.score - a.score);

  // Step 10: Active UI counters
  const activeArticleIds = new Set<string>();
  incomingRumors.forEach((r) => {
    r.latestNews.forEach((n) => activeArticleIds.add(n.id));
  });

  const isConfigured = Boolean(getApiFootballKey());

  return {
    rumors: incomingRumors,
    meta: {
      totalPlayers: incomingRumors.length,
      totalMentions: incomingRumors.reduce((sum, r) => sum + r.mentionCount, 0),
      totalArticles: activeArticleIds.size || uniqueArticles.length,
      generatedAt: new Date().toISOString(),
      sourceHealth,
      squadStatus: squadResolution.status,
      squadVerified: squadResolution.status === 'VERIFIED',
    },
    diagnostics: {
      environment: process.env.NODE_ENV || 'production',
      apiKeyConfigured: isConfigured,
      articlesFetched: activeNewsItems.length,
      transferRelevantArticles: relevantRawItems.length,
      uniqueArticles: uniqueArticles.length,
      candidateSpansExtracted: extractedSpansCount,
      uniqueNormalizedCandidates: candidateFrequencyMap.size,
      identityResolution: {

        attempted: identityAttempted,
        verified: identityVerified,
        unresolved: identityUnresolved,
      },
      currentClubResolution: {
        attempted: clubAttempted,
        succeeded: clubSucceeded,
        failed: clubFailed,
      },
      squad: {
        status: squadResolution.status,
        teamId: squadResolution.teamId,
        season: squadResolution.season,
        endpoint: squadResolution.endpoint,
        httpStatus: squadResolution.httpStatus,
        count: squadResolution.normalizedSquadCount,
        rawResponseCount: squadResolution.rawResponseCount,
        paginationPages: squadResolution.paginationPages,
        goalkeepersCount: squadResolution.goalkeepersCount,
        defendersCount: squadResolution.defendersCount,
        midfieldersCount: squadResolution.midfieldersCount,
        forwardsCount: squadResolution.forwardsCount,
        fetchedAt: squadResolution.fetchedAt,
        cacheHit: squadResolution.cacheHit,
        mismatchReport: squadResolution.mismatchReport,
      },
      rejectionCounts: {
        currentSquad: outgoingCount,
        squadUnavailable: squadUnavailableCount,
        dataConflict: dataConflictsCount,
        unresolved: identityUnresolved,
        lowConfidence: lowConfidenceCount,
        stale: staleCount,
      },
      incomingBeforeSquadFilter,
      activeIncoming: incomingRumors.length,
      renderedPlayers: incomingRumors.length,
      resolutionTraces: getResolutionTraces(),
      discoveredCandidates,
      rejected: rejectedDiagnostics,
    },
  };
}
