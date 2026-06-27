'use client';

import { NarrativeAnalysis } from '@/types';
import { safeText } from '@/lib/safe-text';

interface NarrativeAnalysisSectionsProps {
  analysis: NarrativeAnalysis;
}

export default function NarrativeAnalysisSections({ analysis }: NarrativeAnalysisSectionsProps) {
  return (
    <>
      <div className="modal-section">
        <div className="modal-section-title">
          {'\uD83C\uDFAF'} NARRATIVE ORIGIN
        </div>
        <p className="analysis-text speculation">{safeText(analysis.narrativeOrigin)}</p>
      </div>

      <div className="modal-section">
        <div className="modal-section-title">
          {'\uD83D\uDD17'} COORDINATION EVIDENCE <span className="blink">{'\u258A'}</span>
        </div>
        <p className="analysis-text speculation">{safeText(analysis.coordinationEvidence)}</p>
      </div>

      <div className="modal-section">
        <div className="modal-section-title">
          {'\uD83D\uDCB0'} WHO BENEFITS?
        </div>
        <p className="analysis-text">{safeText(analysis.whoBenefits)}</p>
      </div>

      <div className="modal-section">
        <div className="modal-section-title">
          {'\uD83D\uDD73'} SUPPRESSED ALTERNATIVE FRAMING
        </div>
        <p className="analysis-text speculation">{safeText(analysis.suppressedAlternative)}</p>
      </div>

      {analysis.outletsInvolved.length > 0 && (
        <div className="modal-section">
          <div className="modal-section-title">
            {'\uD83D\uDCE1'} OUTLETS INVOLVED ({analysis.outletsInvolved.length})
          </div>
          <div className="search-results-list">
            {analysis.outletsInvolved.map((outlet, i) => {
              const target = outlet.toLowerCase().trim();
              const match = analysis.relatedStories.find(
                (s) => s.source && s.source.toLowerCase().trim() === target
              );
              return (
                <div key={i} className="search-result-item">
                  {match && match.slug ? (
                    <a href={`/story/${match.slug}`} className="search-result-source">{outlet}</a>
                  ) : (
                    <span style={{ color: 'var(--text-muted, #888)' }}>{outlet}</span>
                  )}
                </div>
              );
            })}
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
              <div key={i} className="search-result-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                {story.slug ? (
                  <a href={`/story/${story.slug}`}>{story.headline}</a>
                ) : story.sourceUrl ? (
                  <a href={story.sourceUrl} target="_blank" rel="noopener noreferrer">{story.headline}</a>
                ) : (
                  <span>{story.headline}</span>
                )}
                {story.sourceUrl && (
                  <a
                    href={story.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="source-link-tag"
                    onClick={(e) => e.stopPropagation()}
                  >
                    SOURCE {'\u2192'}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
