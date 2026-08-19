import type { Player } from '@/types/transfer';
import { getGalatasaraySquad, searchPlayer, CURRENT_SEASON } from '@/lib/api-football';
import { normalizeText, AMBIGUOUS_SURNAMES } from './matcher';

export interface RegisteredPlayer extends Player {
  lastResolvedAt: string;
  discoverySource?: string;
}

export class PlayerRegistry {
  private playersById = new Map<string, RegisteredPlayer>();
  private playersByExternalId = new Map<number, RegisteredPlayer>();
  private isInitialized = false;

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
   * Get all dynamically registered players.
   */
  getAllPlayers(): RegisteredPlayer[] {
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
   * 1. Check existing in-memory registry.
   * 2. Query API-Football search for the exact candidate name.
   * 3. Return null if no real player entity exists (NEVER fabricate synthetic players).
   */
  async resolveCandidatePlayer(candidateName: string): Promise<RegisteredPlayer | null> {
    const trimmed = candidateName.trim();
    if (!trimmed || trimmed.length < 4) return null;

    const normCandidate = normalizeText(trimmed);
    if (AMBIGUOUS_SURNAMES.has(normCandidate)) return null;

    // 1. Check existing in-memory registry
    const existing = this.getAllPlayers().find(
      (p) =>
        p.name.toLowerCase() === trimmed.toLowerCase() ||
        p.aliases.some((a) => a.toLowerCase() === trimmed.toLowerCase()),
    );
    if (existing) return existing;

    // 2. Query API-Football player search dynamically
    try {
      const candidates = await searchPlayer(trimmed);
      if (candidates && candidates.length > 0) {
        const bestMatch = candidates[0];
        return this.registerPlayer(bestMatch, 'API-Football Search');
      }
    } catch {
      // API search error
    }

    // 3. If not found in API-Football, return null (Unresolved)
    return null;
  }
}

// Global registry singleton for server-side execution
export const globalPlayerRegistry = new PlayerRegistry();
