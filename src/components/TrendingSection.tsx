import { useState, useEffect, useRef } from 'react';
import { TrendingUp, Play, ListPlus, ChevronLeft, ChevronRight, Heart, Pause, Flame, Download } from 'lucide-react';
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

interface TrendingSectionProps {
  onPlayTrack: (track: Track) => void;
  currentTrack: Track | null;
  isPlaying?: boolean;
  onAddToQueue?: (track: Track) => void;
  isFavorite?: (trackId: string) => boolean;
  onToggleFavorite?: (track: Track) => Promise<boolean>;
}

const TrendingSection = ({ onPlayTrack, currentTrack, isPlaying, onAddToQueue, isFavorite, onToggleFavorite }: TrendingSectionProps) => {
  const { gradient } = useTheme();
  const { startDownload } = useDownloadManager();
  const navigate = useNavigate();

  const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    fetchTrending();
  }, []);

  const fetchTrending = async () => {
    setLoading(true);
    try {
      // Use the new get-trending endpoint for auto-updating trending music
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-trending`,
        {
          headers: await getFunctionAuthHeaders(),
        }
      );

      if (!response.ok) throw new Error('Failed to fetch trending');

      const results = await response.json();
      if (results.error) throw new Error(results.error);

      setTrendingTracks(results.slice(0, 20));
    } catch (error) {
      console.warn('Trending fetch error:', error);
      // Fallback to youtube-search if get-trending fails
      try {
        const fallbackResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-search?q=${encodeURIComponent('trending music hits')}`,
          {
            headers: await getFunctionAuthHeaders(),
          }
        );
        if (fallbackResponse.ok) {
          const fallbackResults = await fallbackResponse.json();
          setTrendingTracks(fallbackResults.slice(0, 20));
        }
      } catch {
        // Use famous songs as fallback when all APIs fail
        setTrendingTracks(famousSongs.slice(0, 12));
      }
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
      const scrollAmount = 320;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
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
  }, [trendingTracks]);

  if (loading) {
    return (
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative">
            <Flame className="w-6 h-6 text-primary glow-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Trending Now</h2>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[...Array(6)].map((_, i) => (
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

  if (trendingTracks.length === 0) return null;

  return (
    <section className="mb-10 relative">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/30 blur-lg" />
            <div 
              className="relative w-10 h-10 rounded-full flex items-center justify-center"
              style={gradient.enabled ? { background: 'var(--theme-gradient)' } : { backgroundColor: 'hsl(var(--primary))' }}
            >
              <Flame className="w-5 h-5 text-primary-foreground" />
            </div>
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground">Trending Now</h2>
            <p className="text-xs text-muted-foreground hidden md:block">Hot tracks everyone's listening to</p>
          </div>
        </div>
        
        {/* Navigation Arrows */}
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => scrollContainer('left')}
            disabled={!canScrollLeft}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-all",
              canScrollLeft 
                ? "bg-secondary hover:bg-primary hover:text-primary-foreground" 
                : "bg-secondary/50 text-muted-foreground cursor-not-allowed"
            )}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scrollContainer('right')}
            disabled={!canScrollRight}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-all",
              canScrollRight 
                ? "bg-secondary hover:bg-primary hover:text-primary-foreground" 
                : "bg-secondary/50 text-muted-foreground cursor-not-allowed"
            )}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable Track List */}
      <div className="relative">
        {/* Left fade */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-4 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none hidden md:block" />
        )}
        
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide scroll-smooth -mx-2 px-2"
        >
          {trendingTracks.map((track, index) => {
            const isCurrentTrack = currentTrack?.id === track.id;
            const isTrackPlaying = isCurrentTrack && isPlaying;
            
            return (
              <div
                key={track.id}
                className={cn(
                  'flex-shrink-0 w-40 md:w-48 group cursor-pointer animate-in-up',
                )}
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => navigate(`/song/${track.id}`, { state: { track } })}
              >
                <div className={cn(
                  "relative w-full aspect-square rounded-2xl overflow-hidden bg-secondary transition-all duration-300",
                  isCurrentTrack ? "ring-2 ring-primary neon-glow scale-105" : "card-glow"
                )}>
                  <img
                    src={track.thumbnail}
                    alt={track.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  
                  {/* Overlay - pointer-events-none so card clicks pass through */}
                  <div className={cn(
                    "absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent transition-opacity duration-300 pointer-events-none",
                    "opacity-100"
                  )}>
                    {/* Action buttons */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 pointer-events-auto">
                      <button
                        onClick={(e) => { e.stopPropagation(); onPlayTrack(track); }}
                        className={cn(
                          "w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-lg",
                          isTrackPlaying 
                            ? "bg-primary text-primary-foreground neon-glow animate-pulse" 
                            : "bg-primary text-primary-foreground hover:neon-glow active:scale-95"
                        )}
                      >
                        <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
                      </button>

                      
                      {onAddToQueue && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddToQueue(track);
                            toast.success('Added to queue!');
                          }}
                          className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition-colors active:scale-95"
                          title="Add to Queue"
                        >
                          <ListPlus className="w-4 h-4" />
                        </button>
                      )}
                      
                      {onToggleFavorite && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(track);
                          }}
                          className={cn(
                            "w-9 h-9 rounded-full flex items-center justify-center transition-colors active:scale-95 backdrop-blur-sm",
                            isFavorite?.(track.id) 
                              ? "bg-primary text-primary-foreground" 
                              : "bg-white/20 text-white hover:bg-white/30"
                          )}
                          title={isFavorite?.(track.id) ? "Remove from Favorites" : "Add to Favorites"}
                        >
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

                  
                  {/* Playing indicator */}
                  {isTrackPlaying && (
                    <div className="absolute top-3 left-3 flex items-end gap-0.5 h-4 bg-primary/90 rounded-lg px-2 py-1">
                      {[...Array(4)].map((_, i) => (
                        <div
                          key={i}
                          className="w-1 bg-primary-foreground rounded-full equalizer-bar"
                          style={{ height: '100%' }}
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* Rank badge */}
                  <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <span className="text-xs font-bold text-white">#{index + 1}</span>
                  </div>
                </div>
                
                {/* Track info */}
                <h3 className="mt-3 text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                  {track.title}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                  {track.channel}
                </p>
              </div>
            );
          })}
        </div>
        
        {/* Right fade */}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-4 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none hidden md:block" />
        )}
      </div>
    </section>
  );
};

export default TrendingSection;
