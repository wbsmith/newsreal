'use client';

import { useRouter } from 'next/navigation';
import { NarrativeAnalysis } from '@/types';
import AnalysisModal from './AnalysisModal';
import NarrativeAnalysisSections from './NarrativeAnalysisSections';

interface Props {
  analysis: NarrativeAnalysis;
}

export default function NarrativeRouteModal({ analysis }: Props) {
  const router = useRouter();
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.newsreal.ai';
  const siteUrl = `${origin}/narrative/${encodeURIComponent(analysis.slug)}`;
  const shareTitle = analysis.narrativeText?.replace(/<[^>]*>/g, '') || 'Narrative Analysis';

  const header = (
    <>
      <div className="story-meta">
        <span className="story-source">NARRATIVE DECODE</span>
        <span className="story-time">{new Date(analysis.analysisDate).toLocaleString()}</span>
      </div>
      <h2 className="story-headline" style={{ fontSize: '22px' }}>
        <span dangerouslySetInnerHTML={{ __html: analysis.narrativeText }} />
      </h2>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-cyan)', letterSpacing: '1px', marginTop: '4px' }}>
        COHERENCE: {analysis.coherenceScore}% / {analysis.outletsInvolved.length} OUTLETS DETECTED
      </p>
    </>
  );

  return (
    <AnalysisModal
      open={true}
      onClose={() => router.back()}
      shareUrl={siteUrl}
      shareTitle={shareTitle}
      disclaimer="This analysis is AI-generated speculation about narrative patterns. Verify all claims independently. Trust no single source — including us."
      header={header}
    >
      <NarrativeAnalysisSections analysis={analysis} />
    </AnalysisModal>
  );
}
