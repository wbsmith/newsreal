import { FeedItem } from '@/lib/ingestion/rss-parser';
import { Classification } from '@/lib/analysis/story-analyzer';
import { Story } from '@/types';

export const MAX_STORIES_TO_CACHE = 50;

export interface ClassifiedItem {
  item: FeedItem;
  classification: Classification;
}

export async function batchProcess<T, R>(
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

export function trimForCache(stories: Story[]): Story[] {
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
