'use client';

import { SourceNetwork } from '@/types';

interface SourceNetworkSectionProps {
  network: SourceNetwork;
}

export default function SourceNetworkSection({ network }: SourceNetworkSectionProps) {
  return (
    <div className="modal-section">
      <div className="modal-section-title">
        {'\uD83D\uDCE1'} SOURCE NETWORK ({network.outletCount} OUTLETS)
      </div>
      <div className="source-network-list">
        {network.entries.map((entry, i) => (
          <a
            key={i}
            href={entry.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="source-network-entry"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="source-network-outlet">{entry.source}</span>
            <span className="source-network-sim">
              {Math.round(entry.similarity * 100)}% MATCH
            </span>
            <span className="source-network-time">{entry.timeDelta}</span>
            <span className="source-network-entry-headline">{entry.headline}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
