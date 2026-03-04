import { NextRequest, NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/cache';
import { createHash } from 'crypto';

interface DailyAnalytics {
  pageviews: number;
  uniqueIPs: string[];
  storyViews: Record<string, number>;
  shares: Record<string, number>;
  topPages: Record<string, number>;
}

const ANALYTICS_TTL = 365 * 86400; // 1 year
const MAX_UNIQUE_IPS = 10000;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function hashIP(ip: string, date: string): string {
  return createHash('sha256').update(`${ip}:${date}:newsreal-salt`).digest('hex').slice(0, 16);
}

// Simple in-memory rate limiter
const rateLimiter = new Map<string, number>();
setInterval(() => rateLimiter.clear(), 60000);

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  // Rate limit: 30 requests per minute per IP
  const count = rateLimiter.get(ip) || 0;
  if (count > 30) {
    return NextResponse.json({ ok: true }, { status: 200 }); // Silent drop
  }
  rateLimiter.set(ip, count + 1);

  try {
    const body = await request.json();
    const date = today();
    const cacheKey = `analytics:${date}`;

    const current = await getCached<DailyAnalytics>(cacheKey) || {
      pageviews: 0,
      uniqueIPs: [],
      storyViews: {},
      shares: {},
      topPages: {},
    };

    const ipHash = hashIP(ip, date);

    if (body.event === 'share' && body.slug) {
      current.shares[body.slug] = (current.shares[body.slug] || 0) + 1;
    } else {
      current.pageviews++;

      if (!current.uniqueIPs.includes(ipHash) && current.uniqueIPs.length < MAX_UNIQUE_IPS) {
        current.uniqueIPs.push(ipHash);
      }

      if (body.path) {
        current.topPages[body.path] = (current.topPages[body.path] || 0) + 1;

        // Track story views by slug
        const storyMatch = body.path.match(/^\/story\/(.+)$/);
        if (storyMatch) {
          const slug = storyMatch[1];
          current.storyViews[slug] = (current.storyViews[slug] || 0) + 1;
        }
      }
    }

    await setCached(cacheKey, current, ANALYTICS_TTL);

    // Update days manifest
    const manifest = await getCached<string[]>('analytics-days') || [];
    if (!manifest.includes(date)) {
      manifest.unshift(date);
      if (manifest.length > 90) manifest.length = 90;
      await setCached('analytics-days', manifest, ANALYTICS_TTL);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
