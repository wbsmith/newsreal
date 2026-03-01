import { FeedItem } from '@/lib/ingestion/rss-parser';
import { Classification } from '@/lib/analysis/story-analyzer';
import { Story, Category } from '@/types';

export const MAX_STORIES_TO_CACHE = 200;

const ALL_CATEGORIES: Category[] = ['politics', 'tech', 'finance', 'world', 'science', 'deep-state'];

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

/**
 * Select items for classification with category balance.
 * Ensures each hinted category gets at least `minPerCategory` items,
 * then fills remaining slots from the general (unhinted) pool.
 */
export function selectForClassification(
  items: FeedItem[],
  total: number,
  minPerCategory: number
): FeedItem[] {
  const categoryBuckets = new Map<string, FeedItem[]>();
  const generalBucket: FeedItem[] = [];

  for (const item of items) {
    if (item.hintCategory) {
      const bucket = categoryBuckets.get(item.hintCategory) || [];
      bucket.push(item);
      categoryBuckets.set(item.hintCategory, bucket);
    } else {
      generalBucket.push(item);
    }
  }

  const selected: FeedItem[] = [];
  const usedLinks = new Set<string>();

  function addItem(item: FeedItem): boolean {
    if (usedLinks.has(item.link)) return false;
    usedLinks.add(item.link);
    selected.push(item);
    return true;
  }

  // Phase 1: take up to minPerCategory from each category bucket
  for (const cat of ALL_CATEGORIES) {
    const bucket = categoryBuckets.get(cat) || [];
    let taken = 0;
    for (const item of bucket) {
      if (taken >= minPerCategory) break;
      if (selected.length >= total) break;
      if (addItem(item)) taken++;
    }
  }

  // Phase 2: fill remaining from general bucket
  for (const item of generalBucket) {
    if (selected.length >= total) break;
    addItem(item);
  }

  // Phase 3: if still room, take overflow from category buckets
  for (const cat of ALL_CATEGORIES) {
    const bucket = categoryBuckets.get(cat) || [];
    for (const item of bucket) {
      if (selected.length >= total) break;
      addItem(item);
    }
  }

  return selected;
}

/**
 * After classification, sort stories ensuring category balance.
 * Takes top items from each category first, then fills with remaining by priority.
 */
export function categoryBalancedSort(classified: ClassifiedItem[]): ClassifiedItem[] {
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

  const byPriority = (a: ClassifiedItem, b: ClassifiedItem) => {
    const pDiff = priorityOrder[a.classification.priority] - priorityOrder[b.classification.priority];
    return pDiff !== 0 ? pDiff : b.classification.manipulation_index - a.classification.manipulation_index;
  };

  // Group by actual classified category
  const categoryGroups = new Map<Category, ClassifiedItem[]>();
  for (const item of classified) {
    const cat = item.classification.category;
    const group = categoryGroups.get(cat) || [];
    group.push(item);
    categoryGroups.set(cat, group);
  }

  // Sort each group by priority
  for (const group of categoryGroups.values()) {
    group.sort(byPriority);
  }

  // Interleave: round-robin from each category, then append leftovers
  const result: ClassifiedItem[] = [];
  const used = new Set<number>();
  let round = 0;
  let added = true;

  while (added) {
    added = false;
    for (const cat of ALL_CATEGORIES) {
      const group = categoryGroups.get(cat);
      if (!group || round >= group.length) continue;
      const item = group[round];
      const idx = classified.indexOf(item);
      if (!used.has(idx)) {
        result.push(item);
        used.add(idx);
        added = true;
      }
    }
    round++;
  }

  // Append any remaining items (shouldn't happen, but safety net)
  for (let i = 0; i < classified.length; i++) {
    if (!used.has(i)) result.push(classified[i]);
  }

  return result;
}

export function trimForCache(stories: Story[]): Story[] {
  return stories.slice(0, MAX_STORIES_TO_CACHE).map((s) => ({
    ...s,
    summary: s.summary.slice(0, 400),
    realAnalysis: s.realAnalysis.slice(0, 800),
    deepDive: {
      mainstream: s.deepDive.mainstream.slice(0, 600),
      realStory: s.deepDive.realStory.slice(0, 600),
      leftSpin: s.deepDive.leftSpin.slice(0, 600),
      rightSpin: s.deepDive.rightSpin.slice(0, 600),
      whosBenefiting: s.deepDive.whosBenefiting.slice(0, 600),
      whatsHidden: s.deepDive.whatsHidden.slice(0, 600),
    },
  }));
}
