import { fetchFeed, FeedItem } from './rss-parser';

const REDDIT_FEEDS = [
  { url: 'https://www.reddit.com/r/news/.rss', name: 'Reddit r/news' },
  { url: 'https://www.reddit.com/r/politics/.rss', name: 'Reddit r/politics' },
  { url: 'https://www.reddit.com/r/worldnews/.rss', name: 'Reddit r/worldnews' },
  { url: 'https://www.reddit.com/r/conspiracy/.rss', name: 'Reddit r/conspiracy' },
];

export async function fetchReddit(): Promise<FeedItem[]> {
  const results: FeedItem[] = [];

  for (const feed of REDDIT_FEEDS) {
    try {
      const items = await fetchFeed(feed.url, feed.name);
      results.push(...items);
    } catch (err) {
      console.error(`Failed to fetch ${feed.name}:`, err);
    }
  }

  return results;
}
