import { NextRequest, NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/cache';
import { fetchFeed } from '@/lib/ingestion/rss-parser';
import { analyzeWithSonnet } from '@/lib/claude';
import { buildSearchAnalysisPrompt } from '@/lib/analysis/prompts';
import { parseClaudeJSON } from '@/lib/utils';
import { SearchAnalysis } from '@/types';

interface SearchAnalysisRaw {
  media_pattern: string;
  whats_revealed: string;
  whats_missing: string;
  connection_map: string;
  why_its_suppressed: string;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');
  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
  }

  const cacheKey = `suppressed-search:${query}`;

  // 1. Check cache
  const cached = await getCached<SearchAnalysis>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  // 2. Fetch Google News RSS for this query
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

  let feedItems;
  try {
    feedItems = await fetchFeed(rssUrl, 'Google News');
  } catch (err) {
    console.error('Failed to fetch Google News RSS:', err);
    return NextResponse.json({ error: 'Failed to fetch search results' }, { status: 502 });
  }

  if (feedItems.length === 0) {
    return NextResponse.json({ error: 'No search results found' }, { status: 404 });
  }

  // 3. Take top 15 results and format for analysis
  const topResults = feedItems.slice(0, 15).map((item) => ({
    title: item.title,
    source: item.source,
    link: item.link,
    snippet: item.contentSnippet || item.content || '',
  }));

  // 4. Send to Sonnet for analysis
  const { system, user } = buildSearchAnalysisPrompt(query, topResults);
  const raw = await analyzeWithSonnet(system, user);

  if (!raw) {
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }

  const parsed = parseClaudeJSON<SearchAnalysisRaw>(raw);
  if (!parsed) {
    return NextResponse.json({ error: 'Failed to parse analysis' }, { status: 500 });
  }

  // 5. Build response
  const analysis: SearchAnalysis = {
    query,
    resultCount: feedItems.length,
    analysisDate: new Date().toISOString(),
    mediaPattern: parsed.media_pattern,
    whatsRevealed: parsed.whats_revealed,
    whatsMissing: parsed.whats_missing,
    connectionMap: parsed.connection_map,
    whyItsSuppressed: parsed.why_its_suppressed,
    searchResults: topResults,
  };

  // 6. Cache for 24 hours (on-demand analysis tied to specific queries)
  await setCached(cacheKey, analysis, 86400);

  return NextResponse.json(analysis);
}
