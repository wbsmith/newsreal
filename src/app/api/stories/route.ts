import { NextResponse } from 'next/server';
import { getCached } from '@/lib/cache';
import { batchGetStories, getRecentStories } from '@/lib/db';
import { Story, Narrative, Obfuscation, TickerItem } from '@/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  let stories: Story[] = [];
  let narratives: Narrative[] = [];
  let obfuscations: Obfuscation[] = [];
  let tickerItems: TickerItem[] = [];
  let suppressedSearches: string[] = [];
  let source: 'manifest' | 'db' = 'db';

  // Read manifest + sidebar data from cache in parallel
  const [manifest, cachedNarratives, cachedObfuscations, cachedTicker, cachedSuppressed] =
    await Promise.all([
      getCached<string[]>('homepage-manifest').catch(() => null),
      getCached<Narrative[]>('homepage-narratives').catch(() => null),
      getCached<Obfuscation[]>('homepage-obfuscations').catch(() => null),
      getCached<TickerItem[]>('homepage-ticker').catch(() => null),
      getCached<string[]>('homepage-suppressed').catch(() => null),
    ]);

  if (cachedNarratives) narratives = cachedNarratives;
  if (cachedObfuscations) obfuscations = cachedObfuscations;
  if (cachedTicker) tickerItems = cachedTicker;
  if (cachedSuppressed) suppressedSearches = cachedSuppressed;

  // Primary path: manifest (ordered slug list) → batch get full stories from DynamoDB
  if (manifest && manifest.length > 0) {
    try {
      const items = await batchGetStories(manifest);
      // Re-order to match manifest order
      const bySlug = new Map(items.map((item) => [item.id as string, item]));
      stories = manifest
        .map((slug) => bySlug.get(slug))
        .filter(Boolean) as unknown as Story[];
      source = 'manifest';
    } catch {
      // Batch get failed — fall through to scan
    }
  }

  // Fallback: DynamoDB scan (unordered, no sidebar data)
  if (stories.length === 0) {
    try {
      const dbStories = await getRecentStories(120);
      if (dbStories.length > 0) {
        stories = dbStories as unknown as Story[];
        source = 'db';
      }
    } catch {
      // DB error — return empty
    }
  }

  // Apply category filter
  if (category && category !== 'all') {
    stories = stories.filter((s) => s.category === category);
  }

  return NextResponse.json({
    stories,
    narratives,
    obfuscations,
    ticker: tickerItems,
    suppressedSearches,
    source,
  });
}
