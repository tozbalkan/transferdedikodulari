// ─── Enums & Literals ────────────────────────────────────────────────────────

export const POSITIONS = ['FORWARD', 'MIDFIELDER', 'DEFENDER', 'GOALKEEPER'] as const;
export type Position = (typeof POSITIONS)[number];

export const TREND_DIRECTIONS = ['UP', 'DOWN', 'NEUTRAL'] as const;
export type TrendDirection = (typeof TREND_DIRECTIONS)[number];

export const RUMOR_SOURCE_TYPES = ['PRESS', 'RSS', 'X', 'FORUM'] as const;
export type RumorSourceType = (typeof RUMOR_SOURCE_TYPES)[number];

// ─── Player Model ───────────────────────────────────────────────────────────

export interface Player {
  id: string;
  externalId: number | string;
  name: string;
  firstName: string;
  lastName: string;
  position: Position;
  currentClub: string;
  currentClubId?: number;
  nationality: string;
  age?: number;
  photo?: string;
  aliases: string[];
}

// ─── News & RSS Models ──────────────────────────────────────────────────────

export interface RawNewsItem {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  source: string;
  summary?: string;
  content?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary?: string;
  playerId?: string;
}

export interface RssSourceConfig {
  id: string;
  name: string;
  url: string;
  type?: RumorSourceType;
  language: 'tr' | 'en';
  enabled: boolean;
}

export interface RssSourceHealth {
  sourceId: string;
  name: string;
  enabled: boolean;
  success: boolean;
  itemCount: number;
  error?: string;
  fetchedAt: string;
}

export interface SourceDistribution {
  rss: number;
  press: number;
  x: number;
  forum: number;
}

export interface RumorSourceInfo {
  name: string;
  type: RumorSourceType;
  articleCount: number;
  url?: string;
}

// ─── Transfer Rumor Model ───────────────────────────────────────────────────

export interface TransferRumor {
  player: Player;
  mentionCount: number;
  uniqueArticleCount: number;
  sourceCount: number;
  trend: TrendDirection;
  trendPercentage: number;
  score: number;
  confidenceScore?: number;
  recencyScore?: number;
  sourceDiversityScore?: number;
  sourceDistribution: SourceDistribution;
  sources: RumorSourceInfo[];
  latestNews: NewsItem[];
}

// ─── API Response ───────────────────────────────────────────────────────────

export interface RumorsApiMeta {
  totalPlayers: number;
  totalMentions: number;
  totalArticles: number;
  generatedAt: string;
  sourceHealth?: RssSourceHealth[];
}

export interface RumorsApiResponse {
  data: TransferRumor[];
  meta: RumorsApiMeta;
}

export interface PlayersApiResponse {
  data: Player[];
  meta: {
    total: number;
    teamName: string;
    teamId: number | string;
    generatedAt: string;
  };
}

// ─── Scoring Config ─────────────────────────────────────────────────────────

export interface ScoringWeights {
  mentionVolume: number;
  uniqueArticles: number;
  sourceDiversity: number;
  recency: number;
}
