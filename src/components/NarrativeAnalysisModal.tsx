'use client';

import { NarrativeAnalysis } from '@/types';
import AnalysisModal from './AnalysisModal';

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
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://www.newsreal.ai';
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
      {analysis && (
        <>
          <div className="modal-section">
            <div className="modal-section-title">
              {'\uD83C\uDFAF'} NARRATIVE ORIGIN
            </div>
            <p className="analysis-text speculation">{analysis.narrativeOrigin}</p>
          </div>

          <div className="modal-section">
            <div className="modal-section-title">
              {'\uD83D\uDD17'} COORDINATION EVIDENCE <span className="blink">{'\u258A'}</span>
            </div>
            <p className="analysis-text speculation">{analysis.coordinationEvidence}</p>
          </div>

          <div className="modal-section">
            <div className="modal-section-title">
              {'\uD83D\uDCB0'} WHO BENEFITS?
            </div>
            <p className="analysis-text">{analysis.whoBenefits}</p>
          </div>

          <div className="modal-section">
            <div className="modal-section-title">
              {'\uD83D\uDD73'} SUPPRESSED ALTERNATIVE FRAMING
            </div>
            <p className="analysis-text speculation">{analysis.suppressedAlternative}</p>
          </div>

          {analysis.outletsInvolved.length > 0 && (
            <div className="modal-section">
              <div className="modal-section-title">
                {'\uD83D\uDCE1'} OUTLETS INVOLVED ({analysis.outletsInvolved.length})
              </div>
              <div className="search-results-list">
                {analysis.outletsInvolved.map((outlet, i) => (
                  <div key={i} className="search-result-item">
                    <span className="search-result-source">{outlet}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.relatedStories.length > 0 && (
            <div className="modal-section">
              <div className="modal-section-title">
                {'\uD83D\uDCC4'} RELATED STORIES
              </div>
              <div className="search-results-list">
                {analysis.relatedStories.map((story, i) => (
                  <a
                    key={i}
                    href={`/story/${story.slug}`}
                    className="search-result-item"
                  >
                    {story.headline}
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </AnalysisModal>
  );
}
