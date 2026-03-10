'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Story, Narrative, Obfuscation, TickerItem, NarrativeAnalysis, SuppressedSearchEntry } from '@/types';
import { LOADING_MESSAGES } from '@/lib/loading-messages';
import Header from '@/components/Header';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import Ticker from '@/components/Ticker';
import StoryCard from '@/components/StoryCard';
import StoryModal from '@/components/StoryModal';
import NarrativeTracker, { NarrativeTrackerHandle } from '@/components/NarrativeTracker';
import ObfuscationIndex from '@/components/ObfuscationIndex';
import SuppressedSearches from '@/components/SuppressedSearches';
import AnalyzeArticleModal from '@/components/AnalyzeArticleModal';
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

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [archiveResults, setArchiveResults] = useState<Story[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Analyze article modal
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false);

  // Data state — empty until API responds
  const [stories, setStories] = useState<Story[]>([]);
  const [bonusStories, setBonusStories] = useState<Map<string, Story[]>>(new Map());
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

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/search-stories?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.results) {
        // Filter out stories already loaded on the page
        const loadedSlugs = new Set(stories.map(s => s.slug));
        setArchiveResults(data.results.filter((s: Story) => !loadedSlugs.has(s.slug)));
      }
    } catch {
      setArchiveResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [stories]);

  const handleSearchClear = useCallback(() => {
    setSearchQuery('');
    setArchiveResults([]);
  }, []);

  // Lazy-load bonus stories for finance/science filters
  useEffect(() => {
    if (activeFilter !== 'finance' && activeFilter !== 'science') return;
    if (bonusStories.has(activeFilter)) return;
    if (stories.length === 0) return;

    fetch(`/api/stories?category=${activeFilter}`)
      .then(res => res.json())
      .then(data => {
        const mainSlugs = new Set(stories.map(s => s.slug));
        const bonus = (data.stories ?? []).filter((s: Story) => !mainSlugs.has(s.slug));
        setBonusStories(prev => new Map(prev).set(activeFilter, bonus));
      })
      .catch(() => {});
  }, [activeFilter, stories, bonusStories]);

  const filteredStories = useMemo(() => {
    let base: Story[];
    if (activeFilter === 'all') {
      base = stories;
    } else {
      const mainFiltered = stories.filter((s) => s.category === activeFilter);
      if (activeFilter === 'finance' || activeFilter === 'science') {
        const bonus = bonusStories.get(activeFilter) ?? [];
        base = [...mainFiltered, ...bonus];
      } else {
        base = mainFiltered;
      }
    }

    // Client-side search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return base.filter(s =>
        s.headline.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q)
      );
    }

    return base;
  }, [activeFilter, stories, bonusStories, searchQuery]);

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
      <Header
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        onSearch={handleSearch}
        onSearchClear={handleSearchClear}
        onAnalyzeClick={() => setShowAnalyzeModal(true)}
      />
      <DisclaimerBanner />
      <main className="main-content">
        {tickerItems.length > 0 && (
          <Ticker items={tickerItems} onItemClick={handleTickerClick} />
        )}
        <div className="content-layout">
          <div className="stories-top">
            <div className="stories-section-header">
              <h2>{searchQuery ? `Search: "${searchQuery}"` : 'Today\u2019s Narrative Landscape'}</h2>
              <div className="line" />
              <div className="count">{filteredStories.length} STORIES {searchQuery ? 'FOUND' : 'DECODED'}</div>
            </div>
            {filteredStories.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-message">
                  {searchQuery ? 'NO MATCHING SIGNALS...' : 'AWAITING SIGNAL INTERCEPT...'}
                </div>
                <div className="empty-state-sub">
                  {searchQuery
                    ? 'No stories match your search on this page. Check archive results below.'
                    : 'Pipeline initializing. Stories will appear after the next ingestion cycle.'}
                </div>
              </div>
            ) : (
              <div className="stories-grid">
                {filteredStories.slice(0, 5).map((story) => (
                  <StoryCard key={story.id} story={story} onClick={setSelectedStory} />
                ))}
              </div>
            )}
          </div>
          <aside className="sidebar">
            <NarrativeTracker ref={narrativeRef} narratives={narratives} preloadedAnalyses={narrativeAnalyses} />
            <ObfuscationIndex obfuscations={obfuscations} />
            <SuppressedSearches searches={suppressedSearches} preloadedAnalyses={searchAnalyses} />
          </aside>
          {filteredStories.length > 5 && (
            <div className="stories-rest">
              <div className="stories-grid">
                {filteredStories.slice(5).map((story) => (
                  <StoryCard key={story.id} story={story} onClick={setSelectedStory} />
                ))}
              </div>
            </div>
          )}
          {searchQuery && (
            <div className="stories-rest">
              <div className="stories-section-header">
                <h2>Archive Results</h2>
                <div className="line" />
                <div className="count">
                  {searchLoading ? 'SCANNING...' : `${archiveResults.length} ARCHIVED`}
                </div>
              </div>
              {searchLoading ? (
                <div className="empty-state">
                  <div className="empty-state-message">SCANNING ARCHIVES...</div>
                </div>
              ) : archiveResults.length > 0 ? (
                <div className="stories-grid">
                  {archiveResults.map((story) => (
                    <StoryCard key={story.slug} story={story} onClick={setSelectedStory} />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-message">NO ARCHIVED SIGNALS FOUND</div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
      <StoryModal
        story={selectedStory}
        onClose={() => setSelectedStory(null)}
      />
      <AnalyzeArticleModal
        open={showAnalyzeModal}
        onClose={() => setShowAnalyzeModal(false)}
      />
    </>
  );
}
