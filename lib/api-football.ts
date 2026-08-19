import type { Player, Position } from '@/types/transfer';
import { normalizeText, scoreCandidateIdentity } from '@/lib/players/matcher';

const API_FOOTBALL_BASE_URL = 'https://v3.football.api-sports.io';
const DEFAULT_TIMEOUT_MS = 8000;

// Cache TTLs in milliseconds
const SQUAD_CACHE_TTL = 1000 * 60 * 60 * 2; // 2 hours
const PLAYER_SEARCH_CACHE_TTL = 1000 * 60 * 60 * 4; // 4 hours
const CURRENT_CLUB_CACHE_TTL = 1000 * 60 * 60 * 1; // 1 hour
const TEAM_LOOKUP_CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

// Current active competition season context (2026-2027 season)
export const CURRENT_SEASON = 2026;

// Galatasaray Team ID in API-Sports
export const GALATASARAY_DEFAULT_TEAM_ID = 645;
export const GALATASARAY_TEAM_NAME = 'Galatasaray';

export type SquadResolutionStatus =
  | 'VERIFIED'
  | 'VERIFIED_EMPTY'
  | 'UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'INVALID'
  | 'DATA_CONFLICT';

export interface SquadResolutionResult {
  status: SquadResolutionStatus;
  season: number;
  teamId: number;
  endpoint: string;
  httpStatus: number;
  squad: Player[];
  rawResponseCount: number;
  normalizedSquadCount: number;
  paginationPages: number;
  goalkeepersCount: number;
  defendersCount: number;
  midfieldersCount: number;
  forwardsCount: number;
  fetchedAt: string;
  cacheAgeMs: number;
  cacheHit: boolean;
  mismatchReport?: string;
}

export interface PlayerResolutionTrace {
  candidateName: string;
  normalizedCandidateName: string;
  requestedEndpoint: string;
  queryParameters: Record<string, string>;
  httpStatus: number;
  apiErrors?: string;
  responseCount: number;
  selectedPlayerId?: number;
  canonicalApiName?: string;
  identityScore: number;
  currentClub?: string;
  currentClubId?: number;
  position?: Position;
  clubStatus?: 'VERIFIED' | 'UNAVAILABLE';
}

// ─── Custom Errors ──────────────────────────────────────────────────────────

export class ApiFootballError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseBody?: unknown,
  ) {
    super(message);
    this.name = 'ApiFootballError';
  }
}

export class ApiFootballKeyMissingError extends ApiFootballError {
  constructor() {
    super(
      'API_FOOTBALL_KEY environment variable is missing. Please configure it in Vercel.',
      500,
    );
    this.name = 'ApiFootballKeyMissingError';
  }
}

export class ApiFootballRateLimitError extends ApiFootballError {
  constructor(message = 'API-Football rate limit reached.') {
    super(message, 429);
    this.name = 'ApiFootballRateLimitError';
  }
}

// ─── API-Football Response Types ───────────────────────────────────────────

interface ApiFootballTeamItem {
  team: {
    id: number;
    name: string;
    code?: string;
    country: string;
    founded?: number;
    logo?: string;
  };
}

interface ApiFootballSquadPlayer {
  id: number;
  name: string;
  age?: number;
  number?: number;
  position: string;
  photo?: string;
}

interface ApiFootballSquadResponse {
  team: {
    id: number;
    name: string;
  };
  players: ApiFootballSquadPlayer[];
}

interface ApiFootballPlayerItem {
  player: {
    id: number;
    name: string;
    firstname: string;
    lastname: string;
    age?: number;
    nationality: string;
    position?: string;
    photo?: string;
  };
  statistics?: Array<{
    team: {
      id: number;
      name: string;
      logo?: string;
    };
    league?: {
      id: number;
      name: string;
      country?: string;
      season?: number;
    };
    games?: {
      position?: string;
    };
  }>;
}

interface ApiFootballEnvelope<T> {
  get: string;
  parameters: Record<string, string>;
  errors: Record<string, string> | string[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: T[];
}

// ─── In-Memory Cache ────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  createdAt: number;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();
const resolutionTracesMap = new Map<string, PlayerResolutionTrace>();

function getCachedEntry<T>(key: string): CacheEntry<T> | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry as CacheEntry<T>;
}

function getCached<T>(key: string): T | null {
  const entry = getCachedEntry<T>(key);
  return entry ? entry.data : null;
}

function setCached<T>(key: string, data: T, ttlMs: number): void {
  memoryCache.set(key, {
    data,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
  });
}

export function invalidateCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    memoryCache.clear();
    resolutionTracesMap.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(keyPrefix)) {
      memoryCache.delete(key);
    }
  }
}

export function getResolutionTraces(): PlayerResolutionTrace[] {
  return Array.from(resolutionTracesMap.values());
}

// ─── Authoritative Position Normalization ───────────────────────────────────

export function normalizePosition(apiPosition?: string): Position {
  if (!apiPosition) return 'MIDFIELDER';
  const pos = apiPosition.toLowerCase().trim();

  if (
    pos === 'goalkeeper' ||
    pos === 'keeper' ||
    pos === 'gk' ||
    pos.includes('goal')
  ) {
    return 'GOALKEEPER';
  }

  if (
    pos === 'defender' ||
    pos === 'df' ||
    pos === 'back' ||
    pos.includes('centre-back') ||
    pos.includes('center back') ||
    pos.includes('fullback') ||
    pos.includes('def')
  ) {
    return 'DEFENDER';
  }

  if (
    pos === 'midfielder' ||
    pos === 'mf' ||
    pos.includes('midfield') ||
    pos.includes('mid')
  ) {
    return 'MIDFIELDER';
  }

  if (
    pos === 'attacker' ||
    pos === 'forward' ||
    pos === 'fw' ||
    pos.includes('striker') ||
    pos.includes('winger') ||
    pos.includes('att')
  ) {
    return 'FORWARD';
  }

  return 'MIDFIELDER';
}

export function getApiFootballKey(): string | undefined {
  const key =
    process.env.API_FOOTBALL_KEY ||
    process.env.API_SPORTS_KEY ||
    process.env.APISPORTS_KEY ||
    process.env.FOOTBALL_API_KEY ||
    process.env.API_FOOTBALL ||
    process.env.NEXT_PUBLIC_API_FOOTBALL_KEY;
  return key && key.trim() !== '' ? key.trim() : undefined;
}

// ─── Base Fetcher ───────────────────────────────────────────────────────────

interface FetchResult<T> {
  payload: ApiFootballEnvelope<T>;
  httpStatus: number;
}

async function fetchFromApiFootballEnvelope<T>(
  endpoint: string,
  params: Record<string, string> = {},
): Promise<FetchResult<T>> {
  const apiKey = getApiFootballKey();
  if (!apiKey) {
    throw new ApiFootballKeyMissingError();
  }

  const url = new URL(`${API_FOOTBALL_BASE_URL}/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-apisports-key': apiKey.trim(),
      },
      signal: controller.signal,
      next: { revalidate: 3600 },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new ApiFootballError(
          'API-Football authentication failed. Check API_FOOTBALL_KEY.',
          res.status,
        );
      }
      if (res.status === 429) {
        throw new ApiFootballRateLimitError('API-Football request rate limit exceeded.');
      }
      throw new ApiFootballError(
        `API-Football request failed with status ${res.status}`,
        res.status,
      );
    }

    const payload = (await res.json()) as ApiFootballEnvelope<T>;

    if (payload.errors && Object.keys(payload.errors).length > 0) {
      const errorMsg =
        typeof payload.errors === 'object'
          ? JSON.stringify(payload.errors)
          : String(payload.errors);
      if (errorMsg.toLowerCase().includes('rate') || errorMsg.toLowerCase().includes('limit')) {
        throw new ApiFootballRateLimitError(`API-Football rate limit error: ${errorMsg}`);
      }
      if (errorMsg.toLowerCase().includes('token') || errorMsg.toLowerCase().includes('key')) {
        throw new ApiFootballError(`API-Football key error: ${errorMsg}`, 401);
      }
      throw new ApiFootballError(`API-Football error: ${errorMsg}`, 400);
    }

    return { payload, httpStatus: res.status };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof ApiFootballError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiFootballError(
        'API-Football request timed out after ' + DEFAULT_TIMEOUT_MS + 'ms',
        408,
      );
    }
    throw new ApiFootballError(
      error instanceof Error ? error.message : 'Unknown API-Football error',
      500,
    );
  }
}

async function fetchFromApiFootball<T>(
  endpoint: string,
  params: Record<string, string> = {},
): Promise<T[]> {
  const result = await fetchFromApiFootballEnvelope<T>(endpoint, params);
  return result.payload.response || [];
}

// ─── Team Resolution ────────────────────────────────────────────────────────

export async function resolveGalatasarayTeam(): Promise<{ id: number; name: string }> {
  const cacheKey = 'team:galatasaray';
  const cached = getCached<{ id: number; name: string }>(cacheKey);
  if (cached) return cached;

  if (!getApiFootballKey()) {
    return { id: GALATASARAY_DEFAULT_TEAM_ID, name: GALATASARAY_TEAM_NAME };
  }

  try {
    const teams = await fetchFromApiFootball<ApiFootballTeamItem>('teams', {
      search: 'Galatasaray',
    });

    const gsTeam =
      teams.find(
        (t) =>
          t.team.country?.toLowerCase() === 'turkey' &&
          t.team.name.toLowerCase().includes('galatasaray'),
      ) || teams[0];

    const result = {
      id: gsTeam ? gsTeam.team.id : GALATASARAY_DEFAULT_TEAM_ID,
      name: gsTeam ? gsTeam.team.name : GALATASARAY_TEAM_NAME,
    };

    setCached(cacheKey, result, TEAM_LOOKUP_CACHE_TTL);
    return result;
  } catch {
    return { id: GALATASARAY_DEFAULT_TEAM_ID, name: GALATASARAY_TEAM_NAME };
  }
}

// ─── Authoritative Squad Resolution ─────────────────────────────────────────

export async function getGalatasaraySquadDetailed(
  teamId?: number,
  targetSeason: number = CURRENT_SEASON,
): Promise<SquadResolutionResult> {
  const resolvedTeamId = teamId || (await resolveGalatasarayTeam()).id;
  const cacheKey = `squad_detailed:${resolvedTeamId}:${targetSeason}`;
  const cachedEntry = getCachedEntry<SquadResolutionResult>(cacheKey);

  if (cachedEntry) {
    return {
      ...cachedEntry.data,
      cacheAgeMs: Date.now() - cachedEntry.createdAt,
      cacheHit: true,
    };
  }

  // Fail-closed if API key is not configured: No synthetic squad fallback
  if (!getApiFootballKey()) {
    return {
      status: 'UNAVAILABLE',
      season: targetSeason,
      teamId: resolvedTeamId,
      endpoint: `${API_FOOTBALL_BASE_URL}/players/squads?team=${resolvedTeamId}`,
      httpStatus: 0,
      squad: [],
      rawResponseCount: 0,
      normalizedSquadCount: 0,
      paginationPages: 0,
      goalkeepersCount: 0,
      defendersCount: 0,
      midfieldersCount: 0,
      forwardsCount: 0,
      fetchedAt: new Date().toISOString(),
      cacheAgeMs: 0,
      cacheHit: false,
      mismatchReport: 'API_FOOTBALL_KEY is not configured in environment.',
    };
  }

  // Query live paginated API-Football endpoints
  try {
    let playersData: ApiFootballSquadPlayer[] = [];
    let endpointUsed = `${API_FOOTBALL_BASE_URL}/players/squads?team=${resolvedTeamId}`;
    let totalPages = 1;
    let finalHttpStatus = 200;

    // 1. Try players/squads endpoint
    const squadFetch = await fetchFromApiFootballEnvelope<ApiFootballSquadResponse>('players/squads', {
      team: String(resolvedTeamId),
    });
    finalHttpStatus = squadFetch.httpStatus;
    const squadResponses = squadFetch.payload.response || [];

    if (squadResponses && squadResponses.length > 0) {
      playersData = squadResponses[0].players || [];
    }

    // 2. If squad endpoint returned fewer than 18 players, fetch paginated season players endpoint
    if (playersData.length < 18) {
      endpointUsed = `${API_FOOTBALL_BASE_URL}/players?team=${resolvedTeamId}&season=${targetSeason}`;
      const firstPage = await fetchFromApiFootballEnvelope<ApiFootballPlayerItem>('players', {
        team: String(resolvedTeamId),
        season: String(targetSeason),
        page: '1',
      });
      finalHttpStatus = firstPage.httpStatus;
      totalPages = firstPage.payload.paging?.total || 1;
      const allSeasonPlayers = [...(firstPage.payload.response || [])];

      // Fetch remaining pages if paginated
      for (let p = 2; p <= totalPages; p++) {
        const nextPage = await fetchFromApiFootballEnvelope<ApiFootballPlayerItem>('players', {
          team: String(resolvedTeamId),
          season: String(targetSeason),
          page: String(p),
        });
        if (nextPage.payload.response) {
          allSeasonPlayers.push(...nextPage.payload.response);
        }
      }

      if (allSeasonPlayers.length > 0) {
        playersData = allSeasonPlayers.map((item) => ({
          id: item.player.id,
          name: item.player.name,
          age: item.player.age,
          position: item.statistics?.[0]?.games?.position || item.player.position || 'Midfielder',
          photo: item.player.photo,
        }));
      }
    }

    // Check for verified empty response
    if (playersData.length === 0) {
      const emptyResult: SquadResolutionResult = {
        status: 'VERIFIED_EMPTY',
        season: targetSeason,
        teamId: resolvedTeamId,
        endpoint: endpointUsed,
        httpStatus: finalHttpStatus,
        squad: [],
        rawResponseCount: 0,
        normalizedSquadCount: 0,
        paginationPages: totalPages,
        goalkeepersCount: 0,
        defendersCount: 0,
        midfieldersCount: 0,
        forwardsCount: 0,
        fetchedAt: new Date().toISOString(),
        cacheAgeMs: 0,
        cacheHit: false,
        mismatchReport: 'Upstream returned 0 players for team ' + resolvedTeamId,
      };
      setCached(cacheKey, emptyResult, SQUAD_CACHE_TTL);
      return emptyResult;
    }

    // 3. Deduplicate players by numeric ID
    const uniquePlayersMap = new Map<number, ApiFootballSquadPlayer>();
    for (const p of playersData) {
      if (typeof p.id === 'number' && !uniquePlayersMap.has(p.id)) {
        uniquePlayersMap.set(p.id, p);
      }
    }

    const uniquePlayersList = Array.from(uniquePlayersMap.values());

    // 4. Normalize players
    const normalizedSquad: Player[] = uniquePlayersList.map((p) => {
      const nameParts = p.name.trim().split(/\s+/);
      const firstName = nameParts.length > 1 ? nameParts[0] : '';
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0];

      const aliases: string[] = [p.name];
      if (lastName && lastName !== p.name) {
        aliases.push(lastName);
        if (firstName) {
          aliases.push(`${firstName[0]}. ${lastName}`);
          aliases.push(`${firstName} ${lastName[0]}.`);
        }
      }

      return {
        id: `api-football-${p.id}`,
        externalId: p.id,
        name: p.name,
        firstName,
        lastName,
        position: normalizePosition(p.position),
        currentClub: GALATASARAY_TEAM_NAME,
        currentClubId: resolvedTeamId,
        currentClubSeason: targetSeason,
        currentClubResolvedAt: new Date().toISOString(),
        nationality: 'Turkey',
        age: p.age,
        photo: p.photo,
        aliases,
        entityResolutionConfidence: 1.0,
        lastResolvedAt: new Date().toISOString(),
      };
    });

    const goalkeepersCount = normalizedSquad.filter((p) => p.position === 'GOALKEEPER').length;
    const defendersCount = normalizedSquad.filter((p) => p.position === 'DEFENDER').length;
    const midfieldersCount = normalizedSquad.filter((p) => p.position === 'MIDFIELDER').length;
    const forwardsCount = normalizedSquad.filter((p) => p.position === 'FORWARD').length;

    let status: SquadResolutionStatus = 'VERIFIED';
    let mismatchReport: string | undefined;

    // Completeness check
    if (
      normalizedSquad.length < 18 ||
      goalkeepersCount === 0 ||
      defendersCount === 0 ||
      midfieldersCount === 0 ||
      forwardsCount === 0
    ) {
      status = 'INVALID';
      mismatchReport = `Squad failed completeness checks: size=${normalizedSquad.length}, GK=${goalkeepersCount}, DEF=${defendersCount}, MID=${midfieldersCount}, FWD=${forwardsCount}`;
    }

    const result: SquadResolutionResult = {
      status,
      season: targetSeason,
      teamId: resolvedTeamId,
      endpoint: endpointUsed,
      httpStatus: finalHttpStatus,
      squad: normalizedSquad,
      rawResponseCount: playersData.length,
      normalizedSquadCount: normalizedSquad.length,
      paginationPages: totalPages,
      goalkeepersCount,
      defendersCount,
      midfieldersCount,
      forwardsCount,
      fetchedAt: new Date().toISOString(),
      cacheAgeMs: 0,
      cacheHit: false,
      mismatchReport,
    };

    setCached(cacheKey, result, SQUAD_CACHE_TTL);
    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown API error';
    let status: SquadResolutionStatus = 'UNAVAILABLE';
    let httpStatus = 500;

    if (err instanceof ApiFootballRateLimitError) {
      status = 'RATE_LIMITED';
      httpStatus = 429;
    } else if (err instanceof ApiFootballKeyMissingError) {
      status = 'UNAVAILABLE';
      httpStatus = 0;
    } else if (err instanceof ApiFootballError) {
      httpStatus = err.statusCode || 500;
      if (httpStatus === 429) status = 'RATE_LIMITED';
    }

    return {
      status,
      season: targetSeason,
      teamId: resolvedTeamId,
      endpoint: `${API_FOOTBALL_BASE_URL}/players/squads?team=${resolvedTeamId}`,
      httpStatus,
      squad: [],
      rawResponseCount: 0,
      normalizedSquadCount: 0,
      paginationPages: 0,
      goalkeepersCount: 0,
      defendersCount: 0,
      midfieldersCount: 0,
      forwardsCount: 0,
      fetchedAt: new Date().toISOString(),
      cacheAgeMs: 0,
      cacheHit: false,
      mismatchReport: errorMsg,
    };
  }
}

export async function getGalatasaraySquad(
  teamId?: number,
  targetSeason: number = CURRENT_SEASON,
): Promise<Player[]> {
  const result = await getGalatasaraySquadDetailed(teamId, targetSeason);
  return result.squad;
}

// ─── Authoritative Player Identity & Season-Aware Current Club Resolution ───

export interface ResolvedClubInfo {
  clubName: string;
  clubId?: number;
  season: number;
  position: Position;
  resolvedAt: string;
  status: 'VERIFIED' | 'UNAVAILABLE';
}

export interface ResolvedPlayerIdentity {
  id: number;
  name: string;
  firstname: string;
  lastname: string;
  nationality: string;
  age?: number;
  photo?: string;
  position?: Position;
  identityScore: number;
  matchMethod: string;
}

/**
 * Resolve player basic identity from API-Football.
 * Queries `players/profiles?search=...` (or fallback `players?search=...&season=...`)
 * and scores candidate results deterministically.
 */
export async function resolvePlayerIdentity(
  candidateName: string,
): Promise<ResolvedPlayerIdentity | null> {
  const trimmed = candidateName.trim();
  if (!trimmed || trimmed.length < 3) return null;

  if (!getApiFootballKey()) {
    return null;
  }

  const cacheKey = `player_identity:${trimmed.toLowerCase()}`;
  const cached = getCached<ResolvedPlayerIdentity>(cacheKey);
  if (cached) return cached;

  const trace: PlayerResolutionTrace = {
    candidateName: trimmed,
    normalizedCandidateName: normalizeText(trimmed),
    requestedEndpoint: 'players/profiles',
    queryParameters: { search: trimmed },
    httpStatus: 200,
    responseCount: 0,
    identityScore: 0,
  };

  try {
    let candidateItems: ApiFootballPlayerItem[] = [];

    // Strategy 1: Dedicated `/players/profiles?search=...` (Does not require league/season)
    try {
      const profileResult = await fetchFromApiFootballEnvelope<ApiFootballPlayerItem>('players/profiles', {
        search: trimmed,
      });
      trace.requestedEndpoint = 'players/profiles';
      trace.httpStatus = profileResult.httpStatus;
      candidateItems = profileResult.payload.response || [];
    } catch (profileErr) {
      // If profiles endpoint is not supported on current plan, fallback to `/players?search=...&season=...`
      const errorMsg = profileErr instanceof Error ? profileErr.message : String(profileErr);
      trace.apiErrors = errorMsg;

      try {
        const seasonSearch = await fetchFromApiFootballEnvelope<ApiFootballPlayerItem>('players', {
          search: trimmed,
          season: String(CURRENT_SEASON),
        });
        trace.requestedEndpoint = 'players';
        trace.queryParameters = { search: trimmed, season: String(CURRENT_SEASON) };
        trace.httpStatus = seasonSearch.httpStatus;
        candidateItems = seasonSearch.payload.response || [];
      } catch (seasonErr) {
        trace.apiErrors = seasonErr instanceof Error ? seasonErr.message : String(seasonErr);
      }
    }

    // Strategy 2: If searching full name returned 0 results, search by last name token if distinct
    if (candidateItems.length === 0) {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        const lastName = parts[parts.length - 1];
        if (lastName.length >= 4) {
          try {
            const fallbackResult = await fetchFromApiFootballEnvelope<ApiFootballPlayerItem>('players/profiles', {
              search: lastName,
            });
            if (fallbackResult.payload.response && fallbackResult.payload.response.length > 0) {
              candidateItems = fallbackResult.payload.response;
              trace.queryParameters = { search: lastName };
            }
          } catch {
            // fallback ignore
          }
        }
      }
    }

    trace.responseCount = candidateItems.length;

    if (candidateItems.length === 0) {
      resolutionTracesMap.set(trace.normalizedCandidateName, trace);
      return null;
    }

    // Score all returned candidate profiles
    let bestPlayer: ApiFootballPlayerItem['player'] | null = null;
    let bestScore = 0;
    let bestMatchMethod = 'UNMATCHED';

    for (const item of candidateItems) {
      const p = item.player;
      const scoreRes = scoreCandidateIdentity(trimmed, p);
      if (scoreRes.score > bestScore) {
        bestScore = scoreRes.score;
        bestPlayer = p;
        bestMatchMethod = scoreRes.matchMethod;
      }
    }

    trace.identityScore = bestScore;

    // Threshold check (Must score >= 0.80)
    if (!bestPlayer || bestScore < 0.80) {
      resolutionTracesMap.set(trace.normalizedCandidateName, trace);
      return null;
    }

    trace.selectedPlayerId = bestPlayer.id;
    trace.canonicalApiName = bestPlayer.name;
    trace.position = normalizePosition(bestPlayer.position);

    const identity: ResolvedPlayerIdentity = {
      id: bestPlayer.id,
      name: bestPlayer.name,
      firstname: bestPlayer.firstname || '',
      lastname: bestPlayer.lastname || bestPlayer.name,
      nationality: bestPlayer.nationality || '',
      age: bestPlayer.age,
      photo: bestPlayer.photo,
      position: normalizePosition(bestPlayer.position),
      identityScore: bestScore,
      matchMethod: bestMatchMethod,
    };

    setCached(cacheKey, identity, PLAYER_SEARCH_CACHE_TTL);
    resolutionTracesMap.set(trace.normalizedCandidateName, trace);
    return identity;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    trace.apiErrors = errorMsg;
    resolutionTracesMap.set(trace.normalizedCandidateName, trace);
    return null;
  }
}

/**
 * Resolve current club and season membership for a given verified player ID.
 * Queries `players?id=${playerId}&season=...` across target seasons.
 */
export async function resolveCurrentClub(
  playerId: number,
  targetSeason: number = CURRENT_SEASON,
  initialPosition?: Position,
): Promise<ResolvedClubInfo> {
  const cacheKey = `player_club:${playerId}:${targetSeason}`;
  const cached = getCached<ResolvedClubInfo>(cacheKey);
  if (cached) return cached;

  const defaultUnavailable: ResolvedClubInfo = {
    clubName: 'Unknown Club',
    clubId: undefined,
    season: targetSeason,
    position: initialPosition || 'MIDFIELDER',
    resolvedAt: new Date().toISOString(),
    status: 'UNAVAILABLE',
  };

  if (!getApiFootballKey()) {
    return defaultUnavailable;
  }

  try {
    // 1. Try target season (2026)
    let playerRecords = await fetchFromApiFootball<ApiFootballPlayerItem>('players', {
      id: String(playerId),
      season: String(targetSeason),
    });

    let effectiveSeason = targetSeason;

    // 2. If no statistics for 2026, check 2025
    if (
      !playerRecords ||
      playerRecords.length === 0 ||
      !playerRecords[0].statistics ||
      playerRecords[0].statistics.length === 0
    ) {
      playerRecords = await fetchFromApiFootball<ApiFootballPlayerItem>('players', {
        id: String(playerId),
        season: String(targetSeason - 1),
      });
      effectiveSeason = targetSeason - 1;
    }

    // 3. If no statistics for 2025, check 2024
    if (
      !playerRecords ||
      playerRecords.length === 0 ||
      !playerRecords[0].statistics ||
      playerRecords[0].statistics.length === 0
    ) {
      playerRecords = await fetchFromApiFootball<ApiFootballPlayerItem>('players', {
        id: String(playerId),
        season: String(targetSeason - 2),
      });
      effectiveSeason = targetSeason - 2;
    }

    if (!playerRecords || playerRecords.length === 0 || !playerRecords[0].statistics || playerRecords[0].statistics.length === 0) {
      setCached(cacheKey, defaultUnavailable, CURRENT_CLUB_CACHE_TTL);
      return defaultUnavailable;
    }

    const item = playerRecords[0];
    const stats = item.statistics || [];
    const primaryStat = stats[0];

    const clubInfo: ResolvedClubInfo = {
      clubName: primaryStat.team.name,
      clubId: primaryStat.team.id,
      season: effectiveSeason,
      position: normalizePosition(primaryStat.games?.position || initialPosition),
      resolvedAt: new Date().toISOString(),
      status: 'VERIFIED',
    };

    setCached(cacheKey, clubInfo, CURRENT_CLUB_CACHE_TTL);

    // Update trace if exists
    for (const trace of resolutionTracesMap.values()) {
      if (trace.selectedPlayerId === playerId) {
        trace.currentClub = clubInfo.clubName;
        trace.currentClubId = clubInfo.clubId;
        trace.position = clubInfo.position;
        trace.clubStatus = 'VERIFIED';
      }
    }

    return clubInfo;
  } catch {
    setCached(cacheKey, defaultUnavailable, CURRENT_CLUB_CACHE_TTL);
    return defaultUnavailable;
  }
}

/**
 * Authoritative player search combining identity resolution and season-aware club lookup.
 */
export async function searchPlayer(
  name: string,
  targetSeason: number = CURRENT_SEASON,
): Promise<Player[]> {
  const identity = await resolvePlayerIdentity(name);
  if (!identity) return [];

  const clubInfo = await resolveCurrentClub(identity.id, targetSeason, identity.position);

  const aliases: string[] = [identity.name];
  if (identity.lastname && identity.lastname !== identity.name) {
    aliases.push(identity.lastname);
  }
  if (identity.firstname && identity.lastname) {
    aliases.push(`${identity.firstname} ${identity.lastname}`);
    aliases.push(`${identity.firstname[0]}. ${identity.lastname}`);
  }

  const resolvedPlayer: Player = {
    id: `api-football-${identity.id}`,
    externalId: identity.id,
    name: identity.name,
    firstName: identity.firstname,
    lastName: identity.lastname,
    position: clubInfo.position || identity.position || 'MIDFIELDER',
    currentClub: clubInfo.clubName,
    currentClubId: clubInfo.clubId,
    currentClubSeason: clubInfo.season || targetSeason,
    currentClubResolvedAt: clubInfo.resolvedAt,
    nationality: identity.nationality,
    age: identity.age,
    photo: identity.photo,
    aliases,
    entityResolutionConfidence: identity.identityScore,
    lastResolvedAt: new Date().toISOString(),
  };

  return [resolvedPlayer];
}
