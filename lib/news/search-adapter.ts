import type { NewsItem } from '@/types/transfer';

export interface SearchNewsConfig {
  apiKey?: string;
  maxResults?: number;
  dateWindowDays?: number;
}

export interface NewsSourceAdapter {
  id: string;
  name: string;
  fetchArticles(query: string, dateWindowDays?: number): Promise<NewsItem[]>;
}

interface SerperNewsItem {
  title?: string;
  link?: string;
  source?: string;
  date?: string;
  snippet?: string;
}

interface SerperApiResponse {
  news?: SerperNewsItem[];
}

/**
 * Serper / Google Search API Adapter for discovering active live transfer rumors.
 * Configured via process.env.SERPER_API_KEY.
 * Gracefully returns empty array if no API key is provided, never fabricating results.
 */
export class SerperSearchNewsAdapter implements NewsSourceAdapter {
  id = 'serper-search';
  name = 'Serper Search API';
  private apiKey?: string;

  constructor(config?: SearchNewsConfig) {
    this.apiKey = config?.apiKey || process.env.SERPER_API_KEY;
  }

  async fetchArticles(query: string, dateWindowDays: number = 7): Promise<NewsItem[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      const response = await fetch('https://google.serper.dev/news', {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
          gl: 'tr',
          hl: 'tr',
          tbs: `qdr:d${dateWindowDays}`,
          num: 15,
        }),
      });

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as SerperApiResponse;
      if (!data.news || !Array.isArray(data.news)) {
        return [];
      }

      return data.news.map((item: SerperNewsItem, idx: number) => ({
        id: `serper-${Date.now()}-${idx}`,
        title: item.title || '',
        url: item.link || '',
        source: item.source || 'Haber',
        publishedAt: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
        summary: item.snippet || '',
        content: item.snippet || '',
      }));
    } catch {
      return [];
    }
  }
}
