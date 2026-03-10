import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createHash } from 'crypto';
import { scrapeArticle } from '@/lib/scraper';
import { classifyStory, analyzeStory, feedItemToStory } from '@/lib/analysis/story-analyzer';
import { getCached, setCached } from '@/lib/cache';
import { FeedItem } from '@/lib/ingestion/rss-parser';

const RATE_LIMIT = 10;
const RATE_LIMIT_TTL = 86400; // 24 hours

async function checkRateLimit(ip: string): Promise<boolean> {
  const date = new Date().toISOString().slice(0, 10);
  const hash = createHash('sha256').update(ip).digest('hex').slice(0, 12);
  const key = `ratelimit:analyze:${hash}:${date}`;

  const count = await getCached<number>(key);
  if (count !== null && count >= RATE_LIMIT) return false;

  await setCached(key, (count ?? 0) + 1, RATE_LIMIT_TTL);
  return true;
}

export async function POST(request: Request) {
  // Rate limit check
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Maximum 10 analyses per day.' },
      { status: 429 }
    );
  }

  let body: { url?: string; text?: string; title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { url, text, title } = body;

  if (!url && !text) {
    return NextResponse.json(
      { error: 'Provide either a URL or article text' },
      { status: 400 }
    );
  }

  try {
    let articleTitle: string;
    let articleContent: string;
    let articleSource: string;
    let articleUrl: string;

    if (url) {
      // Validate URL
      try {
        new URL(url);
      } catch {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
      }

      const scraped = await scrapeArticle(url);
      articleTitle = scraped.title;
      articleContent = scraped.content;
      articleSource = scraped.siteName;
      articleUrl = url;
    } else {
      articleTitle = title || 'User-Submitted Article';
      articleContent = text!;
      articleSource = 'USER SUBMISSION';
      articleUrl = '';
    }

    // Build FeedItem-like object
    const feedItem: FeedItem = {
      title: articleTitle,
      link: articleUrl,
      pubDate: new Date().toISOString(),
      contentSnippet: articleContent.slice(0, 500),
      content: articleContent,
      source: articleSource,
    };

    // Classify with Haiku
    const classification = await classifyStory(feedItem);
    if (!classification) {
      return NextResponse.json(
        { error: 'Classification failed. Please try again.' },
        { status: 500 }
      );
    }

    // Analyze with Sonnet
    const analysis = await analyzeStory(feedItem, classification);

    // Build Story object
    const story = feedItemToStory(feedItem, classification, analysis, 0);
    // Override source URL for user submissions
    story.sourceUrl = articleUrl;

    return NextResponse.json({ story });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
