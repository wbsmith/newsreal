import { fetchFeed, FeedItem } from './rss-parser';

const REUTERS_FEEDS = [
  { url: 'https://news.google.com/rss/search?q=site:reuters.com+world&hl=en-US&gl=US&ceid=US:en', name: 'Reuters World' },
  { url: 'https://news.google.com/rss/search?q=site:reuters.com+business&hl=en-US&gl=US&ceid=US:en', name: 'Reuters Business' },
  { url: 'https://news.google.com/rss/search?q=site:reuters.com+technology&hl=en-US&gl=US&ceid=US:en', name: 'Reuters Tech' },
];

export async function fetchReuters(): Promise<FeedItem[]> {
  const results: FeedItem[] = [];

  for (const feed of REUTERS_FEEDS) {
    try {
      const items = await fetchFeed(feed.url, feed.name);
      results.push(...items);
    } catch (err) {
      console.error(`Failed to fetch ${feed.name}:`, err);
    }
  }

  return results;
}
