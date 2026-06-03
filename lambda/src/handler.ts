import OpenAI from 'openai';
import Parser from 'rss-parser';
import { formatDistanceToNow } from 'date-fns';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { embed, findNearestNeighbor, upsertStory, buildCategoryCentroids, matchByCentroid, type CentroidMap } from './local-store.js';
import { CATEGORY_PROTOTYPES } from './category-prototypes.js';
import { track, printReport as printTokenReport } from './telemetry.js';

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

interface AssessmentResult {
  category: Category;
  bias_tag: string;
  manipulation_index: number;
  manipulation_breakdown: ManipulationBreakdown;
  priority: 'high' | 'medium' | 'low';
  has_full_text: boolean;
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
  sourceNetwork?: SourceNetwork;
  bonus?: boolean;
}

interface SourceArticle { slug: string; headline: string; sourceUrl: string; source: string; }
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

interface SourceClusterEntry {
  source: string;
  title: string;
  link: string;
  pubDate: string;
  similarity: number;
}

interface SourceCluster {
  canonical: FeedItem;
  coverage: SourceClusterEntry[];
}

interface SourceNetworkEntry {
  source: string;
  headline: string;
  sourceUrl: string;
  similarity: number;
  timeDelta: string;
}

interface SourceNetwork {
  outletCount: number;
  entries: SourceNetworkEntry[];
}

// ─── Config ───

// Module-level prompt overrides — set in runFullPipeline(), read by prompt builders
let activePromptOverrides = new Map<string, string>();

const ASSESS_BATCH_SIZE = Number(process.env.ASSESS_BATCH_SIZE ?? 10);
const ASSESS_COUNT = Number(process.env.ASSESS_COUNT ?? process.env.CLASSIFY_COUNT ?? 150);
const ANALYZE_MODEL = process.env.LOCAL_ANALYZE_MODEL || 'gemma4-31b';
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'http://localhost:1234/v1';
const ANALYZE_MAX_TOKENS = Number(process.env.ANALYZE_MAX_TOKENS ?? 8192);
// 72 hours — long enough that the sidebar survives multi-day gaps between
// manual pipeline runs. Each run overwrites these keys, so stale data is
// naturally bounded by user cadence rather than DDB-TTL ejection.
const CACHE_TTL = 72 * 60 * 60;
const DRY_RUN = process.env.DRY_RUN === 'true';
const ENABLE_ARTICLE_FETCH = false; // Feature flag: fetch full article text via Readability
const ARTICLE_FETCH_BATCH_SIZE = 20;
const ARTICLE_FETCH_TIMEOUT = 10000; // 10s per article
const ARTICLE_TEXT_LIMIT_HAIKU = 2000;  // chars for classify prompt
const ARTICLE_TEXT_LIMIT_SONNET = 5000; // chars for analysis prompt

const RANK_WEIGHT_MANIPULATION = Number(process.env.RANK_WEIGHT_MANIPULATION ?? 0.6);
const RANK_WEIGHT_RECENCY = Number(process.env.RANK_WEIGHT_RECENCY ?? 0.2);
const RANK_WEIGHT_PRESTIGE = Number(process.env.RANK_WEIGHT_PRESTIGE ?? 0.2);

const ALL_CATEGORIES: Category[] = ['politics', 'tech', 'finance', 'world', 'science', 'deep-state'];
const BONUS_CATEGORIES: Category[] = ['finance', 'science'];
const BONUS_PER_CATEGORY = 15;

const TABLE_PREFIX = 'newsreal';
const TABLES = {
  stories: `${TABLE_PREFIX}-stories`,
  cache: `${TABLE_PREFIX}-cache`,
};

// ─── Clients (lazy init) ───

let llm: OpenAI | null = null;
let docClient: DynamoDBDocumentClient | null = null;

function getLLM(): OpenAI {
  if (!llm) {
    llm = new OpenAI({
      baseURL: LLM_BASE_URL,
      apiKey: process.env.LLM_API_KEY || 'not-needed',
    });
  }
  return llm;
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

const STORY_TTL_DAYS = Number(process.env.STORY_TTL_DAYS ?? 90);

async function putStory(story: Record<string, unknown>): Promise<void> {
  // Stamp a TTL so DDB auto-deletes after STORY_TTL_DAYS. Requires TTL
  // enabled on the table with attribute name "ttl" (one-time setup).
  const ttl = Math.floor(Date.now() / 1000) + STORY_TTL_DAYS * 86400;
  await getDynamoDB().send(new PutCommand({
    TableName: TABLES.stories,
    Item: { ...story, ttl },
  }));
}

// ─── RSS Fetching ───

const rssParser = new Parser({
  timeout: 10000,
  requestOptions: { headers: { 'User-Agent': 'NewsReal.ai/1.0 (Media Analysis Platform)' } },
});

// Google News RSS items embed the real publisher in two places: a
// <font color="#6f6f6f">Publisher</font> in the content HTML, and a
// " - Publisher" suffix at the end of the title. We prefer the font tag
// (Google-News-specific marker — won't false-positive on other feeds).
function extractGoogleNewsPublisher(rawContent: string | undefined): string | null {
  if (!rawContent) return null;
  const m = rawContent.match(/<font[^>]*>([^<]+)<\/font>/);
  if (!m) return null;
  const pub = m[1].trim();
  if (!pub || pub.length > 60) return null;
  return pub;
}

async function fetchFeed(url: string, sourceName: string): Promise<FeedItem[]> {
  const feed = await rssParser.parseURL(url);
  return (feed.items || []).map((item) => {
    const publisher = extractGoogleNewsPublisher(item.content);
    let title = item.title || '';
    // If the title ends with " - Publisher", strip it so headlines look clean.
    if (publisher && title.endsWith(` - ${publisher}`)) {
      title = title.slice(0, title.length - publisher.length - 3).trim();
    }
    return {
      title,
      link: item.link || '',
      pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
      contentSnippet: item.contentSnippet,
      content: item.content,
      source: publisher || sourceName,
    };
  });
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
  { url: 'https://www.reddit.com/r/wallstreetbets/.rss', name: 'Reddit r/wallstreetbets', hintCategory: 'finance' },
  { url: 'https://www.reddit.com/r/stocks/.rss', name: 'Reddit r/stocks', hintCategory: 'finance' },
  { url: 'https://www.reddit.com/r/economics/.rss', name: 'Reddit r/economics', hintCategory: 'finance' },

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
  // Direct finance feeds
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories', name: 'MarketWatch', hintCategory: 'finance' },
  { url: 'https://seekingalpha.com/feed.xml', name: 'Seeking Alpha', hintCategory: 'finance' },
  { url: 'https://finance.yahoo.com/news/rssindex', name: 'Yahoo Finance', hintCategory: 'finance' },
  // Alternative / skeptical finance
  { url: 'https://feeds.feedburner.com/zerohedge/feed', name: 'ZeroHedge', hintCategory: 'finance' },
  { url: 'https://wolfstreet.com/feed/', name: 'Wolf Street', hintCategory: 'finance' },
  { url: 'https://www.nakedcapitalism.com/feed', name: 'Naked Capitalism', hintCategory: 'finance' },
  { url: 'https://www.calculatedriskblog.com/feeds/posts/default?alt=rss', name: 'Calculated Risk', hintCategory: 'finance' },

  // ─── Science (direct journal feeds first for priority) ───
  { url: 'https://www.nature.com/nature.rss', name: 'Nature', hintCategory: 'science' },
  { url: 'https://www.science.org/action/showFeed?type=etoc&feed=rss&jc=science', name: 'Science', hintCategory: 'science' },
  { url: 'https://speakingofmedicine.plos.org/feed/', name: 'PLOS Speaking of Medicine', hintCategory: 'science' },
  { url: 'https://absolutelymaybe.plos.org/feed/', name: 'PLOS Absolutely Maybe', hintCategory: 'science' },
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
  { url: 'https://www.nationalreview.com/feed/', name: 'National Review', hintCategory: 'politics' },
  { url: 'https://thefederalist.com/feed/', name: 'The Federalist', hintCategory: 'politics' },
  { url: 'https://www.theamericanconservative.com/feed/', name: 'American Conservative', hintCategory: 'politics' },
  { url: 'https://freebeacon.com/feed/', name: 'Washington Free Beacon', hintCategory: 'politics' },
  { url: 'https://www.washingtonexaminer.com/feed/', name: 'Washington Examiner', hintCategory: 'politics' },

  // ─── World (supplement) ───
  { url: `${GNEWS_SEARCH}${encodeURIComponent('site:aljazeera.com')}`, name: 'Al Jazeera', hintCategory: 'world' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('site:bbc.com world')}`, name: 'BBC World', hintCategory: 'world' },
  { url: 'http://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC Direct', hintCategory: 'world' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', name: 'NYT World', hintCategory: 'world' },
  { url: 'https://www.theguardian.com/world/rss', name: 'The Guardian', hintCategory: 'world' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', name: 'Al Jazeera Direct', hintCategory: 'world' },
  { url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml', name: 'WSJ World', hintCategory: 'world' },

  // ─── Mainstream & Wire (generic, no hint) ───
  { url: 'https://feeds.npr.org/1001/rss.xml', name: 'NPR' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('site:apnews.com')}`, name: 'AP via Google News' },
  { url: `${GNEWS_SEARCH}${encodeURIComponent('site:reuters.com')}`, name: 'Reuters via Google News' },

  // ─── Alternative & Investigative ───
  { url: 'https://www.propublica.org/feeds/propublica/main', name: 'ProPublica' },
  { url: 'https://theintercept.com/feed/?lang=en', name: 'The Intercept' },
  { url: 'https://www.democracynow.org/democracynow.rss', name: 'Democracy Now!' },
  { url: 'https://www.bellingcat.com/feed/', name: 'Bellingcat' },

  // ─── Libertarian Perspectives ───
  { url: 'https://reason.com/feed/', name: 'Reason' },
  // { url: 'https://www.cato.org/rss/articles', name: 'Cato Institute' }, // 404 as of 2026-03

  { url: 'https://mises.org/rss.xml', name: 'Mises Institute' },
  { url: 'https://fee.org/rss', name: 'FEE' },
];

export async function fetchAllFeeds(): Promise<{ items: FeedItem[]; sourceErrors: number; errorDetails: string[] }> {
  const rssPromises = ALL_FEEDS.map(async (f) => {
    const items = await fetchFeed(f.url, f.name);
    if (f.hintCategory) {
      return { name: f.name, items: items.map((item) => ({ ...item, hintCategory: f.hintCategory })) };
    }
    return { name: f.name, items };
  });
  const results = await Promise.allSettled(rssPromises);
  const items: FeedItem[] = [];
  let sourceErrors = 0;
  const errorDetails: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      items.push(...result.value.items);
    } else {
      sourceErrors++;
      const feedName = ALL_FEEDS[i].name;
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      errorDetails.push(`${feedName}: ${reason}`);
      console.error(`Feed fetch failed [${feedName}]:`, reason);
    }
  }
  return { items, sourceErrors, errorDetails };
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
const DEDUP_TRIGRAM_SOFT = 0.45;
const DEDUP_JACCARD_THRESHOLD = 0.4;

// Stop words to ignore in word-level Jaccard comparison
const STOP_WORDS = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','is','are','was','were','be','been','being','has','have','had','do','does','did','will','would','could','should','may','might','shall','can','not','no','its','it','this','that','these','those','as','into','than','new','says','said','after','over','about','up']);

function wordJaccard(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w)));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w)));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) if (wordsB.has(w)) intersection++;
  return intersection / (wordsA.size + wordsB.size - intersection);
}

function isDuplicatePair(trigramSim: number, titleA: string, titleB: string): boolean {
  // Strong trigram match → definite duplicate
  if (trigramSim >= DEDUP_THRESHOLD) return true;
  // Moderate trigram + significant word overlap → semantic duplicate
  if (trigramSim >= DEDUP_TRIGRAM_SOFT && wordJaccard(titleA, titleB) >= DEDUP_JACCARD_THRESHOLD) return true;
  return false;
}

function addToCluster(
  clusters: Map<number, SourceCluster>, idx: number,
  canonical: FeedItem, dup: FeedItem, similarity: number
) {
  if (!clusters.has(idx)) {
    clusters.set(idx, { canonical, coverage: [] });
  }
  clusters.get(idx)!.coverage.push({
    source: dup.source.toUpperCase(),
    title: dup.title,
    link: dup.link,
    pubDate: dup.pubDate,
    similarity: Math.round(similarity * 100) / 100,
  });
}

export function deduplicateStories(items: FeedItem[]): { unique: FeedItem[]; duplicates: number; clusters: Map<number, SourceCluster> } {
  const unique: FeedItem[] = [];
  const trigrams: Map<string, number>[] = [];
  const magnitudes: number[] = [];
  const seenExact = new Map<string, number>();
  const clusters = new Map<number, SourceCluster>();
  let duplicates = 0;

  for (const item of items) {
    const titleLower = item.title.toLowerCase().trim();

    // Fast path: exact match → add to cluster
    if (seenExact.has(titleLower)) {
      const idx = seenExact.get(titleLower)!;
      addToCluster(clusters, idx, unique[idx], item, 1.0);
      duplicates++;
      continue;
    }

    // Build trigram vector for this title
    const tVec = buildTrigrams(titleLower);
    const tMag = trigramMagnitude(tVec);

    // Compare against all existing unique items (hybrid: trigram cosine + word Jaccard)
    let isDuplicate = false;
    for (let i = 0; i < trigrams.length; i++) {
      const sim = trigramCosineSim(tVec, tMag, trigrams[i], magnitudes[i]);
      if (sim >= DEDUP_TRIGRAM_SOFT && isDuplicatePair(sim, titleLower, unique[i].title)) {
        addToCluster(clusters, i, unique[i], item, sim);
        isDuplicate = true;
        duplicates++;
        break;
      }
    }

    if (!isDuplicate) {
      unique.push(item);
      trigrams.push(tVec);
      magnitudes.push(tMag);
      seenExact.set(titleLower, unique.length - 1);
    }
  }

  return { unique, duplicates, clusters };
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

// ─── Local LLM Calls (OpenAI-compatible: LM Studio / Ollama / vLLM) ───

async function analyzeWithSonnet(systemPrompt: string, userPrompt: string, label = 'analyze'): Promise<string | null> {
  try {
    const start = Date.now();
    const response = await getLLM().chat.completions.create({
      model: ANALYZE_MODEL,
      max_tokens: ANALYZE_MAX_TOKENS,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
    track(ANALYZE_MODEL, label, response.usage?.prompt_tokens ?? 0, response.usage?.completion_tokens ?? 0, Date.now() - start);
    return response.choices[0]?.message?.content ?? null;
  } catch (err) {
    console.error('Analyze LLM error:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Utility ───

function parseClaudeJSON<T>(raw: string): T | null {
  const cleaned = raw.trim();

  // Try fenced ```json block first
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]) as T; } catch { /* fall through */ }
  }

  // Direct parse
  try { return JSON.parse(cleaned) as T; } catch { /* fall through */ }

  // Local models often add chatty preambles — extract the largest balanced
  // {...} or [...] span and try that.
  for (const [open, close] of [['{', '}'], ['[', ']']] as const) {
    const first = cleaned.indexOf(open);
    const last = cleaned.lastIndexOf(close);
    if (first !== -1 && last > first) {
      try { return JSON.parse(cleaned.slice(first, last + 1)) as T; } catch { /* fall through */ }
    }
  }

  // Last resort: recover from truncated output. Verbose local models often
  // exhaust max_tokens mid-emit, leaving incomplete JSON. Walk the string,
  // truncate to the last syntactically safe boundary, close open structures.
  const recovered = recoverTruncatedJSON<T>(cleaned);
  if (recovered) return recovered;

  return null;
}

function recoverTruncatedJSON<T>(raw: string): T | null {
  // Find where to start (first '{' or '[' if there's chatty preamble)
  const firstStruct = Math.min(
    raw.indexOf('{') === -1 ? Infinity : raw.indexOf('{'),
    raw.indexOf('[') === -1 ? Infinity : raw.indexOf('['),
  );
  if (!isFinite(firstStruct)) return null;
  const body = raw.slice(firstStruct);

  // Walk forward, tracking string state and bracket stack.
  // Record the "last safe truncation point" — position right after a complete
  // value (closed brace/bracket) or right before a comma at depth >= 1.
  let inString = false;
  let escape = false;
  const stack: string[] = [];
  let lastSafeEnd = -1;
  const stackAtSafe: string[] = [];

  const snapshotStack = (end: number) => {
    lastSafeEnd = end;
    stackAtSafe.length = 0;
    for (const s of stack) stackAtSafe.push(s);
  };

  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (c === '{' || c === '[') {
      stack.push(c);
    } else if (c === '}' || c === ']') {
      stack.pop();
      snapshotStack(i + 1);
      if (stack.length === 0) {
        // Full balanced parse should have worked above; if we get here, something
        // is weird after this point — try parsing what we have.
        try { return JSON.parse(body.slice(0, i + 1)) as T; } catch { /* keep walking */ }
      }
    } else if (c === ',' && stack.length > 0) {
      // Comma at depth >= 1 means the preceding value was complete.
      // Safe to truncate right before this comma.
      snapshotStack(i);
    }
  }

  if (lastSafeEnd <= 0) return null;

  // Reconstruct: keep body[0..lastSafeEnd], then close all open structures
  // that were open at that point.
  let recovered = body.slice(0, lastSafeEnd);
  for (let i = stackAtSafe.length - 1; i >= 0; i--) {
    recovered += stackAtSafe[i] === '{' ? '}' : ']';
  }

  try { return JSON.parse(recovered) as T; } catch { return null; }
}

/**
 * Coerce a model-output field to a string. Smaller local models sometimes
 * over-structure their JSON — they'll emit a nested object where the prompt
 * asks for a single string. Flatten those by concatenating the leaf values
 * into a prose-ish blob so downstream UI doesn't try to render an object
 * as a React child.
 */
function coerceToString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(coerceToString).filter(Boolean).join(' ');
  if (typeof v === 'object') {
    return Object.values(v as Record<string, unknown>).map(coerceToString).filter(Boolean).join(' ');
  }
  return String(v);
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

async function batchProcess<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency: number): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let next = 0;
  let errorCount = 0;

  async function worker() {
    while (next < items.length) {
      const idx = next++;
      try {
        results[idx] = await fn(items[idx]);
      } catch (err) {
        // Log the first error in full so systemic failures aren't silent
        if (errorCount++ === 0) {
          console.error('  batchProcess: first item error:', err instanceof Error ? err.message : err);
        }
        results[idx] = null;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  if (errorCount > 0) console.error(`  batchProcess: ${errorCount}/${items.length} items threw`);
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

export function selectForClassification(items: FeedItem[], total: number, minPerCategory: number): FeedItem[] {
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
  const cappedMin = Math.min(minPerCategory, Math.floor(total / ALL_CATEGORIES.length));
  const selected: FeedItem[] = [];
  for (const cat of ALL_CATEGORIES) {
    const bucket = categoryBuckets.get(cat) || [];
    const sampled = weightedSample(bucket, cappedMin, usedLinks);
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

type AssessedEntry = { item: FeedItem; assessment: AssessmentResult };

function rankScore(item: FeedItem, assessment: AssessmentResult): number {
  const manipulation = assessment.manipulation_index / 100;
  const ageMs = Date.now() - new Date(item.pubDate).getTime();
  const ageHours = isNaN(ageMs) ? 24 : ageMs / (1000 * 60 * 60);
  const recency = Math.max(0, 1 - ageHours / 24);
  const prestige = TOP_TIER_SOURCES.has(item.source.toUpperCase()) ? 1.0 : 0.0;
  return RANK_WEIGHT_MANIPULATION * manipulation
       + RANK_WEIGHT_RECENCY * recency
       + RANK_WEIGHT_PRESTIGE * prestige;
}

function categoryBalancedSort(assessed: AssessedEntry[]): AssessedEntry[] {
  const byRank = (a: AssessedEntry, b: AssessedEntry) =>
    rankScore(b.item, b.assessment) - rankScore(a.item, a.assessment);

  const categoryGroups = new Map<Category, AssessedEntry[]>();
  for (const entry of assessed) {
    const cat = entry.assessment.category;
    const group = categoryGroups.get(cat) || [];
    group.push(entry);
    categoryGroups.set(cat, group);
  }

  for (const group of categoryGroups.values()) {
    group.sort(byRank);
  }

  const result: AssessedEntry[] = [];
  const used = new Set<number>();
  let round = 0;
  let added = true;

  while (added) {
    added = false;
    for (const cat of ALL_CATEGORIES) {
      const group = categoryGroups.get(cat);
      if (!group || round >= group.length) continue;
      const entry = group[round];
      const idx = assessed.indexOf(entry);
      if (!used.has(idx)) {
        result.push(entry);
        used.add(idx);
        added = true;
      }
    }
    round++;
  }

  for (let i = 0; i < assessed.length; i++) {
    if (!used.has(i)) result.push(assessed[i]);
  }

  return result;
}

// ─── Prompts ───

const DEFAULT_SYSTEM_PROMPT = `You are the NewsReal.ai analysis engine. Your job is to generate provocative, attention-grabbing media criticism for each news story.

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

function getSystemPrompt(): string {
  return activePromptOverrides.get('analysis-system') || DEFAULT_SYSTEM_PROMPT;
}

function buildAssessPrompt(headline: string, source: string, text: string, timestamp: string, hasFullText: boolean, categoryHint?: string): { system: string; user: string } {
  const hintLine = categoryHint ? `\n- Category hint (from embedding similarity — override if clearly wrong): ${categoryHint}` : '';
  return {
    system: getSystemPrompt(),
    user: `STORY DATA:
- Headline: ${headline}
- Source(s): ${source}
- ${hasFullText ? 'Full article text' : 'RSS snippet (full text unavailable)'}: ${text}
- Has full article text: ${hasFullText}
- Publication time: ${timestamp}
- Entities mentioned: Auto-detect from text${hintLine}

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
  "category": "<one of: politics | tech | finance | world | science | deep-state>",
  "bias_tag": "<one of: LEAN LEFT | LEAN RIGHT | ESTABLISHMENT | ANTI-ESTABLISHMENT | UNREPORTED | CENTER-ESTABLISHMENT>",
  "manipulation_breakdown": {
    "emotional_manipulation": { "score": <0-20>, "reason": "<1 sentence>" },
    "source_transparency": { "score": <0-20>, "reason": "<1 sentence>" },
    "framing_bias": { "score": <0-20>, "reason": "<1 sentence>" },
    "selective_omission": { "score": <0-20>, "reason": "<1 sentence>" },
    "headline_accuracy": { "score": <0-20>, "reason": "<1 sentence>" }
  },
  "manipulation_index": <0-100 sum of the 5 scores above>,
  "has_full_text": ${hasFullText},
  "quick_take": "<2-3 provocative sentences for the card view. Must include at least one specific claim about timing, money, or connections. EXACTLY ONCE in the sentence, wrap the most provocative specific claim — a name, a dollar amount, a connection — in [REDACTED:...] syntax so it renders as a click-to-reveal blackbar. EXAMPLE: '...sparked outrage over [REDACTED:$400k in AIPAC lobbying tied to Massie's primary challenger]'. DO NOT literally write the phrase 'hidden detail' — substitute the real spicy claim between the colon and the closing bracket.>",
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
    system: activePromptOverrides.get('obfuscation-system') || `You are the NewsReal.ai Obfuscation Detector. Your job is to identify stories that are being BURIED by the current news cycle. Respond ONLY in valid JSON.`,
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

function buildNarrativePrompt(storyList: string, clusterEvidence?: string): { system: string; user: string } {
  const clusterSection = clusterEvidence
    ? `\n\nCROSS-SOURCE COVERAGE DATA (empirical — from RSS deduplication, not speculative):
${clusterEvidence}

Use this data to ground your coherence scores. Stories covered by many outlets with near-identical headlines indicate genuine coordinated messaging or wire-service dependence. Score "lexical_alignment" and "source_convergence" based on the actual cluster data above. "counter_narrative_absence" can be inferred from which stories DON'T appear across outlets. "frame_uniformity" remains your editorial judgment based on framing differences.`
    : '';

  return {
    system: activePromptOverrides.get('narrative-system') || `You are the NewsReal.ai Narrative Tracker. You detect coordinated messaging patterns across media outlets. Respond ONLY in valid JSON.`,
    user: `Analyze the following stories from the past 6 hours across all major outlets.

${storyList}${clusterSection}

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
    system: activePromptOverrides.get('ticker-system') || `You generate ticker alerts for the NewsReal.ai scrolling banner. Respond ONLY in valid JSON.`,
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
    system: activePromptOverrides.get('suppressed-system') || `You generate "forbidden knowledge" search queries for NewsReal.ai. Respond ONLY in valid JSON.`,
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


// ─── Phase 4: centroid match + Phase 5: heuristic priority + slim LLM ───

const CENTROID_MIN_SIMILARITY = Number(process.env.CENTROID_MIN_SIMILARITY ?? 0.45);
const CENTROID_MIN_MARGIN = Number(process.env.CENTROID_MIN_MARGIN ?? 0.05);
const DISABLE_CENTROID = process.env.DISABLE_CENTROID === 'true';

let centroidsPromise: Promise<CentroidMap> | null = null;
function loadCentroids(): Promise<CentroidMap> {
  if (!centroidsPromise) centroidsPromise = buildCategoryCentroids(CATEGORY_PROTOTYPES);
  return centroidsPromise;
}

// Top-tier outlets get a priority weight bump.
const TOP_TIER_SOURCES = new Set([
  'AP', 'AP TOP NEWS', 'REUTERS', 'REUTERS WORLD', 'REUTERS BUSINESS', 'REUTERS TECH',
  'BLOOMBERG', 'WSJ', 'WALL STREET JOURNAL', 'NEW YORK TIMES', 'NYT', 'WASHINGTON POST',
  'BBC', 'BBC NEWS', 'FINANCIAL TIMES', 'FT', 'THE GUARDIAN', 'THE ECONOMIST',
  'CNN', 'NBC NEWS', 'CBS NEWS', 'ABC NEWS', 'AXIOS', 'POLITICO',
]);

function heuristicPriority(item: FeedItem): 'high' | 'medium' | 'low' {
  // Recency: fresher = higher. Decay over 24h.
  const ageMs = Date.now() - new Date(item.pubDate).getTime();
  const ageHours = isNaN(ageMs) ? 24 : ageMs / (1000 * 60 * 60);
  const recencyScore = Math.max(0, 1 - ageHours / 24); // 1.0 at t=0, 0 at 24h+

  // Source weight: top-tier outlets get a 1.5× bump.
  const sourceUpper = item.source.toUpperCase();
  const sourceWeight = TOP_TIER_SOURCES.has(sourceUpper) ? 1.5 : 1.0;

  const score = recencyScore * sourceWeight;
  if (score >= 0.7) return 'high';
  if (score >= 0.35) return 'medium';
  return 'low';
}

// ─── Unified Assess ───

const assessStats = { cacheHits: 0, legacyUpgrades: 0, llmCalls: 0, embedFailures: 0 };
function resetAssessStats() { assessStats.cacheHits = 0; assessStats.legacyUpgrades = 0; assessStats.llmCalls = 0; assessStats.embedFailures = 0; }

export async function assessStory(item: FeedItem): Promise<AssessmentResult | null> {
  const slug = slugify(item.title);
  const validCategories: Category[] = ['politics', 'tech', 'finance', 'world', 'science', 'deep-state'];

  const embedding = await embed(item.title);
  if (!embedding) assessStats.embedFailures++;

  // Path A/B: cache lookup
  let categoryHint: string | undefined;
  if (embedding) {
    const hit = findNearestNeighbor(embedding);
    if (hit) {
      if (hit.story.analysisJson) {
        // Path A: full cache hit
        try {
          const cached = JSON.parse(hit.story.analysisJson) as AssessmentResult;
          cached.priority = heuristicPriority(item);
          assessStats.cacheHits++;
          upsertStory({
            slug, headline: item.title, source: item.source, publishedAt: item.pubDate,
            category: cached.category, biasTag: cached.bias_tag,
            manipulationIndex: cached.manipulation_index, priority: cached.priority,
            quickTake: cached.quick_take, embedding, analysisJson: hit.story.analysisJson,
          });
          return cached;
        } catch {}
      }
      // Path B: legacy cache (has classification but no analysis_json)
      categoryHint = hit.story.category;
      assessStats.legacyUpgrades++;
    }
  }

  // Centroid hint (if no cache-based hint yet)
  if (!categoryHint && embedding && !DISABLE_CENTROID) {
    const centroids = await loadCentroids();
    const match = matchByCentroid(embedding, centroids);
    if (match && validCategories.includes(match.category as Category) &&
        match.similarity >= CENTROID_MIN_SIMILARITY && match.margin >= CENTROID_MIN_MARGIN) {
      categoryHint = match.category;
    }
  }

  // Path C: LLM call
  assessStats.llmCalls++;
  const hasFullText = !!item.fullText;
  const articleText = hasFullText
    ? item.fullText!.slice(0, ARTICLE_TEXT_LIMIT_SONNET)
    : (item.contentSnippet || item.content || 'Full text not available — analyze based on headline and source.');
  const { system, user } = buildAssessPrompt(
    item.title, item.source, articleText, item.pubDate, hasFullText, categoryHint
  );
  const raw = await analyzeWithSonnet(system, user, 'assess');
  if (!raw) return null;

  const parsed = parseClaudeJSON<AssessmentResult>(raw);
  if (!parsed) { console.error('Failed to parse assessment:', raw.slice(0, 200)); return null; }

  if (!validCategories.includes(parsed.category)) parsed.category = 'world';
  // Recompute manipulation_index from breakdown sub-scores (don't trust model arithmetic)
  if (parsed.manipulation_breakdown) {
    const b = parsed.manipulation_breakdown;
    parsed.manipulation_index = (b.emotional_manipulation?.score ?? 0) +
      (b.source_transparency?.score ?? 0) + (b.framing_bias?.score ?? 0) +
      (b.selective_omission?.score ?? 0) + (b.headline_accuracy?.score ?? 0);
  }
  parsed.priority = heuristicPriority(item);
  parsed.has_full_text = hasFullText;

  const analysisJson = JSON.stringify(parsed);
  if (embedding) {
    upsertStory({
      slug, headline: item.title, source: item.source, publishedAt: item.pubDate,
      category: parsed.category, biasTag: parsed.bias_tag,
      manipulationIndex: parsed.manipulation_index, priority: parsed.priority,
      quickTake: parsed.quick_take, embedding, analysisJson,
    });
  }
  return parsed;
}

function feedItemToStory(item: FeedItem, assessment: AssessmentResult, index: number, cluster?: SourceCluster): Story {
  const story: Story = {
    id: index + 1, slug: slugify(item.title), category: assessment.category,
    featured: false, source: item.source.toUpperCase(), sourceUrl: item.link,
    time: relativeTime(item.pubDate), headline: item.title,
    summary: coerceToString(assessment.mainstream_frame).slice(0, 500),
    biasTag: mapBiasTag(assessment.bias_tag || 'CENTER-ESTABLISHMENT'),
    manipulationScore: assessment.manipulation_index,
    manipulationBreakdown: assessment.manipulation_breakdown,
    hasFullText: assessment.has_full_text,
    realAnalysis: coerceToString(assessment.real_story),
    deepDive: {
      mainstream: coerceToString(assessment.mainstream_frame),
      realStory: coerceToString(assessment.real_story),
      leftSpin: coerceToString(assessment.left_spin),
      rightSpin: coerceToString(assessment.right_spin),
      whosBenefiting: coerceToString(assessment.who_benefits),
      whatsHidden: coerceToString(assessment.whats_hidden),
    },
  };

  if (cluster && cluster.coverage.length > 0) {
    story.sourceNetwork = {
      outletCount: cluster.coverage.length + 1,
      entries: cluster.coverage.slice(0, 10).map(c => ({
        source: c.source,
        headline: c.title,
        sourceUrl: c.link,
        similarity: c.similarity,
        timeDelta: computeTimeDelta(item.pubDate, c.pubDate),
      })),
    };
  }

  return story;
}

function computeTimeDelta(canonicalDate: string, otherDate: string): string {
  const diffMs = new Date(otherDate).getTime() - new Date(canonicalDate).getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (Math.abs(diffMins) < 60) return `${diffMins >= 0 ? '+' : ''}${diffMins}m`;
  const diffHrs = Math.round(diffMins / 60);
  return `${diffHrs >= 0 ? '+' : ''}${diffHrs}h`;
}

function generateHeatBar(score: number): string {
  const filled = Math.round(score / 10);
  return '\u2593'.repeat(filled) + '\u2591'.repeat(10 - filled) + ` ${score}%`;
}

// ─── Main Pipeline ───

export async function runFullPipeline(): Promise<Record<string, unknown>> {
  const startTime = Date.now();
  const stats: Record<string, unknown> = {};

  function stepTime(label: string, stepStart: number) {
    const d = ((Date.now() - stepStart) / 1000).toFixed(1);
    console.log(`  [${label}: ${d}s]`);
    stats[`time_${label.toLowerCase().replace(/\s+/g, '_')}`] = `${d}s`;
  }

  // Load prompt overrides from admin dashboard
  const promptOverrideNames = [
    'classify-system', 'analysis-system', 'analysis-rubric',
    'obfuscation-system', 'narrative-system', 'narrative-rubric',
    'ticker-system', 'suppressed-system',
    'narrative-analysis-system', 'search-analysis-system',
  ];
  activePromptOverrides = new Map<string, string>();
  try {
    const overrides = await Promise.all(
      promptOverrideNames.map(n => getCached<{ content: string }>(`admin-prompt:${n}`))
    );
    promptOverrideNames.forEach((name, i) => {
      if (overrides[i]?.content) activePromptOverrides.set(name, overrides[i]!.content);
    });
    if (activePromptOverrides.size > 0) {
      console.log(`Loaded ${activePromptOverrides.size} prompt override(s): ${Array.from(activePromptOverrides.keys()).join(', ')}`);
    }
  } catch (err) {
    console.error('Failed to load prompt overrides:', err instanceof Error ? err.message : err);
  }

  // Step 1: Fetch all feeds
  let stepStart = Date.now();
  console.log('Step 1: Fetching RSS feeds...');
  const { items: allItems, sourceErrors, errorDetails } = await fetchAllFeeds();
  stats.fetched = allItems.length;
  stats.sourceErrors = sourceErrors;
  stats.errorDetails = errorDetails;
  console.log(`  Fetched ${allItems.length} items (${sourceErrors} source errors)`);
  stepTime('Step 1', stepStart);

  if (allItems.length === 0) throw new Error('All RSS sources failed');

  // Step 2: Deduplicate (trigram cosine similarity, handles full set efficiently)
  stepStart = Date.now();
  console.log(`Step 2: Deduplicating ${allItems.length} items...`);
  const { unique, duplicates, clusters } = deduplicateStories(allItems);
  stats.unique = unique.length;
  stats.duplicates = duplicates;
  stats.clusters = clusters.size;
  console.log(`  ${unique.length} unique, ${duplicates} duplicates, ${clusters.size} multi-source clusters`);
  stepTime('Step 2', stepStart);

  // Build link→cluster map for stable lookup through pipeline
  const clustersByLink = new Map<string, SourceCluster>();
  for (const [idx, cluster] of clusters) {
    clustersByLink.set(unique[idx].link, cluster);
  }

  // Step 3: Select and optionally fetch full article text
  stepStart = Date.now();
  const toAssess = selectForClassification(unique, ASSESS_COUNT, 25);
  if (ENABLE_ARTICLE_FETCH) {
    console.log(`Step 3: Fetching full article text for ${toAssess.length} stories...`);
    const { fetched: articlesFetched, failed: articlesFailed } = await fetchArticleTexts(toAssess);
    stats.articlesFetched = articlesFetched;
    stats.articlesFailed = articlesFailed;
    console.log(`  Fetched ${articlesFetched}/${toAssess.length} articles (${articlesFailed} failed)`);
  } else {
    console.log('Step 3: Article fetching disabled (ENABLE_ARTICLE_FETCH=false)');
  }
  stepTime('Step 3', stepStart);

  // Step 4: Assess all stories (unified classify + analyze in single LLM call)
  stepStart = Date.now();
  resetAssessStats();
  console.log(`Step 4: Assessing ${toAssess.length} stories with ${ANALYZE_MODEL} (batch ${ASSESS_BATCH_SIZE}, cache threshold ${process.env.CACHE_HIT_THRESHOLD ?? 0.92})...`);
  const assessResults = await batchProcess(toAssess, assessStory, ASSESS_BATCH_SIZE);

  const assessed: AssessedEntry[] = [];
  for (let i = 0; i < assessResults.length; i++) {
    if (assessResults[i]) assessed.push({ item: toAssess[i], assessment: assessResults[i]! });
  }

  const sorted = categoryBalancedSort(assessed);
  stats.assessed = sorted.length;
  console.log(`  Assessed ${sorted.length} stories  (cache: ${assessStats.cacheHits}, legacy-upgrades: ${assessStats.legacyUpgrades}, LLM: ${assessStats.llmCalls}, embed-failures: ${assessStats.embedFailures})`);
  stats.cacheHits = assessStats.cacheHits;
  stats.llmCalls = assessStats.llmCalls;
  stats.embedFailures = assessStats.embedFailures;
  stepTime('Step 4', stepStart);

  // Step 5: Build Story objects + tag bonus categories
  stepStart = Date.now();
  console.log(`Step 5: Building ${sorted.length} Story objects with source-network metadata...`);
  const stories: Story[] = sorted.map((c, i) => feedItemToStory(c.item, c.assessment, i, clustersByLink.get(c.item.link)));
  const featuredPerCat = new Map<string, number>();
  for (const story of stories) {
    const count = featuredPerCat.get(story.category) || 0;
    if (count < 5) { story.featured = true; featuredPerCat.set(story.category, count + 1); }
  }
  const networkedCount = stories.filter(s => s.sourceNetwork).length;
  console.log(`  ${networkedCount}/${stories.length} stories have multi-source network data`);

  // Tag bonus stories from the assessed pool (no separate LLM pass needed)
  const bonusStories: Story[] = [];
  const bonusManifests: Record<string, string[]> = {};
  const mainSlugs = new Set(stories.map(s => s.slug));
  for (const bonusCat of BONUS_CATEGORIES) {
    const extras = assessed
      .filter(a => a.assessment.category === bonusCat && !mainSlugs.has(slugify(a.item.title)))
      .slice(0, BONUS_PER_CATEGORY);
    for (const extra of extras) {
      const story = feedItemToStory(extra.item, extra.assessment, stories.length + bonusStories.length, clustersByLink.get(extra.item.link));
      story.bonus = true;
      bonusStories.push(story);
    }
    bonusManifests[bonusCat] = bonusStories.filter(s => s.category === bonusCat).map(s => s.slug);
    if (extras.length > 0) console.log(`  [${bonusCat}] ${bonusManifests[bonusCat].length} bonus stories from assessed pool`);
  }
  stats.bonusStories = bonusStories.length;
  stepTime('Step 5', stepStart);

  // Step 6: Sidebar data
  stepStart = Date.now();
  console.log('Step 6: Generating sidebar data...');
  const storyBySlug = new Map(stories.map(s => [s.slug, s]));
  function resolveSlugs(slugs: string[]): SourceArticle[] {
    return slugs.map(sl => storyBySlug.get(sl)).filter(Boolean)
      .map(s => ({ slug: s!.slug, headline: s!.headline, sourceUrl: s!.sourceUrl, source: s!.source }));
  }

  const storyListForPrompt = stories.slice(0, 30).map((s, i) =>
    `${i + 1}. [${s.source}] "${s.headline}" (slug: ${s.slug})`
  ).join('\n');

  // Build cluster evidence for narrative prompt grounding
  const clusterEvidence = stories
    .filter(s => s.sourceNetwork && s.sourceNetwork.outletCount > 2)
    .slice(0, 20)
    .map(s => {
      const outlets = s.sourceNetwork!.entries.map(e => e.source).join(', ');
      return `"${s.headline}" — covered by ${s.sourceNetwork!.outletCount} outlets: ${s.source}, ${outlets}`;
    })
    .join('\n');

  const obfuscationPrompt = buildObfuscationPrompt(storyListForPrompt);
  const narrativePrompt = buildNarrativePrompt(storyListForPrompt, clusterEvidence || undefined);

  const [obfuscationsRaw, narrativesRaw] = await Promise.all([
    analyzeWithSonnet(obfuscationPrompt.system, obfuscationPrompt.user, 'sidebar-obfuscation'),
    analyzeWithSonnet(narrativePrompt.system, narrativePrompt.user, 'sidebar-narrative'),
  ]);

  const obfuscations: Obfuscation[] = (() => {
    if (!obfuscationsRaw) return [];
    const parsed = parseClaudeJSON<{ obfuscations: any[] }>(obfuscationsRaw);
    if (!parsed?.obfuscations) return [];
    return parsed.obfuscations.map((o: any) => ({
      category: coerceToString(o.category),
      whatHappened: coerceToString(o.what_happened),
      whyItMatters: coerceToString(o.why_it_matters),
      whatsCoveringIt: coerceToString(o.whats_covering_it),
      whoBenefits: coerceToString(o.who_benefits),
      detectionConfidence: o.detection_confidence,
      sourceUrl: o.source_url || undefined,
      relatedStories: resolveSlugs(o.covering_story_slugs || []),
    }));
  })();

  const narratives: Narrative[] = (() => {
    if (!narrativesRaw) return [];
    const parsed = parseClaudeJSON<{ narratives: any[] }>(narrativesRaw);
    if (!parsed?.narratives) return [];
    return parsed.narratives.map((n: any) => {
      const relatedStories = resolveSlugs(n.related_story_slugs || []);
      // Derive outletsInvolved from the actual stories we resolved — ground truth,
      // not whatever the model invented. Dedup preserving first-seen order.
      const seen = new Set<string>();
      const outletsInvolved: string[] = [];
      for (const s of relatedStories) {
        if (s.source && !seen.has(s.source)) {
          seen.add(s.source);
          outletsInvolved.push(s.source);
        }
      }
      const text = coerceToString(n.narrative_text);
      return {
        text,
        heat: generateHeatBar(n.coherence_score),
        coherenceScore: n.coherence_score,
        coherenceBreakdown: n.coherence_breakdown || undefined,
        outletsInvolved,
        slug: slugify(text.replace(/<[^>]*>/g, '')),
        relatedStories,
      };
    });
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
    analyzeWithSonnet(tickerPrompt.system, tickerPrompt.user, 'sidebar-ticker'),
    analyzeWithSonnet(suppressedPrompt.system, suppressedPrompt.user, 'sidebar-suppressed'),
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
    const raw = parsed?.suppressed_searches || [];
    // Llama sometimes wraps each query in literal double quotes. Stripping
    // them, because Google News interprets quoted queries as exact-phrase
    // matches and long sentence-style queries never match exactly → 0 results.
    return raw
      .map((q) => coerceToString(q).trim().replace(/^["'`]+|["'`]+$/g, '').trim())
      .filter((q) => q.length > 0);
  })();

  stats.tickerItems = tickerItems.length;
  stats.suppressedSearches = suppressedSearches.length;
  console.log(`  Sidebar: ${obfuscations.length} obfuscations, ${narratives.length} narratives, ${tickerItems.length} ticker, ${suppressedSearches.length} suppressed`);
  stepTime('Step 6', stepStart);

  // Step 7b: Precompute narrative analyses (parallel)
  stepStart = Date.now();
  console.log('Step 6b: Precomputing narrative analyses...');
  const narrativeAnalyses: NarrativeAnalysis[] = [];
  if (narratives.length > 0) {
    const naStart = Date.now();
    const naResults = await Promise.allSettled(narratives.map(async (n) => {
      if (!n.slug) return null;
      const plainText = n.text.replace(/<[^>]*>/g, '');
      const relatedForPrompt = (n.relatedStories || []).map((s, i) =>
        `${i + 1}. [${s.sourceUrl ? new URL(s.sourceUrl).hostname.replace('www.', '') : 'unknown'}] ${s.headline}`
      ).join('\n') || 'None identified';

      const naSystem = activePromptOverrides.get('narrative-analysis-system') || `You are the NewsReal.ai analysis engine. Your job is to generate provocative, attention-grabbing media criticism. Be equally skeptical of all political sides. Always follow the money. Be direct. Be bold. Respond ONLY in valid JSON. No markdown, no commentary.`;
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

      const raw = await analyzeWithSonnet(naSystem, naUser, 'narrative-deepdive');
      if (!raw) return null;
      const parsed = parseClaudeJSON<{ narrative_origin: string; coordination_evidence: string; who_benefits: string; suppressed_alternative: string }>(raw);
      if (!parsed) return null;

      return {
        slug: n.slug,
        narrativeText: n.text,
        coherenceScore: n.coherenceScore || 0,
        outletsInvolved: n.outletsInvolved || [],
        analysisDate: new Date().toISOString(),
        narrativeOrigin: coerceToString(parsed.narrative_origin),
        coordinationEvidence: coerceToString(parsed.coordination_evidence),
        whoBenefits: coerceToString(parsed.who_benefits),
        suppressedAlternative: coerceToString(parsed.suppressed_alternative),
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
  stepTime('Step 6b', stepStart);

  // Step 7c: Precompute search analyses (RSS + analysis model per query)
  stepStart = Date.now();
  console.log('Step 6c: Precomputing search analyses...');
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
          console.error(`  [search-analysis] RSS error for "${query}":`, err instanceof Error ? err.message : err);
          return { query, analysis: null } as SuppressedSearchEntry;
        }

        if (feedItems.length === 0) {
          console.log(`  [search-analysis] "${query}" — 0 results from Google News, skipping`);
          return { query, analysis: null } as SuppressedSearchEntry;
        }
        console.log(`  [search-analysis] "${query}" — ${feedItems.length} results, analyzing...`);

        const topResults = feedItems.slice(0, 15).map((item) => ({
          title: item.title, source: item.source, link: item.link,
          snippet: item.contentSnippet || item.content || '',
        }));

        const formattedResults = topResults.map((r, idx) =>
          `${idx + 1}. [${r.source}] ${r.title}\n   ${r.snippet}`
        ).join('\n\n');

        const saSystem = activePromptOverrides.get('search-analysis-system') || `You are the NewsReal.ai analysis engine. Your job is to generate provocative, attention-grabbing media criticism. Be equally skeptical of all political sides. Always follow the money. Be direct. Be bold. Respond ONLY in valid JSON. No markdown, no commentary.`;
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

        const raw = await analyzeWithSonnet(saSystem, saUser, 'search-deepdive');
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
            mediaPattern: coerceToString(parsed.media_pattern),
            whatsRevealed: coerceToString(parsed.whats_revealed),
            whatsMissing: coerceToString(parsed.whats_missing),
            connectionMap: coerceToString(parsed.connection_map),
            whyItsSuppressed: coerceToString(parsed.why_its_suppressed),
            searchResults: topResults,
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
  stepTime('Step 6c', stepStart);

  // Step 8: Store each story individually in DynamoDB (main + bonus)
  stepStart = Date.now();
  const allStoriesToStore = [...stories, ...bonusStories];
  if (DRY_RUN) {
    console.log(`Step 7: DRY_RUN — skipping DynamoDB store (${allStoriesToStore.length} stories would be written)`);
    stats.stored = 0;
  } else {
    console.log(`Step 7: Storing ${allStoriesToStore.length} stories to DynamoDB (${stories.length} main + ${bonusStories.length} bonus)...`);
    // Build per-story metadata: publishedAt is the *article's* publication date,
    // not the pipeline run time (required for age-based purge semantics).
    // Falls back to now if a story has no recoverable pubDate.
    // `unique` carries every FeedItem that survived dedup, which covers both the
    // main classified set and bonus-pass candidates.
    const storyToFeedDate = new Map<string, string>();
    for (const item of unique) storyToFeedDate.set(slugify(item.title), item.pubDate);
    const nowIso = new Date().toISOString();
    const storeResults = await Promise.allSettled(
      allStoriesToStore.map((story) => {
        const rawPubDate = storyToFeedDate.get(story.slug);
        let publishedAt = rawPubDate;
        if (!publishedAt || isNaN(new Date(publishedAt).getTime())) publishedAt = nowIso;
        else publishedAt = new Date(publishedAt).toISOString(); // normalize to ISO
        return putStory({ ...story, id: story.slug, publishedAt, storedAt: nowIso });
      })
    );
    const stored = storeResults.filter((r) => r.status === 'fulfilled').length;
    const failed = storeResults.filter((r) => r.status === 'rejected').length;
    stats.stored = stored;
    console.log(`  Stored ${stored}/${stories.length} stories${failed ? ` (${failed} failed)` : ''}`);
  }
  stepTime('Step 7', stepStart);

  // Step 9: Cache manifest + sidebar + precomputed analyses
  stepStart = Date.now();
  if (DRY_RUN) {
    console.log('Step 8: DRY_RUN — skipping cache writes');
    stepTime('Step 8', stepStart);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    stats.duration = `${duration}s`;
    stats.timestamp = new Date().toISOString();
    stats.dryRun = true;
    console.log(`Pipeline complete (dry run) in ${duration}s`);
    printTokenReport();
    return { success: true, ...stats };
  }
  console.log('Step 8: Caching manifest + sidebar + analyses...');
  const manifest = stories.map((s) => s.slug);

  // Drop sidebar items whose detail-page analyses didn't make it through
  // Step 7b/7c. Showing them in the sidebar leads to dead-end clicks.
  const analyzedNarrativeSlugs = new Set(narrativeAnalyses.map((na) => na.slug));
  const narrativesForSidebar = narratives.filter((n) => n.slug && analyzedNarrativeSlugs.has(n.slug));
  const droppedNarratives = narratives.length - narrativesForSidebar.length;
  if (droppedNarratives > 0) {
    console.log(`  Filtered out ${droppedNarratives} narrative(s) missing precomputed analysis`);
  }

  const analyzedSearchQueries = new Set(
    searchAnalyses.filter((s) => s.analysis).map((s) => s.query)
  );
  const suppressedForSidebar = suppressedSearches.filter((q) => analyzedSearchQueries.has(q));
  const droppedSearches = suppressedSearches.length - suppressedForSidebar.length;
  if (droppedSearches > 0) {
    console.log(`  Filtered out ${droppedSearches} suppressed search(es) missing analysis`);
  }

  const bulkCacheOps: Promise<void>[] = [
    setCached('homepage-manifest', manifest, CACHE_TTL),
    setCached('homepage-narratives', narrativesForSidebar, CACHE_TTL),
    setCached('homepage-obfuscations', obfuscations, CACHE_TTL),
    setCached('homepage-ticker', tickerItems, CACHE_TTL),
    setCached('homepage-suppressed', suppressedForSidebar, CACHE_TTL),
    setCached('homepage-narrative-analyses', narrativeAnalyses, CACHE_TTL),
    setCached('homepage-search-analyses', searchAnalyses, CACHE_TTL),
    setCached('pipeline-last-run', Date.now(), CACHE_TTL),
  ];
  const bulkCacheKeys = ['homepage-manifest', 'homepage-narratives', 'homepage-obfuscations', 'homepage-ticker', 'homepage-suppressed', 'homepage-narrative-analyses', 'homepage-search-analyses', 'pipeline-last-run'];

  // Bonus category manifests
  for (const bonusCat of BONUS_CATEGORIES) {
    const slugs = bonusManifests[bonusCat] || [];
    bulkCacheOps.push(setCached(`homepage-bonus-${bonusCat}`, slugs, CACHE_TTL));
    bulkCacheKeys.push(`homepage-bonus-${bonusCat}`);
    console.log(`  Bonus manifest for ${bonusCat}: ${slugs.length} stories`);
  }

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
  stepTime('Step 8', stepStart);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  stats.duration = `${duration}s`;
  stats.timestamp = new Date().toISOString();
  console.log(`Pipeline complete in ${duration}s`);
  printTokenReport();

  // Store full stats for admin dashboard
  try {
    const runKey = `pipeline-run:${stats.timestamp}`;
    await setCached(runKey, stats, 30 * 86400);

    const runsManifest = await getCached<string[]>('pipeline-runs') || [];
    runsManifest.unshift(stats.timestamp as string);
    if (runsManifest.length > 20) runsManifest.length = 20;
    await setCached('pipeline-runs', runsManifest, 30 * 86400);
    console.log('  Admin stats saved');
  } catch (err) {
    console.error('  Failed to save admin stats:', err instanceof Error ? err.message : err);
  }

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
