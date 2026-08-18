import Parser from 'rss-parser';
import type { RawNewsItem, RssSourceConfig, RssSourceHealth } from '@/types/transfer';
import { RSS_SOURCES } from './sources';

const DEFAULT_FETCH_TIMEOUT_MS = 7000;

interface CustomFeedItem {
  id?: string;
  guid?: string;
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  content?: string;
  contentSnippet?: string;
  summary?: string;
  description?: string;
}

const parser = new Parser<Record<string, unknown>, CustomFeedItem>({
  timeout: DEFAULT_FETCH_TIMEOUT_MS,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Accept:
      'application/rss+xml, application/xml, text/xml, application/atom+xml, text/html;q=0.9, */*;q=0.8',
  },
  customFields: {
    item: ['description', 'summary', 'content', 'guid'],
  },
});

export interface FetchFeedsResult {
  items: RawNewsItem[];
  health: RssSourceHealth[];
}

/**
 * Fetch a single RSS source safely with timeout and error containment.
 */
export async function fetchSingleFeed(source: RssSourceConfig): Promise<{
  items: RawNewsItem[];
  health: RssSourceHealth;
}> {
  if (!source.enabled) {
    return {
      items: [],
      health: {
        sourceId: source.id,
        name: source.name,
        enabled: false,
        success: true,
        itemCount: 0,
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  try {
    const feed = await parser.parseURL(source.url);
    const rawItems: RawNewsItem[] = (feed.items || [])
      .filter((item) => item.title && item.link)
      .map((item, index) => {
        const publishedDate = item.isoDate || item.pubDate || new Date().toISOString();
        const summary = item.contentSnippet || item.summary || item.description || '';
        const content = item.content || item.description || '';
        const id = item.guid || item.id || item.link || `${source.id}-${index}-${Date.now()}`;

        return {
          id: String(id),
          title: item.title || '',
          url: item.link || '',
          publishedAt: publishedDate,
          source: source.name,
          summary,
          content,
        };
      });

    return {
      items: rawItems,
      health: {
        sourceId: source.id,
        name: source.name,
        enabled: true,
        success: true,
        itemCount: rawItems.length,
        fetchedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown RSS fetch error';
    return {
      items: [],
      health: {
        sourceId: source.id,
        name: source.name,
        enabled: true,
        success: false,
        itemCount: 0,
        error: errorMessage,
        fetchedAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * Fetch all enabled RSS feeds in parallel with individual error isolation.
 */
export async function fetchAllFeeds(
  sources: RssSourceConfig[] = RSS_SOURCES,
): Promise<FetchFeedsResult> {
  const results = await Promise.all(sources.map((source) => fetchSingleFeed(source)));

  const allItems: RawNewsItem[] = [];
  const healthList: RssSourceHealth[] = [];

  for (const res of results) {
    allItems.push(...res.items);
    healthList.push(res.health);
  }

  return {
    items: allItems,
    health: healthList,
  };
}
