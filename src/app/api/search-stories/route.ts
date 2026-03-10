import { NextResponse } from 'next/server';
import { searchStories } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 3) {
    return NextResponse.json(
      { error: 'Query must be at least 3 characters' },
      { status: 400 }
    );
  }

  try {
    const results = await searchStories(q, 20);
    return NextResponse.json({ results, total: results.length });
  } catch {
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
