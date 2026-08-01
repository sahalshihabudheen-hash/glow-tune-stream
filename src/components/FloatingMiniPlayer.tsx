import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, SkipForward, SkipBack, X, Maximize2, Music2, Download, Loader2, Share2, Repeat1 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { useLocation, useNavigate } from 'react-router-dom';
import SoundwaveVisualizer from '@/components/SoundwaveVisualizer';
import LyricsDrawer from '@/components/LyricsDrawer';
import { useDownloadManager } from '@/contexts/DownloadManagerContext';
import { toast } from 'sonner';
import StyledProgressBar from '@/components/StyledProgressBar';

const PLAYER_WIDTH = 320;
const PLAYER_HEIGHT = 136;
const EDGE_PADDING = 12;

const formatTime = (seconds: number) => {
  if (isNaN(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const FloatingMiniPlayer = () => {
  const {
    currentTrack,
    isPlaying,
    handlePlayPause,
    handleNext,
    handlePrevious,
    ytPlayerRef,
    audioRef,
    showMiniPlayer,
    setShowMiniPlayer,
    queue,
    playlist,
    handlePlayFromQueue,
    handlePlayFromPlaylist,
    loopMode,
    loopOneCount,
    toggleLoopOne,
  } = useMusicPlayer();

  // Compute the next-up track (queue first, otherwise next playlist track)
  const nextUpTrack = useMemo(() => {
    if (queue && queue.length > 0) return { track: queue[0], source: 'queue' as const };
    if (currentTrack && playlist && playlist.length > 0) {
      const idx = playlist.findIndex(t => t.id === currentTrack.id);
      if (idx !== -1 && idx < playlist.length - 1) {
        return { track: playlist[idx + 1], source: 'playlist' as const };
      }
    }
    return null;
  }, [queue, playlist, currentTrack]);

  const { startDownload, isDownloading } = useDownloadManager();
  const navigate = useNavigate();
  const location = useLocation();

  // Hide mini player on pages that have their own full player
  const hasFullPlayer = 
    location.pathname === '/' || 
    location.pathname.startsWith('/playlist/') || 
    location.pathname === '/favorites' || 
    location.pathname === '/offline' ||
    location.pathname === '/ai-dj' ||
    location.pathname === '/games' ||
    location.pathname.startsWith('/yt-artist/');

  const [isMobileSize, setIsMobileSize] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 640 : false);
  const [position, setPosition] = useState(() => ({
    x: typeof window !== 'undefined' ? Math.max(EDGE_PADDING, window.innerWidth - PLAYER_WIDTH - 24) : 0,
    y: typeof window !== 'undefined' ? Math.max(EDGE_PADDING, window.innerHeight - PLAYER_HEIGHT - 24) : 0,
  }));
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);

  const dragOffset = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);
  const playerRef = useRef<HTMLDivElement>(null);

  const shouldShow = Boolean(currentTrack && showMiniPlayer && !hasFullPlayer);

  useEffect(() => {
    if (shouldShow) {
      setIsRendered(true);
      setIsExiting(false);
      return;
    }

    if (isRendered) {
      setIsExiting(true);
      const timeout = window.setTimeout(() => {
        setIsRendered(false);
        setIsExiting(false);
      }, 220);
      return () => window.clearTimeout(timeout);
    }
  }, [shouldShow, isRendered]);

  // Clamp position on resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobileSize(window.innerWidth < 640);
      setPosition((prev) => ({
        x: Math.max(EDGE_PADDING, Math.min(prev.x, window.innerWidth - PLAYER_WIDTH - EDGE_PADDING)),
        y: Math.max(EDGE_PADDING, Math.min(prev.y, window.innerHeight - PLAYER_HEIGHT - EDGE_PADDING)),
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync mini-player progress with global audio/youtube player
  useEffect(() => {
    if (!currentTrack) {
      setProgress(0);
      setDuration(0);
      return;
    }

    const updateProgress = () => {
      if (audioRef.current && audioRef.current.src && !Number.isNaN(audioRef.current.duration)) {
        setProgress(audioRef.current.currentTime || 0);
        setDuration(audioRef.current.duration || 0);
        return;
      }

      if (ytPlayerRef.current) {
        try {
          const current = ytPlayerRef.current.getCurrentTime?.() || 0;
          const total = ytPlayerRef.current.getDuration?.() || 0;
          setProgress(current);
          setDuration(total);
        } catch {
          // player not ready yet
        }
      }
    };

    updateProgress();
    const interval = window.setInterval(updateProgress, 250);
    return () => window.clearInterval(interval);
  }, [currentTrack?.id, isPlaying, audioRef, ytPlayerRef]);

  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    if (!playerRef.current) return;
    setIsDragging(true);
    hasDragged.current = false;
    const rect = playerRef.current.getBoundingClientRect();
    dragOffset.current = { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const handleDragMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging) return;
      hasDragged.current = true;

      const newX = Math.max(
        EDGE_PADDING,
        Math.min(clientX - dragOffset.current.x, window.innerWidth - PLAYER_WIDTH - EDGE_PADDING),
      );
      const newY = Math.max(
        EDGE_PADDING,
        Math.min(clientY - dragOffset.current.y, window.innerHeight - PLAYER_HEIGHT - EDGE_PADDING),
      );

      setPosition({ x: newX, y: newY });
    },
    [isDragging],
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', handleDragEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const handleExpand = () => {
    if (hasDragged.current) return;
    navigate('/');
  };

  const handleSeek = useCallback((value: number) => {
    setProgress(value);
    if (audioRef?.current && audioRef.current.src) {
      audioRef.current.currentTime = value;
      return;
    }
    if (ytPlayerRef?.current) {
      try {
        ytPlayerRef.current.seekTo?.(value, true);
      } catch (e) {}
    }
  }, [ytPlayerRef, audioRef]);

  const progressPercent = useMemo(() => {
    if (!duration || Number.isNaN(duration)) return 0;
    return Math.min(100, (progress / duration) * 100);
  }, [progress, duration]);

  if (!isRendered || !currentTrack) return null;

  const node = (
    <div
      ref={playerRef}
      className={cn(
        'fixed z-[9998] w-[calc(100vw-24px)] select-none transition-all duration-200 md:duration-0',
        isMobileSize ? 'max-w-[480px]' : 'max-w-[320px]',
        isDragging && !isMobileSize ? 'cursor-grabbing' : 'cursor-default',
        isExiting ? 'animate-fade-out' : 'animate-fade-in',
      )}
      style={isMobileSize ? {
        left: '12px',
        right: '12px',
        bottom: '76px',
        top: 'auto',
      } : {
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="relative overflow-hidden rounded-[2rem] border border-primary/25 hover:border-primary/45 bg-zinc-950/95 backdrop-blur-md md:backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.7),0_0_20px_hsl(var(--primary)/0.1)] transition-all duration-300 hover:shadow-[0_25px_60px_rgba(0,0,0,0.8),0_0_30px_hsl(var(--primary)/0.2)]">
        {/* Row 1: Drag Area, Artwork & Track Info, Close Button */}
        <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
          <button
            type="button"
            onMouseDown={(e) => {
              if (isMobileSize) return;
              e.preventDefault();
              handleDragStart(e.clientX, e.clientY);
            }}
            onTouchStart={(e) => {
              if (isMobileSize) return;
              if (!e.touches[0]) return;
              handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
            }}
            onClick={handleExpand}
            className={cn(
              'group relative flex items-center gap-3 min-w-0 flex-1 text-left rounded-xl p-1 transition-colors',
              isDragging && !isMobileSize ? 'cursor-grabbing' : (isMobileSize ? 'cursor-default' : 'cursor-grab'),
            )}
          >
            <div className="relative shrink-0">
              <div className={cn(
                "absolute -inset-1 rounded-full bg-primary/25 blur-md transition-all duration-1000",
                isPlaying ? "opacity-100 scale-110 glow-pulse" : "opacity-0 scale-100"
              )} />
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className={cn(
                  "relative h-12 w-12 rounded-full object-cover shadow-lg border-2 border-primary/25 transition-all duration-500",
                  isPlaying ? "md:animate-spin" : ""
                )}
                style={{ animationDuration: '8s' }}
                loading="lazy"
              />
              {/* Vinyl center hub hole */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-zinc-950 border border-primary/30 z-10 shadow-inner" />
              <div className="absolute inset-0 rounded-full bg-background/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                <Maximize2 className="h-3.5 w-3.5 text-foreground" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-foreground leading-tight tracking-tight group-hover:text-primary transition-colors">
                {currentTrack.title}
              </p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <p className="truncate text-[10px] text-muted-foreground font-medium">{currentTrack.channel}</p>
                <SoundwaveVisualizer isPlaying={isPlaying} className="h-4 w-12 shrink-0 opacity-100" shape="bars" />
              </div>
            </div>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMiniPlayer(false);
            }}
            className="h-6 w-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all shrink-0"
            aria-label="Close mini player"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Row 2: Cute Interactive Progress Bar with Timestamps */}
        <div className="px-4 py-1.5 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[9px] font-bold text-muted-foreground/60 tracking-wider font-mono tabular-nums px-0.5">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <StyledProgressBar
            progress={progress}
            duration={duration}
            onSeek={handleSeek}
            className="h-1.5"
            showHandle={true}
          />
        </div>

        {/* Row 3: Mini Controls & Quick Actions */}
        <div className="flex items-center justify-between px-4 pb-3.5 pt-2">
          {/* Left Action: Previous */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrevious();
            }}
            className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all active:scale-90 shrink-0"
            aria-label="Previous track"
          >
            <SkipBack className="h-3.5 w-3.5 fill-current" />
          </button>

          {/* Center: Play/Pause Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePlayPause();
            }}
            className="h-8.5 w-8.5 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-[0_3px_10px_rgba(var(--primary),0.3)] hover:scale-105 active:scale-95 transition-all neon-glow shrink-0"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
          </button>

          {/* Right Action: Next */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all active:scale-90 shrink-0"
            aria-label="Next track"
          >
            <SkipForward className="h-3.5 w-3.5 fill-current" />
          </button>

          {/* Spacer */}
          <div className="w-2" />

          {/* Action Capsule: Lyrics, Share, Download */}
          <div className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-lg border border-white/5 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleLoopOne();
              }}
              className={cn(
                "relative p-1 rounded-md transition-all active:scale-[0.85]",
                loopOneCount > 0
                  ? "text-primary bg-primary/15"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
              aria-label={loopOneCount > 0 ? `Replay ${loopOneCount} more times` : 'Add one replay'}
              title={loopOneCount > 0 ? `Replay ${loopOneCount} more time${loopOneCount === 1 ? '' : 's'}` : 'Add one replay'}
            >
              <Repeat1 className="h-3.5 w-3.5" />
              {loopOneCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-black leading-none text-primary-foreground">
                  {loopOneCount}
                </span>
              )}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setLyricsOpen(!lyricsOpen);
              }}
              className={cn(
                "p-1 rounded-md transition-all active:scale-[0.85]",
                lyricsOpen
                  ? "text-primary bg-primary/15"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
              aria-label="Lyrics"
              title="Lyrics"
            >
              <Music2 className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (currentTrack) {
                  const shareUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/og-embed?id=${currentTrack.id}&title=${encodeURIComponent(currentTrack.title)}&channel=${encodeURIComponent(currentTrack.channel)}&thumbnail=${encodeURIComponent(currentTrack.thumbnail)}`;
                  navigator.clipboard.writeText(shareUrl);
                  toast.success('Share link copied!');
                }
              }}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all active:scale-[0.85]"
              aria-label="Share"
              title="Share"
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (currentTrack) {
                  startDownload({ id: currentTrack.id, title: currentTrack.title, thumbnail: currentTrack.thumbnail });
                }
              }}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all active:scale-[0.85]"
              aria-label="Download"
              title="Download"
            >
              {currentTrack && isDownloading(currentTrack.id) ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {nextUpTrack && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (nextUpTrack.source === 'queue') {
                handlePlayFromQueue(nextUpTrack.track);
              } else {
                handlePlayFromPlaylist(nextUpTrack.track);
              }
            }}
            className="flex items-center gap-2 w-full px-3 py-1.5 bg-secondary/40 hover:bg-secondary/70 transition-colors text-left border-t border-border/40 active:scale-[0.98]"
            aria-label={`Play next: ${nextUpTrack.track.title}`}
          >
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-primary shrink-0">
              {nextUpTrack.source === 'queue' ? '⌛ Next' : 'Next'}
            </span>
            <img
              src={nextUpTrack.track.thumbnail}
              alt=""
              className="h-6 w-6 rounded object-cover shrink-0"
              loading="lazy"
            />
            <p className="truncate text-[11px] font-semibold text-foreground/90 flex-1 min-w-0">
              {nextUpTrack.track.title}
            </p>
            <SkipForward className="h-3 w-3 text-muted-foreground shrink-0" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {createPortal(node, document.body)}
      <LyricsDrawer isOpen={lyricsOpen} onClose={() => setLyricsOpen(false)} />
    </>
  );
};

export default FloatingMiniPlayer;
