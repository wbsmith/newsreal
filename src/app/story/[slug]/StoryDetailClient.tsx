'use client';

import { Story } from '@/types';
import Header from '@/components/Header';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import BiasTag from '@/components/BiasTag';
import ManipulationMeter from '@/components/ManipulationMeter';
import ShareButton from '@/components/ShareButtons';
import StoryAnalysisSections from '@/components/StoryAnalysisSections';
import Footer from '@/components/Footer';

interface StoryDetailClientProps {
  story: Story;
}

export default function StoryDetailClient({ story }: StoryDetailClientProps) {
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://www.newsreal.ai';
  const storyUrl = `${siteUrl}/story/${story.slug}`;

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

          <ShareButton url={storyUrl} title={story.headline} />

          {story.sourceUrl && (
            <div style={{ marginTop: '12px', marginBottom: '8px' }}>
              <a
                href={story.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="dossier-link"
              >
                [READ ORIGINAL {'\u2192'} {story.source}]
              </a>
            </div>
          )}

          <StoryAnalysisSections story={story} />

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
