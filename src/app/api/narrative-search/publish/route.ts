import { NextResponse } from 'next/server';
import { setCached } from '@/lib/cache';
import { putNarrative } from '@/lib/db';
import { NarrativeAnalysis } from '@/types';

export const dynamic = 'force-dynamic';

const PUBLISH_TTL = 60 * 60 * 24 * 30; // 30 days

export async function POST(request: Request) {
  let body: { narrative?: NarrativeAnalysis };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const narrative = body.narrative;
  if (!narrative || !narrative.slug || !narrative.narrativeText) {
    return NextResponse.json({ error: 'Missing narrative data' }, { status: 400 });
  }

  try {
    // The /narrative/[slug] page reads this cache key.
    await setCached(`narrative-analysis:${narrative.slug}`, narrative, PUBLISH_TTL);
    await putNarrative({ ...narrative, id: narrative.slug, userSubmitted: true });

    return NextResponse.json({ success: true, slug: narrative.slug });
  } catch {
    return NextResponse.json({ error: 'Failed to publish' }, { status: 500 });
  }
}
