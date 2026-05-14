'use client';

import { useRouter } from 'next/navigation';
import { Story } from '@/types';
import BiasTag from './BiasTag';
import ManipulationMeter from './ManipulationMeter';
import AnalysisModal from './AnalysisModal';
import StoryAnalysisSections from './StoryAnalysisSections';

interface Props {
  story: Story;
}

/**
 * Modal wrapper used by the intercepted route /@modal/(.)story/[slug].
 * Close → router.back(), so browser-history-aware navigation works
 * cleanly (modal closes on back; direct hits to /story/[slug] still
 * render the full-page version).
 */
export default function StoryRouteModal({ story }: Props) {
  const router = useRouter();
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://www.newsreal.ai';

  const header = (
    <>
      <div className="story-meta">
        <span className="story-source">{story.source}</span>
        <span className="story-time">{story.time}</span>
        <BiasTag tag={story.biasTag} />
      </div>
      <h2 className="story-headline">{story.headline}</h2>
      <p className="story-summary" style={{ fontSize: '17px', marginTop: '8px' }}>{story.summary}</p>
      <ManipulationMeter score={story.manipulationScore} />
    </>
  );

  return (
    <AnalysisModal
      open={true}
      onClose={() => router.back()}
      shareUrl={`${siteUrl}/story/${story.slug}`}
      shareTitle={story.headline}
      header={header}
    >
      <StoryAnalysisSections story={story} />

      <div className="modal-section" style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <a href={`/story/${story.slug}`} className="dossier-link" onClick={(e) => e.stopPropagation()}>
          [VIEW FULL DOSSIER]
        </a>
        {story.sourceUrl && (
          <a href={story.sourceUrl} target="_blank" rel="noopener noreferrer" className="dossier-link" onClick={(e) => e.stopPropagation()}>
            [READ ORIGINAL {'→'} {story.source}]
          </a>
        )}
      </div>
    </AnalysisModal>
  );
}
