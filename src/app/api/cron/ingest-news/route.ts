import { NextResponse } from 'next/server';
import { fetchAPNews } from '@/lib/ingestion/ap-news';
import { fetchReuters } from '@/lib/ingestion/reuters';
import { fetchGoogleNews } from '@/lib/ingestion/google-news';
import { fetchReddit } from '@/lib/ingestion/reddit';
import { deduplicateStories } from '@/lib/ingestion/dedup';
import { FeedItem } from '@/lib/ingestion/rss-parser';
import {
  classifyStory,
  analyzeStory,
  generateObfuscationIndex,
  generateNarratives,
  generateTickerItems,
  generateSuppressedSearches,
  feedItemToStory,
  Classification,
} from '@/lib/analysis/story-analyzer';
import { putStory } from '@/lib/db';
import { getCached, setCached } from '@/lib/cache';
import { Story } from '@/types';

export const maxDuration = 300;

const CACHE_TTL = 21600; // 6 hours
const CLASSIFY_BATCH_SIZE = 10; // Max concurrent Haiku calls
const ANALYZE_BATCH_SIZE = 5; // Max concurrent Sonnet calls
const MAX_STORIES_TO_CACHE = 30; // Keep cache under DynamoDB 400KB limit

// Run tasks in batches to avoid rate limits
async function batchProcess<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  batchSize: number
): Promise<(R | null)[]> {
  const results: (R | null)[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    for (const result of batchResults) {
      results.push(result.status === 'fulfilled' ? result.value : null);
    }
  }
  return results;
}

// Trim content fields so stories fit in DynamoDB's 400KB item limit
function trimForCache(stories: Story[]): Story[] {
  return stories.slice(0, MAX_STORIES_TO_CACHE).map((s) => ({
    ...s,
    summary: s.summary.slice(0, 500),
    realAnalysis: s.realAnalysis.slice(0, 1000),
    deepDive: {
      mainstream: s.deepDive.mainstream.slice(0, 800),
      realStory: s.deepDive.realStory.slice(0, 800),
      leftSpin: s.deepDive.leftSpin.slice(0, 800),
      rightSpin: s.deepDive.rightSpin.slice(0, 800),
      whosBenefiting: s.deepDive.whosBenefiting.slice(0, 800),
      whatsHidden: s.deepDive.whatsHidden.slice(0, 800),
    },
  }));
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    // ─── Throttle check: skip full AI pipeline if last run was <1 hour ago ───
    const lastRun = await getCached<number>('pipeline-last-run');
    const now = Date.now();
    const fullPipeline = !lastRun || (now - lastRun) > 3600000; // 1 hour

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

    // Limit to top 50 most recent for classification (saves API cost)
    const toClassify = unique.slice(0, 50);

    // ─── Step 3: Classify stories with Haiku in batches ───
    const classificationResults = await batchProcess(
      toClassify,
      (item) => classifyStory(item),
      CLASSIFY_BATCH_SIZE
    );

    const classified: { item: FeedItem; classification: Classification }[] = [];
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

    if (!fullPipeline) {
      // Lightweight run: just store classified stories with minimal data
      const stories = classified.map((c, i) => feedItemToStory(c.item, c.classification, null, i));
      await setCached('homepage-stories', trimForCache(stories), CACHE_TTL);

      return NextResponse.json({
        success: true,
        mode: 'lightweight',
        stats: {
          fetched: allItems.length,
          deduped: duplicates.length,
          unique: unique.length,
          classified: classified.length,
        },
        duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
        timestamp: new Date().toISOString(),
      });
    }

    // ─── Step 4: Deep-analyze top 10 with Sonnet in batches ───
    const top10 = classified.slice(0, 10);
    const analysisResults = await batchProcess(
      top10,
      (c) => analyzeStory(c.item, c.classification),
      ANALYZE_BATCH_SIZE
    );

    // Build analysis map (index → result)
    const analysisMap = new Map<number, NonNullable<typeof analysisResults[number]>>();
    for (let i = 0; i < analysisResults.length; i++) {
      if (analysisResults[i]) {
        analysisMap.set(i, analysisResults[i]!);
      }
    }

    // ─── Step 5: Convert all classified stories to Story objects ───
    const stories: Story[] = classified.map((c, i) => {
      const analysis = analysisMap.get(i) ?? null;
      return feedItemToStory(c.item, c.classification, analysis, i);
    });

    // ─── Step 6: Generate sidebar data in parallel ───
    const headlines = classified.slice(0, 20).map((c) => `[${c.item.source}] ${c.item.title}`);

    const [obfuscations, narratives] = await Promise.all([
      generateObfuscationIndex(headlines),
      generateNarratives(headlines),
    ]);

    // Ticker and suppressed searches depend on the above
    const storySummaries = stories.slice(0, 15).map((s) => `${s.headline} (${s.source})`);
    const narrativeSummaries = narratives.map((n) => n.text);
    const obfuscationSummaries = obfuscations.map((o) => `${o.category}: ${o.whatHappened}`);

    const [tickerItems, suppressedSearches] = await Promise.all([
      generateTickerItems(storySummaries, narrativeSummaries, obfuscationSummaries),
      generateSuppressedSearches(storySummaries, obfuscationSummaries),
    ]);

    // ─── Step 7: Store top stories in DynamoDB ───
    const storeResults = await Promise.allSettled(
      stories.slice(0, 20).map((story) =>
        putStory({
          ...story,
          id: story.slug,
          summary: story.summary.slice(0, 500),
          publishedAt: new Date().toISOString(),
        })
      )
    );
    const stored = storeResults.filter((r) => r.status === 'fulfilled').length;

    // ─── Step 8: Cache assembled page data (trimmed to fit 400KB) ───
    await Promise.allSettled([
      setCached('homepage-stories', trimForCache(stories), CACHE_TTL),
      setCached('homepage-narratives', narratives, CACHE_TTL),
      setCached('homepage-obfuscations', obfuscations, CACHE_TTL),
      setCached('homepage-ticker', tickerItems, CACHE_TTL),
      setCached('homepage-suppressed', suppressedSearches, CACHE_TTL),
      setCached('pipeline-last-run', Date.now(), CACHE_TTL),
    ]);

    return NextResponse.json({
      success: true,
      mode: 'full',
      stats: {
        fetched: allItems.length,
        deduped: duplicates.length,
        unique: unique.length,
        classified: classified.length,
        analyzed: analysisMap.size,
        stored,
        narratives: narratives.length,
        obfuscations: obfuscations.length,
        tickerItems: tickerItems.length,
        suppressedSearches: suppressedSearches.length,
        sourceErrors,
      },
      duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Pipeline error:', error);
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
