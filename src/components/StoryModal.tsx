'use client';

import { useEffect, useCallback } from 'react';
import { Story } from '@/types';
import BiasTag from './BiasTag';
import ManipulationMeter from './ManipulationMeter';
import RedactedText from './RedactedText';

interface StoryModalProps {
  story: Story | null;
  onClose: () => void;
}

export default function StoryModal({ story, onClose }: StoryModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (story) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [story, handleKeyDown]);

  if (!story) return null;

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
            {'\u26A0'} This analysis is AI-generated speculation. Verify all claims independently.
            Trust no single source &mdash; including us.
          </p>
        </div>
      </div>
    </div>
  );
}
