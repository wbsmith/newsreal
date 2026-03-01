import Anthropic from '@anthropic-ai/sdk';
import Parser from 'rss-parser';
import * as fuzzball from 'fuzzball';
import { formatDistanceToNow } from 'date-fns';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

// ─── Types ───

interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;
  content?: string;
  source: string;
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

interface AnalysisResult {
  manipulation_index: number;
  manipulation_reasoning: string;
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
  realAnalysis: string;
  deepDive: DeepDive;
}

interface Narrative { text: string; heat: string; coherenceScore?: number; outletsInvolved?: string[]; slug?: string; }
interface Obfuscation { category: string; whatHappened: string; whyItMatters: string; whatsCoveringIt: string; whoBenefits: string; detectionConfidence: number; sourceUrl?: string; }
interface TickerItem { text: string; severity: 'high' | 'med' | 'low'; linkType?: 'story' | 'narrative'; linkRef?: string; }

// ─── Config ───

const CLASSIFY_BATCH_SIZE = 10;
const ANALYZE_BATCH_SIZE = 5;
const CLASSIFY_COUNT = 50;
const DEEP_ANALYZE_COUNT = 50;
const MAX_STORIES_TO_CACHE = 50;
const CACHE_TTL = 21600; // 6 hours

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

const ALL_FEEDS = [
  { url: 'https://feedx.net/rss/ap.xml', name: 'AP Top News' },
  { url: 'https://news.google.com/rss/search?q=site:apnews.com+politics&hl=en-US&gl=US&ceid=US:en', name: 'AP Politics' },
  { url: 'https://news.google.com/rss/search?q=site:apnews.com+business&hl=en-US&gl=US&ceid=US:en', name: 'AP Business' },
  { url: 'https://news.google.com/rss/search?q=site:reuters.com+world&hl=en-US&gl=US&ceid=US:en', name: 'Reuters World' },
  { url: 'https://news.google.com/rss/search?q=site:reuters.com+business&hl=en-US&gl=US&ceid=US:en', name: 'Reuters Business' },
  { url: 'https://news.google.com/rss/search?q=site:reuters.com+technology&hl=en-US&gl=US&ceid=US:en', name: 'Reuters Tech' },
  { url: 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en', name: 'Google News' },
  { url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en', name: 'Google News' },
  { url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en', name: 'Google News' },
  { url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en', name: 'Google News' },
  { url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en', name: 'Google News' },
  { url: 'https://www.reddit.com/r/news/.rss', name: 'Reddit r/news' },
  { url: 'https://www.reddit.com/r/politics/.rss', name: 'Reddit r/politics' },
  { url: 'https://www.reddit.com/r/worldnews/.rss', name: 'Reddit r/worldnews' },
  { url: 'https://www.reddit.com/r/conspiracy/.rss', name: 'Reddit r/conspiracy' },
];

async function fetchAllFeeds(): Promise<{ items: FeedItem[]; sourceErrors: number }> {
  const results = await Promise.allSettled(
    ALL_FEEDS.map((f) => fetchFeed(f.url, f.name))
  );
  const items: FeedItem[] = [];
  let sourceErrors = 0;
  for (const result of results) {
    if (result.status === 'fulfilled') items.push(...result.value);
    else { sourceErrors++; console.error('Feed fetch failed:', result.reason); }
  }
  return { items, sourceErrors };
}

// ─── Deduplication ───

function deduplicateStories(items: FeedItem[]): { unique: FeedItem[]; duplicates: number } {
  const unique: FeedItem[] = [];
  let duplicates = 0;
  for (const item of items) {
    let isDuplicate = false;
    for (const existing of unique) {
      if ((fuzzball as any).ratio(item.title.toLowerCase(), existing.title.toLowerCase()) >= 75) {
        isDuplicate = true;
        duplicates++;
        break;
      }
    }
    if (!isDuplicate) unique.push(item);
  }
  return { unique, duplicates };
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

function trimForCache(stories: Story[]): Story[] {
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

function buildClassifyPrompt(headline: string, summary: string, source: string): string {
  return `Classify this news story. Respond ONLY in JSON, no other text.

Headline: ${headline}
Summary: ${summary}
Source: ${source}

{
  "category": "<politics|tech|finance|world|science|deep-state>",
  "bias_tag": "<LEAN LEFT|LEAN RIGHT|ESTABLISHMENT|ANTI-ESTABLISHMENT|UNREPORTED|CENTER-ESTABLISHMENT>",
  "manipulation_index": <0-100>,
  "priority": "<high|medium|low>",
  "quick_take": "<1 provocative sentence>"
}`;
}

function buildAnalysisPrompt(headline: string, source: string, text: string, timestamp: string): { system: string; user: string } {
  return {
    system: SYSTEM_PROMPT,
    user: `STORY DATA:
- Headline: ${headline}
- Source(s): ${source}
- Full text: ${text}
- Publication time: ${timestamp}
- Related stories from other outlets: None available
- Concurrent government filings (same day): None available
- Social media sentiment: None available
- Entities mentioned: Auto-detect from text

GENERATE THE FOLLOWING (respond in JSON):

{
  "manipulation_index": <0-100 integer>,
  "manipulation_reasoning": "<1 sentence explaining the score>",
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

function buildObfuscationPrompt(headlines: string): { system: string; user: string } {
  return {
    system: `You are the NewsReal.ai Obfuscation Detector. Your job is to identify stories that are being BURIED by the current news cycle. Respond ONLY in valid JSON.`,
    user: `INPUTS:
- Today's top headlines across all major outlets:
${headlines}

- Today's Federal Register filings: Not available this cycle
- Today's congressional actions: Not available this cycle
- Today's SEC filings: Not available this cycle
- Today's federal contract awards: Not available this cycle
- Today's court filings of note: Not available this cycle

TASK:
Identify 3-5 government/regulatory actions that likely received ZERO or minimal mainstream coverage today. For each, explain what happened, why it matters, what dominated the news instead, who benefits, and your confidence level. Speculate boldly based on patterns you know about — timing of filings, typical regulatory behavior, and what types of actions get buried during big news cycles.

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
      "source_url": ""
    }
  ]
}`,
  };
}

function buildNarrativePrompt(headlines: string): { system: string; user: string } {
  return {
    system: `You are the NewsReal.ai Narrative Tracker. You detect coordinated messaging patterns across media outlets. Respond ONLY in valid JSON.`,
    user: `Analyze the following headlines from the past 6 hours across all major outlets.

${headlines}

Identify:
1. COORDINATED LANGUAGE: Are 3+ outlets using identical or near-identical phrasing?
2. SYNCHRONIZED TIMING: Did multiple outlets publish similar stories within the same window?
3. NARRATIVE FRAMES: What are the dominant frames being pushed, and what alternative frames are being suppressed?
4. MISSING PERSPECTIVES: What obvious angles are NO outlets covering?

Respond in JSON:
{
  "narratives": [
    {
      "narrative_text": "<description using <strong>bold</strong> HTML for key terms>",
      "coherence_score": <0-100>,
      "outlets_involved": ["outlet1", "outlet2"]
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
  const prompt = buildClassifyPrompt(item.title, item.contentSnippet || item.content || '', item.source);
  const raw = await classifyWithHaiku(prompt);
  if (!raw) return null;
  const parsed = parseClaudeJSON<Classification>(raw);
  if (!parsed) { console.error('Failed to parse classification:', raw.slice(0, 200)); return null; }
  const valid: Category[] = ['politics', 'tech', 'finance', 'world', 'science', 'deep-state'];
  if (!valid.includes(parsed.category)) parsed.category = 'world';
  return parsed;
}

async function analyzeStory(item: FeedItem, classification: Classification): Promise<AnalysisResult | null> {
  const { system, user } = buildAnalysisPrompt(
    item.title, item.source,
    item.contentSnippet || item.content || 'Full text not available — analyze based on headline and source.',
    item.pubDate
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

  // Step 2: Deduplicate
  console.log('Step 2: Deduplicating...');
  const { unique, duplicates } = deduplicateStories(allItems);
  stats.unique = unique.length;
  stats.duplicates = duplicates;
  console.log(`  ${unique.length} unique, ${duplicates} duplicates`);

  // Step 3: Classify with Haiku
  const toClassify = unique.slice(0, CLASSIFY_COUNT);
  console.log(`Step 3: Classifying ${toClassify.length} stories with Haiku...`);
  const classificationResults = await batchProcess(toClassify, classifyStory, CLASSIFY_BATCH_SIZE);

  const classified: { item: FeedItem; classification: Classification }[] = [];
  for (let i = 0; i < classificationResults.length; i++) {
    if (classificationResults[i]) classified.push({ item: toClassify[i], classification: classificationResults[i]! });
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  classified.sort((a, b) => {
    const pDiff = priorityOrder[a.classification.priority] - priorityOrder[b.classification.priority];
    return pDiff !== 0 ? pDiff : b.classification.manipulation_index - a.classification.manipulation_index;
  });
  stats.classified = classified.length;
  console.log(`  Classified ${classified.length} stories`);

  // Step 4: Deep-analyze with Sonnet
  const toAnalyze = classified.slice(0, DEEP_ANALYZE_COUNT);
  console.log(`Step 4: Deep-analyzing ${toAnalyze.length} stories with Sonnet...`);
  const analysisResults = await batchProcess(toAnalyze, (c) => analyzeStory(c.item, c.classification), ANALYZE_BATCH_SIZE);

  const analysisMap = new Map<number, AnalysisResult>();
  for (let i = 0; i < analysisResults.length; i++) {
    if (analysisResults[i]) analysisMap.set(i, analysisResults[i]!);
  }
  stats.analyzed = analysisMap.size;
  console.log(`  Analyzed ${analysisMap.size} stories`);

  // Step 5: Build Story objects
  const stories: Story[] = classified.map((c, i) => feedItemToStory(c.item, c.classification, analysisMap.get(i) ?? null, i));

  // Step 6: Sidebar data
  console.log('Step 6: Generating sidebar data...');
  const headlines = classified.slice(0, 20).map((c) => `[${c.item.source}] ${c.item.title}`);
  const headlineText = headlines.map((h, i) => `${i + 1}. ${h}`).join('\n');

  const obfuscationPrompt = buildObfuscationPrompt(headlineText);
  const narrativePrompt = buildNarrativePrompt(headlineText);

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
    }));
  })();

  const narratives: Narrative[] = (() => {
    if (!narrativesRaw) return [];
    const parsed = parseClaudeJSON<{ narratives: any[] }>(narrativesRaw);
    if (!parsed?.narratives) return [];
    return parsed.narratives.map((n: any) => ({
      text: n.narrative_text, heat: generateHeatBar(n.coherence_score),
      coherenceScore: n.coherence_score, outletsInvolved: n.outlets_involved,
      slug: slugify(String(n.narrative_text).replace(/<[^>]*>/g, '')),
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

  // Step 7: Store in DynamoDB
  console.log('Step 7: Storing to DynamoDB...');
  const storeResults = await Promise.allSettled(
    stories.slice(0, 20).map((story) =>
      putStory({ ...story, id: story.slug, summary: story.summary.slice(0, 500), publishedAt: new Date().toISOString() })
    )
  );
  stats.stored = storeResults.filter((r) => r.status === 'fulfilled').length;

  // Step 8: Cache everything
  console.log('Step 8: Caching page data...');
  await Promise.allSettled([
    setCached('homepage-stories', trimForCache(stories), CACHE_TTL),
    setCached('homepage-narratives', narratives, CACHE_TTL),
    setCached('homepage-obfuscations', obfuscations, CACHE_TTL),
    setCached('homepage-ticker', tickerItems, CACHE_TTL),
    setCached('homepage-suppressed', suppressedSearches, CACHE_TTL),
    setCached('pipeline-last-run', Date.now(), CACHE_TTL),
  ]);

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
