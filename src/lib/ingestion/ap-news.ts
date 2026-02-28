import { fetchFeed, FeedItem } from './rss-parser';

const AP_FEEDS = [
  { url: 'https://rsshub.app/apnews/topics/apf-topnews', name: 'AP Top News' },
  { url: 'https://rsshub.app/apnews/topics/apf-politics', name: 'AP Politics' },
  { url: 'https://rsshub.app/apnews/topics/apf-business', name: 'AP Business' },
];

export async function fetchAPNews(): Promise<FeedItem[]> {
  const results: FeedItem[] = [];

  for (const feed of AP_FEEDS) {
    try {
      const items = await fetchFeed(feed.url, feed.name);
      results.push(...items);
    } catch (err) {
      console.error(`Failed to fetch ${feed.name}:`, err);
    }
  }

  return results;
}
