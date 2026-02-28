import { fetchFeed, FeedItem } from './rss-parser';

const GOOGLE_NEWS_RSS = 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en';

const GOOGLE_NEWS_TOPIC_FEEDS: Record<string, string> = {
  world: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en',
  business: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en',
  technology: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en',
  science: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en',
};

export async function fetchGoogleNews(topic?: string): Promise<FeedItem[]> {
  const url = topic ? GOOGLE_NEWS_TOPIC_FEEDS[topic] || GOOGLE_NEWS_RSS : GOOGLE_NEWS_RSS;

  try {
    return await fetchFeed(url, 'Google News');
  } catch (err) {
    console.error('Failed to fetch Google News:', err);
    return [];
  }
}
