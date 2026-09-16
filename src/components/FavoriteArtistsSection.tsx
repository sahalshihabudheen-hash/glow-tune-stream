import { useState, useEffect } from 'react';
import { Play, Pause, Heart, ListPlus, Flame, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { getFunctionAuthHeaders } from '@/lib/functionAuth';
import { filterOutShorts } from '@/lib/shorts';
import { readCache, writeCache, prefetchThumbs } from '@/lib/offlineCache';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface Track {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
}

interface ListeningArtist {
  name: string;
  sampleThumbnail: string;
  playCount: number;
}

interface FavoriteArtistsSectionProps {
  onPlayTrack?: (track: Track) => void;
}

const FavoriteArtistsSection = ({ onPlayTrack }: FavoriteArtistsSectionProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const player = useMusicPlayer();
  const playTrackHandler = onPlayTrack || player.handlePlayTrack;

  const [frequentArtists, setFrequentArtists] = useState<ListeningArtist[]>([]);
  const [spotlightArtist, setSpotlightArtist] = useState<string | null>(null);
  const [artistTracks, setArtistTracks] = useState<Track[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);

  // 1. Fetch user's actual top listened artists from listening_history
  useEffect(() => {
    if (!user) return;

    const fetchHistoryArtists = async () => {
      try {
        const { data, error } = await supabase
          .from('listening_history')
          .select('track_channel, track_thumbnail')
          .eq('user_id', user.id)
          .order('played_at', { ascending: false })
          .limit(100);

        if (error || !data) return;

        // Group and count plays per artist channel
        const countMap = new Map<string, { count: number; thumbnail: string }>();
        data.forEach((row: any) => {
          const raw = row.track_channel || '';
          const cleaned = raw.replace(/\s*-\s*topic$/i, '').replace(/vevo$/i, '').trim();
          if (!cleaned) return;

          const existing = countMap.get(cleaned);
          if (existing) {
            existing.count += 1;
          } else {
            countMap.set(cleaned, { count: 1, thumbnail: row.track_thumbnail || '' });
          }
        });

        const sorted = [...countMap.entries()]
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 10)
          .map(([name, val]) => ({
            name,
            sampleThumbnail: val.thumbnail,
            playCount: val.count,
          }));

        setFrequentArtists(sorted);
        if (sorted.length > 0) {
          setSpotlightArtist(sorted[0].name);
        }
      } catch (err) {
        console.error('Failed to parse listening artists', err);
      }
    };

    fetchHistoryArtists();
  }, [user]);

  // 2. Fetch tracks for the active/selected artist ("More like [Artist]")
  useEffect(() => {
    if (!spotlightArtist) return;

    let cancelled = false;
    const fetchArtistSongs = async () => {
      setLoadingTracks(true);
      const cacheKey = `artist_spotlight_${spotlightArtist.toLowerCase()}`;
      const cached = readCache<Track[]>(cacheKey);

      if (cached && cached.length > 0) {
        setArtistTracks(cached);
        setLoadingTracks(false);
      }

      try {
        const query = `${spotlightArtist} top hits songs`;
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-search?q=${encodeURIComponent(query)}`,
          { headers: await getFunctionAuthHeaders() }
        );

        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        if (cancelled || !Array.isArray(data)) return;

        const filtered = filterOutShorts(data).slice(0, 10);
        setArtistTracks(filtered);
        writeCache(cacheKey, filtered);
        prefetchThumbs(filtered.map((t: Track) => t.thumbnail));
      } catch (err) {
        console.error('Error fetching artist songs:', err);
      } finally {
        if (!cancelled) setLoadingTracks(false);
      }
    };

    fetchArtistSongs();

    return () => {
      cancelled = true;
    };
  }, [spotlightArtist]);

  if (frequentArtists.length === 0) return null;

  return (
    <div className="space-y-12">
      {/* ── SECTION 1: Your Favourite Artists (Round Profile Avatars like Spotify) ── */}
      <div>
        <div className="flex items-center gap-3 mb-6 group cursor-default">
          <div className="p-2.5 rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 shadow-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl md:text-3xl font-black tracking-tighter uppercase italic group-hover:neon-text transition-all duration-500">
              Your favourite artists
            </h2>
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.3em]">
              Detected automatically from the music you listen to
            </p>
          </div>
        </div>

        <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 no-scrollbar scroll-smooth">
          {frequentArtists.map((artist) => {
            const isSelected = spotlightArtist === artist.name;
            return (
              <button
                key={artist.name}
                onClick={() => setSpotlightArtist(artist.name)}
                className="group flex flex-col items-center gap-3 shrink-0 focus:outline-none transition-transform active:scale-95 text-center"
                style={{ width: '110px' }}
              >
                <div
                  className={cn(
                    'w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-2 transition-all p-0.5 relative shadow-xl',
                    isSelected
                      ? 'border-primary shadow-[0_0_25px_rgba(var(--primary),0.5)] scale-105'
                      : 'border-white/10 group-hover:border-primary/60 group-hover:scale-105'
                  )}
                >
                  {artist.sampleThumbnail ? (
                    <img
                      src={artist.sampleThumbnail}
                      alt={artist.name}
                      className="w-full h-full object-cover rounded-full group-hover:brightness-110 transition-all"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-primary/30 via-card to-background flex items-center justify-center font-black text-xl text-primary">
                      {artist.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  {/* Play overlay badge on hover */}
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>

                <div className="w-full px-1">
                  <p
                    className={cn(
                      'text-xs md:text-sm font-bold truncate leading-tight transition-colors',
                      isSelected ? 'text-primary font-black' : 'text-foreground group-hover:text-primary'
                    )}
                  >
                    {artist.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                    {artist.playCount} {artist.playCount === 1 ? 'play' : 'plays'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SECTION 2: More like [Artist] (Spotify Style Horizon Cards) ── */}
      {spotlightArtist && (
        <div className="rounded-3xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/5 p-5 md:p-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-3">
              {frequentArtists.find((a) => a.name === spotlightArtist)?.sampleThumbnail && (
                <img
                  src={frequentArtists.find((a) => a.name === spotlightArtist)!.sampleThumbnail}
                  alt={spotlightArtist}
                  className="w-12 h-12 rounded-full object-cover border-2 border-primary/40 shadow-md"
                />
              )}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">
                  More like
                </p>
                <h3 className="text-xl md:text-3xl font-black tracking-tight text-white">
                  {spotlightArtist}
                </h3>
              </div>
            </div>

            <button
              onClick={() => navigate(`/?search=${encodeURIComponent(spotlightArtist)}`)}
              className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              <span>Explore all {spotlightArtist}</span>
              <span>→</span>
            </button>
          </div>

          {loadingTracks ? (
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="w-40 md:w-48 shrink-0 space-y-3 animate-pulse">
                  <div className="w-full aspect-square rounded-2xl bg-white/5" />
                  <div className="h-3 w-3/4 bg-white/10 rounded" />
                  <div className="h-2 w-1/2 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : artistTracks.length > 0 ? (
            <div className="flex gap-4 md:gap-5 overflow-x-auto pb-4 no-scrollbar scroll-smooth">
              {artistTracks.map((track) => {
                const isThisPlaying = player.currentTrack?.id === track.id && player.isPlaying;
                return (
                  <div
                    key={track.id}
                    onClick={() => playTrackHandler(track)}
                    className="group relative w-40 md:w-48 shrink-0 rounded-2xl bg-card/40 border border-white/5 hover:border-primary/40 p-3 transition-all hover:bg-card/80 hover:shadow-2xl hover:shadow-primary/10 cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      {/* Thumbnail with floating Play button like Spotify */}
                      <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-3 bg-black/40">
                        <img
                          src={track.thumbnail}
                          alt={track.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />

                        {/* Floating Play Button */}
                        <div
                          className={cn(
                            'absolute right-2.5 bottom-2.5 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl transition-all duration-300',
                            isThisPlaying
                              ? 'opacity-100 translate-y-0 scale-100'
                              : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-105 active:scale-95'
                          )}
                        >
                          {isThisPlaying ? (
                            <Pause className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          )}
                        </div>
                      </div>

                      {/* Title & Artist */}
                      <h4 className="text-xs md:text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                        {track.title}
                      </h4>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {track.channel}
                      </p>
                    </div>

                    {/* Quick actions on card */}
                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          player.handleAddToQueue(track);
                        }}
                        className="text-muted-foreground hover:text-foreground text-[11px] flex items-center gap-1"
                        title="Add to queue"
                      >
                        <ListPlus className="w-3.5 h-3.5" />
                        <span>Queue</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          player.toggleFavorite(track);
                        }}
                        className={cn(
                          'transition-colors',
                          player.isFavorite(track.id)
                            ? 'text-primary'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                        title="Favorite"
                      >
                        <Heart
                          className={cn(
                            'w-3.5 h-3.5',
                            player.isFavorite(track.id) && 'fill-current'
                          )}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No tracks found for this artist.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default FavoriteArtistsSection;
