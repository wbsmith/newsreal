import { getCached } from '@/lib/cache';
import { SearchAnalysis } from '@/types';
import SearchRouteModal from '@/components/SearchRouteModal';
import { notFound } from 'next/navigation';

export const revalidate = 3600;

interface Props {
  params: Promise<{ query: string }>;
}

export default async function InterceptedSearchModal({ params }: Props) {
  const { query } = await params;
  const decoded = decodeURIComponent(query);
  const analysis = await getCached<SearchAnalysis>(`suppressed-search:${decoded}`);
  if (!analysis) notFound();
  return <SearchRouteModal analysis={analysis} />;
}
