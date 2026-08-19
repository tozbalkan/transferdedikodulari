import type { Player } from '@/types/transfer';
import { getGalatasaraySquad, searchPlayer, CURRENT_SEASON } from '@/lib/api-football';
import { normalizeText, AMBIGUOUS_SURNAMES } from './matcher';
import { persistentPlayerRegistry } from './persistent-registry';
import { negativeResolutionCache } from './negative-cache';

export interface RegisteredPlayer extends Player {
  lastResolvedAt: string;
  discoverySource?: string;
}

export class PlayerRegistry {
  private playersById = new Map<string, RegisteredPlayer>();
  private playersByExternalId = new Map<number, RegisteredPlayer>();
  private isInitialized = false;

  /**
   * Reset in-memory registry cache without wiping persistent disk registry.
   */
  clear(): void {
    this.playersById.clear();
    this.playersByExternalId.clear();
    this.isInitialized = false;
  }

  /**
   * Register a single verified player into the dynamic registry.
   */
  registerPlayer(player: Player, discoverySource: string = 'API-Football'): RegisteredPlayer {
    const registered: RegisteredPlayer = {
      ...player,
      lastResolvedAt: new Date().toISOString(),
      discoverySource,
    };
    this.playersById.set(player.id, registered);
    if (typeof player.externalId === 'number') {
      this.playersByExternalId.set(player.externalId, registered);
    }
    return registered;
  }

  /**
   * Register an array of verified players.
   */
  registerPlayers(players: Player[]): void {
    for (const p of players) {
      this.registerPlayer(p);
    }
  }

  /**
   * Retrieve player by internal ID or external ID.
   */
  getPlayer(id: string | number): RegisteredPlayer | undefined {
    if (typeof id === 'number') {
      return this.playersByExternalId.get(id);
    }
    return this.playersById.get(id);
  }

  /**
   * Get all dynamically registered players (combining in-memory and persistent registry).
   */
  getAllPlayers(): RegisteredPlayer[] {
    const persistentPlayers = persistentPlayerRegistry.getAllPlayers();
    for (const p of persistentPlayers) {
      if (!this.playersById.has(p.id)) {
        this.registerPlayer(p, 'Persistent Registry');
      }
    }
    return Array.from(this.playersById.values());
  }

  /**
   * Initialize the registry dynamically with live API-Football 2026-2027 squad data.
   */
  async initializeSquad(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const dynamicSquad = await getGalatasaraySquad(undefined, CURRENT_SEASON);
      if (dynamicSquad && dynamicSquad.length > 0) {
        this.registerPlayers(dynamicSquad);
      }
      this.isInitialized = true;
    } catch {
      this.isInitialized = true;
    }
  }

  /**
   * Authoritative player resolution:
   * 1. Check in-memory & persistent registry (0 network calls).
   * 2. Check negative cache (0 network calls).
   * 3. Query API-Football search for the candidate if budget permits.
   * 4. Return null if no real player entity exists (NEVER fabricate synthetic players).
   */
  async resolveCandidatePlayer(candidateName: string): Promise<RegisteredPlayer | null> {
    const trimmed = candidateName.trim();
    if (!trimmed || trimmed.length < 3) return null;

    const normCandidate = normalizeText(trimmed);
    if (AMBIGUOUS_SURNAMES.has(normCandidate)) return null;

    // 1. Check persistent registry (Disk + Memory)
    const persistentMatch = persistentPlayerRegistry.findPlayer(trimmed);
    if (persistentMatch) {
      return this.registerPlayer(persistentMatch, 'Persistent Registry');
    }

    // 2. Check negative cache
    if (negativeResolutionCache.get(normCandidate)) {
      return null;
    }

    // 3. Query API-Football player search dynamically
    try {
      const candidates = await searchPlayer(trimmed, CURRENT_SEASON);
      if (candidates && candidates.length > 0) {
        const bestMatch = candidates[0];
        persistentPlayerRegistry.savePlayer(bestMatch);
        return this.registerPlayer(bestMatch, 'API-Football Search');
      }
    } catch {
      // API search error
    }

    // 4. If not found in API-Football, cache negatively and return null
    negativeResolutionCache.set(normCandidate, 'NOT_FOUND', 'Candidate unresolved upstream');
    return null;
  }
}

// Global registry singleton for server-side execution
export const globalPlayerRegistry = new PlayerRegistry();

