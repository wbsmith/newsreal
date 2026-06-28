'use client';

import Link from 'next/link';
import { Story } from '@/types';
import { displayAge } from '@/lib/utils';
import BiasTag from './BiasTag';
import ManipulationMeter from './ManipulationMeter';
import RedactedText from './RedactedText';

interface StoryCardProps {
  story: Story;
  tier?: 'hero' | 'featured' | 'compact';
  votes?: { up: number; down: number };
  userVote?: 'up' | 'down' | null;
  onVote?: (slug: string, direction: 'up' | 'down') => void;
}

export default function StoryCard({ story, tier = 'featured', votes, userVote, onVote }: StoryCardProps) {
  const net = (votes?.up ?? 0) - (votes?.down ?? 0);

  function handleVote(e: React.MouseEvent, direction: 'up' | 'down') {
    e.preventDefault();
    e.stopPropagation();
    onVote?.(story.slug, direction);
  }

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
            <span className="story-time">{displayAge(story.publishedAt, story.time)}</span>
            <BiasTag tag={story.biasTag} />
            {story.sourceNetwork && story.sourceNetwork.outletCount > 1 && (
              <span className="source-network-badge">
                {story.sourceNetwork.outletCount} OUTLETS
              </span>
            )}
          </div>
          <h3 className="story-headline">{story.headline}</h3>
          {story.summary && <p className="story-summary"><RedactedText text={story.summary} /></p>}
          {tier !== 'compact' && (
            <ManipulationMeter score={story.manipulationScore} />
          )}
        </div>
        {tier !== 'compact' && story.realAnalysis && (
          <div className="story-real">
            <p>{story.realAnalysis}</p>
          </div>
        )}
        {onVote && (
          <div className="story-votes">
            <button className={`vote-btn vote-up ${userVote === 'up' ? 'active' : ''}`} onClick={(e) => handleVote(e, 'up')}>&#9650;</button>
            <span className={`vote-count ${net > 0 ? 'positive' : net < 0 ? 'negative' : ''}`}>{net}</span>
            <button className={`vote-btn vote-down ${userVote === 'down' ? 'active' : ''}`} onClick={(e) => handleVote(e, 'down')}>&#9660;</button>
          </div>
        )}
      </article>
    </Link>
  );
}
