import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Heart, ListPlus, ChevronLeft, ChevronRight, MapPin, Music2, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { famousSongs } from '@/data/famousSongs';
import { useDownloadManager } from '@/contexts/DownloadManagerContext';
import { getFunctionAuthHeaders } from '@/lib/functionAuth';


interface Track {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
}

interface PersonalizedSectionProps {
  title: string;
  subtitle?: string;
  icon: 'regional' | 'genre';
  searchParams: Record<string, string>;
  onPlayTrack: (track: Track) => void;
  currentTrack: Track | null;
  isPlaying?: boolean;
  onAddToQueue?: (track: Track) => void;
  isFavorite?: (trackId: string) => boolean;
  onToggleFavorite?: (track: Track) => Promise<boolean>;
}

const PersonalizedSection = ({
  title, subtitle, icon, searchParams,
  onPlayTrack, currentTrack, isPlaying,
  onAddToQueue, isFavorite, onToggleFavorite,
}: PersonalizedSectionProps) => {
  const { gradient } = useTheme();
  const { startDownload } = useDownloadManager();
  const navigate = useNavigate();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    fetchSongs();
  }, [JSON.stringify(searchParams)]);

  const fetchSongs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(searchParams);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-personalized-songs?${params}`,
        {
          headers: await getFunctionAuthHeaders(),
        }
      );
      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setTracks(data.slice(0, 12));
    } catch (err) {
      console.error('Personalized fetch error:', err);
      // Use shuffled famous songs as fallback
      const shuffled = [...famousSongs].sort(() => Math.random() - 0.5);
      setTracks(shuffled.slice(0, 8));
    } finally {
      setLoading(false);
    }
  };

  const updateScrollButtons = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scrollContainer = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -320 : 320,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      container.addEventListener('scroll', updateScrollButtons);
      updateScrollButtons();
      return () => container.removeEventListener('scroll', updateScrollButtons);
    }
  }, [tracks]);

  if (loading) {
    return (
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-6">
          {icon === 'regional' ? <MapPin className="w-5 h-5 text-primary" /> : <Music2 className="w-5 h-5 text-primary" />}
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-40 md:w-48 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="w-full aspect-square rounded-2xl bg-secondary shimmer" />
              <div className="mt-3 h-4 bg-secondary rounded-lg w-3/4" />
              <div className="mt-2 h-3 bg-secondary rounded-lg w-1/2" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (tracks.length === 0) return null;

  return (
    <section className="mb-10 relative">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/30 blur-lg" />
            <div
              className="relative w-10 h-10 rounded-full flex items-center justify-center"
              style={gradient.enabled ? { background: 'var(--theme-gradient)' } : { backgroundColor: 'hsl(var(--primary))' }}
            >
              {icon === 'regional' ? <MapPin className="w-5 h-5 text-primary-foreground" /> : <Music2 className="w-5 h-5 text-primary-foreground" />}
            </div>
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground hidden md:block">{subtitle}</p>}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <button onClick={() => scrollContainer('left')} disabled={!canScrollLeft}
            className={cn("w-10 h-10 rounded-full flex items-center justify-center transition-all",
              canScrollLeft ? "bg-secondary hover:bg-primary hover:text-primary-foreground" : "bg-secondary/50 text-muted-foreground cursor-not-allowed"
            )}><ChevronLeft className="w-5 h-5" /></button>
          <button onClick={() => scrollContainer('right')} disabled={!canScrollRight}
            className={cn("w-10 h-10 rounded-full flex items-center justify-center transition-all",
              canScrollRight ? "bg-secondary hover:bg-primary hover:text-primary-foreground" : "bg-secondary/50 text-muted-foreground cursor-not-allowed"
            )}><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="relative">
        {canScrollLeft && <div className="absolute left-0 top-0 bottom-4 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none hidden md:block" />}
        <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide scroll-smooth -mx-2 px-2">
          {tracks.map((track) => {
            const isCurrentTrack = currentTrack?.id === track.id;
            const isTrackPlaying = isCurrentTrack && isPlaying;

            return (
              <div key={track.id} className="flex-shrink-0 w-40 md:w-48 group cursor-pointer" onClick={() => navigate(`/song/${track.id}`, { state: { track } })}>
                <div className={cn(
                  "relative w-full aspect-square rounded-2xl overflow-hidden bg-secondary transition-all duration-300",
                  isCurrentTrack ? "ring-2 ring-primary neon-glow scale-105" : "card-glow"
                )}>
                  <img src={track.thumbnail} alt={track.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  <div className={cn(
                    "absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent transition-opacity duration-300 pointer-events-none",
                    "opacity-100"
                  )}>
                    <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 pointer-events-auto">
                      <button onClick={(e) => { e.stopPropagation(); onPlayTrack(track); }}
                        className={cn("w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-lg",
                          isTrackPlaying ? "bg-primary text-primary-foreground neon-glow animate-pulse" : "bg-primary text-primary-foreground hover:neon-glow active:scale-95"
                        )}>
                        <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
                      </button>


                      {onAddToQueue && (
                        <button onClick={(e) => { e.stopPropagation(); onAddToQueue(track); toast.success('Added to queue!'); }}
                          className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition-colors active:scale-95"
                          title="Add to Queue"><ListPlus className="w-4 h-4" /></button>
                      )}
                      {onToggleFavorite && (
                        <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(track); }}
                          className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-colors active:scale-95 backdrop-blur-sm",
                            isFavorite?.(track.id) ? "bg-primary text-primary-foreground" : "bg-white/20 text-white hover:bg-white/30"
                          )} title={isFavorite?.(track.id) ? "Remove from Favorites" : "Add to Favorites"}>
                          <Heart className="w-4 h-4" fill={isFavorite?.(track.id) ? 'currentColor' : 'none'} />
                        </button>
                      )}
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          startDownload({ id: track.id, title: track.title, thumbnail: track.thumbnail }); 
                        }}
                        className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition-colors active:scale-95"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {isTrackPlaying && (
                    <div className="absolute top-3 left-3 flex items-end gap-0.5 h-4 bg-primary/90 rounded-lg px-2 py-1">
                      {[...Array(4)].map((_, i) => <div key={i} className="w-1 bg-primary-foreground rounded-full equalizer-bar" style={{ height: '100%' }} />)}
                    </div>
                  )}
                </div>
                <h3 className="mt-3 text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">{track.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{track.channel}</p>
              </div>
            );
          })}
        </div>
        {canScrollRight && <div className="absolute right-0 top-0 bottom-4 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none hidden md:block" />}
      </div>
    </section>
  );
};

export default PersonalizedSection;
