import * as fuzzball from 'fuzzball';
import { FeedItem } from './rss-parser';

const SIMILARITY_THRESHOLD = 75;

export interface DedupResult {
  unique: FeedItem[];
  duplicates: { item: FeedItem; matchedWith: string }[];
}

export function deduplicateStories(items: FeedItem[]): DedupResult {
  const unique: FeedItem[] = [];
  const duplicates: { item: FeedItem; matchedWith: string }[] = [];

  for (const item of items) {
    let isDuplicate = false;

    for (const existing of unique) {
      const score = fuzzball.ratio(
        item.title.toLowerCase(),
        existing.title.toLowerCase()
      );

      if (score >= SIMILARITY_THRESHOLD) {
        isDuplicate = true;
        duplicates.push({ item, matchedWith: existing.title });
        break;
      }
    }

    if (!isDuplicate) {
      unique.push(item);
    }
  }

  return { unique, duplicates };
}
