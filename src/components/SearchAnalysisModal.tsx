'use client';

import { useEffect, useCallback } from 'react';
import { SearchAnalysis } from '@/types';

interface SearchAnalysisModalProps {
  analysis: SearchAnalysis | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

export default function SearchAnalysisModal({
  analysis,
  loading,
  error,
  onClose,
}: SearchAnalysisModalProps) {
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
              INTERCEPTING SEARCH RESULTS...
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
              QUERYING GOOGLE NEWS / ANALYZING COVERAGE PATTERNS / FOLLOWING THE MONEY
            </p>
          </div>
        )}

        {error && (
          <div className="modal-section">
            <div className="modal-section-title">{'\u26A0'} INTERCEPT FAILED</div>
            <p className="analysis-text" style={{ color: 'var(--accent-red)' }}>
              {error}
            </p>
          </div>
        )}

        {analysis && (
          <>
            <div className="story-meta">
              <span className="story-source">SEARCH INTERCEPT</span>
              <span className="story-time">
                {new Date(analysis.analysisDate).toLocaleString()}
              </span>
            </div>

            <h2 className="story-headline" style={{ fontSize: '22px' }}>
              {'\uD83D\uDD0D'} &quot;{analysis.query}&quot;
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
              {analysis.resultCount} RESULTS INTERCEPTED / {analysis.searchResults.length} ANALYZED
            </p>

            <div className="modal-section">
              <div className="modal-section-title">
                {'\uD83D\uDCE1'} MEDIA COVERAGE PATTERN
              </div>
              <p className="analysis-text">{analysis.mediaPattern}</p>
            </div>

            <div className="modal-section">
              <div className="modal-section-title">
                {'\uD83D\uDD13'} WHAT THE RESULTS REVEAL (SPECULATIVE){' '}
                <span className="blink">{'\u258A'}</span>
              </div>
              <p className="analysis-text speculation">{analysis.whatsRevealed}</p>
            </div>

            <div className="modal-section">
              <div className="modal-section-title">
                {'\uD83D\uDD73'} WHAT&apos;S CONSPICUOUSLY MISSING
              </div>
              <p className="analysis-text speculation">{analysis.whatsMissing}</p>
            </div>

            <div className="modal-section">
              <div className="modal-section-title">
                {'\uD83D\uDCB0'} CONNECTION MAP: FOLLOW THE MONEY
              </div>
              <p className="analysis-text">{analysis.connectionMap}</p>
            </div>

            <div className="modal-section">
              <div className="modal-section-title">
                {'\uD83D\uDEAB'} WHY THIS IS SUPPRESSED
              </div>
              <p className="analysis-text speculation">{analysis.whyItsSuppressed}</p>
            </div>

            <div className="modal-section">
              <div className="modal-section-title">
                {'\uD83D\uDCE1'} RAW INTERCEPTS ({analysis.searchResults.length})
              </div>
              <div className="search-results-list">
                {analysis.searchResults.map((result, i) => (
                  <a
                    key={i}
                    href={result.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="search-result-item"
                  >
                    <span className="search-result-source">[{result.source}]</span>{' '}
                    {result.title}
                  </a>
                ))}
              </div>
            </div>

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
                {'\u26A0'} This analysis is AI-generated speculation based on search results.
                Verify all claims independently. Trust no single source &mdash; including us.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
