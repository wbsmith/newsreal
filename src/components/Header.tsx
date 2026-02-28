'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
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
        <Image
          src="/logo-compact.svg"
          alt="NewsReal.ai"
          width={360}
          height={64}
          priority
          style={{ margin: '0 auto' }}
        />
      </div>
      <CategoryNav activeFilter={activeFilter} onFilterChange={onFilterChange} />
    </header>
  );
}
