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

  // 5. Distinct non-ambiguous single surname match (Confidence: 0.75)
  if (player.lastName && player.lastName.length >= 5) {
    const normLast = normalizeText(player.lastName);
    if (!AMBIGUOUS_SURNAMES.has(normLast) && containsWord(normText, normLast)) {
      return { matched: true, confidence: 0.75, matchedAlias: player.lastName };
    }
  }

  return { matched: false, confidence: 0 };
}

// ─── Dynamic Candidate Player Name Extraction (NER) ─────────────────────────

const KNOWN_CLUBS_AND_ORGANIZATIONS = [
  'galatasaray',
  'fenerbahce',
  'besiktas',
  'trabzonspor',
  'basaksehir',
  'kasimpasa',
  'sivasspor',
  'antalyaspor',
  'konyaspor',
  'alanyaspor',
  'samsunspor',
  'eyupspor',
  'goztepe',
  'bodrum fk',
  'corum fk',
  'arca corum',
  'arsenal',
  'manchester united',
  'manchester city',
  'man city',
  'man utd',
  'chelsea',
  'liverpool',
  'tottenham',
  'newcastle',
  'newcastle united',
  'guimaraes',
  'vitoria guimaraes',
  'aston villa',
  'ac milan',
  'milan',
  'inter milan',
  'inter',
  'juventus',
  'as roma',
  'roma',
  'napoli',
  'lazio',
  'atalanta',
  'fiorentina',
  'psg',
  'paris saint germain',
  'paris saint-germain',
  'marseille',
  'lyon',
  'monaco',
  'lille',
  'rennes',
  'nice',
  'real madrid',
  'barcelona',
  'atletico madrid',
  'sevilla',
  'real betis',
  'villarreal',
  'real sociedad',
  'athletic bilbao',
  'bayern munih',
  'bayern munich',
  'borussia dortmund',
  'dortmund',
  'rb leipzig',
  'bayer leverkusen',
  'leverkusen',
  'frankfurt',
  'fluminense',
  'flamengo',
  'palmeiras',
  'santos',
  'corinthians',
  'sao paulo',
  'gremio',
  'river plate',
  'boca juniors',
  'benfica',
  'porto',
  'sporting',
  'sporting cp',
  'ajax',
  'psv',
  'feyenoord',
  'lokomotiv moskova',
  'lokomotiv',
  'zenit',
  'spartak moskova',
  'shakhtar donetsk',
  'dynamo kyiv',
  'olympiacos',
  'panathinaikos',
  'the athletic',
  'sky sports',
  'bbc sport',
];

const NON_PLAYER_ENTITIES = new Set([
  ...KNOWN_CLUBS_AND_ORGANIZATIONS,
  // Competitions & Stadiums
  'super lig',
  'trendyol super lig',
  'turkiye',
  'istanbul',
  'turk telekom arena',
  'rams park',
  'ali sami yen',
  'uefa',
  'uefa sampiyonlar ligi',
  'sampiyonlar ligi',
  'avrupa ligi',
  'konferans ligi',
  'premier lig',
  'serie a',
  'la liga',
  'bundesliga',
  'ligue 1',
  'dunya kupasi',
  'dunya kupas',
  'avrupa sampiyonasi',
  // Managers & Officials
  'okan buruk',
  'dursun ozbek',
  'erden timur',
  'maruf gunes',
  'cenk ergun',
  'mikel arteta',
  'erik ten hag',
  'pep guardiola',
  'jose mourinho',
  'carlo ancelotti',
  'ruben amorim',
  'arda turan',
  'fatih terim',
  'senol gunes',
  'sergen yalcin',
  // Press phrases & nationalities
  'son dakika',
  'transfer haberi',
  'transfer haberleri',
  'resmi aciklama',
  'teknik direktor',
  'sari kirmizililar',
  'sari kirmizi',
  'milli takim',
  'milli futbolcu',
  'avrupa basini',
  'italyan basini',
  'ingiliz basini',
  'ispanyol basini',
  'fransiz basini',
  'alman basini',
  'flas gelisme',
  'sicak temas',
  'tarihi anlasma',
  'portekizli',
  'brezilyali',
  'arjantinli',
  'fransiz',
  'ingiliz',
  'italyan',
  'ispanyol',
  'alman',
  'hollandali',
  'cezayirli',
  'nijeryali',
  'belcikali',
  'fasli',
  'senegalli',
  'kolombiyali',
  'uruguayli',
]);

/**
 * Clean prefixes like "Galatasaray X", "Milan X", "Arsenal X" to isolate the player name.
 */
function stripClubPrefixes(candidate: string): string {
  let cleaned = candidate.trim();
  const prefixes = [
    'Galatasaray',
    'Fenerbahçe',
    'Beşiktaş',
    'Trabzonspor',
    'Arsenal',
    'Manchester United',
    'Manchester City',
    'Milan',
    'AC Milan',
    'Inter',
    'Roma',
    'AS Roma',
    'Napoli',
    'PSG',
    'Real Madrid',
    'Barcelona',
    'Liverpool',
    'Chelsea',
    'Tottenham',
    'Lokomotiv Moskova',
    'Borussia Dortmund',
    'Hem',
  ];

  for (const prefix of prefixes) {
    if (cleaned.toLowerCase().startsWith(prefix.toLowerCase() + ' ')) {
      cleaned = cleaned.slice(prefix.length).trim();
    }
  }
  return cleaned;
}

/**
 * Extract candidate proper names (Capitalized player names) from news text.
 * Automatically cleans club prefixes and filters out non-player entities.
 */
export function extractCandidateNames(rawText: string): string[] {
  if (!rawText) return [];

  // Strip apostrophe suffixes (e.g. "Osimhen'e", "Martinelli'nin", "Rashford'u")
  const cleanedForNER = rawText.replace(/['’][a-zçğıöşüA-ZÇĞİÖŞÜ]+/g, '');

  // Match 2 to 3 capitalized words (e.g. "Gabriel Martinelli", "Marcus Rashford", "Rafael Leao")
  const multiWordRegex = /\b([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+){1,2})\b/g;
  const matches = cleanedForNER.match(multiWordRegex) || [];

  const uniqueCandidates = new Set<string>();

  for (const rawCandidate of matches) {
    const stripped = stripClubPrefixes(rawCandidate);
    const norm = normalizeText(stripped);

    if (norm.length < 5) continue;
    if (NON_PLAYER_ENTITIES.has(norm)) continue;
    if (AMBIGUOUS_SURNAMES.has(norm)) continue;

    // Check if stripped name contains non-player phrases or club names
    const parts = stripped.split(/\s+/);
    if (parts.length >= 2 && parts.length <= 3) {
      const isBlacklisted = parts.some((part) => {
        const pNorm = normalizeText(part);
        return (
          KNOWN_CLUBS_AND_ORGANIZATIONS.includes(pNorm) ||
          pNorm === 'galatasaray' ||
          pNorm === 'fenerbahce' ||
          pNorm === 'besiktas' ||
          pNorm === 'direktor' ||
          pNorm === 'teknik' ||
          pNorm === 'baskani' ||
          pNorm === 'kulubu' ||
          pNorm === 'transferi' ||
          pNorm === 'haberi' ||
          pNorm === 'arsenal' ||
          pNorm === 'guimaraes'
        );
      });

      if (!isBlacklisted) {
        uniqueCandidates.add(stripped.trim());
      }
    }
  }

  return Array.from(uniqueCandidates);
}
