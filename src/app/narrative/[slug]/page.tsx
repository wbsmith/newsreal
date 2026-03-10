import { notFound } from 'next/navigation';
import { getCached } from '@/lib/cache';
import { NarrativeAnalysis } from '@/types';
import NarrativeDetailClient from './NarrativeDetailClient';

export const revalidate = 3600;

interface NarrativePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: NarrativePageProps) {
  const { slug } = await params;
  const analysis = await getCached<NarrativeAnalysis>(`narrative-analysis:${slug}`);
  if (!analysis) return { title: 'Narrative Not Found — NewsReal.ai' };

  const plainText = analysis.narrativeText.replace(/<[^>]*>/g, '');
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.newsreal.ai';

  return {
    title: `${plainText} — NewsReal.ai`,
    description: `Narrative analysis: ${analysis.narrativeOrigin?.slice(0, 160)}`,
    openGraph: {
      title: plainText,
      description: `Narrative analysis: ${analysis.narrativeOrigin?.slice(0, 160)}`,
      url: `${siteUrl}/narrative/${slug}`,
      siteName: 'NewsReal.ai',
      type: 'article',
    },
    alternates: { canonical: `${siteUrl}/narrative/${slug}` },
  };
}

export default async function NarrativePage({ params }: NarrativePageProps) {
  const { slug } = await params;
  const analysis = await getCached<NarrativeAnalysis>(`narrative-analysis:${slug}`);
  if (!analysis) notFound();
  return <NarrativeDetailClient analysis={analysis} />;
}
