'use client';

import Link from 'next/link';

interface SuppressedSearchesProps {
  searches: string[];
}

export default function SuppressedSearches({ searches }: SuppressedSearchesProps) {
  return (
    <div className="sidebar-panel">
      <div className="panel-header">
        <span className="icon">🔍</span>
        <h3>Suppressed Searches</h3>
      </div>
      <div className="panel-body">
        {searches.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-message">CALIBRATING SEARCH VECTORS...</div>
          </div>
        ) : searches.map((s, i) => (
          <Link
            key={i}
            href={`/search-analysis/${encodeURIComponent(s)}`}
            prefetch
            className="search-item"
            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
          >
            → {s}
          </Link>
        ))}
      </div>
    </div>
  );
}
