'use client';

import { Story } from '@/types';
import RedactedText from './RedactedText';
import SourceNetworkSection from './SourceNetworkSection';
import { safeText } from '@/lib/safe-text';

interface StoryAnalysisSectionsProps {
  story: Story;
}

export default function StoryAnalysisSections({ story }: StoryAnalysisSectionsProps) {
  return (
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
            <p className="analysis-text">{safeText(story.deepDive.mainstream)}</p>
          </div>

          <div className="modal-section">
            <div className="modal-section-title">
              {'\uD83D\uDD13'} THE REAL STORY (SPECULATIVE)
            </div>
            <p className="analysis-text speculation">{safeText(story.deepDive.realStory)}</p>
          </div>

          <div className="modal-section">
            <div className="modal-section-title">
              {'\u2696\uFE0F'} BIAS BREAKDOWN
            </div>
            <div className="bias-breakdown">
              <div className="bias-card left-lean">
                <h4>{'\u25C0'} Left-Leaning Frame</h4>
                <p>{safeText(story.deepDive.leftSpin)}</p>
              </div>
              <div className="bias-card right-lean">
                <h4>Right-Leaning Frame {'\u25B6'}</h4>
                <p>{safeText(story.deepDive.rightSpin)}</p>
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
            <p className="analysis-text">{safeText(story.deepDive.whosBenefiting)}</p>
          </div>

          <div className="modal-section">
            <div className="modal-section-title">
              {'\uD83D\uDD73'} WHAT&apos;S BEING HIDDEN
            </div>
            <p className="analysis-text speculation">{safeText(story.deepDive.whatsHidden)}</p>
          </div>
        </>
      )}
    </>
  );
}
