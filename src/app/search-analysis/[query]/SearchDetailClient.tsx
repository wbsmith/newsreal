'use client';

import { SearchAnalysis } from '@/types';
import Header from '@/components/Header';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import ShareButton from '@/components/ShareButtons';
import Footer from '@/components/Footer';

interface SearchDetailClientProps {
  analysis: SearchAnalysis;
}

export default function SearchDetailClient({ analysis }: SearchDetailClientProps) {
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://www.newsreal.ai';
  const pageUrl = `${siteUrl}/search-analysis/${encodeURIComponent(analysis.query)}`;

  return (
    <>
      <Header activeFilter="all" onFilterChange={() => {}} />
      <DisclaimerBanner />
      <main className="main-content">
        <div className="story-detail">
          <div className="story-meta">
            <span className="story-source">SEARCH INTERCEPT</span>
            <span className="story-time">
              {new Date(analysis.analysisDate).toLocaleString()}
            </span>
          </div>

          <h1 className="story-headline" style={{ fontSize: '30px', marginBottom: '16px' }}>
            {'\uD83D\uDD0D'} &quot;{analysis.query}&quot;
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--accent-cyan)',
              letterSpacing: '1px',
              marginTop: '4px',
            }}
          >
            {analysis.resultCount} RESULTS INTERCEPTED / {analysis.searchResults.length} ANALYZED
          </p>

          <ShareButton url={pageUrl} title={`"${analysis.query}" — Suppressed Search`} />

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
        </div>
      </main>
      <Footer />
    </>
  );
}
