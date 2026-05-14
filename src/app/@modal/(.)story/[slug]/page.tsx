import { getStory } from '@/lib/db';
import { Story } from '@/types';
import StoryRouteModal from '@/components/StoryRouteModal';
import { notFound } from 'next/navigation';

export const revalidate = 3600;

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function InterceptedStoryModal({ params }: Props) {
  const { slug } = await params;
  const story = (await getStory(slug)) as unknown as Story | null;
  if (!story) notFound();
  return <StoryRouteModal story={story} />;
}
