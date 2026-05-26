import { NextRequest, NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/cache';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

interface VoteData {
  up: number;
  down: number;
  voters: Record<string, 'up' | 'down'>;
}

const VOTE_TTL = 30 * 86400; // 30 days

function fingerprint(request: NextRequest): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const ua = request.headers.get('user-agent') || 'unknown';
  return createHash('sha256').update(`${ip}:${ua}:newsreal-vote`).digest('hex').slice(0, 16);
}

export async function GET() {
  const votes = await getCached<Record<string, { up: number; down: number }>>('story-votes') || {};
  return NextResponse.json(votes);
}

export async function POST(request: NextRequest) {
  const fp = fingerprint(request);
  const body = await request.json();
  const { slug, direction } = body as { slug: string; direction: 'up' | 'down' };

  if (!slug || !['up', 'down'].includes(direction)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const key = `votes:${slug}`;
  const data = await getCached<VoteData>(key) || { up: 0, down: 0, voters: {} };

  const prev = data.voters[fp];
  if (prev === direction) {
    // Toggle off — undo the vote
    data[direction]--;
    delete data.voters[fp];
  } else {
    if (prev) data[prev]--; // undo previous opposite vote
    data[direction]++;
    data.voters[fp] = direction;
  }

  await setCached(key, data, VOTE_TTL);

  // Update the summary cache (lightweight, no voter details)
  const summary = await getCached<Record<string, { up: number; down: number }>>('story-votes') || {};
  summary[slug] = { up: data.up, down: data.down };
  await setCached('story-votes', summary, VOTE_TTL);

  // Upvoted stories get share-protection
  if (data.up > 0) {
    const date = new Date().toISOString().slice(0, 10);
    const analyticsKey = `analytics:${date}`;
    const analytics = await getCached<{ shares: Record<string, number> }>(analyticsKey);
    if (analytics) {
      analytics.shares[`story:${slug}`] = (analytics.shares[`story:${slug}`] || 0);
      if (!analytics.shares[`story:${slug}`]) analytics.shares[`story:${slug}`] = 1;
      await setCached(analyticsKey, analytics, 365 * 86400);
    }
  }

  return NextResponse.json({ slug, up: data.up, down: data.down, userVote: data.voters[fp] || null });
}
