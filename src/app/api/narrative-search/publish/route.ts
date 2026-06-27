import { NextResponse } from 'next/server';
import { setCached } from '@/lib/cache';
import { putNarrative } from '@/lib/db';
import { stripHtml } from '@/lib/analysis/narrative-cluster';
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

  // Sanitize before storing — narrativeText renders via dangerouslySetInnerHTML,
  // so never persist raw tags (stored-XSS), even if a client posts them directly.
  const clean: NarrativeAnalysis = {
    ...narrative,
    narrativeText: stripHtml(narrative.narrativeText),
    narrativeOrigin: stripHtml(narrative.narrativeOrigin ?? ''),
    coordinationEvidence: stripHtml(narrative.coordinationEvidence ?? ''),
    whoBenefits: stripHtml(narrative.whoBenefits ?? ''),
    suppressedAlternative: stripHtml(narrative.suppressedAlternative ?? ''),
    outletsInvolved: (narrative.outletsInvolved ?? []).map(stripHtml),
    relatedStories: (narrative.relatedStories ?? []).map((s) => ({ ...s, headline: stripHtml(s.headline) })),
  };

  try {
    // The /narrative/[slug] page reads this cache key.
    await setCached(`narrative-analysis:${clean.slug}`, clean, PUBLISH_TTL);
    await putNarrative({ ...clean, id: clean.slug, userSubmitted: true });

    return NextResponse.json({ success: true, slug: clean.slug });
  } catch {
    return NextResponse.json({ error: 'Failed to publish' }, { status: 500 });
  }
}
