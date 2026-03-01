import { TickerItem } from '@/types';

interface TickerProps {
  items: TickerItem[];
  onItemClick?: (item: TickerItem) => void;
}

export default function Ticker({ items, onItemClick }: TickerProps) {
  // Double items for infinite scroll illusion
  const doubled = [...items, ...items];

  return (
    <div className="ticker-bar">
      <div className="ticker-content">
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
              <span className="ticker-divider">{'\u25C6'}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
