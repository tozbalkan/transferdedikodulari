import fs from 'fs';
import path from 'path';

export interface NegativeCacheEntry {
  normalizedQuery: string;
  status: 'NON_PLAYER' | 'NOT_FOUND';
  reason: string;
  cachedAt: number;
  expiresAt: number;
}

const NON_PLAYER_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const NOT_FOUND_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

class NegativeResolutionCache {
  private cache = new Map<string, NegativeCacheEntry>();
  private filePath: string;
  private isLoaded = false;

  constructor() {
    this.filePath = path.join(process.cwd(), 'data', 'negative-cache.json');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (this.isLoaded) return;
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const data = JSON.parse(raw);
        if (data && typeof data.entries === 'object') {
          const now = Date.now();
          for (const [key, entry] of Object.entries(data.entries)) {
            const e = entry as NegativeCacheEntry;
            if (e.expiresAt > now) {
              this.cache.set(key, e);
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
      const obj: { entries: Record<string, NegativeCacheEntry> } = { entries: {} };
      for (const [k, v] of this.cache.entries()) {
        obj.entries[k] = v;
      }
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2), 'utf8');
    } catch {
      // Ignore write errors in read-only serverless
    }
  }

  get(normalizedQuery: string): NegativeCacheEntry | null {
    this.loadFromDisk();
    const entry = this.cache.get(normalizedQuery);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(normalizedQuery);
      return null;
    }
    return entry;
  }

  set(normalizedQuery: string, status: 'NON_PLAYER' | 'NOT_FOUND', reason: string): void {
    this.loadFromDisk();
    const ttl = status === 'NON_PLAYER' ? NON_PLAYER_TTL_MS : NOT_FOUND_TTL_MS;
    const now = Date.now();
    const entry: NegativeCacheEntry = {
      normalizedQuery,
      status,
      reason,
      cachedAt: now,
      expiresAt: now + ttl,
    };
    this.cache.set(normalizedQuery, entry);
    this.saveToDisk();
  }

  size(): number {
    this.loadFromDisk();
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
    this.saveToDisk();
  }
}

export const negativeResolutionCache = new NegativeResolutionCache();
