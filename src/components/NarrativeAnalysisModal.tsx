'use client';

import { NarrativeAnalysis } from '@/types';
import AnalysisModal from './AnalysisModal';
import NarrativeAnalysisSections from './NarrativeAnalysisSections';

interface NarrativeAnalysisModalProps {
  analysis: NarrativeAnalysis | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

export default function NarrativeAnalysisModal({
  analysis,
  loading,
  error,
  onClose,
}: NarrativeAnalysisModalProps) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.newsreal.ai';
  const siteUrl = analysis?.slug ? `${origin}/narrative/${encodeURIComponent(analysis.slug)}` : origin;
  const shareTitle = analysis?.narrativeText?.replace(/<[^>]*>/g, '') || 'Narrative Analysis';

  const header = analysis ? (
    <>
      <div className="story-meta">
        <span className="story-source">NARRATIVE DECODE</span>
        <span className="story-time">
          {new Date(analysis.analysisDate).toLocaleString()}
        </span>
      </div>

      <h2 className="story-headline" style={{ fontSize: '22px' }}>
        <span dangerouslySetInnerHTML={{ __html: analysis.narrativeText }} />
      </h2>
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: 'var(--accent-cyan)',
          letterSpacing: '1px',
          marginTop: '4px',
        }}
      >
        COHERENCE: {analysis.coherenceScore}% / {analysis.outletsInvolved.length} OUTLETS DETECTED
      </p>
    </>
  ) : undefined;

  return (
    <AnalysisModal
      open={!!analysis || loading || !!error}
      onClose={onClose}
      loading={loading}
      loadingText="DECODING NARRATIVE PATTERN..."
      loadingSubtext="TRACING ORIGIN / MAPPING COORDINATION / IDENTIFYING BENEFICIARIES"
      error={error}
      shareUrl={siteUrl}
      shareTitle={shareTitle}
      disclaimer="This analysis is AI-generated speculation about narrative patterns. Verify all claims independently. Trust no single source &mdash; including us."
      header={header}
    >
      {analysis && <NarrativeAnalysisSections analysis={analysis} />}
    </AnalysisModal>
  );
}
