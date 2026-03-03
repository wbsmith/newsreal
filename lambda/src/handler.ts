import Anthropic from '@anthropic-ai/sdk';
import Parser from 'rss-parser';
import { formatDistanceToNow } from 'date-fns';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

// ─── Types ───

interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;
  content?: string;
  source: string;
  hintCategory?: Category;
  fullText?: string;
}

type Category = 'politics' | 'tech' | 'finance' | 'world' | 'science' | 'deep-state';
type BiasTag = 'LEAN LEFT' | 'LEAN RIGHT' | 'ESTABLISHMENT' | 'ANTI-ESTABLISHMENT' | 'UNREPORTED' | 'CENTER-ESTABLISHMENT';

interface Classification {
  category: Category;
  bias_tag: string;
  manipulation_index: number;
  priority: 'high' | 'medium' | 'low';
  quick_take: string;
}

interface ManipulationSubScore {
  score: number;
  reason: string;
}

interface ManipulationBreakdown {
  emotional_manipulation: ManipulationSubScore;
  source_transparency: ManipulationSubScore;
  framing_bias: ManipulationSubScore;
  selective_omission: ManipulationSubScore;
  headline_accuracy: ManipulationSubScore;
}

interface AnalysisResult {
  manipulation_index: number;
  manipulation_breakdown: ManipulationBreakdown;
  has_full_text: boolean;
  bias_tag: string;
  quick_take: string;
  mainstream_frame: string;
  real_story: string;
  left_spin: string;
  right_spin: string;
  who_benefits: string;
  whats_hidden: string;
  connecting_dots?: string;
}

interface DeepDive {
  mainstream: string;
  realStory: string;
  leftSpin: string;
  rightSpin: string;
  whosBenefiting: string;
  whatsHidden: string;
}

interface StoryBiasTag {
  label: BiasTag;
  class: string;
}

interface Story {
  id: number;
  slug: string;
  category: Category;
  featured?: boolean;
  source: string;
  sourceUrl: string;
  time: string;
  headline: string;
  summary: string;
  biasTag: StoryBiasTag;
  manipulationScore: number;
  manipulationBreakdown?: ManipulationBreakdown;
  hasFullText?: boolean;
  realAnalysis: string;
  deepDive: DeepDive;
}

interface SourceArticle { slug: string; headline: string; sourceUrl: string; }
interface Narrative { text: string; heat: string; coherenceScore?: number; outletsInvolved?: string[]; slug?: string; relatedStories?: SourceArticle[]; }
interface Obfuscation { category: string; whatHappened: string; whyItMatters: string; whatsCoveringIt: string; whoBenefits: string; detectionConfidence: number; sourceUrl?: string; relatedStories?: SourceArticle[]; }
interface TickerItem { text: string; severity: 'high' | 'med' | 'low'; linkType?: 'story' | 'narrative'; linkRef?: string; }

interface NarrativeAnalysis {
  slug: string; narrativeText: string; coherenceScore: number; outletsInvolved: string[];
  analysisDate: string; narrativeOrigin: string; coordinationEvidence: string;
  whoBenefits: string; suppressedAlternative: string; relatedStories: SourceArticle[];
}

interface SearchAnalysis {
  query: string; resultCount: number; analysisDate: string;
  mediaPattern: string; whatsRevealed: string; whatsMissing: string;
  connectionMap: string; whyItsSuppressed: string;
  searchResults: { title: string; source: string; link: string; snippet: string }[];
}

interface SuppressedSearchEntry { query: string; analysis: SearchAnalysis | null; }

// ─── Config ───

const CLASSIFY_BATCH_SIZE = 10;
const ANALYZE_BATCH_SIZE = 5;
const CLASSIFY_COUNT = 120;
const DEEP_ANALYZE_COUNT = 120;
const CACHE_TTL = 21600; // 6 hours
const ENABLE_ARTICLE_FETCH = false; // Feature flag: fetch full article text via Readability
const ARTICLE_FETCH_BATCH_SIZE = 20;
const ARTICLE_FETCH_TIMEOUT = 10000; // 10s per article
const ARTICLE_TEXT_LIMIT_HAIKU = 2000;  // chars for classify prompt
const ARTICLE_TEXT_LIMIT_SONNET = 5000; // chars for analysis prompt

const ALL_CATEGORIES: Category[] = ['politics', 'tech', 'finance', 'world', 'science', 'deep-state'];

const TABLE_PREFIX = 'newsreal';
const TABLES = {
  stories: `${TABLE_PREFIX}-stories`,
  cache: `${TABLE_PREFIX}-cache`,
};

// ─── Clients (lazy init) ───

let anthropic: Anthropic | null = null;
let docClient: DynamoDBDocumentClient | null = null;

function getAnthropic(): Anthropic {
  if (!anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
    anthropic = new Anthropic({ apiKey });
  }
  return anthropic;
}

function getDynamoDB(): DynamoDBDocumentClient {
  if (!docClient) {
    const region = process.env.NEWSREAL_AWS_REGION || process.env.AWS_REGION || 'us-east-1';
    const credentials = process.env.NEWSREAL_AWS_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.NEWSREAL_AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.NEWSREAL_AWS_SECRET_ACCESS_KEY!,
        }
      : undefined;
    const client = new DynamoDBClient({ region, credentials });
    docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return docClient;
}

// ─── DynamoDB Cache ───

async function getCached<T>(key: string): Promise<T | null> {
  try {
    const result = await getDynamoDB().send(
      new GetCommand({ TableName: TABLES.cache, Key: { cacheKey: key } })
    );
    if (!result.Item) return null;
    const now = Math.floor(Date.now() / 1000);
    if (result.Item.ttl && result.Item.ttl < now) return null;
    return result.Item.value as T;
  } catch { return null; }
}

async function setCached<T>(key: string, value: T, ttlSeconds = CACHE_TTL): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await getDynamoDB().send(
    new PutCommand({
      TableName: TABLES.cache,
      Item: { cacheKey: key, value, ttl: now + ttlSeconds, createdAt: new Date().toISOString() },
    })
  );
}

async function putStory(story: Record<string, unknown>): Promise<void> {
  await getDynamoDB().send(new PutCommand({ TableName: TABLES.stories, Item: story }));
}

// ─── RSS Fetching ───

const rssParser = new Parser({
  timeout: 10000,
  requestOptions: { headers: { 'User-Agent': 'NewsReal.ai/1.0 (Media Analysis Platform)' } },
});

async function fetchFeed(url: string, sourceName: string): Promise<FeedItem[]> {
  const feed = await rssParser.parseURL(url);
  return (feed.items || []).map((item) => ({
    title: item.title || '',
    link: item.link || '',
    pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
    contentSnippet: item.contentSnippet,
    content: item.content,
    source: sourceName,
  }));
}

const GNEWS_SEARCH = 'https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q=';

const ALL_FEEDS: { url: string; name: string; hintCategory?: Category }[] = [
  // ─── Generic feeds (no hint) ───
  { url: 'https://feedx.net/rss/ap.xml', name: 'AP Top News' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('site:apnews.com politics')}`, name: 'AP Politics' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('site:apnews.com business')}`, name: 'AP Business' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('site:reuters.com world')}`, name: 'Reuters World' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('site:reuters.com business')}`, name: 'Reuters Business' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('site:reuters.com technology')}`, name: 'Reuters Tech' },
  { url: 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en', name: 'Google News' },
  { url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en', name: 'Google News World' },
  { url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en', name: 'Google News Business' },
  { url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en', name: 'Google News Tech' },
  { url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en', name: 'Google News Science' },
  { url: 'https://www.reddit.com/r/news/.rss', name: 'Reddit r/news' },
  { url: 'https://www.reddit.com/r/politics/.rss', name: 'Reddit r/politics' },
  { url: 'https://www.reddit.com/r/worldnews/.rss', name: 'Reddit r/worldnews' },
  { url: 'https://www.reddit.com/r/conspiracy/.rss', name: 'Reddit r/conspiracy' },

  // ─── Tech & AI ───
  { url: `${GNEWS_SEARCH}${encodeURIComponent('site:techcrunch.com')}`, name: 'TechCrunch', hintCategory: 'tech' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('site:arstechnica.com')}`, name: 'Ars Technica', hintCategory: 'tech' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('"artificial intelligence" OR "machine learning"')}`, name: 'AI News', hintCategory: 'tech' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('"cybersecurity" OR "data breach"')}`, name: 'Cybersecurity News', hintCategory: 'tech' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('site:theverge.com')}`, name: 'The Verge', hintCategory: 'tech' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('"OpenAI" OR "Google AI" OR "AI regulation"')}`, name: 'AI Industry', hintCategory: 'tech' },

  // ─── Finance ───
  { url: `${GNEWS_SEARCH}${encodeURIComponent('site:cnbc.com')}`, name: 'CNBC', hintCategory: 'finance' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('"SEC filing" OR "federal reserve" OR "interest rate"')}`, name: 'Finance Regulation', hintCategory: 'finance' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('"cryptocurrency" OR "bitcoin" OR "ethereum"')}`, name: 'Crypto News', hintCategory: 'finance' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('site:bloomberg.com')}`, name: 'Bloomberg', hintCategory: 'finance' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('"Wall Street" OR "stock market" OR "IPO"')}`, name: 'Markets', hintCategory: 'finance' },

  // ─── Science ───
  { url: `${GNEWS_SEARCH}${encodeURIComponent('"scientific study" OR "research finds"')}`, name: 'Science Research', hintCategory: 'science' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('"NASA" OR "SpaceX" OR "space exploration"')}`, name: 'Space News', hintCategory: 'science' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('"climate change" OR "climate research"')}`, name: 'Climate Science', hintCategory: 'science' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('"medical research" OR "FDA approval" OR "clinical trial"')}`, name: 'Medical Research', hintCategory: 'science' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('site:nature.com OR site:sciencedaily.com')}`, name: 'Science Journals', hintCategory: 'science' },

  // ─── Deep State ───
  { url: `${GNEWS_SEARCH}${encodeURIComponent('"federal register" OR "executive order"')}`, name: 'Federal Register', hintCategory: 'deep-state' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('"FOIA" OR "declassified" OR "intelligence community"')}`, name: 'Intel Community', hintCategory: 'deep-state' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('"lobbying disclosure" OR "revolving door" government')}`, name: 'Lobbying Watch', hintCategory: 'deep-state' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('"government contract" OR "defense contractor" OR "no-bid"')}`, name: 'Defense Contracts', hintCategory: 'deep-state' },

  // ─── Politics (supplement) ───
  { url: `${GNEWS_SEARCH}${encodeURIComponent('site:politico.com')}`, name: 'Politico', hintCategory: 'politics' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('"congressional hearing" OR "subpoena" OR "oversight committee"')}`, name: 'Congressional', hintCategory: 'politics' },

  // ─── World (supplement) ───
  { url: `${GNEWS_SEARCH}${encodeURIComponent('site:aljazeera.com')}`, name: 'Al Jazeera', hintCategory: 'world' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('site:bbc.com world')}`, name: 'BBC World', hintCategory: 'world' },
];

async function fetchAllFeeds(): Promise<{ items: FeedItem[]; sourceErrors: number }> {
  const results = await Promise.allSettled(
    ALL_FEEDS.map(async (f) => {
      const items = await fetchFeed(f.url, f.name);
      if (f.hintCategory) {
        return items.map((item) => ({ ...item, hintCategory: f.hintCategory }));
      }
      return items;
    })
  );
  const items: FeedItem[] = [];
  let sourceErrors = 0;
  for (const result of results) {
    if (result.status === 'fulfilled') items.push(...result.value);
    else { sourceErrors++; console.error('Feed fetch failed:', result.reason); }
  }
  return { items, sourceErrors };
}

// ─── Deduplication (trigram cosine similarity) ───

function buildTrigrams(title: string): Map<string, number> {
  const s = title.toLowerCase().trim();
  const map = new Map<string, number>();
  for (let i = 0; i <= s.length - 3; i++) {
    const tri = s.slice(i, i + 3);
    map.set(tri, (map.get(tri) || 0) + 1);
  }
  return map;
}

function trigramMagnitude(map: Map<string, number>): number {
  let sum = 0;
  for (const v of map.values()) sum += v * v;
  return Math.sqrt(sum);
}

function trigramCosineSim(
  a: Map<string, number>, magA: number,
  b: Map<string, number>, magB: number
): number {
  if (magA === 0 || magB === 0) return 0;
  let dot = 0;
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const [key, val] of smaller) {
    const other = larger.get(key);
    if (other !== undefined) dot += val * other;
  }
  return dot / (magA * magB);
}

const DEDUP_THRESHOLD = 0.7;

function deduplicateStories(items: FeedItem[]): { unique: FeedItem[]; duplicates: number } {
  const unique: FeedItem[] = [];
  const trigrams: Map<string, number>[] = [];
  const magnitudes: number[] = [];
  const seenExact = new Set<string>();
  let duplicates = 0;

  for (const item of items) {
    const titleLower = item.title.toLowerCase().trim();

    // Fast path: exact match
    if (seenExact.has(titleLower)) {
      duplicates++;
      continue;
    }

    // Build trigram vector for this title
    const tVec = buildTrigrams(titleLower);
    const tMag = trigramMagnitude(tVec);

    // Compare against all existing unique items
    let isDuplicate = false;
    for (let i = 0; i < trigrams.length; i++) {
      if (trigramCosineSim(tVec, tMag, trigrams[i], magnitudes[i]) >= DEDUP_THRESHOLD) {
        isDuplicate = true;
        duplicates++;
        break;
      }
    }

    if (!isDuplicate) {
      unique.push(item);
      trigrams.push(tVec);
      magnitudes.push(tMag);
      seenExact.add(titleLower);
    }
  }

  return { unique, duplicates };
}

// ─── Article Fetching (Readability extraction) ───

async function fetchArticleText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ARTICLE_FETCH_TIMEOUT);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'NewsReal.ai/1.0 (Media Analysis Platform)' },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) return null;
    const html = await response.text();
    const { document } = parseHTML(html);
    const article = new Readability(document as any).parse();
    return article?.textContent?.trim() || null;
  } catch {
    return null;
  }
}

async function fetchArticleTexts(items: FeedItem[]): Promise<{ fetched: number; failed: number }> {
  let fetched = 0;
  let failed = 0;
  for (let i = 0; i < items.length; i += ARTICLE_FETCH_BATCH_SIZE) {
    const batch = items.slice(i, i + ARTICLE_FETCH_BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (item) => {
        const text = await fetchArticleText(item.link);
        if (text && text.length > 100) {
          item.fullText = text;
          fetched++;
        } else {
          failed++;
        }
      })
    );
  }
  return { fetched, failed };
}

// ─── Claude API Calls ───

async function classifyWithHaiku(prompt: string): Promise<string | null> {
  try {
    const response = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = response.content[0];
    return block.type === 'text' ? block.text : null;
  } catch (err) {
    console.error('Haiku API error:', err instanceof Error ? err.message : err);
    return null;
  }
}

async function analyzeWithSonnet(systemPrompt: string, userPrompt: string): Promise<string | null> {
  try {
    const response = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const block = response.content[0];
    return block.type === 'text' ? block.text : null;
  } catch (err) {
    console.error('Sonnet API error:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Utility ───

function parseClaudeJSON<T>(raw: string): T | null {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    return JSON.parse(cleaned) as T;
  } catch { return null; }
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function relativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'recently';
    return formatDistanceToNow(date, { addSuffix: true });
  } catch { return 'recently'; }
}

const BIAS_CLASS_MAP: Record<string, string> = {
  'LEAN LEFT': 'left', 'LEAN RIGHT': 'right', 'ESTABLISHMENT': 'establishment',
  'CENTER-ESTABLISHMENT': 'center', 'ANTI-ESTABLISHMENT': 'right', 'UNREPORTED': 'establishment',
};

function mapBiasTag(tag: string): StoryBiasTag {
  const normalized = tag.toUpperCase().trim() as BiasTag;
  return { label: normalized, class: BIAS_CLASS_MAP[normalized] || 'center' };
}

async function batchProcess<T, R>(items: T[], fn: (item: T) => Promise<R>, batchSize: number): Promise<(R | null)[]> {
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


const RECENCY_LAMBDA = 0.04; // exponential decay rate — item at rank 50 gets ~14% weight of rank 0
const MAX_AGE_HOURS = 18;    // hard cutoff — ignore anything older than this

function sortByRecency(items: FeedItem[]): FeedItem[] {
  return [...items].sort((a, b) => {
    const da = new Date(a.pubDate).getTime();
    const db = new Date(b.pubDate).getTime();
    return (isNaN(db) ? 0 : db) - (isNaN(da) ? 0 : da);
  });
}

function weightedSample(items: FeedItem[], count: number, usedLinks: Set<string>): FeedItem[] {
  const result: FeedItem[] = [];
  // Build weighted pool: weight = e^(-λ * rank), rank = position in recency-sorted list
  const pool = items.filter(item => !usedLinks.has(item.link));
  const weights = pool.map((_, i) => Math.exp(-RECENCY_LAMBDA * i));
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (totalWeight === 0 || pool.length === 0) return result;

  // Normalize to cumulative distribution
  const cdf: number[] = [];
  let cumulative = 0;
  for (const w of weights) {
    cumulative += w / totalWeight;
    cdf.push(cumulative);
  }

  // Sample without replacement
  const taken = new Set<number>();
  let attempts = 0;
  while (result.length < count && result.length < pool.length && attempts < count * 10) {
    attempts++;
    const r = Math.random();
    let idx = cdf.findIndex(c => c >= r);
    if (idx === -1) idx = cdf.length - 1;
    if (taken.has(idx)) continue;
    taken.add(idx);
    usedLinks.add(pool[idx].link);
    result.push(pool[idx]);
  }
  return result;
}

function selectForClassification(items: FeedItem[], total: number, minPerCategory: number): FeedItem[] {
  // Filter out stale items
  const cutoff = Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000;
  const fresh = items.filter(item => {
    const t = new Date(item.pubDate).getTime();
    return !isNaN(t) ? t >= cutoff : true; // keep items with unparseable dates
  });
  console.log(`  Recency filter: ${items.length} → ${fresh.length} items (cutoff: ${MAX_AGE_HOURS}h)`);

  // Bucket by hintCategory, sort each bucket by recency
  const categoryBuckets = new Map<string, FeedItem[]>();
  const generalBucket: FeedItem[] = [];
  for (const item of fresh) {
    if (item.hintCategory) {
      const bucket = categoryBuckets.get(item.hintCategory) || [];
      bucket.push(item);
      categoryBuckets.set(item.hintCategory, bucket);
    } else {
      generalBucket.push(item);
    }
  }

  // Sort each bucket by recency
  for (const [cat, bucket] of categoryBuckets) {
    categoryBuckets.set(cat, sortByRecency(bucket));
  }
  const sortedGeneral = sortByRecency(generalBucket);

  const usedLinks = new Set<string>();

  // Phase 1: weighted sample minPerCategory from each category bucket
  const selected: FeedItem[] = [];
  for (const cat of ALL_CATEGORIES) {
    const bucket = categoryBuckets.get(cat) || [];
    const sampled = weightedSample(bucket, minPerCategory, usedLinks);
    selected.push(...sampled);
  }

  // Phase 2: fill remaining from general bucket (weighted)
  const remaining = total - selected.length;
  if (remaining > 0) {
    const sampled = weightedSample(sortedGeneral, remaining, usedLinks);
    selected.push(...sampled);
  }

  // Phase 3: if still room, take overflow from category buckets (weighted)
  if (selected.length < total) {
    const allRemaining = sortByRecency(
      fresh.filter(item => !usedLinks.has(item.link))
    );
    const sampled = weightedSample(allRemaining, total - selected.length, usedLinks);
    selected.push(...sampled);
  }

  return selected;
}

function categoryBalancedSort(classified: { item: FeedItem; classification: Classification }[]): { item: FeedItem; classification: Classification }[] {
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

  const byPriority = (a: { classification: Classification }, b: { classification: Classification }) => {
    const pDiff = priorityOrder[a.classification.priority] - priorityOrder[b.classification.priority];
    return pDiff !== 0 ? pDiff : b.classification.manipulation_index - a.classification.manipulation_index;
  };

  const categoryGroups = new Map<Category, { item: FeedItem; classification: Classification }[]>();
  for (const entry of classified) {
    const cat = entry.classification.category;
    const group = categoryGroups.get(cat) || [];
    group.push(entry);
    categoryGroups.set(cat, group);
  }

  for (const group of categoryGroups.values()) {
    group.sort(byPriority);
  }

  const result: { item: FeedItem; classification: Classification }[] = [];
  const used = new Set<number>();
  let round = 0;
  let added = true;

  while (added) {
    added = false;
    for (const cat of ALL_CATEGORIES) {
      const group = categoryGroups.get(cat);
      if (!group || round >= group.length) continue;
      const entry = group[round];
      const idx = classified.indexOf(entry);
      if (!used.has(idx)) {
        result.push(entry);
        used.add(idx);
        added = true;
      }
    }
    round++;
  }

  for (let i = 0; i < classified.length; i++) {
    if (!used.has(i)) result.push(classified[i]);
  }

  return result;
}

type ClassifiedEntry = { item: FeedItem; classification: Classification };

function groupByCategory(items: ClassifiedEntry[]): Map<Category, ClassifiedEntry[]> {
  const groups = new Map<Category, ClassifiedEntry[]>();
  for (const entry of items) {
    const cat = entry.classification.category;
    const group = groups.get(cat) || [];
    group.push(entry);
    groups.set(cat, group);
  }
  return groups;
}

// ─── Prompts ───

const SYSTEM_PROMPT = `You are the NewsReal.ai analysis engine. Your job is to generate provocative, attention-grabbing media criticism for each news story.

STYLE GUIDELINES:
- Be equally skeptical of all political sides
- Always follow the money
- Timing is never coincidental — always note what else happened the same day
- Name specific dollar amounts, even if estimated/speculative
- Reference specific entities, PACs, lobbying groups, contractors
- The tone is: smart, cynical, deeply informed, conspiratorial but self-aware
- Everything you generate will be clearly labeled as AI speculation
- You are not being neutral — you are being provocatively analytical
- Do NOT hedge with "it's important to note" or "to be fair" — be direct
- Respond ONLY in valid JSON. No markdown, no commentary.`;

function buildClassifyPrompt(headline: string, summary: string, source: string, fullText?: string): string {
  const textSection = fullText
    ? `Article text (first ${ARTICLE_TEXT_LIMIT_HAIKU} chars): ${fullText.slice(0, ARTICLE_TEXT_LIMIT_HAIKU)}`
    : `Summary: ${summary}`;
  const hasText = !!fullText;

  return `Classify this news story and score its manipulation level. Respond ONLY in JSON, no other text.

Headline: ${headline}
${textSection}
Source: ${source}
Has full article text: ${hasText}

MANIPULATION INDEX — score each dimension 0-20, then sum for total (0-100):
1. EMOTIONAL MANIPULATION (0-20): Loaded language, fear/outrage triggers, urgency framing, identity appeals
2. SOURCE TRANSPARENCY (0-20): Named vs anonymous sources, verifiability of claims
3. FRAMING BIAS (0-20): How hard the piece pushes a single interpretation
4. SELECTIVE OMISSION (0-20): Missing financial context, timing, history, counter-evidence
5. HEADLINE ACCURACY (0-20): Does headline match the actual content?${!hasText ? '\nNote: Without full text, score source_transparency and headline_accuracy conservatively (mid-range).' : ''}

{
  "category": "<politics|tech|finance|world|science|deep-state>",
  "bias_tag": "<LEAN LEFT|LEAN RIGHT|ESTABLISHMENT|ANTI-ESTABLISHMENT|UNREPORTED|CENTER-ESTABLISHMENT>",
  "manipulation_index": <0-100 sum of 5 dimensions>,
  "priority": "<high|medium|low>",
  "quick_take": "<1 provocative sentence>"
}`;
}

function buildAnalysisPrompt(headline: string, source: string, text: string, timestamp: string, hasFullText: boolean): { system: string; user: string } {
  return {
    system: SYSTEM_PROMPT,
    user: `STORY DATA:
- Headline: ${headline}
- Source(s): ${source}
- ${hasFullText ? 'Full article text' : 'RSS snippet (full text unavailable)'}: ${text}
- Has full article text: ${hasFullText}
- Publication time: ${timestamp}
- Entities mentioned: Auto-detect from text

MANIPULATION INDEX RUBRIC — Score each dimension independently (0-20), then sum for the total (0-100). Provide a 1-sentence justification for each score.

1. EMOTIONAL MANIPULATION (0-20): How much is the language designed to trigger emotion over thought?
   0-5: Neutral, clinical tone. Facts stated plainly.
   6-10: Some charged language but mostly restrained.
   11-15: Frequent emotional triggers — urgency, outrage, fear, identity appeals.
   16-20: Pervasive rage-bait. Every sentence is an emotional hook.

2. SOURCE TRANSPARENCY (0-20): Can the reader verify the claims?
   0-5: Named sources, linked documents, verifiable data.
   6-10: Mix of named/unnamed; most claims checkable.
   11-15: Key claims rest on anonymous attribution.
   16-20: Major assertions unattributed or circular sourcing.

3. FRAMING BIAS (0-20): How hard is the piece pushing one interpretation?
   0-5: Multiple perspectives, counter-evidence acknowledged.
   6-10: Discernible lean but opposing views mentioned.
   11-15: Single-frame narrative, opposing views dismissed or strawmanned.
   16-20: Pure advocacy presented as reporting.

4. SELECTIVE OMISSION (0-20): What critical context is missing?
   0-5: Comprehensive context — financial ties, history, counter-evidence present.
   6-10: Minor gaps, nothing that changes the core picture.
   11-15: Significant missing context (funding, timing, relevant history).
   16-20: Critical information absent that would change the reader's conclusion.

5. HEADLINE ACCURACY (0-20): Does the headline represent the content?
   0-5: Headline is a fair summary.
   6-10: Slight exaggeration or emphasis shift.
   11-15: Headline overstates or implies unsupported causation.
   16-20: Headline actively misleads relative to content.
${!hasFullText ? '\nNote: Without full article text, score source_transparency and headline_accuracy based on what you can assess from the snippet and your knowledge of the source. Flag lower confidence.' : ''}

GENERATE THE FOLLOWING (respond in JSON):

{
  "manipulation_breakdown": {
    "emotional_manipulation": { "score": <0-20>, "reason": "<1 sentence>" },
    "source_transparency": { "score": <0-20>, "reason": "<1 sentence>" },
    "framing_bias": { "score": <0-20>, "reason": "<1 sentence>" },
    "selective_omission": { "score": <0-20>, "reason": "<1 sentence>" },
    "headline_accuracy": { "score": <0-20>, "reason": "<1 sentence>" }
  },
  "manipulation_index": <0-100 sum of the 5 scores above>,
  "has_full_text": ${hasFullText},
  "bias_tag": "<one of: LEAN LEFT | LEAN RIGHT | ESTABLISHMENT | ANTI-ESTABLISHMENT | UNREPORTED | CENTER-ESTABLISHMENT>",
  "quick_take": "<2-3 provocative sentences for the card view. Must include at least one specific claim about timing, money, or connections. Use one [REDACTED:hidden detail] element for dramatic effect.>",
  "mainstream_frame": "<How is mainstream/establishment media framing this story? What language and emotional hooks are they using?>",
  "real_story": "<Your most provocative speculative analysis. What's ACTUALLY driving this story? Follow the money. Look at timing. Who met with whom? What contracts were signed? What regulations were filed? Be specific with numbers and connections even if speculative.>",
  "left_spin": "<How do left-leaning outlets cover this AND what are they conveniently ignoring? Be equally critical.>",
  "right_spin": "<How do right-leaning outlets cover this AND what are they conveniently ignoring? Be equally critical.>",
  "who_benefits": "<Specific entities that benefit. Name names. Name dollar amounts (speculative is fine). Follow the incentive structures.>",
  "whats_hidden": "<The most important thing NOT being discussed. Connect to government filings, regulatory changes, or other stories that this one is drowning out.>",
  "connecting_dots": "<When two major stories break simultaneously, what connects them historically, who are the shared actors, and why are they being covered as separate narratives?>"
}`,
  };
}

function buildObfuscationPrompt(storyList: string): { system: string; user: string } {
  return {
    system: `You are the NewsReal.ai Obfuscation Detector. Your job is to identify stories that are being BURIED by the current news cycle. Respond ONLY in valid JSON.`,
    user: `INPUTS:
- Today's top stories across all major outlets:
${storyList}

- Today's Federal Register filings: Not available this cycle
- Today's congressional actions: Not available this cycle
- Today's SEC filings: Not available this cycle
- Today's federal contract awards: Not available this cycle
- Today's court filings of note: Not available this cycle

TASK:
Identify 3-5 government/regulatory actions that likely received ZERO or minimal mainstream coverage today. For each, explain what happened, why it matters, what dominated the news instead, who benefits, and your confidence level. Speculate boldly based on patterns you know about — timing of filings, typical regulatory behavior, and what types of actions get buried during big news cycles.

For each obfuscation, include "covering_story_slugs" — slugs from the story list above that are dominating the news cycle and covering up this action.

Respond in JSON:
{
  "obfuscations": [
    {
      "category": "<SHORT LABEL e.g. TREASURY, DOD, EPA>",
      "what_happened": "<specific filing or action>",
      "why_it_matters": "<impact + dollar amounts>",
      "whats_covering_it": "<what dominated the news instead>",
      "who_benefits": "<who benefits from no coverage>",
      "detection_confidence": <0-100>,
      "source_url": "",
      "covering_story_slugs": ["slug1", "slug2"]
    }
  ]
}`,
  };
}

function buildNarrativePrompt(storyList: string): { system: string; user: string } {
  return {
    system: `You are the NewsReal.ai Narrative Tracker. You detect coordinated messaging patterns across media outlets. Respond ONLY in valid JSON.`,
    user: `Analyze the following stories from the past 6 hours across all major outlets.

${storyList}

Identify dominant narrative patterns. For each, score coherence using this rubric — score each dimension independently (0-25), then sum for the total (0-100).

COHERENCE RUBRIC:
1. LEXICAL ALIGNMENT (0-25): Are outlets using the same keywords, phrases, and talking points?
   0-8: Same topic, different language. Normal independent coverage.
   9-16: Shared terminology but distinct framing.
   17-25: Near-identical phrasing across outlets. Same metaphors, same adjectives. Memo energy.

2. FRAME UNIFORMITY (0-25): Are outlets applying the same interpretive lens?
   0-8: Diverse interpretations of the same events.
   9-16: Similar conclusions but different reasoning paths.
   17-25: Uniform narrative arc. Same heroes, same villains, same prescribed response.

3. SOURCE CONVERGENCE (0-25): Are outlets citing the same experts/studies/data?
   0-8: Diverse sourcing, different experts and data sets.
   9-16: Some overlap in key sources.
   17-25: Same 2-3 sources dominating across all outlets.

4. COUNTER-NARRATIVE ABSENCE (0-25): How few outlets are offering dissent?
   0-8: Healthy dissent, multiple outlets pushing back.
   9-16: Some dissent but minority position.
   17-25: Near-total uniformity, no major outlet breaking ranks.

For each narrative, include "related_story_slugs" — an array of slug values from the story list above that are most relevant to this narrative pattern.

Respond in JSON:
{
  "narratives": [
    {
      "narrative_text": "<description using <strong>bold</strong> HTML for key terms>",
      "coherence_score": <0-100 sum of 4 dimensions>,
      "coherence_breakdown": {
        "lexical_alignment": <0-25>,
        "frame_uniformity": <0-25>,
        "source_convergence": <0-25>,
        "counter_narrative_absence": <0-25>
      },
      "outlets_involved": ["outlet1", "outlet2"],
      "related_story_slugs": ["slug1", "slug2"]
    }
  ]
}

Generate 4-6 narrative patterns.`,
  };
}

function buildTickerPrompt(
  stories: string, narratives: string, obfuscations: string,
  storySlugs: { slug: string; headline: string }[] = [],
  narrativeSlugs: { slug: string; text: string }[] = []
): { system: string; user: string } {
  const storyRefList = storySlugs.length > 0
    ? '\n\nAVAILABLE STORY REFS (use link_ref to reference these):\n' +
      storySlugs.map((s) => `- slug: "${s.slug}" = ${s.headline}`).join('\n')
    : '';
  const narrativeRefList = narrativeSlugs.length > 0
    ? '\n\nAVAILABLE NARRATIVE REFS (use link_ref to reference these):\n' +
      narrativeSlugs.map((n) => `- slug: "${n.slug}" = ${n.text}`).join('\n')
    : '';

  return {
    system: `You generate ticker alerts for the NewsReal.ai scrolling banner. Respond ONLY in valid JSON.`,
    user: `Given these story clusters and analyses from the past 6 hours, generate 8-10 ticker alerts.

Stories: ${stories}
Narratives detected: ${narratives}
Obfuscations detected: ${obfuscations}
${storyRefList}
${narrativeRefList}

Each alert should be:
- One line, under 100 characters
- Written in ALL-CAPS label format: "CATEGORY: detail"
- Provocative and attention-grabbing
- Where possible, link each ticker item to a related story or narrative using link_type and link_ref

Respond in JSON:
{
  "ticker_items": [
    { "text": "<alert text>", "severity": "<high|med|low>", "link_type": "<story|narrative|null>", "link_ref": "<slug or null>" }
  ]
}`,
  };
}

function buildSuppressedSearchesPrompt(stories: string, obfuscations: string): { system: string; user: string } {
  return {
    system: `You generate "forbidden knowledge" search queries for NewsReal.ai. Respond ONLY in valid JSON.`,
    user: `Based on today's stories and the government filings that received no media coverage, generate 5-8 search queries that a well-informed citizen SHOULD be searching for but probably isn't.

Today's stories: ${stories}
Buried filings/actions: ${obfuscations}

Each query should be a specific, searchable phrase that feels like forbidden knowledge.

Respond in JSON:
{
  "suppressed_searches": ["<search query string>"]
}`,
  };
}

// ─── Pipeline Steps ───

async function classifyStory(item: FeedItem): Promise<Classification | null> {
  const prompt = buildClassifyPrompt(item.title, item.contentSnippet || item.content || '', item.source, item.fullText);
  const raw = await classifyWithHaiku(prompt);
  if (!raw) return null;
  const parsed = parseClaudeJSON<Classification>(raw);
  if (!parsed) { console.error('Failed to parse classification:', raw.slice(0, 200)); return null; }
  const valid: Category[] = ['politics', 'tech', 'finance', 'world', 'science', 'deep-state'];
  if (!valid.includes(parsed.category)) parsed.category = 'world';
  return parsed;
}

async function analyzeStory(item: FeedItem, classification: Classification): Promise<AnalysisResult | null> {
  const hasFullText = !!item.fullText;
  const articleText = hasFullText
    ? item.fullText!.slice(0, ARTICLE_TEXT_LIMIT_SONNET)
    : (item.contentSnippet || item.content || 'Full text not available — analyze based on headline and source.');
  const { system, user } = buildAnalysisPrompt(
    item.title, item.source, articleText, item.pubDate, hasFullText
  );
  const raw = await analyzeWithSonnet(system, user);
  if (!raw) return null;
  const parsed = parseClaudeJSON<AnalysisResult>(raw);
  if (!parsed) { console.error('Failed to parse analysis:', raw.slice(0, 200)); return null; }
  return parsed;
}

function feedItemToStory(item: FeedItem, classification: Classification, analysis: AnalysisResult | null, index: number): Story {
  const deepDive: DeepDive = analysis
    ? { mainstream: analysis.mainstream_frame, realStory: analysis.real_story, leftSpin: analysis.left_spin, rightSpin: analysis.right_spin, whosBenefiting: analysis.who_benefits, whatsHidden: analysis.whats_hidden }
    : { mainstream: 'Full analysis not yet generated for this story.', realStory: classification.quick_take, leftSpin: 'Deep analysis pending.', rightSpin: 'Deep analysis pending.', whosBenefiting: 'Deep analysis pending.', whatsHidden: 'Deep analysis pending.' };

  return {
    id: index + 1, slug: slugify(item.title), category: classification.category,
    featured: index === 0, source: item.source.toUpperCase(), sourceUrl: item.link,
    time: relativeTime(item.pubDate), headline: item.title,
    summary: (item.contentSnippet || item.content || classification.quick_take).slice(0, 500),
    biasTag: mapBiasTag(classification.bias_tag),
    manipulationScore: analysis?.manipulation_index ?? classification.manipulation_index,
    manipulationBreakdown: analysis?.manipulation_breakdown,
    hasFullText: analysis?.has_full_text ?? !!item.fullText,
    realAnalysis: analysis?.quick_take ?? classification.quick_take,
    deepDive,
  };
}

function generateHeatBar(score: number): string {
  const filled = Math.round(score / 10);
  return '\u2593'.repeat(filled) + '\u2591'.repeat(10 - filled) + ` ${score}%`;
}

// ─── Main Pipeline ───

async function runFullPipeline(): Promise<Record<string, unknown>> {
  const startTime = Date.now();
  const stats: Record<string, unknown> = {};

  // Step 1: Fetch all feeds
  console.log('Step 1: Fetching RSS feeds...');
  const { items: allItems, sourceErrors } = await fetchAllFeeds();
  stats.fetched = allItems.length;
  stats.sourceErrors = sourceErrors;
  console.log(`  Fetched ${allItems.length} items (${sourceErrors} source errors)`);

  if (allItems.length === 0) throw new Error('All RSS sources failed');

  // Step 2: Deduplicate (trigram cosine similarity, handles full set efficiently)
  console.log(`Step 2: Deduplicating ${allItems.length} items...`);
  const { unique, duplicates } = deduplicateStories(allItems);
  stats.unique = unique.length;
  stats.duplicates = duplicates;
  console.log(`  ${unique.length} unique, ${duplicates} duplicates`);

  // Step 3: Select and optionally fetch full article text
  const toClassify = selectForClassification(unique, CLASSIFY_COUNT, 15);
  if (ENABLE_ARTICLE_FETCH) {
    console.log(`Step 3: Fetching full article text for ${toClassify.length} stories...`);
    const fetchStart = Date.now();
    const { fetched: articlesFetched, failed: articlesFailed } = await fetchArticleTexts(toClassify);
    const fetchDuration = ((Date.now() - fetchStart) / 1000).toFixed(1);
    stats.articlesFetched = articlesFetched;
    stats.articlesFailed = articlesFailed;
    stats.articleFetchDuration = `${fetchDuration}s`;
    console.log(`  Fetched ${articlesFetched}/${toClassify.length} articles in ${fetchDuration}s (${articlesFailed} failed)`);
  } else {
    console.log('Step 3: Article fetching disabled (ENABLE_ARTICLE_FETCH=false)');
  }

  // Step 4: Classify with Haiku
  console.log(`Step 4: Classifying ${toClassify.length} stories with Haiku...`);
  const classificationResults = await batchProcess(toClassify, classifyStory, CLASSIFY_BATCH_SIZE);

  const classified: { item: FeedItem; classification: Classification }[] = [];
  for (let i = 0; i < classificationResults.length; i++) {
    if (classificationResults[i]) classified.push({ item: toClassify[i], classification: classificationResults[i]! });
  }

  const sorted = categoryBalancedSort(classified);
  stats.classified = sorted.length;
  console.log(`  Classified ${sorted.length} stories`);

  // Step 5: Deep-analyze with Sonnet (parallel category streams)
  const toAnalyze = sorted.slice(0, DEEP_ANALYZE_COUNT);
  const categoryGroups = groupByCategory(toAnalyze);
  const categoryCount = categoryGroups.size;
  console.log(`Step 5: Deep-analyzing ${toAnalyze.length} stories with Sonnet (${categoryCount} parallel streams)...`);

  const analyzeStart = Date.now();
  const categoryResults = await Promise.all(
    Array.from(categoryGroups.entries()).map(async ([category, items]) => {
      const catStart = Date.now();
      console.log(`  [${category}] Analyzing ${items.length} stories...`);
      const results = await batchProcess(items, (c) => analyzeStory(c.item, c.classification), ANALYZE_BATCH_SIZE);
      const catDuration = ((Date.now() - catStart) / 1000).toFixed(1);
      const succeeded = results.filter(Boolean).length;
      console.log(`  [${category}] Done — ${succeeded}/${items.length} in ${catDuration}s`);
      return { items, results };
    })
  );
  const analyzeDuration = ((Date.now() - analyzeStart) / 1000).toFixed(1);

  // Reassemble in the original sorted order
  const analysisMap = new Map<number, AnalysisResult>();
  for (const { items, results } of categoryResults) {
    for (let i = 0; i < results.length; i++) {
      if (results[i]) {
        const originalIdx = toAnalyze.indexOf(items[i]);
        analysisMap.set(originalIdx, results[i]!);
      }
    }
  }
  stats.analyzed = analysisMap.size;
  stats.analyzeDuration = `${analyzeDuration}s`;
  console.log(`  Analysis complete: ${analysisMap.size} stories in ${analyzeDuration}s (wall clock)`);

  // Step 6: Build Story objects
  const stories: Story[] = sorted.map((c, i) => feedItemToStory(c.item, c.classification, analysisMap.get(i) ?? null, i));

  // Step 7: Sidebar data
  console.log('Step 7: Generating sidebar data...');
  const storyBySlug = new Map(stories.map(s => [s.slug, s]));
  function resolveSlugs(slugs: string[]): SourceArticle[] {
    return slugs.map(sl => storyBySlug.get(sl)).filter(Boolean)
      .map(s => ({ slug: s!.slug, headline: s!.headline, sourceUrl: s!.sourceUrl }));
  }

  const storyListForPrompt = stories.slice(0, 30).map((s, i) =>
    `${i + 1}. [${s.source}] "${s.headline}" (slug: ${s.slug})`
  ).join('\n');

  const obfuscationPrompt = buildObfuscationPrompt(storyListForPrompt);
  const narrativePrompt = buildNarrativePrompt(storyListForPrompt);

  const [obfuscationsRaw, narrativesRaw] = await Promise.all([
    analyzeWithSonnet(obfuscationPrompt.system, obfuscationPrompt.user),
    analyzeWithSonnet(narrativePrompt.system, narrativePrompt.user),
  ]);

  const obfuscations: Obfuscation[] = (() => {
    if (!obfuscationsRaw) return [];
    const parsed = parseClaudeJSON<{ obfuscations: any[] }>(obfuscationsRaw);
    if (!parsed?.obfuscations) return [];
    return parsed.obfuscations.map((o: any) => ({
      category: o.category, whatHappened: o.what_happened, whyItMatters: o.why_it_matters,
      whatsCoveringIt: o.whats_covering_it, whoBenefits: o.who_benefits,
      detectionConfidence: o.detection_confidence, sourceUrl: o.source_url || undefined,
      relatedStories: resolveSlugs(o.covering_story_slugs || []),
    }));
  })();

  const narratives: Narrative[] = (() => {
    if (!narrativesRaw) return [];
    const parsed = parseClaudeJSON<{ narratives: any[] }>(narrativesRaw);
    if (!parsed?.narratives) return [];
    return parsed.narratives.map((n: any) => ({
      text: n.narrative_text, heat: generateHeatBar(n.coherence_score),
      coherenceScore: n.coherence_score,
      coherenceBreakdown: n.coherence_breakdown || undefined,
      outletsInvolved: n.outlets_involved,
      slug: slugify(String(n.narrative_text).replace(/<[^>]*>/g, '')),
      relatedStories: resolveSlugs(n.related_story_slugs || []),
    }));
  })();

  stats.narratives = narratives.length;
  stats.obfuscations = obfuscations.length;

  // Ticker + suppressed searches
  const storySummaries = stories.slice(0, 15).map((s) => `${s.headline} (${s.source})`);
  const narrativeSummaries = narratives.map((n) => n.text);
  const obfuscationSummaries = obfuscations.map((o) => `${o.category}: ${o.whatHappened}`);

  const tickerStorySlugs = stories.slice(0, 15).map((s) => ({ slug: s.slug, headline: s.headline }));
  const tickerNarrativeSlugs = narratives.filter((n) => n.slug).map((n) => ({ slug: n.slug!, text: n.text.replace(/<[^>]*>/g, '') }));

  const tickerPrompt = buildTickerPrompt(
    storySummaries.join('; '), narrativeSummaries.join('; '), obfuscationSummaries.join('; '),
    tickerStorySlugs, tickerNarrativeSlugs
  );
  const suppressedPrompt = buildSuppressedSearchesPrompt(storySummaries.join('; '), obfuscationSummaries.join('; '));

  const [tickerRaw, suppressedRaw] = await Promise.all([
    analyzeWithSonnet(tickerPrompt.system, tickerPrompt.user),
    analyzeWithSonnet(suppressedPrompt.system, suppressedPrompt.user),
  ]);

  const tickerItems: TickerItem[] = (() => {
    if (!tickerRaw) return [];
    const parsed = parseClaudeJSON<{ ticker_items: any[] }>(tickerRaw);
    if (!parsed?.ticker_items) return [];
    return parsed.ticker_items.map((item: any) => ({
      text: item.text,
      severity: item.severity,
      linkType: item.link_type || undefined,
      linkRef: item.link_ref || undefined,
    }));
  })();

  const suppressedSearches: string[] = (() => {
    if (!suppressedRaw) return [];
    const parsed = parseClaudeJSON<{ suppressed_searches: string[] }>(suppressedRaw);
    return parsed?.suppressed_searches || [];
  })();

  stats.tickerItems = tickerItems.length;
  stats.suppressedSearches = suppressedSearches.length;
  console.log(`  Sidebar: ${obfuscations.length} obfuscations, ${narratives.length} narratives, ${tickerItems.length} ticker, ${suppressedSearches.length} suppressed`);

  // Step 7b: Precompute narrative analyses (parallel Sonnet calls)
  console.log('Step 7b: Precomputing narrative analyses...');
  const narrativeAnalyses: NarrativeAnalysis[] = [];
  if (narratives.length > 0) {
    const naStart = Date.now();
    const naResults = await Promise.allSettled(narratives.map(async (n) => {
      if (!n.slug) return null;
      const plainText = n.text.replace(/<[^>]*>/g, '');
      const relatedForPrompt = (n.relatedStories || []).map((s, i) =>
        `${i + 1}. [${s.sourceUrl ? new URL(s.sourceUrl).hostname.replace('www.', '') : 'unknown'}] ${s.headline}`
      ).join('\n') || 'None identified';

      const naSystem = `You are the NewsReal.ai analysis engine. Your job is to generate provocative, attention-grabbing media criticism. Be equally skeptical of all political sides. Always follow the money. Be direct. Be bold. Respond ONLY in valid JSON. No markdown, no commentary.`;
      const naUser = `A NewsReal.ai user clicked on a detected narrative pattern to get a deep analysis. Analyze this coordinated messaging pattern.

NARRATIVE: "${plainText}"
COHERENCE SCORE: ${n.coherenceScore || 0}/100
OUTLETS INVOLVED: ${(n.outletsInvolved || []).join(', ') || 'Unknown'}
RELATED STORIES FROM TODAY:
${relatedForPrompt}

Analyze this narrative pattern deeply. Who originated it? What evidence of coordination exists? Who benefits from this framing? What alternative framing is being suppressed?

Respond in JSON:
{
  "narrative_origin": "<Where did this narrative originate? PR firms, think tanks, government press offices, wire services? Trace the likely chain of messaging. Be specific about entities, dates, and documented coordination patterns.>",
  "coordination_evidence": "<What specific evidence points to coordinated messaging? Identical phrases, synchronized timing, shared sources? Compare outlet-by-outlet. Name the specific language patterns.>",
  "who_benefits": "<Who specifically benefits from this narrative frame? Name names, companies, politicians, PACs. Follow the money. What dollar amounts are at stake? What policy outcomes does this narrative support?>",
  "suppressed_alternative": "<What alternative framing is being suppressed? What questions aren't being asked? What connections aren't being drawn? What would the story look like if covered without this narrative frame?>"
}`;

      const raw = await analyzeWithSonnet(naSystem, naUser);
      if (!raw) return null;
      const parsed = parseClaudeJSON<{ narrative_origin: string; coordination_evidence: string; who_benefits: string; suppressed_alternative: string }>(raw);
      if (!parsed) return null;

      return {
        slug: n.slug,
        narrativeText: n.text,
        coherenceScore: n.coherenceScore || 0,
        outletsInvolved: n.outletsInvolved || [],
        analysisDate: new Date().toISOString(),
        narrativeOrigin: parsed.narrative_origin,
        coordinationEvidence: parsed.coordination_evidence,
        whoBenefits: parsed.who_benefits,
        suppressedAlternative: parsed.suppressed_alternative,
        relatedStories: n.relatedStories || [],
      } as NarrativeAnalysis;
    }));

    for (const r of naResults) {
      if (r.status === 'fulfilled' && r.value) narrativeAnalyses.push(r.value);
    }
    const naDuration = ((Date.now() - naStart) / 1000).toFixed(1);
    console.log(`  Precomputed ${narrativeAnalyses.length}/${narratives.length} narrative analyses in ${naDuration}s`);
  }
  stats.narrativeAnalyses = narrativeAnalyses.length;

  // Step 7c: Precompute search analyses (RSS + Sonnet per query)
  console.log('Step 7c: Precomputing search analyses...');
  const searchAnalyses: SuppressedSearchEntry[] = [];
  if (suppressedSearches.length > 0) {
    const saStart = Date.now();
    // Batch 4 concurrent to avoid RSS rate limits
    for (let i = 0; i < suppressedSearches.length; i += 4) {
      const batch = suppressedSearches.slice(i, i + 4);
      const batchResults = await Promise.allSettled(batch.map(async (query) => {
        // Fetch Google News RSS
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
        let feedItems: FeedItem[] = [];
        try {
          feedItems = await fetchFeed(rssUrl, 'Google News');
        } catch (err) {
          console.error(`  RSS fetch failed for "${query}":`, err instanceof Error ? err.message : err);
          return { query, analysis: null } as SuppressedSearchEntry;
        }

        if (feedItems.length === 0) {
          return { query, analysis: null } as SuppressedSearchEntry;
        }

        const topResults = feedItems.slice(0, 15).map((item) => ({
          title: item.title, source: item.source, link: item.link,
          snippet: item.contentSnippet || item.content || '',
        }));

        const formattedResults = topResults.map((r, idx) =>
          `${idx + 1}. [${r.source}] ${r.title}\n   ${r.snippet}`
        ).join('\n\n');

        const saSystem = `You are the NewsReal.ai analysis engine. Your job is to generate provocative, attention-grabbing media criticism. Be equally skeptical of all political sides. Always follow the money. Be direct. Be bold. Respond ONLY in valid JSON. No markdown, no commentary.`;
        const saUser = `A NewsReal.ai user clicked on a "suppressed search" query. Your job is to analyze the search results and expose the patterns in how media is (or isn't) covering this topic.

SEARCH QUERY: "${query}"

GOOGLE NEWS RESULTS (${topResults.length} found):
${formattedResults}

Analyze these results as a group. Look at WHO is covering this, HOW they're framing it, what's CONSPICUOUSLY ABSENT, and what money/power connections explain the coverage pattern.

Respond in JSON:
{
  "media_pattern": "<How is media covering (or not covering) this topic? Which outlets appear? Which are suspiciously absent? What framing dominates? Is coverage coordinated or fragmented? Be specific about outlet names and their angles.>",
  "whats_revealed": "<What do these search results actually tell us when read between the lines? What patterns emerge? What admissions are buried in paragraph 12? What numbers don't add up? Be provocative and specific.>",
  "whats_missing": "<What is CONSPICUOUSLY absent from these results? What obvious questions aren't being asked? What entities/people/money flows are never mentioned? What related stories are being ignored? This is often more important than what's present.>",
  "connection_map": "<Follow the money. Connect this topic to specific lobbying firms, PACs, campaign contributions, government contracts, revolving-door appointments, or regulatory actions. Name names and dollar amounts (speculative is fine). Draw the web of incentives.>",
  "why_its_suppressed": "<Why would this search query be something most people aren't searching for? Who benefits from public ignorance on this topic? What institutional incentives exist to keep this out of mainstream discourse? Be bold.>"
}`;

        const raw = await analyzeWithSonnet(saSystem, saUser);
        if (!raw) return { query, analysis: null } as SuppressedSearchEntry;
        const parsed = parseClaudeJSON<{
          media_pattern: string; whats_revealed: string; whats_missing: string;
          connection_map: string; why_its_suppressed: string;
        }>(raw);
        if (!parsed) return { query, analysis: null } as SuppressedSearchEntry;

        return {
          query,
          analysis: {
            query, resultCount: feedItems.length, analysisDate: new Date().toISOString(),
            mediaPattern: parsed.media_pattern, whatsRevealed: parsed.whats_revealed,
            whatsMissing: parsed.whats_missing, connectionMap: parsed.connection_map,
            whyItsSuppressed: parsed.why_its_suppressed, searchResults: topResults,
          },
        } as SuppressedSearchEntry;
      }));

      for (const r of batchResults) {
        if (r.status === 'fulfilled' && r.value) searchAnalyses.push(r.value);
      }
    }
    const saDuration = ((Date.now() - saStart) / 1000).toFixed(1);
    const succeeded = searchAnalyses.filter(e => e.analysis).length;
    console.log(`  Precomputed ${succeeded}/${suppressedSearches.length} search analyses in ${saDuration}s`);
  }
  stats.searchAnalyses = searchAnalyses.filter(e => e.analysis).length;

  // Step 8: Store each story individually in DynamoDB
  console.log('Step 8: Storing stories to DynamoDB...');
  const publishedAt = new Date().toISOString();
  const storeResults = await Promise.allSettled(
    stories.map((story) =>
      putStory({ ...story, id: story.slug, publishedAt })
    )
  );
  const stored = storeResults.filter((r) => r.status === 'fulfilled').length;
  const failed = storeResults.filter((r) => r.status === 'rejected').length;
  stats.stored = stored;
  console.log(`  Stored ${stored}/${stories.length} stories${failed ? ` (${failed} failed)` : ''}`);

  // Step 9: Cache manifest + sidebar + precomputed analyses
  console.log('Step 9: Caching manifest + sidebar + analyses...');
  const manifest = stories.map((s) => s.slug);
  const bulkCacheOps: Promise<void>[] = [
    setCached('homepage-manifest', manifest, CACHE_TTL),
    setCached('homepage-narratives', narratives, CACHE_TTL),
    setCached('homepage-obfuscations', obfuscations, CACHE_TTL),
    setCached('homepage-ticker', tickerItems, CACHE_TTL),
    setCached('homepage-suppressed', suppressedSearches, CACHE_TTL),
    setCached('homepage-narrative-analyses', narrativeAnalyses, CACHE_TTL),
    setCached('homepage-search-analyses', searchAnalyses, CACHE_TTL),
    setCached('pipeline-last-run', Date.now(), CACHE_TTL),
  ];
  const bulkCacheKeys = ['homepage-manifest', 'homepage-narratives', 'homepage-obfuscations', 'homepage-ticker', 'homepage-suppressed', 'homepage-narrative-analyses', 'homepage-search-analyses', 'pipeline-last-run'];

  // Individual narrative analysis cache entries
  for (const na of narrativeAnalyses) {
    bulkCacheOps.push(setCached(`narrative-analysis:${na.slug}`, na, CACHE_TTL));
    bulkCacheKeys.push(`narrative-analysis:${na.slug}`);
  }

  // Individual search analysis cache entries
  for (const se of searchAnalyses) {
    if (se.analysis) {
      bulkCacheOps.push(setCached(`suppressed-search:${se.query}`, se.analysis, CACHE_TTL));
      bulkCacheKeys.push(`suppressed-search:${se.query}`);
    }
  }

  const cacheResults = await Promise.allSettled(bulkCacheOps);
  cacheResults.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`  Cache write FAILED for ${bulkCacheKeys[i]}: ${r.reason}`);
  });
  const cacheFailed = cacheResults.filter(r => r.status === 'rejected').length;
  console.log(`  Cached ${cacheResults.length - cacheFailed}/${cacheResults.length} entries${cacheFailed ? ` (${cacheFailed} failed)` : ''}`);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  stats.duration = `${duration}s`;
  stats.timestamp = new Date().toISOString();
  console.log(`Pipeline complete in ${duration}s`);

  return { success: true, ...stats };
}

// ─── Lambda Handler ───

export const handler = async (event: any) => {
  console.log('Event:', JSON.stringify(event));

  try {
    const result = await runFullPipeline();
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    console.error('Pipeline failed:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
