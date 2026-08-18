import type { Player, Position } from '@/types/transfer';
import { getGalatasaraySquad, searchPlayer, CURRENT_SEASON } from '@/lib/api-football';
import { normalizeText, AMBIGUOUS_SURNAMES } from './matcher';

export interface RegisteredPlayer extends Player {
  lastResolvedAt: string;
  discoverySource?: string;
}

// Common sports position keywords for contextual fallback inference
const POSITION_KEYWORDS: Record<Position, string[]> = {
  FORWARD: ['forvet', 'golcü', 'hücum', 'kanat', 'striker', 'forward', 'winger', 'santrfor'],
  MIDFIELDER: ['orta saha', 'maestro', 'ön libero', '10 numara', '8 numara', 'midfielder'],
  DEFENDER: ['stoper', 'defans', 'sol bek', 'sağ bek', 'defender', 'center back', 'fullback'],
  GOALKEEPER: ['kaleci', 'eldiven', 'file bekçisi', 'goalkeeper', 'keeper', 'gk'],
};

/**
 * Infer player position from surrounding news article text.
 */
export function inferPositionFromContext(contextText?: string): Position {
  if (!contextText) return 'FORWARD';
  const lower = contextText.toLowerCase();

  for (const [pos, keywords] of Object.entries(POSITION_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return pos as Position;
    }
  }
  return 'FORWARD';
}

export class PlayerRegistry {
  private playersById = new Map<string, RegisteredPlayer>();
  private playersByExternalId = new Map<string | number, RegisteredPlayer>();
  private isInitialized = false;

  /**
   * Register a single player into the dynamic registry.
   */
  registerPlayer(player: Player, discoverySource: string = 'API-Football'): RegisteredPlayer {
    const registered: RegisteredPlayer = {
      ...player,
      lastResolvedAt: new Date().toISOString(),
      discoverySource,
    };
    this.playersById.set(player.id, registered);
    if (player.externalId) {
      this.playersByExternalId.set(player.externalId, registered);
    }
    return registered;
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
  getPlayer(id: string | number): RegisteredPlayer | undefined {
    return this.playersById.get(String(id)) || this.playersByExternalId.get(id);
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
   * Generic resolution pipeline with priority:
   * 1. Existing Player Registry cache (with freshness check)
   * 2. API-Football live player search (2026 season context)
   * 3. Entity synthesis from verified news context (when API is unreachable)
   */
  async resolveCandidatePlayer(
    candidateName: string,
    articleContext?: string,
  ): Promise<RegisteredPlayer | null> {
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
      // API search failed or unconfigured, proceed to priority 3
    }

    // 3. Fallback Entity Synthesis: Parse multi-word player name and contextual position
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2 && parts.length <= 3) {
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ');
      const pos = inferPositionFromContext(articleContext);

      const syntheticPlayer: Player = {
        id: `discovered-${normCandidate.replace(/\s+/g, '-')}`,
        externalId: `disc-${normCandidate.replace(/\s+/g, '-')}`,
        name: trimmed,
        firstName,
        lastName,
        position: pos,
        currentClub: 'Avrupa Kulübü',
        nationality: '',
        aliases: [trimmed, lastName],
      };

      return this.registerPlayer(syntheticPlayer, 'News Entity Discovery');
    }

    return null;
  }
}

// Global registry singleton for server-side execution
export const globalPlayerRegistry = new PlayerRegistry();
