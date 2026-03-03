'use client';

import { Story } from '@/types';
import BiasTag from './BiasTag';
import ManipulationMeter from './ManipulationMeter';
import RedactedText from './RedactedText';
import AnalysisModal from './AnalysisModal';
import SourceNetworkSection from './SourceNetworkSection';

interface StoryModalProps {
  story: Story | null;
  onClose: () => void;
}

export default function StoryModal({ story, onClose }: StoryModalProps) {
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://www.newsreal.ai';

  const header = story ? (
    <>
      <div className="story-meta">
        <span className="story-source">{story.source}</span>
        <span className="story-time">{story.time}</span>
        <BiasTag tag={story.biasTag} />
      </div>

      <h2 className="story-headline">{story.headline}</h2>
      <p className="story-summary" style={{ fontSize: '17px', marginTop: '8px' }}>
        {story.summary}
      </p>

      <ManipulationMeter score={story.manipulationScore} />
    </>
  ) : undefined;

  return (
    <AnalysisModal
      open={!!story}
      onClose={onClose}
      shareUrl={story ? `${siteUrl}/story/${story.slug}` : undefined}
      shareTitle={story?.headline}
      header={header}
    >
      {story && (
        <>
          <div className="modal-section">
            <div className="modal-section-title">
              {'\u25C8'} AI DEEP ANALYSIS <span className="blink">{'\u258A'}</span>
            </div>
            <p className="analysis-text speculation">
              <RedactedText text={story.realAnalysis} />
            </p>
          </div>

          {story.deepDive && (
            <>
              <div className="modal-section">
                <div className="modal-section-title">
                  {'\uD83D\uDCFA'} THE MAINSTREAM FRAME
                </div>
                <p className="analysis-text">{story.deepDive.mainstream}</p>
              </div>

              <div className="modal-section">
                <div className="modal-section-title">
                  {'\uD83D\uDD13'} THE REAL STORY (SPECULATIVE)
                </div>
                <p className="analysis-text speculation">{story.deepDive.realStory}</p>
              </div>

              <div className="modal-section">
                <div className="modal-section-title">
                  {'\u2696\uFE0F'} BIAS BREAKDOWN
                </div>
                <div className="bias-breakdown">
                  <div className="bias-card left-lean">
                    <h4>{'\u25C0'} Left-Leaning Frame</h4>
                    <p>{story.deepDive.leftSpin}</p>
                  </div>
                  <div className="bias-card right-lean">
                    <h4>Right-Leaning Frame {'\u25B6'}</h4>
                    <p>{story.deepDive.rightSpin}</p>
                  </div>
                </div>
              </div>

              {story.sourceNetwork && story.sourceNetwork.entries.length > 0 && (
                <SourceNetworkSection network={story.sourceNetwork} />
              )}

              <div className="modal-section">
                <div className="modal-section-title">
                  {'\uD83D\uDCB0'} WHO BENEFITS?
                </div>
                <p className="analysis-text">{story.deepDive.whosBenefiting}</p>
              </div>

              <div className="modal-section">
                <div className="modal-section-title">
                  {'\uD83D\uDD73'} WHAT&apos;S BEING HIDDEN
                </div>
                <p className="analysis-text speculation">{story.deepDive.whatsHidden}</p>
              </div>
            </>
          )}

          <div className="modal-section" style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <a
              href={`/story/${story.slug}`}
              className="dossier-link"
              onClick={(e) => e.stopPropagation()}
            >
              [VIEW FULL DOSSIER]
            </a>
            {story.sourceUrl && (
              <a
                href={story.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="dossier-link"
                onClick={(e) => e.stopPropagation()}
              >
                [READ ORIGINAL {'\u2192'} {story.source}]
              </a>
            )}
          </div>
        </>
      )}
    </AnalysisModal>
  );
}
