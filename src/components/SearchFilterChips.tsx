import { cn } from '@/lib/utils';

export type SearchFilter = 'all' | 'match' | 'more';

interface ChipsProps {
  query: string;
  value: SearchFilter;
  onChange: (f: SearchFilter) => void;
  counts: { all: number; match: number; more: number };
}

/** Filter chips: everything, only the searched song (and its versions), or only the related songs. */
export const SearchFilterChips = ({ query, value, onChange, counts }: ChipsProps) => {
  const short = query.length > 18 ? `${query.slice(0, 18)}…` : query;
  const chips: { id: SearchFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'match', label: `Only “${short}”`, count: counts.match },
    { id: 'more', label: 'More songs', count: counts.more },
  ];
  return (
    <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Filter search results">
      {chips.map((c) => (
        <button
          key={c.id}
          type="button"
          role="tab"
          aria-selected={value === c.id}
          onClick={() => onChange(c.id)}
          className={cn(
            'rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors',
            value === c.id
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-secondary/40 text-foreground hover:bg-secondary/70',
          )}
        >
          {c.label} <span className="opacity-60">{c.count}</span>
        </button>
      ))}
    </div>
  );
};
