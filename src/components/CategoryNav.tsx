'use client';

const CATEGORIES = [
  { label: 'All Stories', filter: 'all' },
  { label: 'Politics', filter: 'politics' },
  { label: 'Tech & AI', filter: 'tech' },
  { label: 'Finance', filter: 'finance' },
  { label: 'World', filter: 'world' },
  { label: 'Science', filter: 'science' },
  { label: 'Deep State', filter: 'deep-state' },
];

interface CategoryNavProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export default function CategoryNav({ activeFilter, onFilterChange }: CategoryNavProps) {
  return (
    <nav className="header-nav">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.filter}
          className={activeFilter === cat.filter ? 'active' : ''}
          onClick={() => onFilterChange(cat.filter)}
        >
          {cat.label}
        </button>
      ))}
    </nav>
  );
}
