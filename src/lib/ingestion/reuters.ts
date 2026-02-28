import { fetchFeed, FeedItem } from './rss-parser';

const REUTERS_FEEDS = [
  { url: 'https://rsshub.app/reuters/world', name: 'Reuters World' },
  { url: 'https://rsshub.app/reuters/business', name: 'Reuters Business' },
  { url: 'https://rsshub.app/reuters/technology', name: 'Reuters Tech' },
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
