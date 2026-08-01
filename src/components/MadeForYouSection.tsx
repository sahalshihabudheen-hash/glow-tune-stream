import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Heart, ListPlus, Sparkles, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { famousSongs } from '@/data/famousSongs';
import { getFunctionAuthHeaders } from '@/lib/functionAuth';
import { useTasteProfile } from '@/hooks/useTasteProfile';

interface Track {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
}

interface MadeForYouSectionProps {
  title?: string;
  subtitle?: string;
  seedTracks?: Track[];
  excludeIds?: string[];
  onPlayTrack: (track: Track) => void;
  currentTrack: Track | null;
  isPlaying?: boolean;
  onAddToQueue?: (track: Track) => void;
  isFavorite?: (trackId: string) => boolean;
  onToggleFavorite?: (track: Track) => Promise<boolean>;
}

const MadeForYouSection = ({
  title = 'Songs For You',
  subtitle,
  seedTracks = [],
  excludeIds = [],
  onPlayTrack,
  currentTrack,
  isPlaying,
  onAddToQueue,
  isFavorite,
  onToggleFavorite,
}: MadeForYouSectionProps) => {
  const { query, topArtists, loading: profileLoading, refresh } = useTasteProfile(
    seedTracks.map(track => ({ title: track.title, channel: track.channel }))
  );
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profileLoading) return;
    let cancelled = false;

    const fetchTracks = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-search?q=${encodeURIComponent(query)}`,
          { headers: await getFunctionAuthHeaders() }
        );
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        if (cancelled) return;
        const filtered = (data as Track[]).filter(track => !excludeIds.includes(track.id));
        setTracks(filtered.slice(0, 12));
      } catch (error) {
        if (cancelled) return;
        const shuffled = [...famousSongs].sort(() => Math.random() - 0.5);
        setTracks(shuffled.slice(0, 10));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchTracks();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, profileLoading, excludeIds.join(',')]);

  const derivedSubtitle =
    subtitle ||
    (topArtists.length > 0
      ? `Based on ${topArtists.slice(0, 2).join(' & ')}`
      : 'Tuned to your listening habits');

  return (
    <section>
      <div className="flex items-center gap-3 mb-5 md:mb-8">
        <div className="p-2 md:p-2.5 rounded-2xl bg-primary/10 text-primary shadow-lg shrink-0">
          <Sparkles className="w-5 h-5 md:w-6 md:h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg md:text-3xl font-black tracking-tighter uppercase italic truncate">{title}</h2>
          <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.25em] truncate">
            {derivedSubtitle}
          </p>
        </div>
        <button
          onClick={() => refresh()}
          className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-primary active:scale-95 transition-all shrink-0"
          aria-label="Refresh recommendations"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {loading ? (
        <div className="flex gap-3 md:gap-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="w-[140px] md:w-[180px] shrink-0 animate-pulse">
              <div className="aspect-square rounded-2xl bg-white/5" />
              <div className="h-3 mt-3 rounded bg-white/5" />
              <div className="h-2 mt-2 w-2/3 rounded bg-white/5" />
            </div>
          ))}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-3 md:gap-4 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory custom-scrollbar"
        >
          {tracks.map(track => {
            const isCurrent = currentTrack?.id === track.id;
            return (
              <div
                key={track.id}
                className="w-[140px] md:w-[180px] shrink-0 snap-start group"
              >
                <button
                  onClick={() => onPlayTrack(track)}
                  className={cn(
                    'relative w-full aspect-square rounded-2xl overflow-hidden border transition-all active:scale-95',
                    isCurrent ? 'border-primary shadow-[0_0_25px_hsl(var(--primary)/0.35)]' : 'border-white/5'
                  )}
                >
                  <img
                    src={track.thumbnail}
                    alt={track.title}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {isCurrent && isPlaying ? (
                      <Pause className="w-8 h-8 text-primary" />
                    ) : (
                      <Play className="w-8 h-8 text-primary" />
                    )}
                  </div>
                </button>

                <p className="mt-2.5 text-[11px] md:text-xs font-bold leading-snug line-clamp-2">{track.title}</p>
                <p className="text-[10px] text-muted-foreground truncate">{track.channel}</p>

                <div className="mt-2 flex items-center gap-1.5">
                  {onAddToQueue && (
                    <button
                      onClick={() => {
                        onAddToQueue(track);
                        toast.success('Added to queue');
                      }}
                      className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-primary active:scale-95 transition-all"
                      aria-label="Add to queue"
                    >
                      <ListPlus className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onToggleFavorite && (
                    <button
                      onClick={() => onToggleFavorite(track)}
                      className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-primary active:scale-95 transition-all"
                      aria-label="Toggle favorite"
                    >
                      <Heart
                        className={cn('w-3.5 h-3.5', isFavorite?.(track.id) && 'fill-primary text-primary')}
                      />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default MadeForYouSection;
