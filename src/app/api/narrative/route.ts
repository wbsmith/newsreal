import { NextRequest, NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/cache';
import { analyzeWithSonnet } from '@/lib/claude';
import { buildNarrativeAnalysisPrompt } from '@/lib/analysis/prompts';
import { parseClaudeJSON } from '@/lib/utils';
import { Narrative, NarrativeAnalysis, Story } from '@/types';

interface NarrativeAnalysisRaw {
  narrative_origin: string;
  coordination_evidence: string;
  who_benefits: string;
  suppressed_alternative: string;
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 });
  }

  const cacheKey = `narrative-analysis:${slug}`;

  // 1. Check cache
  const cached = await getCached<NarrativeAnalysis>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  // 2. Find the narrative from homepage cache
  const narratives = await getCached<Narrative[]>('homepage-narratives');
  const narrative = narratives?.find((n) => n.slug === slug);

  if (!narrative) {
    return NextResponse.json({ error: 'Narrative not found' }, { status: 404 });
  }

  // 3. Find related stories from homepage cache
  const stories = await getCached<Story[]>('homepage-stories');
  const relatedStories = (stories || []).slice(0, 10).map((s) => ({
    slug: s.slug,
    headline: s.headline,
  }));

  // 4. Send to Sonnet for analysis
  const plainText = narrative.text.replace(/<[^>]*>/g, '');
  const { system, user } = buildNarrativeAnalysisPrompt(
    plainText,
    narrative.coherenceScore || 0,
    narrative.outletsInvolved || [],
    relatedStories
  );

  const raw = await analyzeWithSonnet(system, user);
  if (!raw) {
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }

  const parsed = parseClaudeJSON<NarrativeAnalysisRaw>(raw);
  if (!parsed) {
    return NextResponse.json({ error: 'Failed to parse analysis' }, { status: 500 });
  }

  // 5. Build response
  const analysis: NarrativeAnalysis = {
    slug,
    narrativeText: narrative.text,
    coherenceScore: narrative.coherenceScore || 0,
    outletsInvolved: narrative.outletsInvolved || [],
    analysisDate: new Date().toISOString(),
    narrativeOrigin: parsed.narrative_origin,
    coordinationEvidence: parsed.coordination_evidence,
    whoBenefits: parsed.who_benefits,
    suppressedAlternative: parsed.suppressed_alternative,
    relatedStories,
  };

  // 6. Cache for 24 hours (on-demand analysis tied to specific slugs)
  await setCached(cacheKey, analysis, 86400);

  return NextResponse.json(analysis);
}
