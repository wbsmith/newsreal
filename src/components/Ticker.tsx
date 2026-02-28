import { TickerItem } from '@/types';

interface TickerProps {
  items: TickerItem[];
}

export default function Ticker({ items }: TickerProps) {
  // Double items for infinite scroll illusion
  const doubled = [...items, ...items];

  return (
    <div className="ticker-bar">
      <div className="ticker-content">
        {doubled.map((item, i) => (
          <span key={i}>
            <span className="ticker-item">
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
