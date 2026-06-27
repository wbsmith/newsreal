import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createHash } from 'crypto';
import { fetchFeed } from '@/lib/ingestion/rss-parser';
import { analyze } from '@/lib/llm';
import { getCached, setCached } from '@/lib/cache';
import { slugify, parseClaudeJSON } from '@/lib/utils';
import { splitGoogleNewsTitle, repeatedPhrases, stripHtml } from '@/lib/analysis/narrative-cluster';
import { NarrativeAnalysis, SourceArticle } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const RATE_LIMIT = 25;
const RATE_LIMIT_TTL = 86400; // 24 hours
const GNEWS_SEARCH = 'https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q=';
const MIN_ARTICLES = 5; // below this there's no "dominant narrative" to read

function rateLimitKey(ip: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const hash = createHash('sha256').update(ip).digest('hex').slice(0, 12);
  return `ratelimit:narrative-search:${hash}:${date}`;
}

interface NarrativeLLMResult {
  coherence_score: number;
  narrative_text: string;
  narrative_origin: string;
  coordination_evidence: string;
  who_benefits: string;
  suppressed_alternative: string;
}

function buildPrompt(term: string, headlineList: string, evidence: string, outletCount: number) {
  const system =
    'You are the NewsReal.ai Narrative Tracker. You detect coordinated messaging ' +
    'patterns across media outlets — shared phrasing, uniform framing, and ' +
    'manufactured consensus. Be provocative and specific. Respond ONLY in valid ' +
    'JSON, no markdown.';

  const user = `A user asked for a dominant-narrative read on the search term: "${term}".

Below are recent news headlines matching that term (${outletCount} distinct outlets), followed by the multi-word phrases that recur across them — the empirical "identical terms" signal.

HEADLINES:
${headlineList}

REPEATED PHRASES (phrase — # of headlines using it):
${evidence || '(no strongly repeated phrases detected)'}

Score how coherent/coordinated this narrative is (0-100) using: lexical alignment (shared keywords/phrases), frame uniformity (same interpretive lens), source convergence (same cited actors), and counter-narrative absence (lack of dissent). Higher = more coordinated/manufactured.

Respond in JSON:
{
  "coherence_score": <0-100>,
  "narrative_text": "<the dominant narrative in one punchy sentence, as a headline>",
  "narrative_origin": "<where/how this framing originated and how it propagated across outlets>",
  "coordination_evidence": "<cite the specific repeated phrases and outlet behavior that show coordination or wire-service dependence>",
  "who_benefits": "<who benefits from this framing dominating. Name names, follow the money/incentives.>",
  "suppressed_alternative": "<the framing or facts being crowded out by this narrative>"
}`;

  return { system, user };
}

export async function POST(request: Request) {
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rlKey = rateLimitKey(ip);

  const count = await getCached<number>(rlKey);
  if (count !== null && count >= RATE_LIMIT) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Maximum 25 narrative builds per day.' },
      { status: 429 }
    );
  }

  let body: { term?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const term = body.term?.trim();
  if (!term || term.length < 3) {
    return NextResponse.json({ error: 'Provide a search term of at least 3 characters' }, { status: 400 });
  }

  try {
    // 1. Fetch fresh cross-outlet coverage for the term.
    const url = `${GNEWS_SEARCH}${encodeURIComponent(term)}`;
    let items;
    try {
      items = await fetchFeed(url, 'Google News');
    } catch {
      return NextResponse.json({ error: 'Failed to fetch news for that term. Try again.' }, { status: 502 });
    }

    // Dedupe by link, parse out the real publisher.
    const byLink = new Map<string, { title: string; outlet: string | null; link: string }>();
    for (const it of items) {
      if (!it.link || byLink.has(it.link)) continue;
      const { title, outlet } = splitGoogleNewsTitle(it.title);
      if (title) byLink.set(it.link, { title, outlet, link: it.link });
    }
    const articles = [...byLink.values()];

    if (articles.length < MIN_ARTICLES) {
      return NextResponse.json(
        { error: `Only ${articles.length} article(s) found for "${term}" — not enough for a dominant-narrative read.` },
        { status: 404 }
      );
    }

    // 2. Quantify the coordination signal.
    const outlets = [...new Set(articles.map((a) => a.outlet).filter((o): o is string => !!o))];
    const phrases = repeatedPhrases(articles.map((a) => a.title));
    const headlineList = articles
      .slice(0, 50)
      .map((a, i) => `${i + 1}. [${a.outlet ?? 'unknown'}] ${a.title}`)
      .join('\n');
    const evidence = phrases.map((p) => `"${p.phrase}" — ${p.count} headlines`).join('\n');

    // 3. Generate the narrative read.
    const { system, user } = buildPrompt(term, headlineList, evidence, outlets.length);
    const raw = await analyze(system, user);
    if (!raw) {
      return NextResponse.json({ error: 'Narrative generation failed. Try again.' }, { status: 500 });
    }
    const parsed = parseClaudeJSON<NarrativeLLMResult>(raw);
    if (!parsed || !parsed.narrative_text) {
      return NextResponse.json({ error: 'Narrative generation returned no usable result.' }, { status: 500 });
    }

    const relatedStories: SourceArticle[] = articles.slice(0, 10).map((a) => ({
      slug: '', // external article, not an internal story
      headline: stripHtml(a.title),
      sourceUrl: a.link,
      source: a.outlet ?? undefined,
    }));

    const coherence = Math.max(0, Math.min(100, Math.round(parsed.coherence_score ?? 0)));
    // Strip HTML from all model-generated text — it's plain prose, and stray tags
    // would be a stored-XSS vector (narrativeText renders via
    // dangerouslySetInnerHTML) and trip the WAF on publish.
    const narrative: NarrativeAnalysis = {
      slug: slugify(term) || 'narrative',
      narrativeText: stripHtml(parsed.narrative_text),
      coherenceScore: coherence,
      outletsInvolved: outlets.map(stripHtml),
      analysisDate: new Date().toISOString(),
      narrativeOrigin: stripHtml(parsed.narrative_origin ?? ''),
      coordinationEvidence: stripHtml(parsed.coordination_evidence || evidence),
      whoBenefits: stripHtml(parsed.who_benefits ?? ''),
      suppressedAlternative: stripHtml(parsed.suppressed_alternative ?? ''),
      relatedStories,
    };

    await setCached(rlKey, (count ?? 0) + 1, RATE_LIMIT_TTL);

    return NextResponse.json({ narrative, articleCount: articles.length, phrases });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Narrative build failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
