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

function buildOgImageUrl(story: Story): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.newsreal.ai';
  const params = new URLSearchParams({
    headline: story.headline,
    bias: story.biasTag.label,
    score: String(story.manipulationScore),
    source: story.source,
  });
  return `${base}/api/og?${params.toString()}`;
}

export async function generateMetadata({ params }: StoryPageProps) {
  const { slug } = await params;
  const story = await findStory(slug);
  if (!story) return { title: 'Story Not Found' };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.newsreal.ai';
  const canonicalUrl = `${siteUrl}/story/${slug}`;
  const ogImageUrl = buildOgImageUrl(story);

  return {
    title: `${story.headline} — NewsReal.ai`,
    description: story.summary,
    openGraph: {
      title: story.headline,
      description: story.summary,
      url: canonicalUrl,
      siteName: 'NewsReal.ai',
      type: 'article',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: story.headline,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: story.headline,
      description: story.summary,
      images: [ogImageUrl],
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { slug } = await params;
  const story = await findStory(slug);
  if (!story) notFound();
  return <StoryDetailClient story={story} />;
}
