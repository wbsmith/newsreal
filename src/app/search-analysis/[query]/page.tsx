import { notFound } from 'next/navigation';
import { getCached } from '@/lib/cache';
import { SearchAnalysis } from '@/types';
import SearchDetailClient from './SearchDetailClient';

export const revalidate = 3600;

interface SearchPageProps {
  params: Promise<{ query: string }>;
}

export async function generateMetadata({ params }: SearchPageProps) {
  const { query } = await params;
  const decodedQuery = decodeURIComponent(query);
  const analysis = await getCached<SearchAnalysis>(`suppressed-search:${decodedQuery}`);
  if (!analysis) return { title: 'Search Analysis Not Found — NewsReal.ai' };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.newsreal.ai';

  return {
    title: `"${decodedQuery}" — Suppressed Search — NewsReal.ai`,
    description: `Search analysis: ${analysis.mediaPattern?.slice(0, 160)}`,
    openGraph: {
      title: `"${decodedQuery}" — Suppressed Search`,
      description: `Search analysis: ${analysis.mediaPattern?.slice(0, 160)}`,
      url: `${siteUrl}/search-analysis/${query}`,
      siteName: 'NewsReal.ai',
      type: 'article',
    },
    alternates: { canonical: `${siteUrl}/search-analysis/${query}` },
  };
}

export default async function SearchAnalysisPage({ params }: SearchPageProps) {
  const { query } = await params;
  const decodedQuery = decodeURIComponent(query);
  const analysis = await getCached<SearchAnalysis>(`suppressed-search:${decodedQuery}`);
  if (!analysis) notFound();
  return <SearchDetailClient analysis={analysis} />;
}
