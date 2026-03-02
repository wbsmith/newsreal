import { NextRequest, NextResponse } from 'next/server';
import { getCached } from '@/lib/cache';
import { NarrativeAnalysis } from '@/types';

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 });
  }

  const cacheKey = `narrative-analysis:${slug}`;
  const cached = await getCached<NarrativeAnalysis>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  return NextResponse.json({ error: 'Analysis not yet available — check back after the next pipeline run' }, { status: 404 });
}
