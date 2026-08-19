import { normalizeText, AMBIGUOUS_SURNAMES, NON_PLAYER_ENTITIES, KNOWN_CLUBS_AND_ORGANIZATIONS } from './matcher';

export type PreApiRejectionReason =
  | 'TOO_SHORT'
  | 'NOT_NAME_FORMAT'
  | 'NON_PLAYER_TERMINOLOGY'
  | 'GEOGRAPHIC_OR_DEMONYM'
  | 'KNOWN_CLUB_OR_COMPETITION'
  | 'AMBIGUOUS_MONONYM'
  | 'JOURNALIST_OR_OFFICIAL'
  | 'STOPWORD_ONLY';

export interface ValidationResult {
  isValid: boolean;
  normalizedCandidate: string;
  reason?: PreApiRejectionReason;
  details?: string;
}

// ─── Football, Media & Transfer Terminology Blacklist ────────────────────────

export const FOOTBALL_AND_TRANSFER_TERMS = new Set([
  // Transfer terms & actions
  'transfer',
  'transferde',
  'transferin',
  'transferine',
  'transferiyle',
  'transferini',
  'bonservis',
  'bonservisi',
  'sozlesme',
  'sozlesmesi',
  'kiralik',
  'kiralama',
  'kiralayacak',
  'gorusme',
  'gorusmeler',
  'gorusuyor',
  'anlasma',
  'anlasti',
  'imza',
  'imzayi',
  'imzalar',
  'teklif',
  'teklifi',
  'teklifte',
  'masada',
  'pazarlik',
  'rapor',
  'raporu',
  'liste',
  'listesi',
  'listesinde',
  'aday',
  'adaylar',
  'gundem',
  'gundemde',
  'kadro',
  'kadrosu',
  'kadrosuna',
  'kadrosunu',
  'takviye',
  'hedef',
  'hedefte',
  'hedefi',
  'kulis',
  'kulislerde',
  'operasyon',
  'operasyonu',
  'harekat',
  'harekati',
  'hamle',
  'hamlesi',
  'plan',
  'plani',
  'proje',
  'zirve',
  'masa',
  'masasi',
  'opsiyon',
  'opsiyonu',
  'madde',
  'maddesi',
  'sart',
  'sartlar',
  'paket',
  'formul',
  'bedel',
  'bedeli',
  'maas',
  'maasi',
  'ucret',
  'ucreti',
  'milyon',
  'bin',
  'euro',
  'dolar',
  'tl',
  'gelecek',
  'ayrilik',
  'ayrilacak',
  'ayriliyor',
  'veda',
  'flas',
  'bomba',
  'resmi',
  'aciklama',

  // Management, club roles & stakeholders
  'yonetim',
  'yonetimi',
  'yonetici',
  'baskan',
  'baskani',
  'menajer',
  'menajeri',
  'menajerler',
  'menajerlerden',
  'taraf',
  'taraflar',
  'taraflardan',
  'kulup',
  'kulubu',
  'teknik',
  'direktor',
  'direktoru',
  'hoca',
  'hocasi',
  'antrenor',
  'antrenoru',
  'yardimci',
  'hakem',
  'gozlemci',
  'temsilci',
  'komite',
  'heyet',
  'divan',
  'kurul',
  'kurulu',
  'federasyon',
  'tff',
  'uefa',
  'fifa',
  'basin',
  'sozcu',
  'sozcusu',
  'muhabir',
  'yazar',
  'yorumcu',
  'gazete',
  'gazeteci',

  // Tactics, positions, match terms
  'forvet',
  'forvete',
  'forveti',
  'orta saha',
  'orta sahaya',
  'defans',
  'defansa',
  'stoper',
  'stopere',
  'bek',
  'beke',
  'kanat',
  'kanada',
  'kaleci',
  'kalecisi',
  'kaptan',
  'kaptani',
  'yedek',
  'as',
  'ilk 11',
  'onbir',
  'hucum',
  'hucuma',
  'savunma',
  'savunmaya',
  'kale',
  'gol',
  'goller',
  'golcu',
  'golcusu',
  'asist',
  'pas',
  'sut',
  'mac',
  'maci',
  'derbi',
  'mucadele',
  'hazirlik',
  'kamp',
  'kampi',
  'kupa',
  'kupasi',
  'lig',
  'ligi',
  'puan',
  'sezon',
  'sezonu',
  'devre',
  'yari',
  'uzatma',
  'penalti',
  'kart',
  'faul',
  'tac',
  'korner',
  'ofsayt',
  'yerli',
  'yabanci',
  'gurbetci',
  'yildiz',
  'yildizi',
  'milli',
  'takim',
  'takimi',
  'spor',
  'futbol',
  'futbolcu',
  'oyuncu',
  'oyuncusu',

  // Club abbreviations & nicknames
  'cimbom',
  'aslan',
  'aslanlar',
  'sari kirmizililar',
  'sari kirmizi',
  'kara kartal',
  'kanarya',
  'firtina',
  'real',
  'serie',
  'ligi',
  'united',
  'city',
  'town',
]);

// ─── Demonyms, Countries & Geographic Words ─────────────────────────────────

export const GEOGRAPHIC_AND_DEMONYMS = new Set([
  'rusya',
  'turkiye',
  'suudi arabistan',
  'suudi',
  'arabistan',
  'fildisi sahili',
  'fildisi sahilli',
  'fildisi',
  'guney amerika',
  'kuzey amerika',
  'afrika',
  'afrikali',
  'avrupa',
  'avrupali',
  'asya',
  'asyali',
  'orta dogu',
  'latin amerika',
  'ispanya',
  'ispanyol',
  'italya',
  'italyan',
  'almanya',
  'alman',
  'ingiltere',
  'ingiliz',
  'fransa',
  'fransiz',
  'brezilya',
  'brezilyali',
  'portekiz',
  'portekizli',
  'hollanda',
  'hollandali',
  'arjantin',
  'arjantinli',
  'belcika',
  'belcikali',
  'norvec',
  'norvecli',
  'isvec',
  'isvecli',
  'danimarka',
  'danimarkali',
  'polonya',
  'polonyali',
  'sirbistan',
  'sirp',
  'hirvatistan',
  'hirvat',
  'nijerya',
  'nijeryali',
  'senegal',
  'senegalli',
  'fas',
  'fasli',
  'cezayir',
  'cezayirli',
  'misir',
  'misirli',
  'gana',
  'ganali',
  'kamerun',
  'kamerunlu',
  'kolombiya',
  'kolombiyali',
  'uruguay',
  'uruguayli',
  'sili',
  'silili',
  'paraguay',
  'paraguayli',
  'madridli',
  'chelseali',
  'arsenalli',
  'galatasarayli',
  'fenerbahceli',
  'besiktasli',
  'trabzonsporlu',
  'turk',
]);

// ─── Pre-API Candidate Validator ───────────────────────────────────────────

/**
 * Validates a text candidate locally before attempting upstream API-Football resolution.
 * Filters out football terminology, management, journalists, geographies, demonyms, and malformed strings.
 */
export function validatePlayerCandidate(
  candidate: string,
): ValidationResult {
  const trimmed = candidate.trim();
  const norm = normalizeText(trimmed);

  // 1. Length check
  if (!norm || norm.length < 3) {
    return { isValid: false, normalizedCandidate: norm, reason: 'TOO_SHORT', details: `Length (${norm.length}) < 3` };
  }

  // 2. Pure digit or symbol strings
  if (/^[0-9\s._-]+$/.test(trimmed)) {
    return { isValid: false, normalizedCandidate: norm, reason: 'NOT_NAME_FORMAT', details: 'Contains only numbers/symbols' };
  }

  // 3. Football terminology & transfer jargon
  if (FOOTBALL_AND_TRANSFER_TERMS.has(norm)) {
    return { isValid: false, normalizedCandidate: norm, reason: 'NON_PLAYER_TERMINOLOGY', details: `Matched generic term "${norm}"` };
  }

  // 4. Geographic & Demonym words
  if (GEOGRAPHIC_AND_DEMONYMS.has(norm)) {
    return { isValid: false, normalizedCandidate: norm, reason: 'GEOGRAPHIC_OR_DEMONYM', details: `Matched geographic/demonym "${norm}"` };
  }

  // 5. Check suffixes (-li, -lı, -lu, -lü, -lar, -ler)
  if (norm.endsWith('li') || norm.endsWith('lu') || norm.endsWith('lilar') || norm.endsWith('liler')) {
    const stem = norm.replace(/(lilar|liler|li|lu)$/, '').trim();
    if (
      GEOGRAPHIC_AND_DEMONYMS.has(stem) ||
      KNOWN_CLUBS_AND_ORGANIZATIONS.includes(stem) ||
      NON_PLAYER_ENTITIES.has(stem) ||
      FOOTBALL_AND_TRANSFER_TERMS.has(stem)
    ) {
      return { isValid: false, normalizedCandidate: norm, reason: 'GEOGRAPHIC_OR_DEMONYM', details: `Matched suffix demonym "${norm}"` };
    }
  }

  // 6. Known clubs, organizations, leagues, stadiums
  if (NON_PLAYER_ENTITIES.has(norm) || KNOWN_CLUBS_AND_ORGANIZATIONS.includes(norm)) {
    return { isValid: false, normalizedCandidate: norm, reason: 'KNOWN_CLUB_OR_COMPETITION', details: `Matched known entity "${norm}"` };
  }

  // 7. Token structure validation
  const parts = norm.split(/\s+/).filter(Boolean);

  // Single token validation
  if (parts.length === 1) {
    const token = parts[0];
    if (token.length < 4) {
      return { isValid: false, normalizedCandidate: norm, reason: 'TOO_SHORT', details: 'Single token length < 4' };
    }
    if (AMBIGUOUS_SURNAMES.has(token)) {
      return { isValid: false, normalizedCandidate: norm, reason: 'AMBIGUOUS_MONONYM', details: `Ambiguous surname "${token}" without first name` };
    }
    if (FOOTBALL_AND_TRANSFER_TERMS.has(token) || GEOGRAPHIC_AND_DEMONYMS.has(token)) {
      return { isValid: false, normalizedCandidate: norm, reason: 'NON_PLAYER_TERMINOLOGY', details: `Single token generic term "${token}"` };
    }
  }

  // Multi-token validation: check individual words
  if (parts.length >= 2) {
    const allAreGeneric = parts.every(
      (p) => FOOTBALL_AND_TRANSFER_TERMS.has(p) || GEOGRAPHIC_AND_DEMONYMS.has(p),
    );
    if (allAreGeneric) {
      return { isValid: false, normalizedCandidate: norm, reason: 'NON_PLAYER_TERMINOLOGY', details: `All tokens are generic terms in "${norm}"` };
    }
  }

  return { isValid: true, normalizedCandidate: norm };
}
