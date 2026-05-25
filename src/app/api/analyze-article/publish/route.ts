import { NextResponse } from 'next/server';
import { putStory } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: { story: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.story || !body.story.slug) {
    return NextResponse.json({ error: 'Missing story data' }, { status: 400 });
  }

  try {
    // Store with id = slug for DynamoDB key
    const storyToStore = {
      ...body.story,
      id: body.story.slug,
      publishedAt: new Date().toISOString(),
      userSubmitted: true,
    };

    await putStory(storyToStore);

    return NextResponse.json({ success: true, slug: body.story.slug });
  } catch {
    return NextResponse.json({ error: 'Failed to publish' }, { status: 500 });
  }
}
