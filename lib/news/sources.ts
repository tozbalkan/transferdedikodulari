import type { RssSourceConfig } from '@/types/transfer';

/**
 * Whitelist of verified and accessible RSS sources.
 * Sources are categorized by type ('PRESS', 'RSS') and language ('tr', 'en').
 * Disabled sources can be toggled without code modifications.
 */
export const RSS_SOURCES: RssSourceConfig[] = [
  // ─── Turkish Sports Media Feeds ──────────────────────────────────────────
  {
    id: 'fotomac-gs',
    name: 'Fotomaç Galatasaray',
    url: 'https://www.fotomac.com.tr/rss/galatasaray.xml',
    type: 'PRESS',
    language: 'tr',
    enabled: true,
  },
  {
    id: 'fotomac-transfer',
    name: 'Fotomaç Transfer',
    url: 'https://www.fotomac.com.tr/rss/transfer.xml',
    type: 'PRESS',
    language: 'tr',
    enabled: true,
  },
  {
    id: 'aspor-gs',
    name: 'A Spor Galatasaray',
    url: 'https://www.aspor.com.tr/rss/galatasaray.xml',
    type: 'PRESS',
    language: 'tr',
    enabled: true,
  },
  {
    id: 'sabah-spor',
    name: 'Sabah Spor',
    url: 'https://www.sabah.com.tr/rss/spor.xml',
    type: 'PRESS',
    language: 'tr',
    enabled: true,
  },
  {
    id: 'fanatik-gs',
    name: 'Fanatik Galatasaray',
    url: 'https://www.fanatik.com.tr/rss/galatasaray',
    type: 'PRESS',
    language: 'tr',
    enabled: false, // Feed currently returns 404
  },
  {
    id: 'trthaber-spor',
    name: 'TRT Haber Spor',
    url: 'https://www.trthaber.com/spor_articles.rss',
    type: 'PRESS',
    language: 'tr',
    enabled: true,
  },

  // ─── International Football News Feeds ───────────────────────────────────
  {
    id: 'bbc-football',
    name: 'BBC Sport Football',
    url: 'https://feeds.bbci.co.uk/sport/football/rss.xml',
    type: 'PRESS',
    language: 'en',
    enabled: true,
  },
  {
    id: 'skysports-football',
    name: 'Sky Sports Football',
    url: 'https://www.skysports.com/rss/12040',
    type: 'PRESS',
    language: 'en',
    enabled: true,
  },
];
