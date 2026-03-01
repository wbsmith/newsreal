import Parser from 'rss-parser';
import { Category } from '@/types';

const parser = new Parser({
  timeout: 10000,
  requestOptions: {
    headers: {
      'User-Agent': 'NewsReal.ai/1.0 (Media Analysis Platform)',
    },
  },
});

export interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;
  content?: string;
  creator?: string;
  categories?: string[];
  source: string;
  hintCategory?: Category;
}

export async function fetchFeed(url: string, sourceName: string): Promise<FeedItem[]> {
  const feed = await parser.parseURL(url);

  return (feed.items || []).map((item) => ({
    title: item.title || '',
    link: item.link || '',
    pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
    contentSnippet: item.contentSnippet,
    content: item.content,
    creator: item.creator,
    categories: item.categories,
    source: sourceName,
  }));
}
