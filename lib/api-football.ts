import type { Player, Position } from '@/types/transfer';

const API_FOOTBALL_BASE_URL = 'https://v3.football.api-sports.io';
const DEFAULT_TIMEOUT_MS = 8000;

// Cache TTLs in milliseconds
const SQUAD_CACHE_TTL = 1000 * 60 * 60 * 2; // 2 hours
const PLAYER_SEARCH_CACHE_TTL = 1000 * 60 * 60 * 4; // 4 hours
const TEAM_LOOKUP_CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

// Fallback Galatasaray Team ID (API-Sports ID for Galatasaray SK Turkey)
export const GALATASARAY_DEFAULT_TEAM_ID = 645;
export const GALATASARAY_TEAM_NAME = 'Galatasaray';

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

interface ApiFootballTransferItem {
  transfers: Array<{
    date: string;
    type: string;
    teams: {
      in: { id: number; name: string; logo?: string };
      out: { id: number; name: string; logo?: string };
    };
  }>;
}

// ─── In-Memory Cache ────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached<T>(key: string, data: T, ttlMs: number): void {
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
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

    // API-Sports sometimes returns error object inside 200 OK
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
  } catch (err) {
    // If lookup fails but API key error was raised, propagate
    if (err instanceof ApiFootballKeyMissingError) throw err;
    // Otherwise fallback to default Galatasaray Team ID
    return { id: GALATASARAY_DEFAULT_TEAM_ID, name: GALATASARAY_TEAM_NAME };
  }
}

// ─── Squad Fetching ─────────────────────────────────────────────────────────

export async function getGalatasaraySquad(teamId?: number): Promise<Player[]> {
  const resolvedTeamId = teamId || (await resolveGalatasarayTeam()).id;
  const cacheKey = `squad:${resolvedTeamId}`;
  const cached = getCached<Player[]>(cacheKey);
  if (cached) return cached;

  const squadResponses = await fetchFromApiFootball<ApiFootballSquadResponse>('players/squads', {
    team: String(resolvedTeamId),
  });

  if (!squadResponses || squadResponses.length === 0) {
    return [];
  }

  const playersData = squadResponses[0].players || [];
  const players: Player[] = playersData.map((p) => {
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

  setCached(cacheKey, players, SQUAD_CACHE_TTL);
  return players;
}

// ─── Player Search & Resolution ─────────────────────────────────────────────

export async function searchPlayer(name: string): Promise<Player[]> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 3) return [];

  const cacheKey = `player_search:${trimmed.toLowerCase()}`;
  const cached = getCached<Player[]>(cacheKey);
  if (cached) return cached;

  const currentYear = new Date().getFullYear();
  // Try current year or previous year season
  let rawPlayers = await fetchFromApiFootball<ApiFootballPlayerItem>('players', {
    search: trimmed,
    season: String(currentYear),
  });

  if (!rawPlayers || rawPlayers.length === 0) {
    rawPlayers = await fetchFromApiFootball<ApiFootballPlayerItem>('players', {
      search: trimmed,
      season: String(currentYear - 1),
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

  const currentYear = new Date().getFullYear();
  const results = await fetchFromApiFootball<ApiFootballPlayerItem>('players', {
    id: String(playerId),
    season: String(currentYear),
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

export async function getPlayerTransfers(
  playerId: number,
): Promise<ApiFootballTransferItem['transfers']> {
  const cacheKey = `transfers:${playerId}`;
  const cached = getCached<ApiFootballTransferItem['transfers']>(cacheKey);
  if (cached) return cached;

  const items = await fetchFromApiFootball<ApiFootballTransferItem>('transfers', {
    player: String(playerId),
  });

  const transfers = items?.[0]?.transfers || [];
  setCached(cacheKey, transfers, PLAYER_SEARCH_CACHE_TTL);
  return transfers;
}
