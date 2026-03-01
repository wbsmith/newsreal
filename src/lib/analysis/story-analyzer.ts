import { FeedItem } from '@/lib/ingestion/rss-parser';
import { classifyWithHaiku, analyzeWithSonnet } from '@/lib/claude';
import { slugify, relativeTime, mapBiasTag, parseClaudeJSON } from '@/lib/utils';
import {
  Story,
  Category,
  Narrative,
  Obfuscation,
  TickerItem,
  DeepDive,
} from '@/types';
import {
  buildQuickClassificationPrompt,
  buildStoryAnalysisPrompt,
  buildObfuscationPrompt,
  buildNarrativeTrackerPrompt,
  buildTickerPrompt,
  buildSuppressedSearchesPrompt,
} from './prompts';

// ─── Types ───

export interface Classification {
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

interface ObfuscationResult {
  obfuscations: {
    category: string;
    what_happened: string;
    why_it_matters: string;
    whats_covering_it: string;
    who_benefits: string;
    detection_confidence: number;
    source_url?: string;
  }[];
}

interface NarrativeResult {
  narratives: {
    narrative_text: string;
    coherence_score: number;
    outlets_involved?: string[];
  }[];
}

interface TickerResult {
  ticker_items: {
    text: string;
    severity: 'high' | 'med' | 'low';
    link_type?: 'story' | 'narrative' | null;
    link_ref?: string | null;
  }[];
}

interface SuppressedResult {
  suppressed_searches: string[];
}

// ─── Classification (Haiku — cheap) ───

export async function classifyStory(item: FeedItem): Promise<Classification | null> {
  const prompt = buildQuickClassificationPrompt(
    item.title,
    item.contentSnippet || item.content || '',
    item.source
  );

  const raw = await classifyWithHaiku(prompt);
  if (!raw) return null;

  const parsed = parseClaudeJSON<Classification>(raw);
  if (!parsed) {
    console.error('Failed to parse Haiku classification:', raw.slice(0, 200));
    return null;
  }

  // Normalize category
  const validCategories: Category[] = ['politics', 'tech', 'finance', 'world', 'science', 'deep-state'];
  if (!validCategories.includes(parsed.category)) {
    parsed.category = 'world';
  }

  return parsed;
}

// ─── Deep Analysis (Sonnet — expensive) ───

export async function analyzeStory(
  item: FeedItem,
  classification: Classification
): Promise<AnalysisResult | null> {
  const { system, user } = buildStoryAnalysisPrompt(
    item.title,
    item.source,
    item.contentSnippet || item.content || 'Full text not available — analyze based on headline and source.',
    item.pubDate
  );

  const raw = await analyzeWithSonnet(system, user);
  if (!raw) return null;

  const parsed = parseClaudeJSON<AnalysisResult>(raw);
  if (!parsed) {
    console.error('Failed to parse Sonnet analysis:', raw.slice(0, 200));
    return null;
  }

  return parsed;
}

// ─── Obfuscation Index ───

export async function generateObfuscationIndex(headlines: string[]): Promise<Obfuscation[]> {
  const headlineText = headlines.map((h, i) => `${i + 1}. ${h}`).join('\n');
  const { system, user } = buildObfuscationPrompt(headlineText);

  const raw = await analyzeWithSonnet(system, user);
  if (!raw) return [];

  const parsed = parseClaudeJSON<ObfuscationResult>(raw);
  if (!parsed?.obfuscations) return [];

  return parsed.obfuscations.map((o) => ({
    category: o.category,
    whatHappened: o.what_happened,
    whyItMatters: o.why_it_matters,
    whatsCoveringIt: o.whats_covering_it,
    whoBenefits: o.who_benefits,
    detectionConfidence: o.detection_confidence,
    sourceUrl: o.source_url || undefined,
  }));
}

// ─── Narrative Tracker ───

export async function generateNarratives(headlines: string[]): Promise<Narrative[]> {
  const headlineText = headlines.map((h, i) => `${i + 1}. ${h}`).join('\n');
  const { system, user } = buildNarrativeTrackerPrompt(headlineText);

  const raw = await analyzeWithSonnet(system, user);
  if (!raw) return [];

  const parsed = parseClaudeJSON<NarrativeResult>(raw);
  if (!parsed?.narratives) return [];

  return parsed.narratives.map((n) => ({
    text: n.narrative_text,
    heat: generateHeatBar(n.coherence_score),
    coherenceScore: n.coherence_score,
    outletsInvolved: n.outlets_involved,
    slug: slugify(n.narrative_text.replace(/<[^>]*>/g, '')),
  }));
}

function generateHeatBar(score: number): string {
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  return '\u2593'.repeat(filled) + '\u2591'.repeat(empty) + ` ${score}%`;
}

// ─── Ticker Items ───

export async function generateTickerItems(
  stories: string[],
  narratives: string[],
  obfuscations: string[],
  storySlugs: { slug: string; headline: string }[] = [],
  narrativeSlugs: { slug: string; text: string }[] = []
): Promise<TickerItem[]> {
  const { system, user } = buildTickerPrompt(
    stories.join('; '),
    narratives.join('; '),
    obfuscations.join('; '),
    storySlugs,
    narrativeSlugs
  );

  const raw = await analyzeWithSonnet(system, user);
  if (!raw) return [];

  const parsed = parseClaudeJSON<TickerResult>(raw);
  if (!parsed?.ticker_items) return [];

  return parsed.ticker_items.map((item) => ({
    text: item.text,
    severity: item.severity,
    linkType: item.link_type || undefined,
    linkRef: item.link_ref || undefined,
  }));
}

// ─── Suppressed Searches ───

export async function generateSuppressedSearches(
  stories: string[],
  obfuscations: string[]
): Promise<string[]> {
  const { system, user } = buildSuppressedSearchesPrompt(
    stories.join('; '),
    obfuscations.join('; ')
  );

  const raw = await analyzeWithSonnet(system, user);
  if (!raw) return [];

  const parsed = parseClaudeJSON<SuppressedResult>(raw);
  if (!parsed?.suppressed_searches) return [];

  return parsed.suppressed_searches;
}

// ─── Feed Item → Story Mapper ───

export function feedItemToStory(
  item: FeedItem,
  classification: Classification,
  analysis: AnalysisResult | null,
  index: number
): Story {
  const deepDive: DeepDive = analysis
    ? {
        mainstream: analysis.mainstream_frame,
        realStory: analysis.real_story,
        leftSpin: analysis.left_spin,
        rightSpin: analysis.right_spin,
        whosBenefiting: analysis.who_benefits,
        whatsHidden: analysis.whats_hidden,
      }
    : {
        mainstream: 'Full analysis not yet generated for this story.',
        realStory: classification.quick_take,
        leftSpin: 'Deep analysis pending.',
        rightSpin: 'Deep analysis pending.',
        whosBenefiting: 'Deep analysis pending.',
        whatsHidden: 'Deep analysis pending.',
      };

  return {
    id: index + 1,
    slug: slugify(item.title),
    category: classification.category,
    featured: index === 0,
    source: item.source.toUpperCase(),
    sourceUrl: item.link,
    time: relativeTime(item.pubDate),
    headline: item.title,
    summary: (item.contentSnippet || item.content || classification.quick_take).slice(0, 500),
    biasTag: mapBiasTag(classification.bias_tag),
    manipulationScore: analysis?.manipulation_index ?? classification.manipulation_index,
    realAnalysis: analysis?.quick_take ?? classification.quick_take,
    deepDive,
  };
}
