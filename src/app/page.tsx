'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Story, Narrative, Obfuscation, TickerItem, NarrativeAnalysis, SuppressedSearchEntry } from '@/types';
import { LOADING_MESSAGES } from '@/lib/loading-messages';
import Header from '@/components/Header';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import Ticker from '@/components/Ticker';
import StoryGrid from '@/components/StoryGrid';
import StoryModal from '@/components/StoryModal';
import NarrativeTracker, { NarrativeTrackerHandle } from '@/components/NarrativeTracker';
import ObfuscationIndex from '@/components/ObfuscationIndex';
import SuppressedSearches from '@/components/SuppressedSearches';
import Footer from '@/components/Footer';

export default function Home() {
  const router = useRouter();
  const narrativeRef = useRef<NarrativeTrackerHandle>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [activeFilter, setActiveFilter] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('category') || 'all';
    }
    return 'all';
  });
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);

  // Data state — empty until API responds
  const [stories, setStories] = useState<Story[]>([]);
  const [narratives, setNarratives] = useState<Narrative[]>([]);
  const [obfuscations, setObfuscations] = useState<Obfuscation[]>([]);
  const [tickerItems, setTickerItems] = useState<TickerItem[]>([]);
  const [suppressedSearches, setSuppressedSearches] = useState<string[]>([]);
  const [narrativeAnalyses, setNarrativeAnalyses] = useState<NarrativeAnalysis[]>([]);
  const [searchAnalyses, setSearchAnalyses] = useState<SuppressedSearchEntry[]>([]);

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
        if (data.narrativeAnalyses?.length > 0) setNarrativeAnalyses(data.narrativeAnalyses);
        if (data.searchAnalyses?.length > 0) setSearchAnalyses(data.searchAnalyses);
      })
      .catch(() => {
        // API unavailable — sections will show empty state
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

  const handleTickerClick = useCallback(
    (item: TickerItem) => {
      if (item.linkType === 'story' && item.linkRef) {
        router.push(`/story/${item.linkRef}`);
      } else if (item.linkType === 'narrative' && item.linkRef) {
        narrativeRef.current?.analyzeNarrative(item.linkRef);
      }
    },
    [router]
  );

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
              src="/icon.png"
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
        {tickerItems.length > 0 && (
          <Ticker items={tickerItems} onItemClick={handleTickerClick} />
        )}
        <div className="content-layout">
          <div className="stories-column">
            <StoryGrid
              stories={filteredStories}
              onStoryClick={setSelectedStory}
            />
          </div>
          <aside className="sidebar">
            <NarrativeTracker ref={narrativeRef} narratives={narratives} preloadedAnalyses={narrativeAnalyses} />
            <ObfuscationIndex obfuscations={obfuscations} />
            <SuppressedSearches searches={suppressedSearches} preloadedAnalyses={searchAnalyses} />
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
