'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Story, Narrative, Obfuscation, TickerItem } from '@/types';
import { LOADING_MESSAGES } from '@/lib/loading-messages';
import Header from '@/components/Header';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import Ticker from '@/components/Ticker';
import StoryCard from '@/components/StoryCard';
import NarrativeTracker from '@/components/NarrativeTracker';
import ObfuscationIndex from '@/components/ObfuscationIndex';
import SuppressedSearches from '@/components/SuppressedSearches';
import AnalyzeArticleModal from '@/components/AnalyzeArticleModal';
import NarrativeSearchModal from '@/components/NarrativeSearchModal';
import Footer from '@/components/Footer';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [activeFilter, setActiveFilter] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('category') || 'all';
    }
    return 'all';
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [archiveResults, setArchiveResults] = useState<Story[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Analyze article modal (this one stays as state — it's a write action, not navigation)
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false);
  const [showNarrativeModal, setShowNarrativeModal] = useState(false);

  // Vote state
  const [votes, setVotes] = useState<Record<string, { up: number; down: number }>>({});
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down'>>({});

  // Data state — empty until API responds
  const [stories, setStories] = useState<Story[]>([]);
  const [bonusStories, setBonusStories] = useState<Map<string, Story[]>>(new Map());
  const [narratives, setNarratives] = useState<Narrative[]>([]);
  const [obfuscations, setObfuscations] = useState<Obfuscation[]>([]);
  const [tickerItems, setTickerItems] = useState<TickerItem[]>([]);
  const [suppressedSearches, setSuppressedSearches] = useState<string[]>([]);

  // Loading sequence + API fetch
  useEffect(() => {
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[msgIdx]);
    }, 1800);

    fetch('/api/stories')
      .then((res) => res.json())
      .then((data) => {
        if (data.stories?.length > 0) setStories(data.stories);
        if (data.narratives?.length > 0) setNarratives(data.narratives);
        if (data.obfuscations?.length > 0) setObfuscations(data.obfuscations);
        if (data.ticker?.length > 0) setTickerItems(data.ticker);
        if (data.suppressedSearches?.length > 0) setSuppressedSearches(data.suppressedSearches);
      })
      .catch(() => {});

    fetch('/api/vote')
      .then((res) => res.json())
      .then((data) => { if (data && typeof data === 'object') setVotes(data); })
      .catch(() => {});

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
        router.push(`/narrative/${item.linkRef}`);
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
        const loadedSlugs = new Set(stories.map(s => s.slug));
        setArchiveResults(data.results.filter((s: Story) => !loadedSlugs.has(s.slug)));
      }
    } catch {
      setArchiveResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [stories]);

  const handleVote = useCallback(async (slug: string, direction: 'up' | 'down') => {
    // Optimistic update
    const prev = userVotes[slug];
    const prevVotes = votes[slug] || { up: 0, down: 0 };
    const next = { ...prevVotes };
    if (prev === direction) {
      next[direction]--;
      setUserVotes((v) => { const n = { ...v }; delete n[slug]; return n; });
    } else {
      if (prev) next[prev]--;
      next[direction]++;
      setUserVotes((v) => ({ ...v, [slug]: direction }));
    }
    setVotes((v) => ({ ...v, [slug]: next }));

    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, direction }),
      });
      const data = await res.json();
      setVotes((v) => ({ ...v, [slug]: { up: data.up, down: data.down } }));
      setUserVotes((v) => data.userVote ? { ...v, [slug]: data.userVote } : (() => { const n = { ...v }; delete n[slug]; return n; })());
    } catch {}
  }, [votes, userVotes]);

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

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const local = base.filter(s =>
        s.headline.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q)
      );
      // Fully integrate archive/DB matches (incl. user-submitted) with the
      // loaded-page matches into one recency-sorted list, deduped by slug.
      const seen = new Set(local.map(s => s.slug));
      const merged = [...local, ...archiveResults.filter(s => !seen.has(s.slug))];
      merged.sort((a, b) =>
        new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()
      );
      return merged;
    }

    const hasVotes = base.some(s => votes[s.slug]);
    if (!hasVotes) return base;

    return [...base].sort((a, b) => {
      const va = votes[a.slug] || { up: 0, down: 0 };
      const vb = votes[b.slug] || { up: 0, down: 0 };
      const netA = va.up - va.down;
      const netB = vb.up - vb.down;
      if (netA !== netB) return netB - netA;
      return 0; // preserve pipeline order as tiebreaker
    });
  }, [activeFilter, stories, bonusStories, searchQuery, votes, archiveResults]);

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
        onNarrativeClick={() => setShowNarrativeModal(true)}
      />
      <DisclaimerBanner />
      <main className="main-content">
        {tickerItems.length > 0 && (
          <Ticker items={tickerItems} onItemClick={handleTickerClick} />
        )}
        <div className="content-layout">
          <div className="stories-top">
            <div className="stories-section-header">
              <h2>{searchQuery ? `Search: "${searchQuery}"` : 'Today’s Narrative Landscape'}</h2>
              <div className="line" />
              <div className="count">
                {searchQuery && searchLoading
                  ? 'SEARCHING ARCHIVE…'
                  : `${filteredStories.length} STORIES ${searchQuery ? 'FOUND' : 'DECODED'}`}
              </div>
            </div>
            {filteredStories.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-message">
                  {searchQuery ? 'NO MATCHING SIGNALS...' : 'AWAITING SIGNAL INTERCEPT...'}
                </div>
                <div className="empty-state-sub">
                  {searchQuery
                    ? (searchLoading ? 'Searching the archive…' : 'No stories match your search.')
                    : 'Pipeline initializing. Stories will appear after the next ingestion cycle.'}
                </div>
              </div>
            ) : (
              <>
                <div className="stories-grid stories-grid-hero">
                  <StoryCard story={filteredStories[0]} tier="hero" votes={votes[filteredStories[0].slug]} userVote={userVotes[filteredStories[0].slug]} onVote={handleVote} />
                </div>
                {filteredStories.slice(1).filter(s => s.featured).length > 0 && (
                  <div className="stories-grid stories-grid-featured">
                    {filteredStories.slice(1).filter(s => s.featured).map((story) => (
                      <StoryCard key={story.id} story={story} tier="featured" votes={votes[story.slug]} userVote={userVotes[story.slug]} onVote={handleVote} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <aside className="sidebar">
            <NarrativeTracker narratives={narratives} />
            <ObfuscationIndex obfuscations={obfuscations} />
            <SuppressedSearches searches={suppressedSearches} />
          </aside>
          {filteredStories.filter(s => !s.featured).length > 0 && (
            <div className="stories-rest">
              <div className="stories-grid stories-grid-compact">
                {filteredStories.filter(s => !s.featured).map((story) => (
                  <StoryCard key={story.id} story={story} tier="compact" votes={votes[story.slug]} userVote={userVotes[story.slug]} onVote={handleVote} />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
      <AnalyzeArticleModal
        open={showAnalyzeModal}
        onClose={() => setShowAnalyzeModal(false)}
      />
      <NarrativeSearchModal
        open={showNarrativeModal}
        onClose={() => setShowNarrativeModal(false)}
        initialTerm={searchQuery}
      />
    </>
  );
}
