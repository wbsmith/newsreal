import { notFound } from 'next/navigation';
import { MOCK_STORIES } from '@/lib/mock-data';
import StoryDetailClient from './StoryDetailClient';

interface StoryPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return MOCK_STORIES.map((story) => ({ slug: story.slug }));
}

export async function generateMetadata({ params }: StoryPageProps) {
  const { slug } = await params;
  const story = MOCK_STORIES.find((s) => s.slug === slug);
  if (!story) return { title: 'Story Not Found' };
  return {
    title: `${story.headline} \u2014 NewsReal.ai`,
    description: story.summary,
  };
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { slug } = await params;
  const story = MOCK_STORIES.find((s) => s.slug === slug);
  if (!story) notFound();
  return <StoryDetailClient story={story} />;
}
