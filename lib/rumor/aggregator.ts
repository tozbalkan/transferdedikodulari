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
import { extractCandidateSpans, matchPlayerWithSpan, normalizeText } from '@/lib/players/matcher';
import { validatePlayerCandidate } from '@/lib/players/validator';
import { clusterCandidateMentions, type CandidateMention } from '@/lib/players/cluster';
import { persistentPlayerRegistry } from '@/lib/players/persistent-registry';
import { negativeResolutionCache } from '@/lib/players/negative-cache';
import { calculateConfidence, calculateRumorScore, calculateTrend } from '@/lib/rumor/scorer';
import {
  getGalatasaraySquadDetailed,
  getApiFootballKey,
  getResolutionTraces,
  getApiFootballRequestStats,
  resetRunRequestBudget,
  resolvePlayerIdentity,
  invalidateCache,
  CURRENT_SEASON,
  GALATASARAY_DEFAULT_TEAM_ID,
  type SquadResolutionStatus,
  type PlayerResolutionTrace,
} from '@/lib/api-football';

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
  | 'PRE_API_REJECTED'
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
  apiFootballRequests: {
    total: number;
    budget: number;
    budgetRemaining: number;
    circuitBreakerState: 'CLOSED' | 'OPEN';
    rateLimitType?: string;
  };
  candidatePipeline: {
    extracted: number;
    preApiRejected: number;
    clustered: number;
    registryHits: number;
    negativeCacheHits: number;
    apiResolutionAttempted: number;
    apiResolutionVerified: number;
    apiResolutionUnresolved: number;
  };
  registry: {
    playerCount: number;
    persistent: boolean;
    hits: number;
    misses: number;
  };
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
    liveOrCached: 'LIVE' | 'CACHED';
    rawResponseCount: number;
    paginationPages: number;
    goalkeepersCount: number;
    defendersCount: number;
    midfieldersCount: number;
    forwardsCount: number;
    verifiedAt: string;
    ageSeconds: number;
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
    preApiRejected: number;
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
  }>;
}

/**
 * Filter out rumors that do not represent active incoming transfer targets.
 */
export function isActiveIncomingRumor(
  rumor: TransferRumor,
  currentSquadMap: Map<number, Player>,
  currentSquadNames: Set<string>,
  squadStatus: SquadResolutionStatus,
  windowDays: number = RUMOR_WINDOW_DAYS,
): { isActive: boolean; reason?: RejectionReason; details?: string } {
  // 1. Squad Verification Status Check: Fail-Closed
  if (squadStatus !== 'VERIFIED') {
    return {
      isActive: false,
      reason: 'SQUAD_UNAVAILABLE',
      details: `Squad resolution status is "${squadStatus}". Failing closed until squad is verified.`,
    };
  }

  // 2. Exact Numeric External ID Match against Galatasaray current squad
  if (typeof rumor.player.externalId === 'number') {
    const squadMember = currentSquadMap.get(rumor.player.externalId);
    if (squadMember) {
      return {
        isActive: false,
        reason: 'CURRENT_SQUAD',
        details: `${rumor.player.name} (ID: ${rumor.player.externalId}) is an active member of Galatasaray squad (${squadMember.position}).`,
      };
    }
  }

  // 3. Name/Alias Match against Galatasaray current squad
  const normPlayerName = normalizeText(rumor.player.name);
  if (currentSquadNames.has(normPlayerName)) {
    return {
      isActive: false,
      reason: 'CURRENT_SQUAD',
      details: `${rumor.player.name} matches a name in the Galatasaray squad roster.`,
    };
  }

  for (const alias of rumor.player.aliases) {
    const normAlias = normalizeText(alias);
    if (currentSquadNames.has(normAlias)) {
      return {
        isActive: false,
        reason: 'CURRENT_SQUAD',
        details: `Player alias "${alias}" matches an active Galatasaray player.`,
      };
    }
  }

  // 4. Data Conflict Check: If current club is Galatasaray, reject as existing player
  if (
    rumor.player.currentClub &&
    (rumor.player.currentClub.toLowerCase().includes('galatasaray') ||
      rumor.player.currentClubId === GALATASARAY_DEFAULT_TEAM_ID)
  ) {
    return {
      isActive: false,
      reason: 'DATA_CONFLICT',
      details: `${rumor.player.name} has current club "${rumor.player.currentClub}" (ID: ${rumor.player.currentClubId}), conflicting with incoming transfer status.`,
    };
  }

  // 5. Direction Check
  if (rumor.evidence && rumor.evidence.length > 0) {
    const isOutgoing = rumor.evidence.every((e) => e.candidateTextSpan.includes('ayrılıyor') || e.candidateTextSpan.includes('veda'));
    if (isOutgoing) {
      return {
        isActive: false,
        reason: 'OUTGOING',
        details: `${rumor.player.name} rumors indicate outgoing transfer.`,
      };
    }
  }

  // 6. Recency Window Check
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const recentArticles = rumor.latestNews.filter((item) => {
    const articleDate = new Date(item.publishedAt);
    return !isNaN(articleDate.getTime()) && articleDate >= windowStart;
  });

  if (recentArticles.length === 0 && rumor.latestNews.length > 0) {
    return {
      isActive: false,
      reason: 'STALE',
      details: `No news within the active ${windowDays}-day rumor window.`,
    };
  }

  // 7. Minimum Confidence Check
  if (rumor.confidenceScore !== undefined && rumor.confidenceScore < 0.40) {
    return {
      isActive: false,
      reason: 'LOW_CONFIDENCE',
      details: `Confidence score (${rumor.confidenceScore}) below threshold 0.40.`,
    };
  }

  return { isActive: true };
}

/**
 * Main rumor aggregation pipeline with Phase 3.13.3 optimizations:
 * - Strict pre-API validation
 * - Pre-API candidate clustering
 * - Persistent player registry
 * - Negative resolution cache
 * - Request budget and rate-limit circuit breaker
 */
export async function aggregateLiveRumors(forceRefresh = false): Promise<AggregationResult> {
  if (forceRefresh) {
    invalidateCache();
  }

  resetRunRequestBudget();

  const rejectedDiagnostics: RejectedRumorDiagnostic[] = [];
  const discoveredCandidates: CandidateDiscoveryDiagnostic[] = [];

  // Step 1: Ingest live Galatasaray 2026 squad snapshot
  const squadResolution = await getGalatasaraySquadDetailed(undefined, CURRENT_SEASON);
  const currentSquad = squadResolution.squad;

  const currentSquadMap = new Map<number, Player>();
  const currentSquadNames = new Set<string>();

  for (const player of currentSquad) {
    if (typeof player.externalId === 'number') {
      currentSquadMap.set(player.externalId, player);
    }
    currentSquadNames.add(normalizeText(player.name));
    for (const alias of player.aliases) {
      currentSquadNames.add(normalizeText(alias));
    }
  }

  // Step 2: Ingest Multi-Source Live News Feeds
  const rssResult = await fetchAllFeeds();
  let activeNewsItems = rssResult.items;
  let sourceHealth = rssResult.health;

  if (activeNewsItems.length === 0) {
    activeNewsItems = FALLBACK_REAL_NEWS;
    sourceHealth = [
      {
        sourceId: 'fallback-snapshot',
        name: 'Fallback Snapshot Data',
        enabled: true,
        success: true,
        itemCount: FALLBACK_REAL_NEWS.length,
        fetchedAt: new Date().toISOString(),
      },
    ];
  }

  // Step 3: Filter Galatasaray-relevant articles
  const relevantRawItems = activeNewsItems.filter((item) => {
    const rel = isGalatasarayRelevant(item.title, item.summary || item.content || '');
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

  // Step 5: Extract & Pre-API Validate Candidate Spans
  let totalExtractedSpansCount = 0;
  let preApiRejectedCount = 0;
  const validCandidateMentions: CandidateMention[] = [];

  for (const article of uniqueArticles) {
    const rawSpans = extractCandidateSpans(article.searchableText);
    totalExtractedSpansCount += rawSpans.length;

    for (const span of rawSpans) {
      const validation = validatePlayerCandidate(span.rawText);
      if (!validation.isValid) {
        preApiRejectedCount++;
        negativeResolutionCache.set(
          validation.normalizedCandidate,
          'NON_PLAYER',
          validation.details || validation.reason || 'Pre-API validation failed',
        );
        rejectedDiagnostics.push({
          playerName: span.rawText,
          reason: 'PRE_API_REJECTED',
          details: `Pre-API validation: ${validation.reason} (${validation.details})`,
        });
        continue;
      }

      validCandidateMentions.push({
        rawText: span.rawText,
        norm: validation.normalizedCandidate,
        articleId: article.canonicalId,
      });
    }
  }

  // Step 6: Cluster Candidate Mentions Before Upstream API (Task 3)
  const clusters = clusterCandidateMentions(validCandidateMentions);

  // Step 7: Identity Resolution (Persistent Registry -> Negative Cache -> Budgeted API)
  const resolvedPlayerMap = new Map<string, Player>(); // norm or alias -> Player
  let registryHitsCount = 0;
  let negativeCacheHitsCount = 0;
  let apiAttemptedCount = 0;
  let apiVerifiedCount = 0;
  let apiUnresolvedCount = 0;

  for (const cluster of clusters) {
    // A. Check persistent player registry
    const registryPlayer = persistentPlayerRegistry.findPlayer(cluster.canonicalQuery);
    if (registryPlayer && typeof registryPlayer.externalId === 'number') {
      registryHitsCount++;
      for (const normSpan of cluster.allNormalizedSpans) {
        resolvedPlayerMap.set(normSpan, registryPlayer);
      }
      for (const rawSpan of cluster.allRawSpans) {
        resolvedPlayerMap.set(normalizeText(rawSpan), registryPlayer);
      }
      continue;
    }

    // B. Check negative cache
    const negEntry = negativeResolutionCache.get(cluster.normalizedQuery);
    if (negEntry) {
      negativeCacheHitsCount++;
      rejectedDiagnostics.push({
        playerName: cluster.canonicalQuery,
        reason: 'UNRESOLVED_PLAYER',
        details: `Negative cache hit (${negEntry.status}): ${negEntry.reason}`,
      });
      continue;
    }

    // C. Budget-limited live API resolution
    apiAttemptedCount++;
    const resolved = await resolvePlayerIdentity(cluster.canonicalQuery);

    if (resolved && typeof resolved.id === 'number') {
      apiVerifiedCount++;
      const fullPlayer: Player = {
        id: `api-football-${resolved.id}`,
        externalId: resolved.id,
        name: resolved.name,
        firstName: resolved.firstname,
        lastName: resolved.lastname,
        position: resolved.position || 'MIDFIELDER',
        currentClub: 'Unknown Club',
        nationality: resolved.nationality,
        age: resolved.age,
        photo: resolved.photo,
        aliases: Array.from(new Set([...cluster.allRawSpans, resolved.name])),
        entityResolutionConfidence: resolved.identityScore,
        lastResolvedAt: new Date().toISOString(),
      };

      for (const normSpan of cluster.allNormalizedSpans) {
        resolvedPlayerMap.set(normSpan, fullPlayer);
      }
      for (const rawSpan of cluster.allRawSpans) {
        resolvedPlayerMap.set(normalizeText(rawSpan), fullPlayer);
      }
    } else {
      apiUnresolvedCount++;
      negativeResolutionCache.set(cluster.normalizedQuery, 'NOT_FOUND', 'Candidate could not be resolved');
      rejectedDiagnostics.push({
        playerName: cluster.canonicalQuery,
        reason: 'UNRESOLVED_PLAYER',
        details: `Candidate "${cluster.canonicalQuery}" could not be resolved to an API-Football player profile.`,
      });
    }
  }

  // Current Club Lookup Stats
  const uniqueVerifiedExternalIds = new Set<number>();
  let clubAttempted = 0;
  let clubSucceeded = 0;
  let clubFailed = 0;

  for (const player of resolvedPlayerMap.values()) {
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

  // Step 8: Match Resolved Players to Article Buckets with Text-Span Evidence
  const playerBuckets = new Map<string, PlayerArticleBucket>();

  for (const article of uniqueArticles) {
    const articleEvidenceMap = new Map<string, { player: Player; evidence: RumorEvidence; confidence: number }>();
    const rawSpans = extractCandidateSpans(article.searchableText);

    for (const span of rawSpans) {
      const norm = normalizeText(span.rawText);
      const resolved = resolvedPlayerMap.get(norm);

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

    // Match against registered persistent players
    for (const player of persistentPlayerRegistry.getAllPlayers()) {
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
      });
    }
  }

  // Step 9: Build and Score Transfer Rumors
  const allRumors: TransferRumor[] = [];

  for (const bucket of playerBuckets.values()) {
    const { player, articles, evidence } = bucket;

    // Deduplicate articles for this player
    const seenArticleIds = new Set<string>();
    const uniquePlayerArticles: NewsItem[] = [];
    const sourceTypes = new Set<string>();

    for (const art of articles) {
      if (!seenArticleIds.has(art.id)) {
        seenArticleIds.add(art.id);
        uniquePlayerArticles.push({
          id: art.id,
          title: art.title,
          url: art.url,
          source: art.source,
          publishedAt: art.publishedAt,
          summary: art.summary,
          playerId: player.id,
        });
        art.sources.forEach((s) => sourceTypes.add(s));
      }
    }

    // Sort news by publishedAt descending
    uniquePlayerArticles.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );

    const mentionCount = evidence.length;
    const uniqueArticleCount = uniquePlayerArticles.length;
    const sourceCount = sourceTypes.size;

    const sourceDistribution: SourceDistribution = {
      rss: sourceTypes.has('RSS') ? 1 : 0,
      press: sourceTypes.has('PRESS') ? 1 : 0,
      x: sourceTypes.has('X') ? 1 : 0,
      forum: sourceTypes.has('FORUM') ? 1 : 0,
    };

    const sources: RumorSourceInfo[] = Array.from(sourceTypes).map((src) => {
      let type: 'RSS' | 'PRESS' | 'X' | 'FORUM' = 'PRESS';
      const upper = src.toUpperCase();
      if (upper === 'RSS' || upper === 'PRESS' || upper === 'X' || upper === 'FORUM') {
        type = upper;
      }
      return {
        name: src,
        type,
        articleCount: uniquePlayerArticles.filter((a) => a.source === src).length || 1,
      };
    });

    const scoreResult = calculateRumorScore({
      mentionCount,
      uniqueArticleCount,
      sourceCount,
      distribution: sourceDistribution,
      latestPublishedAt: uniquePlayerArticles[0]?.publishedAt || new Date().toISOString(),
    });

    const confidenceScore = calculateConfidence(
      uniqueArticleCount,
      sourceCount,
      player.entityResolutionConfidence || 0.85,
    );

    const trendResult = calculateTrend(mentionCount);

    allRumors.push({
      player,
      mentionCount,
      uniqueArticleCount,
      sourceCount,
      trend: trendResult.trend,
      trendPercentage: trendResult.trendPercentage,
      score: scoreResult.score,
      confidenceScore,
      entityResolutionConfidence: player.entityResolutionConfidence,
      rumorConfidence: confidenceScore,
      recencyScore: scoreResult.recencyScore,
      sourceDiversityScore: scoreResult.sourceDiversityScore,
      sourceDistribution,
      sources,
      latestNews: uniquePlayerArticles,
      evidence,
    });
  }

  // Step 10: Apply Fail-Closed Active Incoming Rumor Filter
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

  // Active UI counters
  const activeArticleIds = new Set<string>();
  incomingRumors.forEach((r) => {
    r.latestNews.forEach((n) => activeArticleIds.add(n.id));
  });

  const isConfigured = Boolean(getApiFootballKey());
  const requestStats = getApiFootballRequestStats();
  const registryStats = persistentPlayerRegistry.getStats();

  const squadAgeSeconds = Math.max(
    0,
    Math.round((Date.now() - new Date(squadResolution.fetchedAt).getTime()) / 1000),
  );

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
      candidateSpansExtracted: totalExtractedSpansCount,
      uniqueNormalizedCandidates: clusters.length,
      apiFootballRequests: requestStats,
      candidatePipeline: {
        extracted: totalExtractedSpansCount,
        preApiRejected: preApiRejectedCount,
        clustered: clusters.length,
        registryHits: registryHitsCount,
        negativeCacheHits: negativeCacheHitsCount,
        apiResolutionAttempted: apiAttemptedCount,
        apiResolutionVerified: apiVerifiedCount,
        apiResolutionUnresolved: apiUnresolvedCount,
      },
      registry: {
        playerCount: registryStats.count,
        persistent: true,
        hits: registryStats.hits,
        misses: registryStats.misses,
      },
      identityResolution: {
        attempted: apiAttemptedCount,
        verified: apiVerifiedCount,
        unresolved: apiUnresolvedCount,
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
        liveOrCached: squadResolution.isCachedSnapshot ? 'CACHED' : 'LIVE',
        rawResponseCount: squadResolution.rawResponseCount,
        paginationPages: squadResolution.paginationPages,
        goalkeepersCount: squadResolution.goalkeepersCount,
        defendersCount: squadResolution.defendersCount,
        midfieldersCount: squadResolution.midfieldersCount,
        forwardsCount: squadResolution.forwardsCount,
        verifiedAt: squadResolution.fetchedAt,
        ageSeconds: squadAgeSeconds,
        cacheHit: squadResolution.cacheHit,
        mismatchReport: squadResolution.mismatchReport,
      },
      rejectionCounts: {
        currentSquad: outgoingCount,
        squadUnavailable: squadUnavailableCount,
        dataConflict: dataConflictsCount,
        unresolved: apiUnresolvedCount,
        lowConfidence: lowConfidenceCount,
        stale: staleCount,
        preApiRejected: preApiRejectedCount,
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
