import { Pause, Play, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Track {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
}

export type SearchFilter = 'all' | 'match' | 'more';

interface TopResultProps {
  track: Track;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: (track: Track) => void;
}

/** Spotify-style "Top result" card: the best match for the search, shown big above the rest. */
export const SearchTopResult = ({ track, isCurrent, isPlaying, onPlay }: TopResultProps) => (
  <section className="mb-6 animate-in-up" aria-label="Top result">
    <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
      <Sparkles className="h-3.5 w-3.5 text-primary" /> Top result
    </h2>
    <button
      type="button"
      onClick={() => onPlay(track)}
      className={cn(
        'group flex w-full items-center gap-4 rounded-2xl border bg-secondary/40 p-3 text-left transition-colors md:gap-6 md:p-5',
        'hover:bg-secondary/70',
        isCurrent ? 'border-primary/60' : 'border-border',
      )}
    >
      <img
        src={track.thumbnail}
        alt=""
        loading="lazy"
        className="h-20 w-20 shrink-0 rounded-xl object-cover shadow-lg md:h-32 md:w-32"
      />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-lg font-extrabold leading-tight md:text-3xl">{track.title}</p>
        <p className="mt-1 truncate text-sm text-muted-foreground md:text-base">{track.channel}</p>
        <span className="mt-2 inline-block rounded-full bg-background/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
          Song
        </span>
      </div>
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-105 md:h-14 md:w-14"
        aria-hidden="true"
      >
        {isCurrent && isPlaying ? <Pause className="h-6 w-6" /> : <Play className="ml-0.5 h-6 w-6" />}
      </span>
    </button>
  </section>
);

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
