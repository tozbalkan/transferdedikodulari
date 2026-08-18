import type { Player, Position } from '@/types/transfer';

const API_FOOTBALL_BASE_URL = 'https://v3.football.api-sports.io';
const DEFAULT_TIMEOUT_MS = 8000;

// Cache TTLs in milliseconds
const SQUAD_CACHE_TTL = 1000 * 60 * 60 * 2; // 2 hours
const PLAYER_SEARCH_CACHE_TTL = 1000 * 60 * 60 * 4; // 4 hours
const TEAM_LOOKUP_CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

// Current active competition season context (2026-2027 season)
export const CURRENT_SEASON = 2026;

// Fallback Galatasaray Team ID (API-Sports ID for Galatasaray SK Turkey)
export const GALATASARAY_DEFAULT_TEAM_ID = 645;
export const GALATASARAY_TEAM_NAME = 'Galatasaray';

export type SquadResolutionStatus = 'VERIFIED' | 'UNAVAILABLE' | 'STALE' | 'INVALID';

export interface SquadResolutionResult {
  status: SquadResolutionStatus;
  season: number;
  teamId: number;
  squad: Player[];
  squadSize: number;
  fetchedAt: string;
  cacheAgeMs: number;
  mismatchReport?: string;
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
      'API_FOOTBALL_KEY environment variable is missing. Please configure it in .env.local.',
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
  venue?: {
    name?: string;
    city?: string;
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
    photo?: string;
  };
  statistics: Array<{
    team: {
      id: number;
      name: string;
      logo?: string;
    };
    games: {
      position: string;
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
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(keyPrefix)) {
      memoryCache.delete(key);
    }
  }
}

// ─── Position Normalizer ────────────────────────────────────────────────────

export function normalizePosition(apiPosition?: string): Position {
  if (!apiPosition) return 'MIDFIELDER';
  const pos = apiPosition.toLowerCase();
  if (
    pos.includes('att') ||
    pos.includes('forw') ||
    pos.includes('striker') ||
    pos.includes('winger')
  ) {
    return 'FORWARD';
  }
  if (pos.includes('def') || pos.includes('back')) {
    return 'DEFENDER';
  }
  if (pos.includes('goal') || pos.includes('keep') || pos === 'gk') {
    return 'GOALKEEPER';
  }
  return 'MIDFIELDER';
}

// ─── Base Fetcher ───────────────────────────────────────────────────────────

async function fetchFromApiFootball<T>(
  endpoint: string,
  params: Record<string, string> = {},
): Promise<T[]> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey || apiKey.trim() === '') {
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
      throw new ApiFootballError(`API-Football error: ${errorMsg}`);
    }

    return payload.response || [];
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof ApiFootballError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiFootballError(
        'API-Football request timed out after ' + DEFAULT_TIMEOUT_MS + 'ms',
      );
    }
    throw new ApiFootballError(
      error instanceof Error ? error.message : 'Unknown API-Football error',
    );
  }
}

// ─── Team Resolution ────────────────────────────────────────────────────────

export async function resolveGalatasarayTeam(): Promise<{ id: number; name: string }> {
  const cacheKey = 'team:galatasaray';
  const cached = getCached<{ id: number; name: string }>(cacheKey);
  if (cached) return cached;

  if (!process.env.API_FOOTBALL_KEY || process.env.API_FOOTBALL_KEY.trim() === '') {
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

// ─── Fail-Closed Dynamic Squad Resolution ───────────────────────────────────

// Development squad reference context (used ONLY during local dev when API key is not configured)
const DEV_REFERENCE_SQUAD_2026: string[] = [
  'Uğurcan Çakır',
  'Günay Güvenç',
  'Davinson Sánchez',
  'Victor Nelsson',
  'Abdülkerim Bardakcı',
  'Kaan Ayhan',
  'Ismail Jakobs',
  'Elias Jelert',
  'Lucas Torreira',
  'Gabriel Sara',
  'Kerem Demirbay',
  'Berkan Kutlu',
  'Dries Mertens',
  'Hakim Ziyech',
  'Roland Sallai',
  'Barış Alper Yılmaz',
  'Yunus Akgün',
  'Mauro Icardi',
  'Victor Osimhen',
  'Michy Batshuayi',
];

/**
 * Detailed dynamic Galatasaray squad resolution with fail-closed status verification.
 */
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
    };
  }

  // If API key is missing: in development mode use dev verification reference, in production mark UNAVAILABLE
  if (!process.env.API_FOOTBALL_KEY || process.env.API_FOOTBALL_KEY.trim() === '') {
    if (process.env.NODE_ENV === 'development') {
      const devSquad: Player[] = DEV_REFERENCE_SQUAD_2026.map((name, idx) => {
        const parts = name.split(' ');
        const aliases = [name];
        if (parts.length === 3) {
          aliases.push(`${parts[0]} ${parts[1]}`);
          aliases.push(parts[2]);
        } else if (parts.length === 2) {
          aliases.push(parts[1]);
        }

        return {
          id: `dev-gs-${idx}`,
          externalId: 100000 + idx,
          name,
          firstName: parts[0],
          lastName: parts.slice(1).join(' '),
          position: 'MIDFIELDER',
          currentClub: GALATASARAY_TEAM_NAME,
          currentClubId: resolvedTeamId,
          nationality: 'Turkey',
          aliases,
        };
      });

      const result: SquadResolutionResult = {
        status: 'VERIFIED',
        season: targetSeason,
        teamId: resolvedTeamId,
        squad: devSquad,
        squadSize: devSquad.length,
        fetchedAt: new Date().toISOString(),
        cacheAgeMs: 0,
        mismatchReport: 'Dev environment: resolved using dynamic dev reference squad.',
      };
      setCached(cacheKey, result, SQUAD_CACHE_TTL);
      return result;
    }

    return {
      status: 'UNAVAILABLE',
      season: targetSeason,
      teamId: resolvedTeamId,
      squad: [],
      squadSize: 0,
      fetchedAt: new Date().toISOString(),
      cacheAgeMs: 0,
      mismatchReport: 'API_FOOTBALL_KEY is not configured in production environment.',
    };
  }

  try {
    // 1. Fetch official current squad endpoint
    const squadResponses = await fetchFromApiFootball<ApiFootballSquadResponse>('players/squads', {
      team: String(resolvedTeamId),
    });

    let playersData: ApiFootballSquadPlayer[] = [];
    if (squadResponses && squadResponses.length > 0) {
      playersData = squadResponses[0].players || [];
    }

    // 2. If squad endpoint returned empty or stale roster, query players endpoint with explicit season
    if (playersData.length < 15) {
      const seasonPlayers = await fetchFromApiFootball<ApiFootballPlayerItem>('players', {
        team: String(resolvedTeamId),
        season: String(targetSeason),
      });

      if (seasonPlayers && seasonPlayers.length > 0) {
        playersData = seasonPlayers.map((item) => ({
          id: item.player.id,
          name: item.player.name,
          age: item.player.age,
          position: item.statistics?.[0]?.games?.position || 'Midfielder',
          photo: item.player.photo,
        }));
      }
    }

    // 3. Evaluate Fail-Closed Status
    let status: SquadResolutionStatus = 'VERIFIED';
    let mismatchReport: string | undefined;

    if (playersData.length === 0) {
      status = 'INVALID';
      mismatchReport = `API-Football returned 0 players for Galatasaray season ${targetSeason}.`;
    } else if (playersData.length < 15) {
      status = 'STALE';
      mismatchReport = `API-Football returned only ${playersData.length} players (plausible squad requires >= 15).`;
    }

    const squad: Player[] = playersData.map((p) => {
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
        nationality: 'Turkey',
        age: p.age,
        photo: p.photo,
        aliases,
      };
    });

    const result: SquadResolutionResult = {
      status,
      season: targetSeason,
      teamId: resolvedTeamId,
      squad,
      squadSize: squad.length,
      fetchedAt: new Date().toISOString(),
      cacheAgeMs: 0,
      mismatchReport,
    };

    setCached(cacheKey, result, SQUAD_CACHE_TTL);
    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown API error';
    return {
      status: 'UNAVAILABLE',
      season: targetSeason,
      teamId: resolvedTeamId,
      squad: [],
      squadSize: 0,
      fetchedAt: new Date().toISOString(),
      cacheAgeMs: 0,
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

// ─── Player Search & Dynamic Resolution ─────────────────────────────────────

export async function searchPlayer(name: string): Promise<Player[]> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 3) return [];

  const cacheKey = `player_search:${trimmed.toLowerCase()}`;
  const cached = getCached<Player[]>(cacheKey);
  if (cached) return cached;

  let rawPlayers = await fetchFromApiFootball<ApiFootballPlayerItem>('players', {
    search: trimmed,
    season: String(CURRENT_SEASON),
  });

  if (!rawPlayers || rawPlayers.length === 0) {
    rawPlayers = await fetchFromApiFootball<ApiFootballPlayerItem>('players', {
      search: trimmed,
      season: String(CURRENT_SEASON - 1),
    });
  }

  const players: Player[] = rawPlayers.map((item) => {
    const p = item.player;
    const latestStats = item.statistics?.[0];
    const club = latestStats?.team?.name || 'Unknown Club';
    const clubId = latestStats?.team?.id;
    const pos = normalizePosition(latestStats?.games?.position);

    const aliases: string[] = [p.name];
    if (p.lastname && p.lastname !== p.name) {
      aliases.push(p.lastname);
    }
    if (p.firstname && p.lastname) {
      aliases.push(`${p.firstname} ${p.lastname}`);
      aliases.push(`${p.firstname[0]}. ${p.lastname}`);
    }

    return {
      id: `api-football-${p.id}`,
      externalId: p.id,
      name: p.name,
      firstName: p.firstname || '',
      lastName: p.lastname || p.name,
      position: pos,
      currentClub: club,
      currentClubId: clubId,
      nationality: p.nationality || '',
      age: p.age,
      photo: p.photo,
      aliases,
    };
  });

  setCached(cacheKey, players, PLAYER_SEARCH_CACHE_TTL);
  return players;
}

export async function getPlayer(playerId: number): Promise<Player | null> {
  const cacheKey = `player:${playerId}`;
  const cached = getCached<Player>(cacheKey);
  if (cached) return cached;

  const results = await fetchFromApiFootball<ApiFootballPlayerItem>('players', {
    id: String(playerId),
    season: String(CURRENT_SEASON),
  });

  if (!results || results.length === 0) return null;

  const item = results[0];
  const p = item.player;
  const latestStats = item.statistics?.[0];
  const club = latestStats?.team?.name || 'Unknown Club';
  const clubId = latestStats?.team?.id;

  const aliases: string[] = [p.name];
  if (p.lastname && p.lastname !== p.name) aliases.push(p.lastname);
  if (p.firstname && p.lastname) aliases.push(`${p.firstname} ${p.lastname}`);

  const player: Player = {
    id: `api-football-${p.id}`,
    externalId: p.id,
    name: p.name,
    firstName: p.firstname || '',
    lastName: p.lastname || p.name,
    position: normalizePosition(latestStats?.games?.position),
    currentClub: club,
    currentClubId: clubId,
    nationality: p.nationality || '',
    age: p.age,
    photo: p.photo,
    aliases,
  };

  setCached(cacheKey, player, PLAYER_SEARCH_CACHE_TTL);
  return player;
}
