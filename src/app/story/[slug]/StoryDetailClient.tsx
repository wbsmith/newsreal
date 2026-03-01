'use client';

import { Story } from '@/types';
import Header from '@/components/Header';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import BiasTag from '@/components/BiasTag';
import ManipulationMeter from '@/components/ManipulationMeter';
import RedactedText from '@/components/RedactedText';
import ShareButtons from '@/components/ShareButtons';
import Footer from '@/components/Footer';

interface StoryDetailClientProps {
  story: Story;
}

export default function StoryDetailClient({ story }: StoryDetailClientProps) {
  return (
    <>
      <Header activeFilter={story.category} onFilterChange={() => {}} />
      <DisclaimerBanner />
      <main className="main-content">
        <div className="story-detail">
          <div className="story-meta">
            <span className="story-source">{story.source}</span>
            <span className="story-time">{story.time}</span>
            <BiasTag tag={story.biasTag} />
          </div>

          <h1 className="story-headline" style={{ fontSize: '36px', marginBottom: '16px' }}>
            {story.headline}
          </h1>
          <p className="story-summary" style={{ fontSize: '17px', marginTop: '8px' }}>
            {story.summary}
          </p>

          <ManipulationMeter score={story.manipulationScore} />

          <ShareButtons slug={story.slug} headline={story.headline} />

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
      </main>
      <Footer />
    </>
  );
}
