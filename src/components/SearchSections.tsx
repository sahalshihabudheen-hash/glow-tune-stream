import { Play, Pause, Sparkles, Layers, Flame } from 'lucide-react';
import TrackCard from './TrackCard';
import { cn } from '@/lib/utils';
import type { RankedResults } from '@/lib/searchRanking';

interface Track {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
}

interface Props {
  ranked: RankedResults<Track>;
  maxVersions: number;
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  isFavorite?: (trackId: string) => boolean;
  onToggleFavorite?: (track: Track) => Promise<boolean>;
}

const SectionHeader = ({ icon: Icon, title, subtitle }: { icon: typeof Sparkles; title: string; subtitle?: string }) => (
  <div className="mb-5 flex items-center gap-3">
    <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <h2 className="text-lg font-black uppercase italic tracking-tight md:text-2xl">{title}</h2>
      {subtitle && (
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/60">{subtitle}</p>
      )}
    </div>
  </div>
);

/**
 * Search results in three clear blocks instead of one long grid:
 *   Top result  -> the song that was searched for
 *   Versions    -> slowed / remix / other uploads of the same song
 *   More like this -> songs of the same theme (phonk, lofi, ...) or artist
 */
export const SearchSections = ({
  ranked,
  maxVersions,
  currentTrack,
  isPlaying,
  onPlayTrack,
  onAddToQueue,
  isFavorite,
  onToggleFavorite,
}: Props) => {
  const top = ranked.top;
  if (!top) return null;
  const versions = ranked.matches.slice(1, maxVersions);
  const topPlaying = currentTrack?.id === top.id && isPlaying;

  const grid = (tracks: Track[]) => (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6 lg:grid-cols-4 xl:grid-cols-5">
      {tracks.map((t, i) => (
        <TrackCard
          key={`${t.id}-${i}`}
          track={t}
          isCurrent={currentTrack?.id === t.id}
          isPlaying={isPlaying}
          onPlay={onPlayTrack}
          onAddToQueue={onAddToQueue}
          isFavorite={isFavorite?.(t.id)}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-12">
      <section>
        <SectionHeader icon={Sparkles} title="Top result" />
        <button
          type="button"
          onClick={() => onPlayTrack(top)}
          className="group relative flex w-full items-center gap-5 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:bg-white/[0.06] md:gap-8 md:p-6"
        >
          <img
            src={top.thumbnail}
            alt=""
            className="h-24 w-24 shrink-0 rounded-2xl object-cover shadow-xl md:h-44 md:w-44"
          />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-xl font-black leading-tight md:text-4xl">{top.title}</p>
            <p className="mt-2 truncate text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">
              {top.channel}
            </p>
            <span
              className={cn(
                'mt-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-110',
              )}
            >
              {topPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
            </span>
          </div>
        </button>
      </section>

      {versions.length > 0 && (
        <section>
          <SectionHeader icon={Layers} title="Versions" subtitle="Slowed, remixes and other uploads" />
          {grid(versions)}
        </section>
      )}

      {ranked.others.length > 0 && (
        <section>
          <SectionHeader
            icon={Flame}
            title={ranked.theme ? `More ${ranked.theme}` : 'More like this'}
            subtitle={ranked.theme ? `Same vibe as your search` : 'Popular songs you might like'}
          />
          {grid(ranked.others)}
        </section>
      )}
    </div>
  );
};

export default SearchSections;
