import { NextRequest, NextResponse } from 'next/server';
import { getCached } from '@/lib/cache';
import { SearchAnalysis } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');
  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
  }

  const cacheKey = `suppressed-search:${query}`;
  const cached = await getCached<SearchAnalysis>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  return NextResponse.json({ error: 'Analysis not yet available — check back after the next pipeline run' }, { status: 404 });
}
