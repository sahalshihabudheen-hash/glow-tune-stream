import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Volume1, Repeat, Repeat1, Shuffle, ListPlus, Check, Minus, Plus, Maximize2, Music2, SlidersHorizontal, Download, Loader2, Share2, Zap, Headphones, MonitorPlay } from 'lucide-react';
import { toast } from 'sonner';
import SoundwaveVisualizer from './SoundwaveVisualizer';
import { cn } from '@/lib/utils';
import StyledProgressBar from './StyledProgressBar';
import PlaylistDrawer from './PlaylistDrawer';
import FullscreenPlayer from './FullscreenPlayer';
import LyricsDrawer from './LyricsDrawer';
import EqualizerPanel from './EqualizerPanel';
import NowPlayingPanel from './NowPlayingPanel';
import { useTheme } from '@/contexts/ThemeContext';
import { useDownloadManager } from '@/contexts/DownloadManagerContext';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { shareTrack } from '@/utils/shareUtils';

const DownloadButton = ({ track, compact }: { track: { id: string; title: string; thumbnail: string }; compact?: boolean }) => {
  const { startDownload, isDownloading } = useDownloadManager();
  const loading = isDownloading(track.id);
  return (
    <button 
      onClick={() => startDownload(track)} 
      className={cn(
        "rounded-xl transition-all flex items-center justify-center",
        compact ? "p-1" : "p-1.5 lg:p-2",
        loading ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
      )} 
      title="Download"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
    </button>
  );
};


interface Track {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
}

interface MusicPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onAddToPlaylist?: (track: Track) => void;
  isInPlaylist?: boolean;
  playlist?: Track[];
  onPlayFromPlaylist?: (track: Track) => void;
  onRemoveFromPlaylist?: (trackId: string) => void;
  onClearPlaylist?: () => void;
  onReorderPlaylist?: (startIndex: number, endIndex: number) => void;
  ytPlayerRef?: React.MutableRefObject<any>;
  audioRef?: React.MutableRefObject<HTMLAudioElement | null>;
  shuffleMode?: boolean;
  onToggleShuffle?: () => void;
  loopMode?: 'off' | 'all' | 'one';
  onCycleLoopMode?: () => void;
  queue?: Track[];
  onRemoveFromQueue?: (trackId: string) => void;
  onPlayFromQueue?: (track: Track) => void;
}

const MusicPlayer = ({
  currentTrack,
  isPlaying,
  onPlayPause,
  onNext,
  onPrevious,
  onAddToPlaylist,
  isInPlaylist = false,
  playlist = [],
  onPlayFromPlaylist,
  onRemoveFromPlaylist,
  onClearPlaylist,
  onReorderPlaylist,
  ytPlayerRef,
  audioRef,
  shuffleMode = false,
  onToggleShuffle,
  loopMode = 'off',
  onCycleLoopMode,
  queue = [],
  onRemoveFromQueue,
  onPlayFromQueue,
}: MusicPlayerProps) => {
  const { 
    settings,
    updateSettings 
  } = useTheme();

  const {
    currentTrack: ctxCurrentTrack,
    isPlaying: ctxIsPlaying,
    handlePlayPause: ctxOnPlayPause,
    handleNext: ctxOnNext,
    handlePrevious: ctxOnPrevious,
    handlePlayFromPlaylist,
    handlePlayFromQueue,
    handleAddToPlaylist,
    handleAddToQueue,
    handleRemoveFromPlaylist,
    handleClearPlaylist,
    playlist: ctxPlaylist,
    queue: ctxQueue,
    isInPlaylist: ctxIsInPlaylist,
    removeFromQueue,
    reorderPlaylist,
    shuffleMode: ctxShuffleMode,
    toggleShuffle,
    loopMode: ctxLoopMode,
    loopOneCount,
    cycleLoopMode,
    toggleLoopOne,
    isFavorite,
    toggleFavorite,
    volume,
    setVolume,
    isMuted,
    setIsMuted,
    nowPlayingOpen,
    setNowPlayingOpen,
    useBackgroundAudioMode,
    setUseBackgroundAudioMode,
  } = useMusicPlayer();

  const { startDownload, isDownloading } = useDownloadManager();

  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [showEQ, setShowEQ] = useState(false);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const nextUpTrack = (() => {
    if (ctxQueue.length > 0) return ctxQueue[0];
    if (currentTrack && ctxPlaylist.length > 0) {
      const idx = ctxPlaylist.findIndex(t => t.id === currentTrack.id);
      if (idx !== -1 && idx < ctxPlaylist.length - 1) return ctxPlaylist[idx + 1];
      if (idx !== -1 && ctxLoopMode === 'all') return ctxPlaylist[0];
    }
    return null;
  })();

  useEffect(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    if (isPlaying && !isDragging) {
      progressIntervalRef.current = setInterval(() => {
        if (audioRef?.current && audioRef.current.src && !isNaN(audioRef.current.duration)) {
          setProgress(audioRef.current.currentTime);
          setDuration(audioRef.current.duration);
          return;
        }
        if (ytPlayerRef?.current) {
          try {
            const currentTime = ytPlayerRef.current.getCurrentTime?.() || 0;
            const totalDuration = ytPlayerRef.current.getDuration?.() || 0;
            setProgress(currentTime);
            setDuration(totalDuration);
          } catch (e) {}
        }
      }, 250);
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, ytPlayerRef, audioRef, isDragging]);

  useEffect(() => {
    setProgress(0);
    setDuration(0);
  }, [currentTrack?.id]);

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

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setVolume(value);
    setIsMuted(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleShare = () => {
    if (currentTrack) {
      shareTrack(currentTrack);
    }
  };

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeX className="w-5 h-5" />;
    if (volume < 50) return <Volume1 className="w-5 h-5" />;
    return <Volume2 className="w-5 h-5" />;
  };

  const isMiniMode = settings.miniPlayerMode;
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  // Auto-mini player logic - triggers when playing starts or track changes
  useEffect(() => {
    if (isPlaying && settings.autoMiniPlayer && !isMiniMode) {
      updateSettings({ miniPlayerMode: true });
    }
    
    // Auto-open the Now Playing panel (video/artist) when first playing
    if (isPlaying && !hasAutoOpened && !nowPlayingOpen) {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      if (!isMobile) {
        setNowPlayingOpen(true);
      }
      setHasAutoOpened(true);
    }
  }, [isPlaying, currentTrack?.id, settings.autoMiniPlayer, isMiniMode, updateSettings, hasAutoOpened, nowPlayingOpen, setNowPlayingOpen]);

  // Shift the whole app layout when the Now Playing side panel is open (desktop only)
  useEffect(() => {
    document.documentElement.classList.toggle('np-open', nowPlayingOpen);
    return () => document.documentElement.classList.remove('np-open');
  }, [nowPlayingOpen]);

  return (
    <>
    <footer className={cn(
        'fixed bottom-20 left-3 right-3 md:bottom-6 md:left-[272px] transition-all duration-700 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden group/player glass-premium border border-white/10 z-50 beat-player-bar',
        nowPlayingOpen ? 'md:right-[380px]' : 'md:right-6',
        'h-[88px] md:h-[136px] py-2 px-3 md:px-8'
      )}>
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-primary/60 to-transparent beat-player-strip group-hover/player:opacity-100 transition-opacity" />
        
        {/* Mobile View Player (h-[88px] on mobile, hidden on desktop) */}
        <div className="flex md:hidden h-full w-full items-center justify-between relative z-10 gap-2">
          {/* Left: Track Info + Seek Bar */}
          <div 
            className="flex-1 flex flex-col justify-center min-w-0 cursor-pointer"
            onClick={() => currentTrack && setIsFullscreen(true)}
          >
            {/* Top row: thumbnail + text */}
            <div className="flex items-center gap-2 min-w-0">
              {currentTrack ? (
                <>
                  <div className="relative shrink-0">
                    <div className={cn(
                      "absolute -inset-1 rounded-lg bg-primary/30 blur-md transition-all duration-1000 beat-art-glow",
                      isPlaying ? "opacity-100 scale-110" : "opacity-0 scale-100"
                    )} />
                    <img
                      src={currentTrack.thumbnail}
                      alt={currentTrack.title}
                      className="relative w-10 h-10 rounded-lg object-cover shadow-md"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[11px] font-black text-foreground truncate tracking-tight">
                      {currentTrack.title}
                    </h3>
                    <p className="text-[8px] font-black text-muted-foreground/60 truncate uppercase tracking-widest mt-0.5">
                      {currentTrack.channel}
                    </p>
                    <SoundwaveVisualizer isPlaying={isPlaying} className="mt-1 h-4 w-full max-w-28" shape="spectrum" />
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 opacity-40">
                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/5" />
                  <div className="space-y-1">
                    <div className="h-2 w-16 bg-white/10 rounded-full" />
                    <div className="h-1.5 w-12 bg-white/5 rounded-full" />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom row: seek progress bar */}
            <div className="flex items-center gap-1 mt-1.5 px-0.5 w-full">
              <span className="text-[7px] font-bold text-muted-foreground tabular-nums w-5 text-right shrink-0">{formatTime(progress)}</span>
              <StyledProgressBar
                progress={progress}
                duration={duration}
                onSeek={handleSeek}
                className="flex-1 min-w-[60px]"
              />
              <span className="text-[7px] font-bold text-muted-foreground tabular-nums w-5 shrink-0">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Center Play/Pause Pill */}
          <div className="shrink-0 flex items-center justify-center">
            <button
              onClick={onPlayPause}
              className="w-10 h-10 rounded-[1.1rem] bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 active:scale-95 transition-all neon-glow beat-play-btn"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
          </div>

          {/* Right actions pill/capsule — kept minimal on small phones; full set in fullscreen player */}
          <div className="shrink-0 flex items-center justify-end">
            <div className="flex items-center gap-0.5 px-1.5 py-1.5 rounded-full bg-white/5 border border-white/5">
              <button 
                onClick={() => setLyricsOpen(!lyricsOpen)} 
                className={cn("hidden min-[420px]:flex p-1.5 rounded-full transition-all", lyricsOpen ? "text-primary" : "text-muted-foreground hover:text-foreground")}
                title="Lyrics"
              >
                <Music2 className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={toggleLoopOne} 
                className={cn("relative p-1.5 rounded-full transition-all", loopOneCount > 0 ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")}
                title={loopOneCount > 0 ? `Replay ${loopOneCount} more time${loopOneCount === 1 ? '' : 's'}` : 'Add one replay'}
              >
                <Repeat1 className="w-3.5 h-3.5" />
                {loopOneCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-black leading-none text-primary-foreground">
                    {loopOneCount}
                  </span>
                )}
              </button>
              <button 
                onClick={handleShare} 
                className="hidden min-[420px]:flex p-1.5 rounded-full text-muted-foreground hover:text-foreground transition-all"
                title="Share"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
              {currentTrack && (
                <button 
                  onClick={() => startDownload(currentTrack)} 
                  className={cn(
                    "p-1.5 rounded-full transition-all",
                    isDownloading(currentTrack.id) ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )} 
                  title="Download"
                >
                  {isDownloading(currentTrack.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                </button>
              )}
              <button 
                onClick={() => currentTrack && setIsFullscreen(true)} 
                className="p-1.5 rounded-full text-muted-foreground hover:text-foreground transition-all"
                title="Fullscreen"
              >
                <MonitorPlay className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Desktop View Player (hidden on mobile, flex on desktop) */}
        <div className="hidden md:flex h-full items-center justify-between relative z-10 gap-4 lg:gap-8">
          {/* Left: Track Info */}
          <div 
            className={cn(
              "flex items-center gap-3 cursor-pointer group/track min-w-0 transition-all duration-500 shrink-0",
              nowPlayingOpen ? "w-48 lg:w-60" : "w-64 lg:w-76"
            )}
            onClick={() => currentTrack && setIsFullscreen(true)}
          >
            {currentTrack ? (
              <>
                <div className="relative shrink-0">
                  <div className={cn(
                    "absolute -inset-1 rounded-xl bg-primary/30 blur-md transition-all duration-1000 beat-art-glow",
                    isPlaying ? "opacity-100 scale-110" : "opacity-0 scale-100"
                  )} />
                  <img
                    src={currentTrack.thumbnail}
                    alt={currentTrack.title}
                    className="relative w-12 h-12 rounded-xl object-cover shadow-xl transition-transform duration-500 group-hover/track:scale-105"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[13px] font-black text-foreground truncate group-hover/track:text-primary transition-colors tracking-tight">
                    {currentTrack.title}
                  </h3>
                  <p className="text-[9px] font-black text-muted-foreground/60 truncate uppercase tracking-widest mt-0.5">
                    {currentTrack.channel}
                  </p>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 opacity-40">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/5" />
                <div className="space-y-1.5">
                  <div className="h-2.5 w-20 bg-white/10 rounded-full" />
                  <div className="h-1.5 w-12 bg-white/5 rounded-full" />
                </div>
              </div>
            )}
          </div>

          {/* Center Tier: Controls and Progress */}
          <div className="flex-1 max-w-md lg:max-w-xl h-full flex flex-col items-center justify-between py-1.5 mx-auto min-w-0 px-2">
            {/* Controls (Top) */}
            <div className="flex items-center gap-6 lg:gap-8">
              <button 
                onClick={onPrevious}
                className="text-muted-foreground hover:text-foreground transition-all active:scale-90 beat-skip-btn"
              >
                <SkipBack className="w-4.5 h-4.5 fill-current" />
              </button>
              <button
                onClick={onPlayPause}
                className="w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:scale-110 active:scale-95 transition-all neon-glow beat-play-btn"
              >
                {isPlaying ? <Pause className="w-4.5 h-4.5 fill-current" /> : <Play className="w-4.5 h-4.5 fill-current ml-0.5" />}
              </button>
              <button 
                onClick={onNext}
                className="text-muted-foreground hover:text-foreground transition-all active:scale-90 beat-skip-btn"
              >
                <SkipForward className="w-4.5 h-4.5 fill-current" />
              </button>
            </div>

            {/* Soundwave (Middle) */}
            <div className={cn(
              "w-36 h-8 opacity-90 overflow-hidden pointer-events-none transition-all duration-300 beat-soundwave",
              nowPlayingOpen ? "hidden" : "flex items-center justify-center"
            )}>
              <SoundwaveVisualizer isPlaying={isPlaying} className="w-full h-full" />
            </div>

            {/* Progress Bar (Bottom) */}
            <div className="w-full flex items-center gap-2 px-1">
              <span className="text-[10px] font-bold text-muted-foreground tabular-nums w-8 text-right shrink-0">{formatTime(progress)}</span>
              <StyledProgressBar
                progress={progress}
                duration={duration}
                onSeek={handleSeek}
                className="flex-1 min-w-[100px]"
              />
              <span className="text-[10px] font-bold text-muted-foreground tabular-nums w-8 shrink-0">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right: Actions & Volume */}
            <div className={cn(
              "flex items-center justify-end gap-2 transition-all duration-500 shrink-0",
              nowPlayingOpen ? "w-48 lg:w-60" : "w-64 lg:w-76"
            )}>
            <div className={cn(
                "grid grid-flow-col auto-cols-[2rem] items-center justify-center rounded-xl bg-white/5 border border-white/5 shadow-inner transition-all",
                nowPlayingOpen ? "gap-0.5 p-0.5" : "gap-1 p-1"
            )}>
              <button 
                onClick={() => setLyricsOpen(!lyricsOpen)} 
                className={cn(
                  "h-8 w-8 rounded-lg transition-all flex items-center justify-center",
                  lyricsOpen ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
                title="Lyrics"
              >
                <Music2 className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setNowPlayingOpen(!nowPlayingOpen)} 
                className={cn(
                  "h-8 w-8 rounded-lg transition-all flex items-center justify-center",
                  nowPlayingOpen ? "animate-pulse" : "",
                  nowPlayingOpen ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
                title="Now Playing"
              >
                <MonitorPlay className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setShowEQ(!showEQ)} 
                className={cn(
                  "h-8 w-8 rounded-lg transition-all flex items-center justify-center",
                  showEQ ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
                title="Equalizer"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
              <button 
                onClick={toggleLoopOne} 
                className={cn(
                  "relative h-8 w-8 rounded-lg transition-all flex items-center justify-center",
                  loopOneCount > 0 ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
                title={loopOneCount > 0 ? `Replay ${loopOneCount} more time${loopOneCount === 1 ? '' : 's'}` : 'Add one replay'}
              >
                <Repeat1 className="w-4 h-4" />
                {loopOneCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-background px-0.5 text-[8px] font-black leading-none text-primary ring-1 ring-primary/40">
                    {loopOneCount}
                  </span>
                )}
              </button>
              <button 
                onClick={handleShare} 
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all flex items-center justify-center"
                title="Share"
              >
                <Share2 className="w-4 h-4" />
              </button>
              {currentTrack && (
                <div className={nowPlayingOpen ? "scale-90" : "scale-100"}>
                  <DownloadButton track={currentTrack} compact={nowPlayingOpen} />
                </div>
              )}
            </div>

            <div className={cn(
              "flex items-center gap-2 group/volume shrink-0 transition-all duration-300",
              nowPlayingOpen ? "w-16 lg:w-24" : "w-24 lg:w-32"
            )}>
              <button onClick={toggleMute} className="text-muted-foreground hover:text-primary transition-colors shrink-0">
                {getVolumeIcon()}
              </button>
              <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden relative">
                <div 
                  className="absolute inset-y-0 left-0 bg-primary neon-glow-sm transition-all"
                  style={{ width: `${isMuted ? 0 : volume}%` }}
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                />
              </div>
            </div>
          </div>
        </div>
      </footer>

      <FullscreenPlayer
        isOpen={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onPlayPause={onPlayPause}
        onNext={onNext}
        onPrevious={onPrevious}
        shuffleMode={shuffleMode}
        onToggleShuffle={onToggleShuffle}
        loopMode={loopMode}
        onCycleLoopMode={onCycleLoopMode}
        queue={queue}
        onRemoveFromQueue={onRemoveFromQueue}
        onPlayFromQueue={onPlayFromQueue}
        progress={progress}
        duration={duration}
        onSeek={handleSeek}
        audioRef={audioRef}
      />

      <LyricsDrawer isOpen={lyricsOpen} onClose={() => setLyricsOpen(false)} />
      <NowPlayingPanel 
        isOpen={nowPlayingOpen} 
        onClose={() => setNowPlayingOpen(false)} 
        currentTrack={currentTrack} 
        nextTrack={nextUpTrack} 
      />
    </>
  );
};

export default MusicPlayer;