import { fetchFeed, FeedItem } from './rss-parser';
import { Category } from '@/types';

interface CategoryFeedConfig {
  query: string;
  sourceName: string;
  hintCategory: Category;
}

const GOOGLE_NEWS_SEARCH_BASE =
  'https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q=';

const CATEGORY_FEEDS: CategoryFeedConfig[] = [
  // ─── Tech & AI ───
  { query: 'site:techcrunch.com', sourceName: 'TechCrunch', hintCategory: 'tech' },
  { query: 'site:arstechnica.com', sourceName: 'Ars Technica', hintCategory: 'tech' },
  { query: '"artificial intelligence" OR "machine learning"', sourceName: 'AI News', hintCategory: 'tech' },
  { query: '"cybersecurity" OR "data breach"', sourceName: 'Cybersecurity News', hintCategory: 'tech' },
  { query: 'site:theverge.com', sourceName: 'The Verge', hintCategory: 'tech' },
  { query: '"OpenAI" OR "Google AI" OR "AI regulation"', sourceName: 'AI Industry', hintCategory: 'tech' },

  // ─── Finance ───
  { query: 'site:cnbc.com', sourceName: 'CNBC', hintCategory: 'finance' },
  { query: '"SEC filing" OR "federal reserve" OR "interest rate"', sourceName: 'Finance Regulation', hintCategory: 'finance' },
  { query: '"cryptocurrency" OR "bitcoin" OR "ethereum"', sourceName: 'Crypto News', hintCategory: 'finance' },
  { query: 'site:bloomberg.com', sourceName: 'Bloomberg', hintCategory: 'finance' },
  { query: '"Wall Street" OR "stock market" OR "IPO"', sourceName: 'Markets', hintCategory: 'finance' },

  // ─── Science ───
  { query: '"scientific study" OR "research finds"', sourceName: 'Science Research', hintCategory: 'science' },
  { query: '"NASA" OR "SpaceX" OR "space exploration"', sourceName: 'Space News', hintCategory: 'science' },
  { query: '"climate change" OR "climate research"', sourceName: 'Climate Science', hintCategory: 'science' },
  { query: '"medical research" OR "FDA approval" OR "clinical trial"', sourceName: 'Medical Research', hintCategory: 'science' },
  { query: 'site:nature.com OR site:sciencedaily.com', sourceName: 'Science Journals', hintCategory: 'science' },

  // ─── Deep State ───
  { query: '"federal register" OR "executive order"', sourceName: 'Federal Register', hintCategory: 'deep-state' },
  { query: '"FOIA" OR "declassified" OR "intelligence community"', sourceName: 'Intel Community', hintCategory: 'deep-state' },
  { query: '"lobbying disclosure" OR "revolving door" government', sourceName: 'Lobbying Watch', hintCategory: 'deep-state' },
  { query: '"government contract" OR "defense contractor" OR "no-bid"', sourceName: 'Defense Contracts', hintCategory: 'deep-state' },

  // ─── Politics (supplement) ───
  { query: 'site:politico.com', sourceName: 'Politico', hintCategory: 'politics' },
  { query: '"congressional hearing" OR "subpoena" OR "oversight committee"', sourceName: 'Congressional', hintCategory: 'politics' },

  // ─── World (supplement) ───
  { query: 'site:aljazeera.com', sourceName: 'Al Jazeera', hintCategory: 'world' },
  { query: 'site:bbc.com world', sourceName: 'BBC World', hintCategory: 'world' },
];

async function fetchCategoryFeed(config: CategoryFeedConfig): Promise<FeedItem[]> {
  const url = `${GOOGLE_NEWS_SEARCH_BASE}${encodeURIComponent(config.query)}`;
  try {
    const items = await fetchFeed(url, config.sourceName);
    return items.map((item) => ({ ...item, hintCategory: config.hintCategory }));
  } catch (err) {
    console.error(`Category feed failed [${config.sourceName}]:`, err instanceof Error ? err.message : err);
    return [];
  }
}

export async function fetchCategoryFeeds(): Promise<FeedItem[]> {
  const results = await Promise.allSettled(
    CATEGORY_FEEDS.map((config) => fetchCategoryFeed(config))
  );

  const items: FeedItem[] = [];
  let failures = 0;
  for (const result of results) {
    if (result.status === 'fulfilled') {
      items.push(...result.value);
    } else {
      failures++;
      console.error('Category feed promise rejected:', result.reason);
    }
  }

  console.log(`Category feeds: ${items.length} items from ${CATEGORY_FEEDS.length - failures}/${CATEGORY_FEEDS.length} feeds`);
  return items;
}
