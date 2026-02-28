'use client';

import { useEffect, useState } from 'react';
import CategoryNav from './CategoryNav';

interface HeaderProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export default function Header({ activeFilter, onFilterChange }: HeaderProps) {
  const [dateline, setDateline] = useState('');

  useEffect(() => {
    setDateline(
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    );
  }, []);

  return (
    <header className="site-header">
      <div className="header-top">
        <div className="dateline">{dateline}</div>
        <div className="live-indicator">
          <span className="live-dot" />
          LIVE ANALYSIS
        </div>
      </div>
      <div className="header-main">
        <div className="logo">
          <span className="news">News</span>
          <span className="real">Real</span>
          <span className="dot-ai">.ai</span>
        </div>
        <div className="tagline">The Story Behind the Story</div>
      </div>
      <CategoryNav activeFilter={activeFilter} onFilterChange={onFilterChange} />
    </header>
  );
}
