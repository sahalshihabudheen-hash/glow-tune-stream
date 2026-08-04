import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, SkipForward, SkipBack, ChevronDown, Music2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

/**
 * Dynamic-island style "notch" that floats at the top of the screen on phones
 * while music plays (including when the app is running in the background and
 * the user comes back to it). Tap to expand into quick controls.
 */
const MobileNowPlayingNotch = () => {
  const {
    currentTrack,
    isPlaying,
    handlePlayPause,
    handleNext,
    handlePrevious,
    audioRef,
    ytPlayerRef,
    setNowPlayingOpen,
  } = useMusicPlayer();

  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [expanded, setExpanded] = useState(false);
  const [progress, setProgress] = useState(0);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Track progress for the ring / bar
  useEffect(() => {
    if (!currentTrack) return;
    const id = setInterval(() => {
      try {
        const audio = audioRef.current;
        if (audio && audio.duration > 0 && !audio.paused) {
          setProgress((audio.currentTime / audio.duration) * 100);
          return;
        }
        const yt = ytPlayerRef.current;
        if (yt?.getDuration && yt.getDuration() > 0) {
          setProgress((yt.getCurrentTime() / yt.getDuration()) * 100);
        }
      } catch {
        /* ignore */
      }
    }, 700);
    return () => clearInterval(id);
  }, [currentTrack, audioRef, ytPlayerRef]);

  // Auto collapse after a few seconds
  useEffect(() => {
    if (!expanded) return;
    collapseTimer.current = setTimeout(() => setExpanded(false), 6000);
    return () => {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
    };
  }, [expanded]);

  if (!isMobile || !currentTrack) return null;

  return createPortal(
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[75] pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
    >
      <div
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'pointer-events-auto overflow-hidden rounded-[28px] border border-primary/25',
          'bg-background/80 backdrop-blur-xl shadow-[0_8px_30px_hsl(var(--primary)/0.25)]',
          'transition-all duration-500 ease-out',
          expanded ? 'w-[min(92vw,360px)] p-3' : 'w-[min(72vw,260px)] px-3 py-2'
        )}
      >
        <div className="flex items-center gap-3">
          {/* Artwork with progress ring */}
          <div className="relative shrink-0">
            <div
              className="absolute -inset-[3px] rounded-full"
              style={{
                background: `conic-gradient(hsl(var(--primary)) ${progress}%, hsl(var(--primary)/0.15) ${progress}%)`,
              }}
            />
            <div className="relative rounded-full overflow-hidden bg-muted h-9 w-9 ring-2 ring-background">
              {currentTrack.thumbnail ? (
                <img
                  src={currentTrack.thumbnail}
                  alt={currentTrack.title}
                  className={cn('h-full w-full object-cover', isPlaying && 'animate-[spin_8s_linear_infinite]')}
                />
              ) : (
                <Music2 className="h-4 w-4 m-auto mt-2.5 text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Title */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight">{currentTrack.title}</p>
            <p className="truncate text-[11px] text-muted-foreground leading-tight">
              {currentTrack.channel}
            </p>
          </div>

          {/* Equalizer bars / play toggle */}
          {!expanded ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePlayPause();
              }}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="shrink-0 h-8 w-8 rounded-full bg-primary/15 text-primary grid place-items-center active:scale-95 transition"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </div>

        {/* Expanded controls */}
        <div
          className={cn(
            'grid transition-all duration-500 ease-out',
            expanded ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0'
          )}
        >
          <div className="overflow-hidden">
            <div className="h-1 w-full rounded-full bg-primary/15 mb-3">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevious();
                }}
                aria-label="Previous track"
                className="h-10 w-10 rounded-full grid place-items-center text-foreground/80 active:scale-95 transition"
              >
                <SkipBack className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayPause();
                }}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="h-12 w-12 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-[0_0_20px_hsl(var(--primary)/0.5)] active:scale-95 transition"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                aria-label="Next track"
                className="h-10 w-10 rounded-full grid place-items-center text-foreground/80 active:scale-95 transition"
              >
                <SkipForward className="h-5 w-5" />
              </button>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setNowPlayingOpen(true);
                setExpanded(false);
              }}
              className="mt-3 w-full rounded-xl bg-primary/10 py-2 text-xs font-medium text-primary active:scale-[0.98] transition"
            >
              Open Now Playing
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MobileNowPlayingNotch;
