import { NextResponse } from 'next/server';
import {
  analyzeStory,
  generateObfuscationIndex,
  generateNarratives,
  generateTickerItems,
  generateSuppressedSearches,
  feedItemToStory,
} from '@/lib/analysis/story-analyzer';
import { putStory } from '@/lib/db';
import { getCached, setCached } from '@/lib/cache';
import { Story } from '@/types';
import { ClassifiedItem, trimForCache, batchProcess } from '@/lib/analysis/pipeline-utils';

export const maxDuration = 300;

const CACHE_TTL = 21600; // 6 hours
const ANALYZE_BATCH_SIZE = 5; // Concurrent Sonnet calls per batch
const ANALYZE_PER_RUN = 5; // Stories to deep-analyze per invocation (fits in 28s)

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    // ─── Load classified stories from cache (set by ingest-news) ───
    const classified = await getCached<ClassifiedItem[]>('pipeline-classified');
    if (!classified || classified.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No classified stories in cache — run ingest-news first',
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    // ─── Load existing stories to find which still need analysis ───
    const existingStories = await getCached<Story[]>('homepage-stories') || [];
    const alreadyAnalyzed = new Set(
      existingStories
        .filter((s) => s.deepDive.mainstream !== 'Full analysis not yet generated for this story.')
        .map((s) => s.headline)
    );

    // Find stories that haven't been deep-analyzed yet
    const needsAnalysis = classified.filter((c) => !alreadyAnalyzed.has(c.item.title));
    const toAnalyze = needsAnalysis.slice(0, ANALYZE_PER_RUN);

    if (toAnalyze.length === 0) {
      // All stories analyzed — just regenerate sidebar data
      const headlines = classified.slice(0, 20).map((c) => `[${c.item.source}] ${c.item.title}`);
      const storySummaries = existingStories.slice(0, 15).map((s) => `${s.headline} (${s.source})`);

      const [obfuscations, narratives] = await Promise.all([
        generateObfuscationIndex(headlines),
        generateNarratives(headlines),
      ]);

      const narrativeSummaries = narratives.map((n) => n.text);
      const obfuscationSummaries = obfuscations.map((o) => `${o.category}: ${o.whatHappened}`);

      const [tickerItems, suppressedSearches] = await Promise.all([
        generateTickerItems(storySummaries, narrativeSummaries, obfuscationSummaries),
        generateSuppressedSearches(storySummaries, obfuscationSummaries),
      ]);

      await Promise.allSettled([
        setCached('homepage-narratives', narratives, CACHE_TTL),
        setCached('homepage-obfuscations', obfuscations, CACHE_TTL),
        setCached('homepage-ticker', tickerItems, CACHE_TTL),
        setCached('homepage-suppressed', suppressedSearches, CACHE_TTL),
      ]);

      return NextResponse.json({
        success: true,
        mode: 'sidebar-refresh',
        stats: {
          alreadyAnalyzed: alreadyAnalyzed.size,
          narratives: narratives.length,
          obfuscations: obfuscations.length,
          tickerItems: tickerItems.length,
          suppressedSearches: suppressedSearches.length,
        },
        duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
        timestamp: new Date().toISOString(),
      });
    }

    // ─── Deep-analyze batch with Sonnet ───
    const analysisResults = await batchProcess(
      toAnalyze,
      (c) => analyzeStory(c.item, c.classification),
      ANALYZE_BATCH_SIZE
    );

    // Merge new analyses into existing stories
    const storyMap = new Map(existingStories.map((s) => [s.headline, s]));
    let newlyAnalyzed = 0;

    for (let i = 0; i < toAnalyze.length; i++) {
      const analysis = analysisResults[i];
      if (!analysis) continue;

      const c = toAnalyze[i];
      const existing = storyMap.get(c.item.title);
      const idx = existing ? existing.id - 1 : storyMap.size;
      const story = feedItemToStory(c.item, c.classification, analysis, idx);
      storyMap.set(c.item.title, story);
      newlyAnalyzed++;
    }

    const updatedStories = Array.from(storyMap.values());

    // Store analyzed stories in DynamoDB
    const storeResults = await Promise.allSettled(
      updatedStories.filter((s) =>
        s.deepDive.mainstream !== 'Full analysis not yet generated for this story.'
      ).slice(0, 20).map((story) =>
        putStory({
          ...story,
          id: story.slug,
          summary: story.summary.slice(0, 500),
          publishedAt: new Date().toISOString(),
        })
      )
    );
    const stored = storeResults.filter((r) => r.status === 'fulfilled').length;

    await setCached('homepage-stories', trimForCache(updatedStories), CACHE_TTL);

    return NextResponse.json({
      success: true,
      mode: 'analyze',
      stats: {
        totalClassified: classified.length,
        previouslyAnalyzed: alreadyAnalyzed.size,
        analyzedThisRun: newlyAnalyzed,
        remaining: needsAnalysis.length - newlyAnalyzed,
        stored,
      },
      duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Analyze pipeline error:', error);
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
