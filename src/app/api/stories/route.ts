import { NextResponse } from 'next/server';
import { getCached } from '@/lib/cache';
import { getRecentStories } from '@/lib/db';
import { Story, Narrative, Obfuscation, TickerItem } from '@/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  let stories: Story[] | null = null;
  let narratives: Narrative[] | null = null;
  let obfuscations: Obfuscation[] | null = null;
  let tickerItems: TickerItem[] | null = null;
  let suppressedSearches: string[] | null = null;
  let source: 'live' | 'db' = 'db';

  // Try 1: DynamoDB cache — all reads in parallel to stay within Amplify timeout
  try {
    const [cachedStories, cachedNarratives, cachedObfuscations, cachedTicker, cachedSuppressed] =
      await Promise.all([
        getCached<Story[]>('homepage-stories'),
        getCached<Narrative[]>('homepage-narratives'),
        getCached<Obfuscation[]>('homepage-obfuscations'),
        getCached<TickerItem[]>('homepage-ticker'),
        getCached<string[]>('homepage-suppressed'),
      ]);

    if (cachedStories && cachedStories.length > 0) {
      stories = cachedStories;
      narratives = cachedNarratives;
      obfuscations = cachedObfuscations;
      tickerItems = cachedTicker;
      suppressedSearches = cachedSuppressed;
      source = 'live';
    }
  } catch {
    // Cache miss or error — continue to fallback
  }

  // Try 2: DynamoDB scan
  if (!stories || stories.length === 0) {
    try {
      const dbStories = await getRecentStories(30);
      if (dbStories && dbStories.length > 0) {
        stories = dbStories as unknown as Story[];
        source = 'db';
      }
    } catch {
      // DB error — return empty
    }
  }

  // No data available — return empty
  if (!stories) {
    stories = [];
  }

  // Apply category filter
  if (category && category !== 'all') {
    stories = stories.filter((s) => s.category === category);
  }

  return NextResponse.json({
    stories,
    narratives: narratives || [],
    obfuscations: obfuscations || [],
    ticker: tickerItems || [],
    suppressedSearches: suppressedSearches || [],
    source,
  });
}
