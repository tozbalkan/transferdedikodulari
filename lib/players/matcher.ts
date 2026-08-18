import type { Player } from '@/types/transfer';

// ─── Ambiguous Surnames (Must never match alone) ───────────────────────────

export const AMBIGUOUS_SURNAMES = new Set([
  'silva',
  'santos',
  'fernandes',
  'garcia',
  'martinez',
  'rodriguez',
  'lopez',
  'gonzalez',
  'hernandez',
  'perez',
  'sanchez',
  'ramirez',
  'torres',
  'flores',
  'rivera',
  'gomez',
  'diaz',
  'reyes',
  'morales',
  'ortiz',
  'castillo',
  'alvarez',
  'yilmaz',
  'kaya',
  'demir',
  'celik',
  'sahin',
  'yildiz',
  'yildirim',
  'ozturk',
  'aydin',
  'ozdemir',
  'arslan',
  'dogan',
  'kilic',
  'aslan',
  'cetin',
  'kara',
  'koc',
  'kurt',
  'ozkan',
  'simsek',
  'junior',
  'paul',
  'john',
  'david',
  'smith',
  'williams',
  'brown',
  'jones',
  'miller',
  'davis',
  'wilson',
]);

// ─── Accent & String Normalization ──────────────────────────────────────────

/**
 * Pure accent & Turkish character normalizer.
 * Only used for comparison algorithms, does not mutate original player data.
 */
export function normalizeText(text: string): string {
  if (!text) return '';

  return text
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/Ğ/g, 'g')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/ü/g, 'u')
    .replace(/Ş/g, 's')
    .replace(/ş/g, 's')
    .replace(/Ö/g, 'o')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'c')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Regex word boundary helper for exact matching.
 */
function containsWord(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, 'i');
  return regex.test(haystack);
}

// ─── Matcher Logic ──────────────────────────────────────────────────────────

export interface MatchResult {
  matched: boolean;
  confidence: number;
  matchedAlias?: string;
}

/**
 * Evaluate if a given player is mentioned in the normalized text.
 */
export function matchPlayer(rawText: string, player: Player): MatchResult {
  const normText = normalizeText(rawText);
  const normFullName = normalizeText(player.name);

  // 1. Exact full name matching (Highest confidence)
  if (normFullName && normFullName.length >= 4 && normText.includes(normFullName)) {
    return { matched: true, confidence: 1.0, matchedAlias: player.name };
  }

  // 2. First + Last name combination
  if (player.firstName && player.lastName) {
    const combined = normalizeText(`${player.firstName} ${player.lastName}`);
    if (combined && combined !== normFullName && normText.includes(combined)) {
      return {
        matched: true,
        confidence: 0.95,
        matchedAlias: `${player.firstName} ${player.lastName}`,
      };
    }
  }

  // 3. Registered aliases
  for (const alias of player.aliases || []) {
    const normAlias = normalizeText(alias);
    if (!normAlias || normAlias.length < 4) continue;

    // Reject if alias is an ambiguous surname
    if (AMBIGUOUS_SURNAMES.has(normAlias)) continue;

    if (containsWord(normText, normAlias)) {
      return { matched: true, confidence: 0.9, matchedAlias: alias };
    }
  }

  // 4. Initials: "G. Martinelli" or "Martinelli, G."
  if (player.firstName && player.lastName && player.lastName.length >= 4) {
    const normLast = normalizeText(player.lastName);
    const firstChar = normalizeText(player.firstName)[0];

    if (firstChar && !AMBIGUOUS_SURNAMES.has(normLast)) {
      const initialVariant1 = `${firstChar}. ${normLast}`;
      const initialVariant2 = `${firstChar} ${normLast}`;
      if (normText.includes(initialVariant1) || containsWord(normText, initialVariant2)) {
        return { matched: true, confidence: 0.85, matchedAlias: initialVariant1 };
      }
    }
  }

  // 5. Distinct non-ambiguous single surname match (Confidence: 0.70)
  if (player.lastName && player.lastName.length >= 5) {
    const normLast = normalizeText(player.lastName);
    if (!AMBIGUOUS_SURNAMES.has(normLast) && containsWord(normText, normLast)) {
      return { matched: true, confidence: 0.7, matchedAlias: player.lastName };
    }
  }

  return { matched: false, confidence: 0 };
}

/**
 * Extract candidate proper names (Capitalized phrases) from news text.
 * Used for dynamic player discovery when player is not yet in registry.
 */
export function extractCandidateNames(rawText: string): string[] {
  if (!rawText) return [];

  // Match sequences of 1 to 3 capitalized words (e.g. "Paulo Dybala", "Victor Osimhen")
  const regex = /\b([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+){1,2})\b/g;
  const matches = rawText.match(regex) || [];

  const blacklist = new Set([
    'galatasaray',
    'fenerbahce',
    'besiktas',
    'trabzonspor',
    'super lig',
    'turkiye',
    'istanbul',
    'rams park',
    'okan buruk',
    'dursun ozbek',
    'erden timur',
    'son dakika',
    'transfer haberi',
    'resmi aciklama',
    'uefa sampiyonlar',
    'avrupa ligi',
  ]);

  const uniqueCandidates = new Set<string>();

  for (const candidate of matches) {
    const norm = normalizeText(candidate);
    if (norm.length >= 5 && !blacklist.has(norm)) {
      uniqueCandidates.add(candidate.trim());
    }
  }

  return Array.from(uniqueCandidates);
}
