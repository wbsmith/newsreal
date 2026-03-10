'use client';

import { SearchAnalysis } from '@/types';
import AnalysisModal from './AnalysisModal';

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
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.newsreal.ai';
  const siteUrl = analysis?.query ? `${origin}/search-analysis/${encodeURIComponent(analysis.query)}` : origin;

  const header = analysis ? (
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
    </>
  ) : undefined;

  return (
    <AnalysisModal
      open={!!analysis || loading || !!error}
      onClose={onClose}
      loading={loading}
      loadingText="INTERCEPTING SEARCH RESULTS..."
      loadingSubtext="QUERYING GOOGLE NEWS / ANALYZING COVERAGE PATTERNS / FOLLOWING THE MONEY"
      error={error}
      shareUrl={siteUrl}
      shareTitle={analysis?.query ? `"${analysis.query}" — Suppressed Search` : 'Search Analysis'}
      disclaimer="This analysis is AI-generated speculation based on search results. Verify all claims independently. Trust no single source &mdash; including us."
      header={header}
    >
      {analysis && (
        <>
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
        </>
      )}
    </AnalysisModal>
  );
}
