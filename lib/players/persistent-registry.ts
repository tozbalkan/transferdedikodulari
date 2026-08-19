import fs from 'fs';
import path from 'path';
import type { Player, Position } from '@/types/transfer';
import { normalizeText, scoreCandidateIdentity } from './matcher';

export interface PersistentPlayerRecord {
  externalId: number;
  canonicalName: string;
  normalizedName: string;
  aliases: string[];
  firstname: string;
  lastname: string;
  nationality: string;
  photo?: string;
  position: Position;
  currentClub?: string;
  currentClubId?: number;
  currentClubSeason?: number;
  identityResolvedAt: string;
  clubResolvedAt?: string;
  lastVerifiedAt: string;
  source: 'API_FOOTBALL';
}

export class PersistentPlayerRegistry {
  private recordsById = new Map<number, PersistentPlayerRecord>();
  private recordsByNormalizedName = new Map<string, PersistentPlayerRecord>();
  private filePath: string;
  private isLoaded = false;
  public hits = 0;
  public misses = 0;

  constructor() {
    this.filePath = path.join(process.cwd(), 'data', 'player-registry.json');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (this.isLoaded) return;
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const list: PersistentPlayerRecord[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const item of list) {
            if (typeof item.externalId === 'number') {
              this.recordsById.set(item.externalId, item);
              const norm = item.normalizedName || normalizeText(item.canonicalName);
              this.recordsByNormalizedName.set(norm, item);
              for (const alias of item.aliases || []) {
                const normAlias = normalizeText(alias);
                if (normAlias && !this.recordsByNormalizedName.has(normAlias)) {
                  this.recordsByNormalizedName.set(normAlias, item);
                }
              }
            }
          }
        }
      }
      this.isLoaded = true;
    } catch {
      this.isLoaded = true;
    }
  }

  private saveToDisk(): void {
    try {
      const list = Array.from(this.recordsById.values());
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), 'utf8');
    } catch {
      // Ignore write errors in read-only environments
    }
  }

  private recordToPlayer(rec: PersistentPlayerRecord): Player {
    return {
      id: `api-football-${rec.externalId}`,
      externalId: rec.externalId,
      name: rec.canonicalName,
      firstName: rec.firstname,
      lastName: rec.lastname,
      position: rec.position || 'MIDFIELDER',
      currentClub: rec.currentClub || 'Unknown Club',
      currentClubId: rec.currentClubId,
      currentClubSeason: rec.currentClubSeason,
      currentClubResolvedAt: rec.clubResolvedAt,
      nationality: rec.nationality,
      photo: rec.photo,
      aliases: rec.aliases || [rec.canonicalName],
      entityResolutionConfidence: 1.0,
      lastResolvedAt: rec.lastVerifiedAt,
    };
  }

  findPlayer(query: string): Player | null {
    this.loadFromDisk();
    const norm = normalizeText(query);
    if (!norm || norm.length < 3) {
      this.misses++;
      return null;
    }

    // 1. Direct normalized name or alias lookup
    const direct = this.recordsByNormalizedName.get(norm);
    if (direct) {
      this.hits++;
      return this.recordToPlayer(direct);
    }

    // 2. Score candidate against all registered players
    let bestScore = 0;
    let bestRecord: PersistentPlayerRecord | null = null;

    for (const rec of this.recordsById.values()) {
      const scoreRes = scoreCandidateIdentity(query, {
        name: rec.canonicalName,
        firstname: rec.firstname,
        lastname: rec.lastname,
        position: rec.position,
      });

      if (scoreRes.score > bestScore) {
        bestScore = scoreRes.score;
        bestRecord = rec;
      }
    }

    if (bestRecord && bestScore >= 0.85) {
      this.hits++;
      return this.recordToPlayer(bestRecord);
    }

    this.misses++;
    return null;
  }

  getPlayerByExternalId(externalId: number): Player | null {
    this.loadFromDisk();
    const rec = this.recordsById.get(externalId);
    return rec ? this.recordToPlayer(rec) : null;
  }

  savePlayer(player: Player): void {
    this.loadFromDisk();
    if (typeof player.externalId !== 'number') return;

    const existing = this.recordsById.get(player.externalId);
    const now = new Date().toISOString();

    const record: PersistentPlayerRecord = {
      externalId: player.externalId,
      canonicalName: player.name,
      normalizedName: normalizeText(player.name),
      aliases: Array.from(new Set([...(existing?.aliases || []), ...(player.aliases || []), player.name])),
      firstname: player.firstName || existing?.firstname || '',
      lastname: player.lastName || existing?.lastname || player.name,
      nationality: player.nationality || existing?.nationality || '',
      photo: player.photo || existing?.photo,
      position: player.position || existing?.position || 'MIDFIELDER',
      currentClub: player.currentClub || existing?.currentClub,
      currentClubId: player.currentClubId || existing?.currentClubId,
      currentClubSeason: player.currentClubSeason || existing?.currentClubSeason,
      identityResolvedAt: existing?.identityResolvedAt || now,
      clubResolvedAt: player.currentClubResolvedAt || existing?.clubResolvedAt || now,
      lastVerifiedAt: now,
      source: 'API_FOOTBALL',
    };

    this.recordsById.set(player.externalId, record);
    this.recordsByNormalizedName.set(record.normalizedName, record);
    for (const alias of record.aliases) {
      const normAlias = normalizeText(alias);
      if (normAlias) {
        this.recordsByNormalizedName.set(normAlias, record);
      }
    }

    this.saveToDisk();
  }

  getAllPlayers(): Player[] {
    this.loadFromDisk();
    return Array.from(this.recordsById.values()).map((r) => this.recordToPlayer(r));
  }

  getStats(): { count: number; hits: number; misses: number } {
    this.loadFromDisk();
    return {
      count: this.recordsById.size,
      hits: this.hits,
      misses: this.misses,
    };
  }
}

export const persistentPlayerRegistry = new PersistentPlayerRegistry();
