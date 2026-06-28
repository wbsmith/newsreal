import { notFound } from 'next/navigation';
import { getStory } from '@/lib/db';
import { Story } from '@/types';
import { stripRedaction } from '@/lib/utils';
import StoryDetailClient from './StoryDetailClient';

export const revalidate = 3600;

interface StoryPageProps {
  params: Promise<{ slug: string }>;
}

async function findStory(slug: string): Promise<Story | undefined> {
  try {
    const item = await getStory(slug);
    if (item) return item as unknown as Story;
  } catch {
    // DynamoDB miss
  }
  return undefined;
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
  // summary may carry [REDACTED:…] markup; unwrap it for plain-text meta tags.
  const description = stripRedaction(story.summary);

  return {
    title: `${story.headline} — NewsReal.ai`,
    description,
    openGraph: {
      title: story.headline,
      description,
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
      description,
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
