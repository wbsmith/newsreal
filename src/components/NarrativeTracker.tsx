'use client';

import Link from 'next/link';
import { Narrative } from '@/types';

interface NarrativeTrackerProps {
  narratives: Narrative[];
}

export default function NarrativeTracker({ narratives }: NarrativeTrackerProps) {
  return (
    <div className="sidebar-panel">
      <div className="panel-header">
        <span className="icon">📡</span>
        <h3>Dominant Narratives</h3>
      </div>
      <div className="panel-body">
        {narratives.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-message">SCANNING TRANSMISSION PATTERNS...</div>
          </div>
        ) : narratives.map((n, i) => (
          n.slug ? (
            <Link
              key={i}
              href={`/narrative/${n.slug}`}
              prefetch
              className="narrative-item narrative-item-clickable"
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              <span className="narrative-rank">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <div className="narrative-text" dangerouslySetInnerHTML={{ __html: n.text }} />
                <div className="narrative-heat">{n.heat}</div>
              </div>
            </Link>
          ) : (
            <div key={i} className="narrative-item">
              <span className="narrative-rank">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <div className="narrative-text" dangerouslySetInnerHTML={{ __html: n.text }} />
                <div className="narrative-heat">{n.heat}</div>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
