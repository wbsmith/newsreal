interface SuppressedSearchesProps {
  searches: string[];
}

export default function SuppressedSearches({ searches }: SuppressedSearchesProps) {
  return (
    <div className="sidebar-panel">
      <div className="panel-header">
        <span className="icon">{'\uD83D\uDD0D'}</span>
        <h3>Suppressed Searches</h3>
      </div>
      <div className="panel-body">
        {searches.map((s, i) => (
          <div key={i} className="search-item">
            {'\u2192'} {s}
          </div>
        ))}
      </div>
    </div>
  );
}
