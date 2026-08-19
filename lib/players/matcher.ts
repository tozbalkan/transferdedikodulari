import type { Player, CandidateTextSpan } from '@/types/transfer';

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

// ─── Matcher Logic & Text-Span Verification ────────────────────────────────

export interface MatchSpanResult {
  matched: boolean;
  matchMethod?: 'EXACT_FULL_NAME' | 'FIRST_LAST_NAME' | 'VERIFIED_ALIAS' | 'INITIALS';
  matchedSpan?: string;
  confidence: number;
}

/**
 * Evaluate if a given player is mentioned in the text, returning exact text-span evidence.
 * Requires actual presence of player's identity in the text.
 */
export function matchPlayerWithSpan(rawText: string, player: Player): MatchSpanResult {
  const normText = normalizeText(rawText);
  const normFullName = normalizeText(player.name);

  // 1. Exact full name matching (Highest confidence)
  if (normFullName && normFullName.length >= 4 && normText.includes(normFullName)) {
    return {
      matched: true,
      matchMethod: 'EXACT_FULL_NAME',
      matchedSpan: player.name,
      confidence: 1.0,
    };
  }

  // 2. First + Last name combination
  if (player.firstName && player.lastName) {
    const combined = normalizeText(`${player.firstName} ${player.lastName}`);
    if (combined && combined !== normFullName && normText.includes(combined)) {
      return {
        matched: true,
        matchMethod: 'FIRST_LAST_NAME',
        matchedSpan: `${player.firstName} ${player.lastName}`,
        confidence: 0.95,
      };
    }
  }

  // 3. Registered verified aliases
  for (const alias of player.aliases || []) {
    const normAlias = normalizeText(alias);
    if (!normAlias || normAlias.length < 4) continue;

    // Reject if alias is an ambiguous surname
    if (AMBIGUOUS_SURNAMES.has(normAlias)) continue;

    if (containsWord(normText, normAlias)) {
      return {
        matched: true,
        matchMethod: 'VERIFIED_ALIAS',
        matchedSpan: alias,
        confidence: 0.9,
      };
    }
  }

  // 4. Initials: "G. Martinelli"
  if (player.firstName && player.lastName && player.lastName.length >= 4) {
    const normLast = normalizeText(player.lastName);
    const firstChar = normalizeText(player.firstName)[0];

    if (firstChar && !AMBIGUOUS_SURNAMES.has(normLast)) {
      const initialVariant = `${firstChar}. ${normLast}`;
      if (normText.includes(initialVariant)) {
        return {
          matched: true,
          matchMethod: 'INITIALS',
          matchedSpan: initialVariant,
          confidence: 0.85,
        };
      }
    }
  }

  return { matched: false, confidence: 0 };
}

// ─── Non-Player Entity Blacklist ───────────────────────────────────────────

export const KNOWN_CLUBS_AND_ORGANIZATIONS = [
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
  'bologna',
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
  'eintracht frankfurt',
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

export const NON_PLAYER_ENTITIES = new Set([
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
  // Managers & Officials (Non-players)
  'okan buruk',
  'buruk',
  'dursun ozbek',
  'ozbek',
  'erden timur',
  'maruf gunes',
  'cenk ergun',
  'mikel arteta',
  'arteta',
  'erik ten hag',
  'pep guardiola',
  'jose mourinho',
  'mourinho',
  'carlo ancelotti',
  'ancelotti',
  'ruben amorim',
  'amorim',
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
  'devam',
  'detaylar',
  'haber',
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
 * Extract candidate person spans from news text with exact character positions.
 */
export function extractCandidateSpans(rawText: string): CandidateTextSpan[] {
  if (!rawText) return [];

  // Match 2 to 3 capitalized words (e.g. "Gabriel Martinelli", "Marcus Rashford", "Rafael Leao")
  const multiWordRegex = /\b([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+){1,2})\b/g;
  const spans: CandidateTextSpan[] = [];
  let match: RegExpExecArray | null;

  while ((match = multiWordRegex.exec(rawText)) !== null) {
    const rawSpan = match[1];
    const stripped = stripClubPrefixes(rawSpan);
    const norm = normalizeText(stripped);

    if (norm.length < 5) continue;
    if (NON_PLAYER_ENTITIES.has(norm)) continue;
    if (AMBIGUOUS_SURNAMES.has(norm)) continue;

    const parts = stripped.split(/\s+/);
    if (parts.length >= 2 && parts.length <= 3) {
      const isBlacklisted = parts.some((part) => {
        const pNorm = normalizeText(part);
        return (
          KNOWN_CLUBS_AND_ORGANIZATIONS.includes(pNorm) ||
          NON_PLAYER_ENTITIES.has(pNorm) ||
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
        spans.push({
          rawText: stripped,
          start: match.index,
          end: match.index + rawSpan.length,
          normalizedCandidate: norm,
        });
      }
    }
  }

  return spans;
}
