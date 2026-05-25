'use client';

import Link from 'next/link';
import { Story } from '@/types';
import BiasTag from './BiasTag';
import ManipulationMeter from './ManipulationMeter';

interface StoryCardProps {
  story: Story;
  tier?: 'hero' | 'featured' | 'compact';
}

export default function StoryCard({ story, tier = 'featured' }: StoryCardProps) {
  return (
    <Link
      href={`/story/${story.slug}`}
      prefetch
      className={`story-card ${tier}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <article>
        <div>
          <div className="story-meta">
            <span className="story-source">{story.source}</span>
            <span className="story-time">{story.time}</span>
            <BiasTag tag={story.biasTag} />
            {story.sourceNetwork && story.sourceNetwork.outletCount > 1 && (
              <span className="source-network-badge">
                {story.sourceNetwork.outletCount} OUTLETS
              </span>
            )}
          </div>
          <h3 className="story-headline">{story.headline}</h3>
          {story.summary && <p className="story-summary">{story.summary}</p>}
          {tier !== 'compact' && (
            <ManipulationMeter score={story.manipulationScore} />
          )}
        </div>
        {tier !== 'compact' && story.realAnalysis && (
          <div className="story-real">
            <p>{story.realAnalysis}</p>
          </div>
        )}
      </article>
    </Link>
  );
}
