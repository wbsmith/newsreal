// Lightweight, dependency-free helpers for the on-demand narrative builder.
// We don't need the full pipeline's trigram-cosine dedup here — for a
// dominant-narrative read we want (a) the publisher behind each Google News
// headline and (b) the multi-word phrases that recur across headlines, which is
// the concrete "identical terms repeated across outlets" coordination signal.

// Google News encodes the publisher as a " - Publisher" suffix on the title.
export function splitGoogleNewsTitle(rawTitle: string): { title: string; outlet: string | null } {
  const idx = rawTitle.lastIndexOf(' - ');
  if (idx === -1) return { title: rawTitle.trim(), outlet: null };
  const outlet = rawTitle.slice(idx + 3).trim();
  // Guard against false positives (e.g. a hyphenated headline tail).
  if (!outlet || outlet.length > 50 || outlet.includes('  ')) {
    return { title: rawTitle.trim(), outlet: null };
  }
  return { title: rawTitle.slice(0, idx).trim(), outlet };
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'with',
  'at', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'it',
  'its', 'his', 'her', 'their', 'they', 'he', 'she', 'we', 'you', 'i', 'this',
  'that', 'these', 'those', 'will', 'would', 'can', 'could', 'has', 'have',
  'had', 'not', 'no', 'who', 'what', 'how', 'why', 'after', 'over', 'into',
  'amid', 'says', 'said', 'new', 'us', 'up', 'out', 'about',
]);

export interface RepeatedPhrase {
  phrase: string;
  count: number; // number of distinct headlines containing the phrase
}

// Find 2–3 word phrases that recur across the headline set. Each phrase is
// counted at most once per headline, so `count` reads as "N articles used this
// exact phrasing".
export function repeatedPhrases(
  titles: string[],
  minCount = 3,
  topN = 12,
): RepeatedPhrase[] {
  const counts = new Map<string, number>();

  for (const title of titles) {
    const words = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    const seenInThisTitle = new Set<string>();
    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i + n <= words.length; i++) {
        const gram = words.slice(i, i + n);
        // Skip phrases that are entirely stopwords — no signal.
        if (gram.every((w) => STOPWORDS.has(w))) continue;
        const phrase = gram.join(' ');
        if (seenInThisTitle.has(phrase)) continue;
        seenInThisTitle.add(phrase);
        counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .filter(([, c]) => c >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([phrase, count]) => ({ phrase, count }));
}
