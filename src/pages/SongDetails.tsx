import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Play, Pause, SkipBack, SkipForward, Heart, ListPlus, ArrowLeft,
  Music2, Loader2, Sparkles, Share2, User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import MusicPlayer from '@/components/MusicPlayer';
import TrackCard from '@/components/TrackCard';
import StyledProgressBar from '@/components/StyledProgressBar';
import AddToPlaylistDialog from '@/components/AddToPlaylistDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { supabase } from '@/integrations/supabase/client';
import { getFunctionAuthHeaders } from '@/lib/functionAuth';

interface Track {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
}

const formatTime = (seconds: number) => {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

/** Strips the usual "(Official Video) [4K] | Lyrics" noise for better related-song queries */
const cleanTitle = (title: string) =>
  title
    .replace(/\((?:[^)]*(?:official|video|audio|lyric|hd|4k|remix|full)[^)]*)\)/gi, '')
    .replace(/\[(?:[^\]]*(?:official|video|audio|lyric|hd|4k)[^\]]*)\]/gi, '')
    .replace(/\|.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();

const SongDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    currentTrack, isPlaying,
    handlePlayTrack, handlePlayPause, handleNext, handlePrevious,
    handleAddToQueue, handleAddToPlaylist, handlePlayFromPlaylist,
    handleRemoveFromPlaylist, handleClearPlaylist, reorderPlaylist,
    handlePlayFromQueue, removeFromQueue,
    ytPlayerRef, audioRef, playlist, queue, isInPlaylist,
    shuffleMode, toggleShuffle, loopMode, cycleLoopMode,
    isFavorite, toggleFavorite, tracks,
  } = useMusicPlayer();

  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');

  const stateTrack = (location.state as { track?: Track } | null)?.track;
  const [track, setTrack] = useState<Track | null>(
    stateTrack && stateTrack.id === id ? stateTrack : null
  );

  const [loadingTrack, setLoadingTrack] = useState(!track);

  const [related, setRelated] = useState<Track[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  const [lyrics, setLyrics] = useState<string | null>(null);
  const [lyricsSource, setLyricsSource] = useState('');
  const [loadingLyrics, setLoadingLyrics] = useState(false);

  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isCurrent = !!track && currentTrack?.id === track.id;

  /* ---------- Resolve the track ---------- */
  useEffect(() => {
    if (!id) return;
    if (track?.id === id) return;

    const known =
      (stateTrack?.id === id ? stateTrack : undefined) ||
      tracks.find((t) => t.id === id) ||
      playlist.find((t) => t.id === id) ||
      queue.find((t) => t.id === id) ||
      (currentTrack?.id === id ? currentTrack : undefined);

    if (known) {
      setTrack(known);
      setLoadingTrack(false);
      return;
    }

    // Direct link / refresh: resolve public metadata via YouTube oEmbed
    let cancelled = false;
    setLoadingTrack(true);
    (async () => {
      try {
        const res = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(
            `https://www.youtube.com/watch?v=${id}`
          )}&format=json`
        );
        if (!res.ok) throw new Error('not found');
        const data = await res.json();
        if (cancelled) return;
        setTrack({
          id,
          title: data.title || 'Unknown track',
          channel: data.author_name || 'Unknown artist',
          thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        });
      } catch {
        if (!cancelled) setTrack(null);
      } finally {
        if (!cancelled) setLoadingTrack(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* ---------- Related / more like this ---------- */
  useEffect(() => {
    if (!track) return;
    let cancelled = false;
    setLoadingRelated(true);
    setRelated([]);
    (async () => {
      try {
        const query = `${cleanTitle(track.title)} ${track.channel}`.slice(0, 120);
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-search?q=${encodeURIComponent(query)}`,
          { headers: await getFunctionAuthHeaders() }
        );
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        if (cancelled) return;
        const list: Track[] = (Array.isArray(data) ? data : []).filter(
          (t: Track) => t?.id && t.id !== track.id
        );
        setRelated(list);
      } catch {
        if (!cancelled) setRelated([]);
      } finally {
        if (!cancelled) setLoadingRelated(false);
      }
    })();
    return () => { cancelled = true; };
  }, [track?.id]);

  /* ---------- Lyrics ---------- */
  useEffect(() => {
    if (!track) return;
    let cancelled = false;
    setLyrics(null);
    setLyricsSource('');
    setLoadingLyrics(true);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-lyrics', {
          body: { trackId: track.id, trackTitle: track.title, trackChannel: track.channel },
        });
        if (error) throw error;
        if (cancelled) return;
        setLyrics(data?.lyrics || null);
        setLyricsSource(data?.source || '');
      } catch {
        if (!cancelled) setLyrics(null);
      } finally {
        if (!cancelled) setLoadingLyrics(false);
      }
    })();
    return () => { cancelled = true; };
  }, [track?.id]);

  /* ---------- Progress (reads the existing global player) ---------- */
  useEffect(() => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (!isCurrent) { setProgress(0); setDuration(0); return; }

    progressIntervalRef.current = setInterval(() => {
      const el = audioRef?.current;
      if (el && el.src && !el.paused) {
        setProgress(el.currentTime);
        setDuration(isFinite(el.duration) ? el.duration : 0);
        return;
      }
      try {
        setProgress(ytPlayerRef?.current?.getCurrentTime?.() || 0);
        setDuration(ytPlayerRef?.current?.getDuration?.() || 0);
      } catch {}
    }, 250);

    return () => { if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); };
  }, [isCurrent, isPlaying, audioRef, ytPlayerRef]);

  const handleSeek = useCallback((value: number) => {
    setProgress(value);
    if (audioRef?.current && audioRef.current.src) audioRef.current.currentTime = value;
    try { ytPlayerRef?.current?.seekTo?.(value, true); } catch {}
  }, [audioRef, ytPlayerRef]);

  const handleMainPlay = () => {
    if (!track) return;
    if (isCurrent) handlePlayPause();
    else handlePlayTrack(track, [track, ...related]);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/song/${track?.id}`);
    toast.success('Song link copied!');
  };

  const handleNavbarSearch = () => {
    if (searchQuery.trim()) navigate(`/?search=${encodeURIComponent(searchQuery)}`);
  };

  const moreLikeThis = related.slice(0, 6);
  const recommended = related.slice(6, 18);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="ml-0 md:ml-64">
        <Navbar searchQuery={searchQuery} onSearchChange={setSearchQuery} onSearch={handleNavbarSearch} />

        <main className="pt-24 md:pt-28 pb-40 px-4 md:px-8">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>

          {loadingTrack ? (
            <div className="flex flex-col md:flex-row gap-8">
              <Skeleton className="w-full md:w-80 aspect-square rounded-[2rem]" />
              <div className="flex-1 space-y-4">
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          ) : !track ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="p-4 rounded-full bg-primary/10 mb-4">
                <Music2 className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-xl font-semibold mb-2">Song not found</h1>
              <p className="text-muted-foreground mb-6">We couldn't load details for this track.</p>
              <Link to="/"><Button>Back to Home</Button></Link>
            </div>
          ) : (
            <>
              {/* ===== Hero ===== */}
              <section className="glass-premium rounded-[2rem] border border-white/5 p-4 md:p-8 shadow-xl">
                <div className="flex flex-col md:flex-row gap-6 md:gap-10">
                  <div className="relative w-full max-w-xs mx-auto md:mx-0 md:w-72 lg:w-80 shrink-0">
                    <div className="aspect-square rounded-[1.5rem] overflow-hidden shadow-2xl">
                      <img
                        src={track.thumbnail}
                        alt={`${track.title} artwork`}
                        className={cn(
                          'w-full h-full object-cover transition-transform duration-700',
                          isCurrent && isPlaying && 'scale-105'
                        )}
                      />
                    </div>
                    {isCurrent && isPlaying && (
                      <div className="absolute top-3 left-3 flex items-end gap-0.5 h-4 bg-primary/90 rounded-md px-1.5 py-1">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="w-0.5 bg-primary-foreground rounded-full equalizer-bar" style={{ height: '100%' }} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Song</p>
                    <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight break-words">
                      {track.title}
                    </h1>
                    <p className="mt-3 text-muted-foreground flex items-center gap-2 text-sm md:text-base">
                      <User className="w-4 h-4 shrink-0" />
                      <span className="truncate">{track.channel}</span>
                    </p>

                    {/* Progress */}
                    <div className="mt-6">
                      <StyledProgressBar
                        progress={progress}
                        duration={duration}
                        onSeek={handleSeek}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-2 tabular-nums">
                        <span>{formatTime(progress)}</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="mt-6 flex flex-wrap items-center gap-3">
                      <button
                        onClick={handlePrevious}
                        aria-label="Previous track"
                        className="w-11 h-11 rounded-full bg-white/10 text-foreground flex items-center justify-center hover:bg-white/20 transition-all active:scale-95"
                      >
                        <SkipBack className="w-5 h-5 fill-current" />
                      </button>

                      <button
                        onClick={handleMainPlay}
                        aria-label={isCurrent && isPlaying ? 'Pause' : 'Play'}
                        className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl neon-glow hover:scale-105 transition-all active:scale-95"
                      >
                        {isCurrent && isPlaying
                          ? <Pause className="w-6 h-6 fill-current" />
                          : <Play className="w-6 h-6 fill-current ml-0.5" />}
                      </button>

                      <button
                        onClick={handleNext}
                        aria-label="Next track"
                        className="w-11 h-11 rounded-full bg-white/10 text-foreground flex items-center justify-center hover:bg-white/20 transition-all active:scale-95"
                      >
                        <SkipForward className="w-5 h-5 fill-current" />
                      </button>

                      <div className="w-px h-8 bg-border mx-1 hidden sm:block" />

                      <button
                        onClick={() => toggleFavorite(track)}
                        aria-label="Toggle favorite"
                        className={cn(
                          'w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95',
                          isFavorite(track.id)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-white/10 text-foreground hover:bg-white/20'
                        )}
                      >
                        <Heart className="w-5 h-5" fill={isFavorite(track.id) ? 'currentColor' : 'none'} />
                      </button>

                      <AddToPlaylistDialog
                        track={track}
                        trigger={
                          <button
                            aria-label="Add to playlist"
                            className="w-11 h-11 rounded-full bg-white/10 text-foreground flex items-center justify-center hover:bg-white/20 transition-all active:scale-95"
                          >
                            <ListPlus className="w-5 h-5" />
                          </button>
                        }
                      />

                      <button
                        onClick={handleShare}
                        aria-label="Share song"
                        className="w-11 h-11 rounded-full bg-white/10 text-foreground flex items-center justify-center hover:bg-white/20 transition-all active:scale-95"
                      >
                        <Share2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* ===== Lyrics + Info ===== */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
                <section className="lg:col-span-2 glass-premium rounded-[2rem] border border-white/5 p-5 md:p-7">
                  <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-primary" /> Lyrics
                  </h2>
                  {loadingLyrics ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
                      <Loader2 className="w-4 h-4 animate-spin" /> Finding lyrics...
                    </div>
                  ) : lyrics ? (
                    <>
                      <pre className="whitespace-pre-wrap font-sans text-sm md:text-base leading-relaxed text-foreground/90 max-h-[26rem] overflow-y-auto no-scrollbar">
                        {lyrics}
                      </pre>
                      {lyricsSource && (
                        <p className="text-xs text-muted-foreground mt-4">Source: {lyricsSource}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground py-6">
                      No lyrics available for this song yet.
                    </p>
                  )}
                </section>

                <section className="glass-premium rounded-[2rem] border border-white/5 p-5 md:p-7">
                  <h2 className="text-lg font-semibold mb-4">Song info</h2>
                  <dl className="space-y-4 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Title</dt>
                      <dd className="text-foreground break-words">{track.title}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Artist / Channel</dt>
                      <dd className="text-foreground break-words">{track.channel}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Duration</dt>
                      <dd className="text-foreground tabular-nums">
                        {duration > 0 ? formatTime(duration) : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Status</dt>
                      <dd className="text-foreground">
                        {isCurrent ? (isPlaying ? 'Now playing' : 'Paused') : 'Not playing'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">In playlist</dt>
                      <dd className="text-foreground">{isInPlaylist(track.id) ? 'Yes' : 'No'}</dd>
                    </div>
                  </dl>
                  <Button
                    variant="secondary"
                    className="w-full mt-6 gap-2"
                    onClick={() => handleAddToQueue(track)}
                  >
                    <ListPlus className="w-4 h-4" /> Add to queue
                  </Button>
                </section>
              </div>

              {/* ===== More like this ===== */}
              <section className="mt-10">
                <h2 className="text-lg md:text-xl font-semibold mb-4">More like this</h2>
                {loadingRelated ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[...Array(6)].map((_, i) => (
                      <Skeleton key={i} className="aspect-square rounded-[2rem]" />
                    ))}
                  </div>
                ) : moreLikeThis.length ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {moreLikeThis.map((t) => (
                      <TrackCard
                        key={t.id}
                        track={t}
                        isCurrent={currentTrack?.id === t.id}
                        isPlaying={isPlaying}
                        onPlay={(sel) => handlePlayTrack(sel, related)}
                        onAddToQueue={handleAddToQueue}
                        isFavorite={isFavorite(t.id)}
                        onToggleFavorite={toggleFavorite}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No similar songs found right now.</p>
                )}
              </section>

              {/* ===== Recommended ===== */}
              {recommended.length > 0 && (
                <section className="mt-10">
                  <h2 className="text-lg md:text-xl font-semibold mb-4">Recommended for you</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {recommended.map((t) => (
                      <TrackCard
                        key={t.id}
                        track={t}
                        isCurrent={currentTrack?.id === t.id}
                        isPlaying={isPlaying}
                        onPlay={(sel) => handlePlayTrack(sel, related)}
                        onAddToQueue={handleAddToQueue}
                        isFavorite={isFavorite(t.id)}
                        onToggleFavorite={toggleFavorite}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </main>

        <MusicPlayer
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onAddToPlaylist={handleAddToPlaylist}
          isInPlaylist={currentTrack ? isInPlaylist(currentTrack.id) : false}
          playlist={playlist}
          onPlayFromPlaylist={handlePlayFromPlaylist}
          onRemoveFromPlaylist={handleRemoveFromPlaylist}
          onClearPlaylist={handleClearPlaylist}
          onReorderPlaylist={reorderPlaylist}
          ytPlayerRef={ytPlayerRef}
          audioRef={audioRef}
          shuffleMode={shuffleMode}
          onToggleShuffle={toggleShuffle}
          loopMode={loopMode}
          onCycleLoopMode={cycleLoopMode}
          queue={queue}
          onRemoveFromQueue={removeFromQueue}
          onPlayFromQueue={handlePlayFromQueue}
        />
      </div>
    </div>
  );
};

export default SongDetails;
