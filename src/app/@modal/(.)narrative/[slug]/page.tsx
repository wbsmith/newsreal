import { getCached } from '@/lib/cache';
import { NarrativeAnalysis } from '@/types';
import NarrativeRouteModal from '@/components/NarrativeRouteModal';
import { notFound } from 'next/navigation';

export const revalidate = 3600;

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function InterceptedNarrativeModal({ params }: Props) {
  const { slug } = await params;
  const analysis = await getCached<NarrativeAnalysis>(`narrative-analysis:${slug}`);
  if (!analysis) notFound();
  return <NarrativeRouteModal analysis={analysis} />;
}
