'use client';

import { Story } from '@/types';
import StoryCard from './StoryCard';

interface StoryGridProps {
  stories: Story[];
  onStoryClick: (story: Story) => void;
}

export default function StoryGrid({ stories, onStoryClick }: StoryGridProps) {
  return (
    <div>
      <div className="stories-section-header">
        <h2>Today&apos;s Narrative Landscape</h2>
        <div className="line" />
        <div className="count">{stories.length} STORIES DECODED</div>
      </div>
      {stories.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-message">AWAITING SIGNAL INTERCEPT...</div>
          <div className="empty-state-sub">Pipeline initializing. Stories will appear after the next ingestion cycle.</div>
        </div>
      ) : (
        <div className="stories-grid">
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} onClick={onStoryClick} />
          ))}
        </div>
      )}
    </div>
  );
}
