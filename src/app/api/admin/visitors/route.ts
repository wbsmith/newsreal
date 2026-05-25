import { NextRequest, NextResponse } from 'next/server';
import { getCached } from '@/lib/cache';

export const dynamic = 'force-dynamic';

interface VisitorRecord {
  ip: string;
  userAgent: string;
  path: string;
  referrer: string;
  timestamp: string;
}

interface DailyVisitors {
  visits: VisitorRecord[];
}

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const visitors = await getCached<DailyVisitors>(`visitors:${date}`);

    return NextResponse.json({
      date,
      visits: visitors?.visits || [],
      total: visitors?.visits?.length || 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load visitors' },
      { status: 500 }
    );
  }
}
