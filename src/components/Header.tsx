'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import CategoryNav from './CategoryNav';

interface HeaderProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  onSearch?: (query: string) => void;
  onSearchClear?: () => void;
  onAnalyzeClick?: () => void;
}

export default function Header({ activeFilter, onFilterChange, onSearch, onSearchClear, onAnalyzeClick }: HeaderProps) {
  const [dateline, setDateline] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (searchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [searchOpen]);

  const handleSearchSubmit = () => {
    const q = searchValue.trim();
    if (q.length >= 3 && onSearch) {
      onSearch(q);
    }
  };

  const handleSearchClose = () => {
    setSearchOpen(false);
    setSearchValue('');
    onSearchClear?.();
  };

  return (
    <header className="site-header">
      <div className="header-top">
        <div className="dateline">{dateline}</div>
        <div className="header-actions">
          {searchOpen ? (
            <div className="search-input-wrapper">
              <input
                ref={inputRef}
                type="text"
                className="header-search-input"
                placeholder="SEARCH STORIES..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearchSubmit();
                  if (e.key === 'Escape') handleSearchClose();
                }}
              />
              <button className="header-icon-btn" onClick={handleSearchSubmit} aria-label="Search">
                {'\u2315'}
              </button>
              <button className="header-icon-btn" onClick={handleSearchClose} aria-label="Close search">
                {'\u00D7'}
              </button>
            </div>
          ) : (
            <button className="header-icon-btn" onClick={() => setSearchOpen(true)} aria-label="Search">
              {'\u2315'}
            </button>
          )}
          {onAnalyzeClick && (
            <button className="header-analyze-btn" onClick={onAnalyzeClick}>
              ANALYZE
            </button>
          )}
          <div className="live-indicator">
            <span className="live-dot" />
            LIVE ANALYSIS
          </div>
        </div>
      </div>
      <div className="header-main">
        <Link href="/">
          <Image
            src="/logo-compact.svg"
            alt="NewsReal.ai"
            width={360}
            height={64}
            priority
            style={{ margin: '0 auto' }}
          />
        </Link>
      </div>
      <CategoryNav activeFilter={activeFilter} onFilterChange={onFilterChange} />
    </header>
  );
}
