'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Story, Narrative, Obfuscation, TickerItem } from '@/types';
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

  // Data state — initialized with mock data as defaults
  const [stories, setStories] = useState<Story[]>(MOCK_STORIES);
  const [narratives, setNarratives] = useState<Narrative[]>(NARRATIVES);
  const [obfuscations, setObfuscations] = useState<Obfuscation[]>(OBFUSCATIONS);
  const [tickerItems, setTickerItems] = useState<TickerItem[]>(TICKER_ITEMS);
  const [suppressedSearches, setSuppressedSearches] = useState<string[]>(SUPPRESSED_SEARCHES);

  // Loading sequence + API fetch
  useEffect(() => {
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[msgIdx]);
    }, 1800);

    // Fetch real data during loading animation
    fetch('/api/stories')
      .then((res) => res.json())
      .then((data) => {
        if (data.stories?.length > 0) setStories(data.stories);
        if (data.narratives?.length > 0) setNarratives(data.narratives);
        if (data.obfuscations?.length > 0) setObfuscations(data.obfuscations);
        if (data.ticker?.length > 0) setTickerItems(data.ticker);
        if (data.suppressedSearches?.length > 0) setSuppressedSearches(data.suppressedSearches);
      })
      .catch(() => {
        // Mock data already set as initial state — no change needed
      });

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
      ? stories
      : stories.filter((s) => s.category === activeFilter);

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
        <Ticker items={tickerItems} />
        <div className="content-layout">
          <div className="stories-column">
            <StoryGrid
              stories={filteredStories}
              onStoryClick={setSelectedStory}
            />
          </div>
          <aside className="sidebar">
            <NarrativeTracker narratives={narratives} />
            <ObfuscationIndex obfuscations={obfuscations} />
            <SuppressedSearches searches={suppressedSearches} />
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
