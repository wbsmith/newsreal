import { fetchFeed, FeedItem } from './rss-parser';

const AP_FEEDS = [
  { url: 'https://feedx.net/rss/ap.xml', name: 'AP Top News' },
  { url: 'https://news.google.com/rss/search?q=site:apnews.com+politics&hl=en-US&gl=US&ceid=US:en', name: 'AP Politics' },
  { url: 'https://news.google.com/rss/search?q=site:apnews.com+business&hl=en-US&gl=US&ceid=US:en', name: 'AP Business' },
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
