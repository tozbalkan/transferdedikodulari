import fs from 'fs';
import path from 'path';
import type { Player, Position } from '@/types/transfer';
import { normalizeText, scoreCandidateIdentity, AMBIGUOUS_SURNAMES } from '@/lib/players/matcher';
import { persistentPlayerRegistry } from '@/lib/players/persistent-registry';
import { negativeResolutionCache } from '@/lib/players/negative-cache';

const API_FOOTBALL_BASE_URL = 'https://v3.football.api-sports.io';
const DEFAULT_TIMEOUT_MS = 8000;

// Cache TTLs in milliseconds
const SQUAD_CACHE_TTL = 1000 * 60 * 60 * 2; // 2 hours
const PLAYER_SEARCH_CACHE_TTL = 1000 * 60 * 60 * 4; // 4 hours
const CURRENT_CLUB_CACHE_TTL = 1000 * 60 * 60 * 1; // 1 hour

// Current active competition season context (2026-2027 season)
export const CURRENT_SEASON = 2026;

// Galatasaray Team ID in API-Sports
export const GALATASARAY_DEFAULT_TEAM_ID = 645;
export const GALATASARAY_TEAM_NAME = 'Galatasaray';

// Maximum upstream API requests permitted per aggregation run
export const MAX_API_FOOTBALL_REQUESTS_PER_RUN = 6;

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
  isCachedSnapshot?: boolean;
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
  source?: 'API_FOOTBALL' | 'PERSISTENT_REGISTRY' | 'NEGATIVE_CACHE';
}

// ─── Circuit Breaker & Request Budget State ─────────────────────────────────

export interface CircuitBreakerState {
  isTripped: boolean;
  rateLimitType?: 'DAILY_QUOTA' | 'MINUTE_RATE_LIMIT';
  trippedAt?: number;
  cooldownUntil?: number;
  errorMessage?: string;
}

let runRequestCount = 0;
let totalRequestsCount = 0;

const circuitBreaker: CircuitBreakerState = {
  isTripped: false,
};

export function resetRunRequestBudget(): void {
  runRequestCount = 0;
}

export function getApiFootballRequestStats(): {
  total: number;
  budget: number;
  budgetRemaining: number;
  circuitBreakerState: 'CLOSED' | 'OPEN';
  rateLimitType?: string;
} {
  const now = Date.now();
  if (circuitBreaker.isTripped && circuitBreaker.cooldownUntil && now > circuitBreaker.cooldownUntil) {
    circuitBreaker.isTripped = false;
    circuitBreaker.rateLimitType = undefined;
  }

  return {
    total: totalRequestsCount,
    budget: MAX_API_FOOTBALL_REQUESTS_PER_RUN,
    budgetRemaining: Math.max(0, MAX_API_FOOTBALL_REQUESTS_PER_RUN - runRequestCount),
    circuitBreakerState: circuitBreaker.isTripped ? 'OPEN' : 'CLOSED',
    rateLimitType: circuitBreaker.rateLimitType,
  };
}

function tripCircuitBreaker(errorMessage: string): void {
  const now = Date.now();
  circuitBreaker.isTripped = true;
  circuitBreaker.trippedAt = now;
  circuitBreaker.errorMessage = errorMessage;

  if (errorMessage.toLowerCase().includes('day') || errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('daily')) {
    circuitBreaker.rateLimitType = 'DAILY_QUOTA';
    circuitBreaker.cooldownUntil = now + 60 * 60 * 1000; // 1 hour cooldown
  } else {
    circuitBreaker.rateLimitType = 'MINUTE_RATE_LIMIT';
    circuitBreaker.cooldownUntil = now + 60 * 1000; // 1 minute cooldown
  }
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

export class ApiFootballBudgetExhaustedError extends ApiFootballError {
  constructor(message = 'API-Football per-run request budget exhausted.') {
    super(message, 429);
    this.name = 'ApiFootballBudgetExhaustedError';
  }
}

// ─── API-Football Response Types ───────────────────────────────────────────

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

// ─── Position Normalization ────────────────────────────────────────────────

export function normalizePosition(apiPosition?: string): Position {
  if (!apiPosition) return 'MIDFIELDER';
  const pos = apiPosition.toLowerCase().trim();

  if (pos === 'goalkeeper' || pos === 'keeper' || pos === 'gk' || pos.includes('goal')) {
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

  if (pos === 'midfielder' || pos === 'mf' || pos.includes('midfield') || pos.includes('mid')) {
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

// ─── Base Fetcher with Circuit Breaker & Request Budget ─────────────────────

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

  // Check Circuit Breaker
  const now = Date.now();
  if (circuitBreaker.isTripped && circuitBreaker.cooldownUntil && now < circuitBreaker.cooldownUntil) {
    throw new ApiFootballRateLimitError(
      `Circuit breaker OPEN (${circuitBreaker.rateLimitType}): ${circuitBreaker.errorMessage}`,
    );
  }

  // Check Request Budget
  if (runRequestCount >= MAX_API_FOOTBALL_REQUESTS_PER_RUN) {
    throw new ApiFootballBudgetExhaustedError();
  }

  const url = new URL(`${API_FOOTBALL_BASE_URL}/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    runRequestCount++;
    totalRequestsCount++;

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
        tripCircuitBreaker('HTTP 429 Rate limit exceeded');
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
      if (
        errorMsg.toLowerCase().includes('rate') ||
        errorMsg.toLowerCase().includes('limit') ||
        errorMsg.toLowerCase().includes('reached') ||
        errorMsg.toLowerCase().includes('plan')
      ) {
        tripCircuitBreaker(errorMsg);
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
  return { id: GALATASARAY_DEFAULT_TEAM_ID, name: GALATASARAY_TEAM_NAME };
}

// ─── Persistent Squad Snapshot Helper ──────────────────────────────────────

function getSquadSnapshotPath(): string {
  return path.join(process.cwd(), 'data', 'galatasaray-squad-snapshot.json');
}

function loadSquadSnapshot(): { squad: Player[]; verifiedAt: string } | null {
  try {
    const filePath = getSquadSnapshotPath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.players) && data.players.length >= 18) {
        return {
          squad: data.players,
          verifiedAt: data.verifiedAt || new Date().toISOString(),
        };
      }
    }
  } catch {
    // Ignore read errors
  }
  return null;
}

function saveSquadSnapshot(squad: Player[]): void {
  try {
    const filePath = getSquadSnapshotPath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = {
      teamId: GALATASARAY_DEFAULT_TEAM_ID,
      season: CURRENT_SEASON,
      verifiedAt: new Date().toISOString(),
      sourceEndpoint: `${API_FOOTBALL_BASE_URL}/players/squads?team=${GALATASARAY_DEFAULT_TEAM_ID}`,
      source: 'API_FOOTBALL',
      players: squad,
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // Ignore write errors in read-only serverless
  }
}

// ─── Authoritative Squad Resolution ─────────────────────────────────────────

export async function getGalatasaraySquadDetailed(
  teamId?: number,
  targetSeason: number = CURRENT_SEASON,
): Promise<SquadResolutionResult> {
  const resolvedTeamId = teamId || GALATASARAY_DEFAULT_TEAM_ID;
  const cacheKey = `squad_detailed:${resolvedTeamId}:${targetSeason}`;
  const cachedEntry = getCachedEntry<SquadResolutionResult>(cacheKey);

  if (cachedEntry) {
    return {
      ...cachedEntry.data,
      cacheAgeMs: Date.now() - cachedEntry.createdAt,
      cacheHit: true,
    };
  }

  // 1. Try to query live API-Football if key exists and not rate-limited
  if (getApiFootballKey() && !circuitBreaker.isTripped && runRequestCount < MAX_API_FOOTBALL_REQUESTS_PER_RUN) {
    try {
      let playersData: ApiFootballSquadPlayer[] = [];
      const totalPages = 1;
      let finalHttpStatus = 200;

      const squadFetch = await fetchFromApiFootballEnvelope<ApiFootballSquadResponse>('players/squads', {
        team: String(resolvedTeamId),
      });
      finalHttpStatus = squadFetch.httpStatus;
      const squadResponses = squadFetch.payload.response || [];

      if (squadResponses && squadResponses.length > 0) {
        playersData = squadResponses[0].players || [];
      }

      if (playersData.length >= 18) {
        // Deduplicate and normalize players
        const uniquePlayersMap = new Map<number, ApiFootballSquadPlayer>();
        for (const p of playersData) {
          if (typeof p.id === 'number' && !uniquePlayersMap.has(p.id)) {
            uniquePlayersMap.set(p.id, p);
          }
        }

        const normalizedSquad: Player[] = Array.from(uniquePlayersMap.values()).map((p) => {
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

        // Save fresh verified snapshot to disk
        saveSquadSnapshot(normalizedSquad);

        const goalkeepersCount = normalizedSquad.filter((p) => p.position === 'GOALKEEPER').length;
        const defendersCount = normalizedSquad.filter((p) => p.position === 'DEFENDER').length;
        const midfieldersCount = normalizedSquad.filter((p) => p.position === 'MIDFIELDER').length;
        const forwardsCount = normalizedSquad.filter((p) => p.position === 'FORWARD').length;

        const liveResult: SquadResolutionResult = {
          status: 'VERIFIED',
          season: targetSeason,
          teamId: resolvedTeamId,
          endpoint: `${API_FOOTBALL_BASE_URL}/players/squads?team=${resolvedTeamId}`,
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
        };

        setCached(cacheKey, liveResult, SQUAD_CACHE_TTL);
        return liveResult;
      }
    } catch {
      // Live request failed or rate-limited; proceed to snapshot recovery below
    }
  }

  // 2. Persistent Snapshot Recovery (Phase 3.13.3)
  const snapshot = loadSquadSnapshot();
  if (snapshot && snapshot.squad.length >= 18) {
    const goalkeepersCount = snapshot.squad.filter((p) => p.position === 'GOALKEEPER').length;
    const defendersCount = snapshot.squad.filter((p) => p.position === 'DEFENDER').length;
    const midfieldersCount = snapshot.squad.filter((p) => p.position === 'MIDFIELDER').length;
    const forwardsCount = snapshot.squad.filter((p) => p.position === 'FORWARD').length;

    const snapshotResult: SquadResolutionResult = {
      status: 'VERIFIED',
      season: targetSeason,
      teamId: resolvedTeamId,
      endpoint: `${API_FOOTBALL_BASE_URL}/players/squads?team=${resolvedTeamId}`,
      httpStatus: 200,
      squad: snapshot.squad,
      rawResponseCount: snapshot.squad.length,
      normalizedSquadCount: snapshot.squad.length,
      paginationPages: 1,
      goalkeepersCount,
      defendersCount,
      midfieldersCount,
      forwardsCount,
      fetchedAt: snapshot.verifiedAt,
      cacheAgeMs: 0,
      cacheHit: true,
      isCachedSnapshot: true,
      mismatchReport: circuitBreaker.isTripped
        ? `Using verified squad snapshot (${circuitBreaker.rateLimitType || 'RATE_LIMITED'})`
        : undefined,
    };

    setCached(cacheKey, snapshotResult, SQUAD_CACHE_TTL);
    return snapshotResult;
  }

  // 3. Fail-Closed if no key and no verified snapshot exists
  return {
    status: circuitBreaker.isTripped ? 'RATE_LIMITED' : 'UNAVAILABLE',
    season: targetSeason,
    teamId: resolvedTeamId,
    endpoint: `${API_FOOTBALL_BASE_URL}/players/squads?team=${resolvedTeamId}`,
    httpStatus: circuitBreaker.isTripped ? 429 : 0,
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
    mismatchReport: circuitBreaker.errorMessage || 'API_FOOTBALL_KEY unavailable and no squad snapshot found.',
  };
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
 * Resolve player basic identity.
 * 1. Checks Persistent Player Registry (0 network calls).
 * 2. Checks Negative Resolution Cache (0 network calls).
 * 3. Enforces Circuit Breaker & Request Budget.
 * 4. Queries `/players?search=...` upstream if budget permits.
 */
export async function resolvePlayerIdentity(
  candidateName: string,
): Promise<ResolvedPlayerIdentity | null> {
  const trimmed = candidateName.trim();
  if (!trimmed || trimmed.length < 3) return null;

  const normCandidate = normalizeText(trimmed);
  if (normCandidate.length < 3) return null;

  // 1. Check in-memory session cache
  const cacheKey = `player_identity:${normCandidate}`;
  const cached = getCached<ResolvedPlayerIdentity>(cacheKey);
  if (cached) return cached;

  // 2. Check Persistent Player Registry (Disk & Memory)
  const registryPlayer = persistentPlayerRegistry.findPlayer(trimmed);
  if (registryPlayer && typeof registryPlayer.externalId === 'number') {
    const identity: ResolvedPlayerIdentity = {
      id: registryPlayer.externalId,
      name: registryPlayer.name,
      firstname: registryPlayer.firstName || '',
      lastname: registryPlayer.lastName || registryPlayer.name,
      nationality: registryPlayer.nationality || '',
      age: registryPlayer.age,
      photo: registryPlayer.photo,
      position: registryPlayer.position,
      identityScore: registryPlayer.entityResolutionConfidence || 1.0,
      matchMethod: 'PERSISTENT_REGISTRY',
    };

    setCached(cacheKey, identity, PLAYER_SEARCH_CACHE_TTL);
    resolutionTracesMap.set(normCandidate, {
      candidateName: trimmed,
      normalizedCandidateName: normCandidate,
      requestedEndpoint: 'local:persistent_registry',
      queryParameters: { search: trimmed },
      httpStatus: 200,
      responseCount: 1,
      selectedPlayerId: identity.id,
      canonicalApiName: identity.name,
      identityScore: identity.identityScore,
      currentClub: registryPlayer.currentClub,
      currentClubId: registryPlayer.currentClubId,
      position: identity.position,
      clubStatus: registryPlayer.currentClub ? 'VERIFIED' : 'UNAVAILABLE',
      source: 'PERSISTENT_REGISTRY',
    });

    return identity;
  }

  // 3. Check Negative Resolution Cache
  const negativeEntry = negativeResolutionCache.get(normCandidate);
  if (negativeEntry) {
    resolutionTracesMap.set(normCandidate, {
      candidateName: trimmed,
      normalizedCandidateName: normCandidate,
      requestedEndpoint: 'local:negative_cache',
      queryParameters: { search: trimmed },
      httpStatus: 200,
      responseCount: 0,
      identityScore: 0,
      apiErrors: `Negatively cached (${negativeEntry.status}): ${negativeEntry.reason}`,
      source: 'NEGATIVE_CACHE',
    });
    return null;
  }

  // 4. Check API Key, Circuit Breaker & Request Budget
  if (!getApiFootballKey()) return null;

  const now = Date.now();
  if (circuitBreaker.isTripped && circuitBreaker.cooldownUntil && now < circuitBreaker.cooldownUntil) {
    resolutionTracesMap.set(normCandidate, {
      candidateName: trimmed,
      normalizedCandidateName: normCandidate,
      requestedEndpoint: 'circuit_breaker_open',
      queryParameters: { search: trimmed },
      httpStatus: 429,
      responseCount: 0,
      identityScore: 0,
      apiErrors: `Circuit breaker OPEN (${circuitBreaker.rateLimitType})`,
    });
    return null;
  }

  if (runRequestCount >= MAX_API_FOOTBALL_REQUESTS_PER_RUN) {
    resolutionTracesMap.set(normCandidate, {
      candidateName: trimmed,
      normalizedCandidateName: normCandidate,
      requestedEndpoint: 'request_budget_exhausted',
      queryParameters: { search: trimmed },
      httpStatus: 429,
      responseCount: 0,
      identityScore: 0,
      apiErrors: 'Per-run request budget exhausted',
    });
    return null;
  }

  const trace: PlayerResolutionTrace = {
    candidateName: trimmed,
    normalizedCandidateName: normCandidate,
    requestedEndpoint: 'players',
    queryParameters: { search: trimmed },
    httpStatus: 200,
    responseCount: 0,
    identityScore: 0,
    source: 'API_FOOTBALL',
  };

  try {
    let candidateItems: ApiFootballPlayerItem[] = [];

    // Strategy 1: Search using `/players?search=...`
    try {
      const searchResult = await fetchFromApiFootballEnvelope<ApiFootballPlayerItem>('players', {
        search: trimmed,
      });
      trace.requestedEndpoint = 'players';
      trace.queryParameters = { search: trimmed };
      trace.httpStatus = searchResult.httpStatus;
      candidateItems = searchResult.payload.response || [];
    } catch (searchErr) {
      const errorMsg = searchErr instanceof Error ? searchErr.message : String(searchErr);
      trace.apiErrors = errorMsg;

      if (normCandidate !== trimmed.toLowerCase() && !circuitBreaker.isTripped) {
        try {
          const normResult = await fetchFromApiFootballEnvelope<ApiFootballPlayerItem>('players', {
            search: normCandidate,
          });
          trace.queryParameters = { search: normCandidate };
          trace.httpStatus = normResult.httpStatus;
          candidateItems = normResult.payload.response || [];
        } catch {
          // ignore
        }
      }
    }

    // Strategy 2: If searching full name returned 0 results, search by last name token if distinct
    if (candidateItems.length === 0 && !circuitBreaker.isTripped && runRequestCount < MAX_API_FOOTBALL_REQUESTS_PER_RUN) {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        const lastName = parts[parts.length - 1];
        const normLast = normalizeText(lastName);
        if (normLast.length >= 4 && !AMBIGUOUS_SURNAMES.has(normLast)) {
          try {
            const fallbackResult = await fetchFromApiFootballEnvelope<ApiFootballPlayerItem>('players', {
              search: lastName,
            });
            if (fallbackResult.payload.response && fallbackResult.payload.response.length > 0) {
              candidateItems = fallbackResult.payload.response;
              trace.queryParameters = { search: lastName };
              trace.httpStatus = fallbackResult.httpStatus;
            }
          } catch {
            // fallback ignore
          }
        }
      }
    }

    trace.responseCount = candidateItems.length;

    if (candidateItems.length === 0) {
      negativeResolutionCache.set(normCandidate, 'NOT_FOUND', 'Upstream API returned 0 results');
      resolutionTracesMap.set(trace.normalizedCandidateName, trace);
      return null;
    }

    // Score all returned candidate profiles deterministically
    let bestPlayer: ApiFootballPlayerItem['player'] | null = null;
    let bestItem: ApiFootballPlayerItem | null = null;
    let bestScore = 0;
    let bestMatchMethod = 'UNMATCHED';

    for (const item of candidateItems) {
      const p = item.player;
      if (!p) continue;
      const scoreRes = scoreCandidateIdentity(trimmed, p);
      if (scoreRes.score > bestScore) {
        bestScore = scoreRes.score;
        bestPlayer = p;
        bestItem = item;
        bestMatchMethod = scoreRes.matchMethod;
      }
    }

    trace.identityScore = bestScore;

    // Threshold check (Must score >= 0.80)
    if (!bestPlayer || bestScore < 0.80) {
      negativeResolutionCache.set(normCandidate, 'NOT_FOUND', `Best identity score (${bestScore}) < 0.80`);
      resolutionTracesMap.set(trace.normalizedCandidateName, trace);
      return null;
    }

    trace.selectedPlayerId = bestPlayer.id;
    trace.canonicalApiName = bestPlayer.name;
    const resolvedPosition = normalizePosition(bestPlayer.position || bestItem?.statistics?.[0]?.games?.position);
    trace.position = resolvedPosition;

    // Pre-resolve and cache current club
    let resolvedClubName = 'Unknown Club';
    let resolvedClubId: number | undefined;
    let resolvedSeason = CURRENT_SEASON;

    if (bestItem?.statistics && bestItem.statistics.length > 0) {
      const primaryStat = bestItem.statistics[0];
      resolvedClubName = primaryStat.team?.name || 'Unknown Club';
      resolvedClubId = primaryStat.team?.id;
      resolvedSeason = primaryStat.league?.season || CURRENT_SEASON;

      trace.currentClub = resolvedClubName;
      trace.currentClubId = resolvedClubId;
      trace.clubStatus = resolvedClubName !== 'Unknown Club' ? 'VERIFIED' : 'UNAVAILABLE';
    }

    const identity: ResolvedPlayerIdentity = {
      id: bestPlayer.id,
      name: bestPlayer.name,
      firstname: bestPlayer.firstname || '',
      lastname: bestPlayer.lastname || bestPlayer.name,
      nationality: bestPlayer.nationality || '',
      age: bestPlayer.age,
      photo: bestPlayer.photo,
      position: resolvedPosition,
      identityScore: bestScore,
      matchMethod: bestMatchMethod,
    };

    // Save to persistent registry
    const verifiedPlayer: Player = {
      id: `api-football-${bestPlayer.id}`,
      externalId: bestPlayer.id,
      name: bestPlayer.name,
      firstName: identity.firstname,
      lastName: identity.lastname,
      position: resolvedPosition,
      currentClub: resolvedClubName,
      currentClubId: resolvedClubId,
      currentClubSeason: resolvedSeason,
      nationality: identity.nationality,
      age: identity.age,
      photo: identity.photo,
      aliases: [bestPlayer.name, trimmed],
      entityResolutionConfidence: bestScore,
      lastResolvedAt: new Date().toISOString(),
    };
    persistentPlayerRegistry.savePlayer(verifiedPlayer);

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
 */
export async function resolveCurrentClub(
  playerId: number,
  targetSeason: number = CURRENT_SEASON,
  initialPosition?: Position,
): Promise<ResolvedClubInfo> {
  const cacheKey = `player_club:${playerId}:${targetSeason}`;
  const cached = getCached<ResolvedClubInfo>(cacheKey);
  if (cached) return cached;

  // Check persistent registry
  const regPlayer = persistentPlayerRegistry.getPlayerByExternalId(playerId);
  if (regPlayer && regPlayer.currentClub && regPlayer.currentClub !== 'Unknown Club') {
    const clubInfo: ResolvedClubInfo = {
      clubName: regPlayer.currentClub,
      clubId: regPlayer.currentClubId,
      season: regPlayer.currentClubSeason || targetSeason,
      position: regPlayer.position || initialPosition || 'MIDFIELDER',
      resolvedAt: regPlayer.currentClubResolvedAt || new Date().toISOString(),
      status: 'VERIFIED',
    };
    setCached(cacheKey, clubInfo, CURRENT_CLUB_CACHE_TTL);
    return clubInfo;
  }

  const defaultUnavailable: ResolvedClubInfo = {
    clubName: 'Unknown Club',
    clubId: undefined,
    season: targetSeason,
    position: initialPosition || 'MIDFIELDER',
    resolvedAt: new Date().toISOString(),
    status: 'UNAVAILABLE',
  };

  if (!getApiFootballKey() || circuitBreaker.isTripped || runRequestCount >= MAX_API_FOOTBALL_REQUESTS_PER_RUN) {
    return defaultUnavailable;
  }

  try {
    let playerRecords = await fetchFromApiFootball<ApiFootballPlayerItem>('players', {
      id: String(playerId),
      season: String(targetSeason),
    });

    let effectiveSeason = targetSeason;

    if (!playerRecords || playerRecords.length === 0 || !playerRecords[0].statistics || playerRecords[0].statistics.length === 0) {
      if (!circuitBreaker.isTripped && runRequestCount < MAX_API_FOOTBALL_REQUESTS_PER_RUN) {
        playerRecords = await fetchFromApiFootball<ApiFootballPlayerItem>('players', {
          id: String(playerId),
          season: String(targetSeason - 1),
        });
        effectiveSeason = targetSeason - 1;
      }
    }

    if (!playerRecords || playerRecords.length === 0 || !playerRecords[0].statistics || playerRecords[0].statistics.length === 0) {
      setCached(cacheKey, defaultUnavailable, CURRENT_CLUB_CACHE_TTL);
      return defaultUnavailable;
    }

    const item = playerRecords[0];
    const stats = item.statistics || [];
    const primaryStat = stats[0];

    const clubInfo: ResolvedClubInfo = {
      clubName: primaryStat.team?.name || 'Unknown Club',
      clubId: primaryStat.team?.id,
      season: effectiveSeason,
      position: normalizePosition(primaryStat.games?.position || initialPosition),
      resolvedAt: new Date().toISOString(),
      status: primaryStat.team?.name ? 'VERIFIED' : 'UNAVAILABLE',
    };

    setCached(cacheKey, clubInfo, CURRENT_CLUB_CACHE_TTL);

    for (const trace of resolutionTracesMap.values()) {
      if (trace.selectedPlayerId === playerId) {
        trace.currentClub = clubInfo.clubName;
        trace.currentClubId = clubInfo.clubId;
        trace.position = clubInfo.position;
        trace.clubStatus = clubInfo.status;
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

