import { useState, useEffect } from 'react';
import { Clock, Play, Pause, ListPlus, Heart, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useDownloadManager } from '@/contexts/DownloadManagerContext';


interface Track {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
}

interface RecentlyPlayedSectionProps {
  onPlayTrack: (track: Track) => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  onAddToQueue?: (track: Track) => void;
  isFavorite?: (trackId: string) => boolean;
  onToggleFavorite?: (track: Track) => Promise<boolean>;
}

const RecentlyPlayedSection = ({ 
  onPlayTrack, 
  currentTrack, 
  isPlaying,
  onAddToQueue,
  isFavorite,
  onToggleFavorite
}: RecentlyPlayedSectionProps) => {
  const { user } = useAuth();
  const { startDownload } = useDownloadManager();
  const navigate = useNavigate();

  const [recentTracks, setRecentTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchRecent = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('listening_history')
          .select('track_id, track_title, track_thumbnail, track_channel, played_at')
          .eq('user_id', user.id)
          .order('played_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        // Deduplicate by track_id, keep most recent
        const seen = new Set<string>();
        const unique: Track[] = [];
        for (const row of data || []) {
          if (!seen.has(row.track_id)) {
            seen.add(row.track_id);
            unique.push({
              id: row.track_id,
              title: row.track_title,
              thumbnail: row.track_thumbnail,
              channel: row.track_channel,
            });
          }
          if (unique.length >= 15) break;
        }
        setRecentTracks(unique);
      } catch (err) {
        console.warn('Failed to fetch recently played:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecent();
  }, [user]);

  if (loading || recentTracks.length === 0) return null;

  return (
    <section className="mb-10 animate-in-up">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-8 rounded-full bg-primary" />
        <Clock className="w-5 h-5 text-primary" />
        <h2 className="text-xl md:text-2xl font-bold text-foreground">Recently Played</h2>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4">
          {recentTracks.map((track) => {
            const isCurrentTrack = currentTrack?.id === track.id;
            const isTrackPlaying = isCurrentTrack && isPlaying;
            
            return (
              <div
                key={track.id}
                className="group flex-shrink-0 w-36 md:w-44 text-left focus:outline-none cursor-pointer"
                onClick={() => navigate(`/song/${track.id}`, { state: { track } })}
              >
                <div className={cn(
                  "relative rounded-xl overflow-hidden mb-2 aspect-square bg-secondary transition-all duration-300",
                  isCurrentTrack ? "ring-2 ring-primary neon-glow" : "card-glow"
                )}>
                  <img
                    src={track.thumbnail}
                    alt={track.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                  
                  {/* Action Overlay - pointer-events-none so card clicks pass through */}
                  <div className={cn(
                    "absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent transition-opacity duration-300 flex flex-col justify-end p-3 pointer-events-none",
                    "opacity-100"
                  )}>
                    <div className="flex items-center gap-2 pointer-events-auto">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayTrack(track);
                        }}
                        className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-lg",
                          isTrackPlaying ? "bg-primary text-primary-foreground animate-pulse shadow-primary/50" : "bg-primary text-primary-foreground hover:scale-110 active:scale-95"
                        )}
                      >
                        <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                      </button>

                      
                      {onAddToQueue && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddToQueue(track);
                            toast.success('Added to queue!');
                          }}
                          className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition-all active:scale-95"
                          title="Add to Queue"
                        >
                          <ListPlus className="w-3.5 h-3.5" />
                        </button>
                      )}
                      
                      {onToggleFavorite && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(track);
                          }}
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95 backdrop-blur-sm",
                            isFavorite?.(track.id) 
                              ? "bg-primary text-primary-foreground" 
                              : "bg-white/20 text-white hover:bg-white/30"
                          )}
                          title={isFavorite?.(track.id) ? "Remove from Favorites" : "Add to Favorites"}
                        >
                          <Heart className="w-3.5 h-3.5" fill={isFavorite?.(track.id) ? 'currentColor' : 'none'} />
                        </button>
                      )}

                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          startDownload({ id: track.id, title: track.title, thumbnail: track.thumbnail });
                        }}
                        className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition-all active:scale-95"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  
                  {/* Equalizer (playing state) */}
                  {isTrackPlaying && (
                    <div className="absolute top-2 left-2 flex items-end gap-0.5 h-3 bg-primary/90 rounded-md px-1.5 py-0.5">
                      {[...Array(3)].map((_, i) => (
                        <div
                          key={i}
                          className="w-0.5 bg-primary-foreground rounded-full equalizer-bar"
                          style={{ height: '100%' }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{track.title}</p>
                <p className="text-xs text-muted-foreground truncate">{track.channel}</p>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </section>
  );
};

export default RecentlyPlayedSection;
