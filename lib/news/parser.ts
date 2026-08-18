import type { RawNewsItem } from '@/types/transfer';

// ─── Galatasaray Aliases ───────────────────────────────────────────────────

export const GALATASARAY_ALIASES = [
  'galatasaray',
  'galatasaray sk',
  'galatasaray s.k.',
  'galatasaray a.ş.',
  'cimbom',
  'aslan',
  'aslanlar',
  'sarı-kırmızılılar',
  'sarı kırmızılılar',
  'sarı-kırmızılı',
  'sarı kırmızılı',
  'gala',
] as const;

// ─── Transfer Intent Keywords ───────────────────────────────────────────────

export const TRANSFER_KEYWORDS = [
  'transfer',
  'transfers',
  'transferi',
  'transferine',
  'transferiyle',
  'transferde',
  'transferini',
  'bonservis',
  'bonservisi',
  'kiralık',
  'kiralama',
  'kiralayacak',
  'teklif',
  'teklifi',
  'teklifte',
  'imza',
  'imzayı',
  'imzalar',
  'anlaşma',
  'anlaştı',
  'görüşme',
  'görüşmeler',
  'görüşüyor',
  'masada',
  'talip',
  'kadrosuna',
  'renklerine',
  'takas',
  'kap',
  'interested',
  'interest',
  'target',
  'targets',
  'linked',
  'deal',
  'sign',
  'signing',
  'signed',
  'bid',
  'bids',
  'offer',
  'offers',
  'move',
  'loan',
  'permanent',
  'negotiation',
  'negotiations',
  'talks',
  'agreement',
  'pursuit',
] as const;

export type TransferDirection = 'INCOMING' | 'OUTGOING' | 'UNKNOWN';

export const INCOMING_KEYWORDS = [
  'galatasaray için',
  "galatasaray'a",
  'galatasaraya',
  'galatasaray ilgileniyor',
  'galatasaray transfer',
  'galatasaray teklif',
  'galatasaray listesine aldı',
  'galatasaray masada',
  'galatasaray imza',
  'galatasaray anlaştı',
  'galatasaray hedef',
  'galatasaray kadrosuna',
  'sarı kırmızılılar transfer',
  'sarı-kırmızılılar transfer',
  'cimbom transfer',
  'aslan transfer',
  'interested',
  'bid for',
  'targets',
  'close to signing',
  'talks to join galatasaray',
];

export const OUTGOING_KEYWORDS = [
  "galatasaray'dan ayrıl",
  'galatasaraydan ayrıl',
  'ayrılıyor',
  'ayrılacak',
  'ayrılabilir',
  'talip oldu',
  'teklif geldi',
  "avrupa'ya transfer",
  'wants to leave',
  'leave galatasaray',
  'offer for galatasaray',
];

/**
 * Classifies transfer rumor direction based on rule-based keyword signals.
 */
export function classifyTransferDirection(text: string): TransferDirection {
  const lower = text.toLowerCase();
  const hasOutgoing = OUTGOING_KEYWORDS.some((kw) => lower.includes(kw));
  const hasIncoming = INCOMING_KEYWORDS.some((kw) => lower.includes(kw));

  if (hasOutgoing && !hasIncoming) return 'OUTGOING';
  if (hasIncoming) return 'INCOMING';
  return 'INCOMING';
}

// ─── Pure String Cleaners ───────────────────────────────────────────────────

/**
 * Remove HTML tags, HTML entities, and unnecessary punctuation.
 */
export function cleanHtml(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&[a-z0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize whitespace and remove control characters.
 */
export function normalizeWhitespace(text: string): string {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Normalize URL by removing common tracking query parameters and trailing slashes.
 */
export function normalizeUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    const url = new URL(rawUrl);
    const paramsToDelete: string[] = [];
    url.searchParams.forEach((_, key) => {
      if (
        key.startsWith('utm_') ||
        key === 'ref' ||
        key === 'source' ||
        key === 'fbclid' ||
        key === 'gclid'
      ) {
        paramsToDelete.push(key);
      }
    });
    paramsToDelete.forEach((param) => url.searchParams.delete(param));

    let clean = url.origin + url.pathname;
    if (clean.endsWith('/') && clean.length > 1) {
      clean = clean.slice(0, -1);
    }
    return clean.toLowerCase();
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

/**
 * Parse date into valid ISO string with fallback.
 */
export function parsePublishedDate(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString();
  const timestamp = Date.parse(dateStr);
  if (isNaN(timestamp)) {
    return new Date().toISOString();
  }
  return new Date(timestamp).toISOString();
}

// ─── Relevance Detection ───────────────────────────────────────────────────

export interface RelevanceResult {
  isRelevant: boolean;
  hasGalatasarayContext: boolean;
  hasTransferIntent: boolean;
  direction: TransferDirection;
  matchedKeywords: string[];
  searchableText: string;
}

/**
 * Rule-based Galatasaray and Transfer Intent relevance detector.
 */
export function isGalatasarayRelevant(
  title: string,
  summary?: string,
  content?: string,
): RelevanceResult {
  const cleanedTitle = cleanHtml(title);
  const cleanedSummary = cleanHtml(summary || '');
  const cleanedContent = cleanHtml(content || '');

  const searchableText = `${cleanedTitle} ${cleanedSummary} ${cleanedContent}`.toLowerCase();

  // Check for Galatasaray mentions
  const hasGalatasarayContext = GALATASARAY_ALIASES.some((alias) =>
    searchableText.includes(alias.toLowerCase()),
  );

  // Check for Transfer intent
  const matchedKeywords: string[] = [];
  for (const keyword of TRANSFER_KEYWORDS) {
    if (searchableText.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword);
    }
  }

  const hasTransferIntent = matchedKeywords.length > 0;
  const isRelevant = hasGalatasarayContext && hasTransferIntent;
  const direction = classifyTransferDirection(searchableText);

  return {
    isRelevant,
    hasGalatasarayContext,
    hasTransferIntent,
    direction,
    matchedKeywords,
    searchableText: `${cleanedTitle} ${cleanedSummary}`,
  };
}

// ─── Duplicate Detection ───────────────────────────────────────────────────

export interface AggregatedArticle {
  canonicalId: string;
  title: string;
  url: string;
  normalizedUrl: string;
  publishedAt: string;
  sourceCount: number;
  sources: string[];
  summary: string;
  searchableText: string;
  direction: TransferDirection;
}

function computeWordSet(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9ğüşıöç]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3);
  return new Set(words);
}

function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  setA.forEach((w) => {
    if (setB.has(w)) intersection++;
  });
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Deduplicates raw news items across multiple feeds.
 * Retains sourceCount and unique articles list.
 */
export function deduplicateArticles(rawItems: RawNewsItem[]): AggregatedArticle[] {
  const results: AggregatedArticle[] = [];

  for (const item of rawItems) {
    const cleanTitle = cleanHtml(item.title);
    const cleanSummary = cleanHtml(item.summary || item.content || '');
    const normUrl = normalizeUrl(item.url);
    const pubDate = parsePublishedDate(item.publishedAt);
    const itemWordSet = computeWordSet(cleanTitle);
    const direction = classifyTransferDirection(`${cleanTitle} ${cleanSummary}`);

    let matchFound = false;

    for (const existing of results) {
      // 1. Normalized URL match
      if (normUrl && existing.normalizedUrl === normUrl) {
        matchFound = true;
        existing.sourceCount += 1;
        if (!existing.sources.includes(item.source)) {
          existing.sources.push(item.source);
        }
        break;
      }

      // 2. High title similarity (> 0.75) within 48h
      const existingWordSet = computeWordSet(existing.title);
      const similarity = calculateJaccardSimilarity(itemWordSet, existingWordSet);

      const timeDiffHours =
        Math.abs(new Date(pubDate).getTime() - new Date(existing.publishedAt).getTime()) /
        (1000 * 60 * 60);

      if (similarity >= 0.75 && timeDiffHours <= 48) {
        matchFound = true;
        existing.sourceCount += 1;
        if (!existing.sources.includes(item.source)) {
          existing.sources.push(item.source);
        }
        break;
      }
    }

    if (!matchFound) {
      results.push({
        canonicalId: item.id || normUrl || `${Date.now()}-${results.length}`,
        title: cleanTitle,
        url: item.url,
        normalizedUrl: normUrl,
        publishedAt: pubDate,
        sourceCount: 1,
        sources: [item.source],
        summary: cleanSummary,
        searchableText: `${cleanTitle} ${cleanSummary}`,
        direction,
      });
    }
  }

  return results;
}
