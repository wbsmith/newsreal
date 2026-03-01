import { NextResponse } from 'next/server';
import { fetchAPNews } from '@/lib/ingestion/ap-news';
import { fetchReuters } from '@/lib/ingestion/reuters';
import { fetchGoogleNews } from '@/lib/ingestion/google-news';
import { fetchReddit } from '@/lib/ingestion/reddit';
import { deduplicateStories } from '@/lib/ingestion/dedup';
import { FeedItem } from '@/lib/ingestion/rss-parser';
import {
  classifyStory,
  feedItemToStory,
  Classification,
} from '@/lib/analysis/story-analyzer';
import { getCached, setCached } from '@/lib/cache';
import { Story } from '@/types';
import { ClassifiedItem, trimForCache, batchProcess } from '@/lib/analysis/pipeline-utils';

export const maxDuration = 300;

const CACHE_TTL = 21600; // 6 hours
const CLASSIFY_BATCH_SIZE = 10; // Max concurrent Haiku calls
const CLASSIFY_COUNT = 30; // Classify top N (keep under 28s Amplify timeout)

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    // ─── Step 1: Fetch all RSS sources in parallel ───
    const feedResults = await Promise.allSettled([
      fetchAPNews(),
      fetchReuters(),
      fetchGoogleNews(),
      fetchGoogleNews('world'),
      fetchGoogleNews('business'),
      fetchGoogleNews('technology'),
      fetchGoogleNews('science'),
      fetchReddit(),
    ]);

    const allItems: FeedItem[] = [];
    let sourceErrors = 0;
    for (const result of feedResults) {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
      } else {
        sourceErrors++;
        console.error('Feed fetch failed:', result.reason);
      }
    }

    if (allItems.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'All RSS sources failed',
        sourceErrors,
        timestamp: new Date().toISOString(),
      }, { status: 502 });
    }

    // ─── Step 2: Deduplicate across all sources ───
    const { unique, duplicates } = deduplicateStories(allItems);

    const toClassify = unique.slice(0, CLASSIFY_COUNT);

    // ─── Step 3: Classify stories with Haiku in batches ───
    const classificationResults = await batchProcess(
      toClassify,
      (item) => classifyStory(item),
      CLASSIFY_BATCH_SIZE
    );

    const classified: ClassifiedItem[] = [];
    for (let i = 0; i < classificationResults.length; i++) {
      const result = classificationResults[i];
      if (result) {
        classified.push({ item: toClassify[i], classification: result });
      }
    }

    // Sort by priority (high first) then manipulation score (high first)
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    classified.sort((a, b) => {
      const pDiff = priorityOrder[a.classification.priority] - priorityOrder[b.classification.priority];
      if (pDiff !== 0) return pDiff;
      return b.classification.manipulation_index - a.classification.manipulation_index;
    });

    // ─── Step 4: Build stories and cache ───
    const stories = classified.map((c, i) => feedItemToStory(c.item, c.classification, null, i));
    await setCached('homepage-stories', trimForCache(stories), CACHE_TTL);

    // Cache classified items for the analyze step to pick up
    const classifiedForCache = classified.map((c) => ({
      item: {
        title: c.item.title,
        link: c.item.link,
        source: c.item.source,
        pubDate: c.item.pubDate,
        contentSnippet: (c.item.contentSnippet || c.item.content || '').slice(0, 500),
        content: '',
      },
      classification: c.classification,
    }));
    await setCached('pipeline-classified', classifiedForCache, CACHE_TTL);

    return NextResponse.json({
      success: true,
      stats: {
        fetched: allItems.length,
        deduped: duplicates.length,
        unique: unique.length,
        classified: classified.length,
        sourceErrors,
      },
      duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Ingest pipeline error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown pipeline error',
        duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
