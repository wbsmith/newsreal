import { NextResponse } from 'next/server';
import { MOCK_STORIES } from '@/lib/mock-data';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  let stories = MOCK_STORIES;
  if (category && category !== 'all') {
    stories = stories.filter((s) => s.category === category);
  }

  return NextResponse.json({ stories, source: 'mock' });
}
