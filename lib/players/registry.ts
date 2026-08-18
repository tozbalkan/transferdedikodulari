import type { Player } from '@/types/transfer';
import { getGalatasaraySquad, searchPlayer } from '@/lib/api-football';
import { MASTER_PLAYERS_DATA } from './squad-data';

export class PlayerRegistry {
  private playersById = new Map<string, Player>();
  private playersByExternalId = new Map<string | number, Player>();
  private isInitialized = false;

  /**
   * Register a single player into the registry.
   */
  registerPlayer(player: Player): void {
    this.playersById.set(player.id, player);
    this.playersByExternalId.set(player.externalId, player);
  }

  /**
   * Register an array of players.
   */
  registerPlayers(players: Player[]): void {
    for (const p of players) {
      this.registerPlayer(p);
    }
  }

  /**
   * Retrieve player by internal ID or external ID.
   */
  getPlayer(id: string | number): Player | undefined {
    return this.playersById.get(String(id)) || this.playersByExternalId.get(id);
  }

  /**
   * Get all registered players.
   */
  getAllPlayers(): Player[] {
    return Array.from(this.playersById.values());
  }

  /**
   * Initialize the registry with current squad master data and API-Football.
   */
  async initializeSquad(): Promise<void> {
    if (this.isInitialized) return;
    // 1. Seed with known master squad & transfer target data
    this.registerPlayers(MASTER_PLAYERS_DATA);

    try {
      // 2. Supplement with live API-Football squad if available
      const squad = await getGalatasaraySquad();
      if (squad && squad.length > 0) {
        this.registerPlayers(squad);
      }
      this.isInitialized = true;
    } catch {
      // If API-Football is unconfigured or rate limited, master players are already ready
      this.isInitialized = true;
    }
  }

  /**
   * Resolve an unverified candidate name by searching API-Football.
   */
  async resolveCandidatePlayer(name: string): Promise<Player | null> {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 3) return null;

    // Check if already in registry
    const existing = this.getAllPlayers().find(
      (p) =>
        p.name.toLowerCase() === trimmed.toLowerCase() ||
        p.aliases.some((a) => a.toLowerCase() === trimmed.toLowerCase()),
    );
    if (existing) return existing;

    try {
      const candidates = await searchPlayer(trimmed);
      if (candidates && candidates.length > 0) {
        const bestMatch = candidates[0];
        this.registerPlayer(bestMatch);
        return bestMatch;
      }
      return null;
    } catch {
      return null;
    }
  }
}

// Global registry singleton for server-side execution
export const globalPlayerRegistry = new PlayerRegistry();
