'use client';

import { Story } from '@/types';
import BiasTag from './BiasTag';
import ManipulationMeter from './ManipulationMeter';
import AnalysisModal from './AnalysisModal';
import StoryAnalysisSections from './StoryAnalysisSections';

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
          <StoryAnalysisSections story={story} />

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
