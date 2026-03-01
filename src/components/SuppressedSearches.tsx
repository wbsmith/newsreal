'use client';

import { useState } from 'react';
import { SearchAnalysis } from '@/types';
import SearchAnalysisModal from './SearchAnalysisModal';

interface SuppressedSearchesProps {
  searches: string[];
}

export default function SuppressedSearches({ searches }: SuppressedSearchesProps) {
  const [analysis, setAnalysis] = useState<SearchAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeQuery, setActiveQuery] = useState<string | null>(null);

  async function handleSearch(query: string) {
    setActiveQuery(query);
    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Search failed (${res.status})`);
      }
      const data: SearchAnalysis = await res.json();
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search analysis failed');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setAnalysis(null);
    setLoading(false);
    setError(null);
    setActiveQuery(null);
  }

  return (
    <div className="sidebar-panel">
      <div className="panel-header">
        <span className="icon">{'\uD83D\uDD0D'}</span>
        <h3>Suppressed Searches</h3>
      </div>
      <div className="panel-body">
        {searches.map((s, i) => (
          <div
            key={i}
            className={`search-item ${activeQuery === s ? 'search-item-active' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => handleSearch(s)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSearch(s);
              }
            }}
          >
            {'\u2192'} {s}
            {activeQuery === s && loading && (
              <span className="analyzing-tag"> [ANALYZING...]</span>
            )}
          </div>
        ))}
      </div>

      <SearchAnalysisModal
        analysis={analysis}
        loading={loading}
        error={error}
        onClose={handleClose}
      />
    </div>
  );
}
