import { notFound } from 'next/navigation';
import { getCached } from '@/lib/cache';
import { MOCK_STORIES } from '@/lib/mock-data';
import { Story } from '@/types';
import StoryDetailClient from './StoryDetailClient';

export const revalidate = 3600;

interface StoryPageProps {
  params: Promise<{ slug: string }>;
}

async function findStory(slug: string): Promise<Story | undefined> {
  // Try cache first
  try {
    const cached = await getCached<Story[]>('homepage-stories');
    if (cached) {
      const found = cached.find((s) => s.slug === slug);
      if (found) return found;
    }
  } catch {
    // Cache miss — continue to fallback
  }

  // Fall back to mock data
  return MOCK_STORIES.find((s) => s.slug === slug);
}

export async function generateMetadata({ params }: StoryPageProps) {
  const { slug } = await params;
  const story = await findStory(slug);
  if (!story) return { title: 'Story Not Found' };
  return {
    title: `${story.headline} \u2014 NewsReal.ai`,
    description: story.summary,
  };
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { slug } = await params;
  const story = await findStory(slug);
  if (!story) notFound();
  return <StoryDetailClient story={story} />;
}
