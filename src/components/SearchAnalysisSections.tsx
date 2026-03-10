'use client';

import { SearchAnalysis } from '@/types';

interface SearchAnalysisSectionsProps {
  analysis: SearchAnalysis;
}

export default function SearchAnalysisSections({ analysis }: SearchAnalysisSectionsProps) {
  return (
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
  );
}
