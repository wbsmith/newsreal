'use client';

import { useEffect, useCallback } from 'react';
import { NarrativeAnalysis } from '@/types';

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
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (analysis || loading || error) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [analysis, loading, error, handleKeyDown]);

  if (!analysis && !loading && !error) return null;

  return (
    <div
      className="modal-overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}>
          {'\u00D7'}
        </button>

        {loading && (
          <div className="search-loading">
            <div className="loading-text" style={{ fontSize: '14px', marginBottom: '16px' }}>
              DECODING NARRATIVE PATTERN...
            </div>
            <div className="loading-bar">
              <div className="loading-fill" />
            </div>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--text-muted)',
                marginTop: '16px',
                letterSpacing: '1px',
              }}
            >
              TRACING ORIGIN / MAPPING COORDINATION / IDENTIFYING BENEFICIARIES
            </p>
          </div>
        )}

        {error && (
          <div className="modal-section">
            <div className="modal-section-title">{'\u26A0'} DECODE FAILED</div>
            <p className="analysis-text" style={{ color: 'var(--accent-red)' }}>
              {error}
            </p>
          </div>
        )}

        {analysis && (
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

            <div className="modal-section" style={{ textAlign: 'center' }}>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '1.5px',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                }}
              >
                {'\u26A0'} This analysis is AI-generated speculation about narrative patterns.
                Verify all claims independently. Trust no single source &mdash; including us.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
