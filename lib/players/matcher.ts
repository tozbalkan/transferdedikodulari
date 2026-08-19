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

  // 4. Initials: "G. Martinelli", "R. Leao"
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
  'nottingham forest',
  'nottingham',
  'forest',
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
  'as monaco',
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
  // Geographic / Countries / Continents
  'guney amerika',
  'kuzey amerika',
  'suudi arabistan',
  'suudi',
  'arabistan',
  'fildisi sahili',
  'fildisi sahilli',
  'fildisi',
  'afrika',
  'avrupa',
  'asya',
  'ispanya',
  'italya',
  'almanya',
  'ingiltere',
  'fransa',
  'brezilya',
  'portekiz',
  // Managers & Journalists / Officials
  'okan buruk',
  'buruk',
  'dursun ozbek',
  'ozbek',
  'erden timur',
  'maruf gunes',
  'cenk ergun',
  'emre kaplan',
  'acun ilicali',
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
  'francesco farioli',
  'farioli',
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
  'real madridli',
  'madridli',
  'chelseali',
  'arsenalli',
  'galatasarayli',
  'fenerbahceli',
  'besiktasli',
  'trabzonsporlu',
]);

const LEADING_STOPWORDS = [
  'herkes',
  've',
  'bu',
  'o',
  'bir',
  'ilk',
  'son',
  'yeni',
  'eski',
  'tum',
  'daha',
  'iste',
  'hem',
  'gozu',
  'tek',
  'kulup',
  'takim',
  'haber',
  'yildiz',
  'milli',
];

/**
 * Clean prefixes like "Galatasaray X", "Milan X", "Arsenal X", "Herkes X" to isolate the player name.
 */
export function stripCandidatePrefixes(candidate: string): string {
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
    'Ve',
    'Herkes',
    'İşte',
    'Yeni',
    'Yıldız',
  ];

  for (const prefix of prefixes) {
    if (cleaned.toLowerCase().startsWith(prefix.toLowerCase() + ' ')) {
      cleaned = cleaned.slice(prefix.length).trim();
    }
  }

  // Also strip common leading lowercase stopwords
  const parts = cleaned.split(/\s+/);
  if (parts.length > 2) {
    const firstNorm = normalizeText(parts[0]);
    if (LEADING_STOPWORDS.includes(firstNorm)) {
      cleaned = parts.slice(1).join(' ').trim();
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
    const stripped = stripCandidatePrefixes(rawSpan);
    const norm = normalizeText(stripped);

    if (norm.length < 5) continue;
    if (NON_PLAYER_ENTITIES.has(norm)) continue;
    if (AMBIGUOUS_SURNAMES.has(norm)) continue;

    // Reject demonyms or club adjectives with suffixes: -li, -lı, -lu, -lü
    if (norm.endsWith('li') || norm.endsWith('li') || norm.endsWith('lu') || norm.endsWith('lu')) {
      const stem = norm.slice(0, -2);
      if (KNOWN_CLUBS_AND_ORGANIZATIONS.includes(stem) || NON_PLAYER_ENTITIES.has(stem)) {
        continue;
      }
    }

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
          pNorm === 'guimaraes' ||
          pNorm === 'arabistan' ||
          pNorm === 'sahilli'
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

// ─── Identity Scoring Algorithm ───────────────────────────────────────────

export interface IdentityScoringResult {
  score: number;
  matchMethod: 'EXACT_FULL_NAME' | 'CANONICAL_NAME' | 'FIRST_LAST_NAME' | 'INITIALS_SURNAME' | 'TOKEN_SUBSET' | 'UNMATCHED';
}

/**
 * Deterministic candidate identity scoring against API-Football player record.
 */
export function scoreCandidateIdentity(
  candidateQuery: string,
  apiPlayer: {
    name?: string;
    firstname?: string;
    lastname?: string;
    position?: string;
    age?: number;
  },
): IdentityScoringResult {
  const normQuery = normalizeText(candidateQuery);
  const normName = normalizeText(apiPlayer.name || '');
  const normFirst = normalizeText(apiPlayer.firstname || '');
  const normLast = normalizeText(apiPlayer.lastname || '');
  const normCombined = normalizeText(`${normFirst} ${normLast}`.trim());

  if (!normQuery || normQuery.length < 3) {
    return { score: 0, matchMethod: 'UNMATCHED' };
  }

  // 1. Exact full name match
  if (normQuery === normName || normQuery === normCombined) {
    return { score: 1.0, matchMethod: 'EXACT_FULL_NAME' };
  }

  // 2. Canonical Name match
  if (normName && (normQuery.includes(normName) || normName.includes(normQuery))) {
    // If name is ambiguous surname only, require compatible first name
    if (AMBIGUOUS_SURNAMES.has(normName)) {
      if (normFirst && normQuery.includes(normFirst)) {
        return { score: 0.9, matchMethod: 'CANONICAL_NAME' };
      }
      return { score: 0, matchMethod: 'UNMATCHED' };
    }
    return { score: 0.95, matchMethod: 'CANONICAL_NAME' };
  }

  // 3. First + Last name tokens present in query
  const queryTokens = normQuery.split(/\s+/).filter(Boolean);
  if (queryTokens.length >= 2) {
    const firstToken = queryTokens[0];
    const lastToken = queryTokens[queryTokens.length - 1];

    const firstMatches = normFirst.includes(firstToken) || normName.includes(firstToken);
    // Ensure the last token matches the actual player surname (normLast)
    const lastMatches =
      normLast === lastToken ||
      normLast.endsWith(` ${lastToken}`) ||
      normLast.startsWith(`${lastToken} `) ||
      normName.endsWith(` ${lastToken}`) ||
      normName === lastToken;

    if (firstMatches && lastMatches) {
      return { score: 0.92, matchMethod: 'FIRST_LAST_NAME' };
    }


    // 4. Initials match: "L. Sane", "V. Osimhen", "G. Martinelli"
    if (lastMatches && firstToken.length === 1 && normFirst.startsWith(firstToken)) {
      return { score: 0.88, matchMethod: 'INITIALS_SURNAME' };
    }
  }

  // 5. Single strong distinctive surname with compatible first name
  if (queryTokens.length === 2) {
    const firstToken = queryTokens[0];
    const lastToken = queryTokens[1];
    const lastMatches =
      normLast === lastToken ||
      normLast.endsWith(` ${lastToken}`) ||
      normName.endsWith(` ${lastToken}`) ||
      normName === lastToken;

    if (!AMBIGUOUS_SURNAMES.has(lastToken) && lastMatches) {
      if (normFirst.startsWith(firstToken[0]) || normFirst.includes(firstToken)) {
        return { score: 0.85, matchMethod: 'TOKEN_SUBSET' };
      }
    }
  }


  return { score: 0, matchMethod: 'UNMATCHED' };
}
