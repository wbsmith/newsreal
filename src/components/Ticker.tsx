'use client';

import { TickerItem } from '@/types';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

interface TickerProps {
  items: TickerItem[];
  onItemClick?: (item: TickerItem) => void;
}

// Constant scroll speed in px/sec. Duration is derived from content width so the
// ticker moves at the same visual speed regardless of viewport (fixes the
// "much slower on mobile" effect, where a fixed duration meant a narrower
// content set crawled by).
const TICKER_SPEED_PX_PER_SEC = 90;

export default function Ticker({ items, onItemClick }: TickerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  // Width of one content set, in px. The animation shifts by exactly this much
  // and the duration is derived from it for a constant px/sec speed.
  const [setWidth, setSetWidth] = useState(0);

  // Double items for infinite scroll illusion
  const doubled = [...items, ...items];

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const w = el.scrollWidth / 2; // doubled content → one set is half
    if (w > 0) setSetWidth(w);
  }, [items]);

  if (items.length === 0) return null;

  const style: CSSProperties | undefined = setWidth > 0
    ? ({
        animationDuration: `${setWidth / TICKER_SPEED_PX_PER_SEC}s`,
        '--ticker-shift': `${setWidth}px`,
      } as CSSProperties)
    : undefined;

  return (
    <div className="ticker-bar">
      <div
        className="ticker-content"
        ref={contentRef}
        style={style}
      >
        {doubled.map((item, i) => (
          <span key={i}>
            <span
              className={`ticker-item ${item.linkRef ? 'ticker-item-clickable' : ''}`}
              role={item.linkRef ? 'button' : undefined}
              tabIndex={item.linkRef ? 0 : undefined}
              onClick={
                item.linkRef && onItemClick
                  ? () => onItemClick(item)
                  : undefined
              }
              onKeyDown={
                item.linkRef && onItemClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onItemClick(item);
                      }
                    }
                  : undefined
              }
            >
              <span className={`severity ${item.severity}`} />
              {item.text}
            </span>
            {i < doubled.length - 1 && (
              <span className="ticker-divider">{'◆'}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
