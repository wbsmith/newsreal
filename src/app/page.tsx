'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Story } from '@/types';
import {
  MOCK_STORIES,
  NARRATIVES,
  OBFUSCATIONS,
  SUPPRESSED_SEARCHES,
  TICKER_ITEMS,
  LOADING_MESSAGES,
} from '@/lib/mock-data';
import Header from '@/components/Header';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import Ticker from '@/components/Ticker';
import StoryGrid from '@/components/StoryGrid';
import StoryModal from '@/components/StoryModal';
import NarrativeTracker from '@/components/NarrativeTracker';
import ObfuscationIndex from '@/components/ObfuscationIndex';
import SuppressedSearches from '@/components/SuppressedSearches';
import Footer from '@/components/Footer';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);

  // Loading sequence
  useEffect(() => {
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[msgIdx]);
    }, 1800);

    const loadTimer = setTimeout(() => {
      setLoading(false);
      clearInterval(msgInterval);
    }, 4000);

    return () => {
      clearInterval(msgInterval);
      clearTimeout(loadTimer);
    };
  }, []);

  const filteredStories =
    activeFilter === 'all'
      ? MOCK_STORIES
      : MOCK_STORIES.filter((s) => s.category === activeFilter);

  if (loading) {
    return (
      <>
        <Header activeFilter={activeFilter} onFilterChange={setActiveFilter} />
        <DisclaimerBanner />
        <main className="main-content">
          <div className="loading-screen">
            <Image
              src="/icon.svg"
              alt=""
              width={80}
              height={80}
              priority
              style={{ opacity: 0.8 }}
            />
            <div className="glitch-text">INTERCEPTING SIGNALS...</div>
            <div className="loading-bar">
              <div className="loading-bar-fill" />
            </div>
            <div className="loading-messages">{loadingMsg}</div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      <DisclaimerBanner />
      <main className="main-content">
        <Ticker items={TICKER_ITEMS} />
        <div className="content-layout">
          <div className="stories-column">
            <StoryGrid
              stories={filteredStories}
              onStoryClick={setSelectedStory}
            />
          </div>
          <aside className="sidebar">
            <NarrativeTracker narratives={NARRATIVES} />
            <ObfuscationIndex obfuscations={OBFUSCATIONS} />
            <SuppressedSearches searches={SUPPRESSED_SEARCHES} />
          </aside>
        </div>
      </main>
      <Footer />
      <StoryModal
        story={selectedStory}
        onClose={() => setSelectedStory(null)}
      />
    </>
  );
}
