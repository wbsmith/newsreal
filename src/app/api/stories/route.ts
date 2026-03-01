import { NextResponse } from 'next/server';
import { getCached } from '@/lib/cache';
import { getRecentStories } from '@/lib/db';
import {
  MOCK_STORIES,
  NARRATIVES,
  OBFUSCATIONS,
  SUPPRESSED_SEARCHES,
  TICKER_ITEMS,
} from '@/lib/mock-data';
import { Story, Narrative, Obfuscation, TickerItem } from '@/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  let stories: Story[] | null = null;
  let narratives: Narrative[] | null = null;
  let obfuscations: Obfuscation[] | null = null;
  let tickerItems: TickerItem[] | null = null;
  let suppressedSearches: string[] | null = null;
  let source: 'live' | 'db' | 'mock' = 'mock';

  // Try 1: DynamoDB cache (fast single GetItem)
  try {
    stories = await getCached<Story[]>('homepage-stories');
    if (stories && stories.length > 0) {
      source = 'live';
      narratives = await getCached<Narrative[]>('homepage-narratives');
      obfuscations = await getCached<Obfuscation[]>('homepage-obfuscations');
      tickerItems = await getCached<TickerItem[]>('homepage-ticker');
      suppressedSearches = await getCached<string[]>('homepage-suppressed');
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
      // DB error — continue to mock fallback
    }
  }

  // Try 3: Mock data fallback
  if (!stories || stories.length === 0) {
    stories = MOCK_STORIES;
    source = 'mock';
  }

  // Apply category filter
  if (category && category !== 'all') {
    stories = stories.filter((s) => s.category === category);
  }

  return NextResponse.json({
    stories,
    narratives: narratives || NARRATIVES,
    obfuscations: obfuscations || OBFUSCATIONS,
    ticker: tickerItems || TICKER_ITEMS,
    suppressedSearches: suppressedSearches || SUPPRESSED_SEARCHES,
    source,
  });
}
