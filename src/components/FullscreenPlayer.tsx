import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, ListMusic, Trash2, ChevronDown, X, SlidersHorizontal, Share2, Music2, Volume2, VolumeX, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import StyledProgressBar from './StyledProgressBar';
import SoundwaveVisualizer from './SoundwaveVisualizer';
import EqualizerPanel from './EqualizerPanel';
import { ScrollArea } from './ui/scroll-area';
import { toast } from 'sonner';
import { useDownloadManager } from '@/contexts/DownloadManagerContext';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { isTrackDownloadedOffline } from '@/lib/offlineStore';

interface Track {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
}

interface MusicTheme {
  id: string;
  name: string;
  tagline: string;
  bgGradients: string[];
  ambientOrbs: Array<{
    color: string;
    size: string;
    position: string;
    duration: string;
    delay: string;
  }>;
  orbitBorderColor: string;
  pulsingColor: string;
  visualizerAccent: string;
}

const getMusicTheme = (title: string = '', channel: string = ''): MusicTheme => {
  const text = `${title} ${channel}`.toLowerCase();

  // 1. Phonk / Trap / Bass / Remix -> Cyber Phonk
  if (text.includes('phonk') || text.includes('bass') || text.includes('trap') || text.includes('remix') || text.includes('drift') || text.includes('sigma') || text.includes('house') || text.includes('edm') || text.includes('electro')) {
    return {
      id: 'cyberpunk',
      name: 'Cyber Phonk',
      tagline: 'High-octane neon cyberpunk vibes',
      bgGradients: [
        'from-purple-950/40 via-red-950/20 to-fuchsia-950/30',
        'from-pink-900/30 via-transparent to-indigo-900/40',
        'from-rose-950/20 via-violet-950/10 to-transparent'
      ],
      ambientOrbs: [
        { color: 'bg-fuchsia-500/25', size: 'w-[450px] h-[450px]', position: 'top-[10%] left-[20%]', duration: '6s', delay: '0s' },
        { color: 'bg-red-500/15', size: 'w-[500px] h-[500px]', position: 'bottom-[15%] right-[10%]', duration: '8s', delay: '1s' },
        { color: 'bg-purple-600/15', size: 'w-[350px] h-[350px]', position: 'top-[45%] left-[55%]', duration: '10s', delay: '3s' }
      ],
      orbitBorderColor: 'border-fuchsia-500/20',
      pulsingColor: 'bg-fuchsia-500',
      visualizerAccent: 'text-fuchsia-400',
    };
  }

  // 2. Lo-Fi / Chill / Sleep -> Cosmic Lo-Fi
  if (text.includes('lofi') || text.includes('lo-fi') || text.includes('chill') || text.includes('sleep') || text.includes('relax') || text.includes('dream') || text.includes('night') || text.includes('ambient') || text.includes('cosmic') || text.includes('space') || text.includes('star') || text.includes('instrumental')) {
    return {
      id: 'cosmic',
      name: 'Cosmic Lo-Fi',
      tagline: 'Deep space ambient dreamscape',
      bgGradients: [
        'from-indigo-950/50 via-blue-950/20 to-violet-950/30',
        'from-sky-900/20 via-transparent to-purple-950/25',
        'from-indigo-950/30 via-amber-500/5 to-transparent'
      ],
      ambientOrbs: [
        { color: 'bg-sky-500/25', size: 'w-[380px] h-[380px]', position: 'top-[25%] left-[15%]', duration: '10s', delay: '0s' },
        { color: 'bg-violet-500/15', size: 'w-[450px] h-[450px]', position: 'bottom-[20%] right-[15%]', duration: '14s', delay: '2s' },
        { color: 'bg-indigo-600/15', size: 'w-[320px] h-[320px]', position: 'top-[50%] left-[60%]', duration: '12s', delay: '4s' }
      ],
      orbitBorderColor: 'border-sky-500/20',
      pulsingColor: 'bg-sky-400',
      visualizerAccent: 'text-sky-300',
    };
  }

  // 3. Acoustic / Folk / Nature / Piano -> Emerald Forest
  if (text.includes('acoustic') || text.includes('guitar') || text.includes('piano') || text.includes('nature') || text.includes('forest') || text.includes('rain') || text.includes('calm') || text.includes('soft') || text.includes('folk') || text.includes('indie')) {
    return {
      id: 'emerald',
      name: 'Emerald Forest',
      tagline: 'Organic woodland chillout',
      bgGradients: [
        'from-emerald-950/40 via-teal-950/20 to-green-950/30',
        'from-lime-900/15 via-transparent to-emerald-900/30',
        'from-teal-950/20 via-yellow-500/5 to-transparent'
      ],
      ambientOrbs: [
        { color: 'bg-emerald-500/20', size: 'w-[400px] h-[400px]', position: 'top-[15%] left-[25%]', duration: '12s', delay: '0s' },
        { color: 'bg-teal-500/15', size: 'w-[420px] h-[420px]', position: 'bottom-[25%] right-[20%]', duration: '15s', delay: '3s' },
        { color: 'bg-lime-500/15', size: 'w-[310px] h-[310px]', position: 'top-[55%] left-[55%]', duration: '11s', delay: '5s' }
      ],
      orbitBorderColor: 'border-emerald-500/20',
      pulsingColor: 'bg-emerald-400',
      visualizerAccent: 'text-emerald-400',
    };
  }

  // 4. Pop / Vocal / Summer / Love -> Golden Sunset
  if (text.includes('pop') || text.includes('vocal') || text.includes('summer') || text.includes('love') || text.includes('happy') || text.includes('sun') || text.includes('party') || text.includes('dance') || text.includes('rock') || text.includes('energetic')) {
    return {
      id: 'sunset',
      name: 'Golden Sunset',
      tagline: 'Warm energetic beach twilight',
      bgGradients: [
        'from-orange-950/40 via-rose-950/20 to-amber-950/30',
        'from-amber-900/20 via-transparent to-rose-900/30',
        'from-orange-950/25 via-yellow-500/10 to-transparent'
      ],
      ambientOrbs: [
        { color: 'bg-amber-500/25', size: 'w-[420px] h-[420px]', position: 'top-[20%] left-[20%]', duration: '8s', delay: '0s' },
        { color: 'bg-rose-500/15', size: 'w-[480px] h-[480px]', position: 'bottom-[15%] right-[15%]', duration: '11s', delay: '2s' },
        { color: 'bg-orange-500/15', size: 'w-[330px] h-[330px]', position: 'top-[50%] left-[65%]', duration: '9s', delay: '4s' }
      ],
      orbitBorderColor: 'border-amber-500/20',
      pulsingColor: 'bg-amber-400',
      visualizerAccent: 'text-amber-400',
    };
  }

  // 5. Synthwave / retro / electro -> Synthwave Cyber
  if (text.includes('synthwave') || text.includes('synth') || text.includes('retro') || text.includes('wave') || text.includes('80s') || text.includes('future')) {
    return {
      id: 'synthwave',
      name: 'Retro Synthwave',
      tagline: 'Neon magenta 80s dreamwave',
      bgGradients: [
        'from-pink-950/40 via-blue-950/20 to-magenta-950/30',
        'from-cyan-950/20 via-transparent to-pink-900/25',
        'from-indigo-950/35 via-pink-500/5 to-transparent'
      ],
      ambientOrbs: [
        { color: 'bg-pink-500/25', size: 'w-[400px] h-[400px]', position: 'top-[15%] left-[15%]', duration: '7s', delay: '0s' },
        { color: 'bg-cyan-500/15', size: 'w-[440px] h-[440px]', position: 'bottom-[25%] right-[15%]', duration: '9s', delay: '2s' },
        { color: 'bg-violet-600/15', size: 'w-[320px] h-[320px]', position: 'top-[45%] left-[55%]', duration: '11s', delay: '4.5s' }
      ],
      orbitBorderColor: 'border-pink-500/20',
      pulsingColor: 'bg-pink-400',
      visualizerAccent: 'text-pink-400',
    };
  }

  // 6. Default Theme -> Northern Aurora
  return {
    id: 'default',
    name: 'Northern Aurora',
    tagline: 'Dynamic shifting celestial rays',
    bgGradients: [
      'from-teal-950/40 via-indigo-950/20 to-emerald-950/30',
      'from-amber-900/10 via-transparent to-teal-900/25',
      'from-emerald-950/20 via-amber-500/5 to-transparent'
    ],
    ambientOrbs: [
      { color: 'bg-teal-500/25', size: 'w-[350px] h-[350px]', position: 'top-[20%] left-[30%]', duration: '7s', delay: '0s' },
      { color: 'bg-amber-500/10', size: 'w-[400px] h-[400px]', position: 'bottom-[25%] right-[20%]', duration: '10s', delay: '2s' },
      { color: 'bg-indigo-500/15', size: 'w-[300px] h-[300px]', position: 'top-[50%] left-[60%]', duration: '13s', delay: '4s' }
    ],
    orbitBorderColor: 'border-teal-500/20',
    pulsingColor: 'bg-teal-400',
    visualizerAccent: 'text-teal-400',
  };
};

interface FullscreenPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  shuffleMode?: boolean;
  onToggleShuffle?: () => void;
  loopMode?: 'off' | 'all' | 'one';
  onCycleLoopMode?: () => void;
  queue: Track[];
  onRemoveFromQueue?: (trackId: string) => void;
  onPlayFromQueue?: (track: Track) => void;
  progress: number;
  duration: number;
  onSeek: (value: number) => void;
  audioRef?: React.MutableRefObject<HTMLAudioElement | null>;
}

const FullscreenPlayer = ({
  isOpen,
  onClose,
  currentTrack,
  isPlaying,
  onPlayPause,
  onNext,
  onPrevious,
  shuffleMode = false,
  onToggleShuffle,
  loopMode = 'off',
  onCycleLoopMode,
  queue,
  onRemoveFromQueue,
  onPlayFromQueue,
  progress,
  duration,
  onSeek,
  audioRef,
}: FullscreenPlayerProps) => {
  const { settings } = useTheme();
  const [isOnline, setIsOnline] = useState(() => typeof window !== 'undefined' ? navigator.onLine : true);
  const [isOfflineTrack, setIsOfflineTrack] = useState(false);
  const musicTheme = getMusicTheme(currentTrack?.title, currentTrack?.channel);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (currentTrack) {
      isTrackDownloadedOffline(currentTrack.id).then(res => {
        setIsOfflineTrack(res);
      });
    } else {
      setIsOfflineTrack(false);
    }
  }, [currentTrack]);

  const { 
    playlist,
    queue: ctxQueue,
    removeFromQueue: ctxRemoveFromQueue,
    handlePlayFromQueue: ctxPlayFromQueue,
    handlePlayFromPlaylist,
    volume,
    setVolume,
    isMuted,
    setIsMuted,
    loopOneCount,
    toggleLoopOne,
  } = useMusicPlayer();
  const { startDownload, isDownloading } = useDownloadManager();

  // Use context queue (always up-to-date), fall back to prop
  const activeQueue = ctxQueue.length > 0 ? ctxQueue : queue;
  const activeRemoveFromQueue = ctxRemoveFromQueue || onRemoveFromQueue;
  const activePlayFromQueue = ctxPlayFromQueue || onPlayFromQueue;

  const [showQueue, setShowQueue] = useState(false);
  const [showEQ, setShowEQ] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Build combined "Up Next": temporary queue first, then upcoming playlist tracks
  const upcomingPlaylist = (() => {
    if (!currentTrack || playlist.length === 0) return [] as Track[];
    const idx = playlist.findIndex(t => t.id === currentTrack.id);
    if (idx === -1) return [] as Track[];
    return playlist.slice(idx + 1);
  })();

  const queueIds = new Set(activeQueue.map(t => t.id));
  const upNextCombined: Array<Track & { _source: 'queue' | 'playlist' }> = [
    ...activeQueue.map(t => ({ ...t, _source: 'queue' as const })),
    ...upcomingPlaylist.filter(t => !queueIds.has(t.id)).map(t => ({ ...t, _source: 'playlist' as const })),
  ];

  const playUpNextItem = (track: Track & { _source: 'queue' | 'playlist' }) => {
    if (track._source === 'queue') {
      activePlayFromQueue?.(track);
    } else {
      handlePlayFromPlaylist(track);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleShare = () => {
    if (currentTrack) {
      const shareUrl = `${window.location.origin}/api/og?id=${currentTrack.id}&title=${encodeURIComponent(currentTrack.title)}`;
      navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied!');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  if (!isVisible && !isOpen) return null;

  const node = (
    <div
      className={cn(
        "fixed inset-0 z-[9999] w-screen h-[100dvh] flex flex-col overflow-hidden transition-all duration-700 ease-in-out",
        isOpen ? "opacity-100 scale-100" : "opacity-0 scale-110 pointer-events-none"
      )}
      role="dialog"
      aria-modal="true"
    >
      {/* Immersive Background */}
      <div className="absolute inset-0 bg-[#050505] overflow-hidden">
        {currentTrack && (
          <>
            {/* Ambient Background Video or Offline/Downloaded Music Theme Visualizer */}
            {isOnline && !isOfflineTrack ? (
              <div
                className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden"
                style={{ opacity: Math.max(0, Math.min(100, settings.backgroundVideoBrightness ?? 30)) / 100 }}
              >
                <iframe
                  className="absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 border-0 pointer-events-none select-none"
                  style={{
                    width: 'max(100vw, 177.78dvh)',
                    height: 'max(100dvh, 56.25vw)',
                  }}
                  src={`https://www.youtube-nocookie.com/embed/${currentTrack.id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${currentTrack.id}&modestbranding=1&rel=0&iv_load_policy=3&showinfo=0&disablekb=1&playsinline=1`}
                  title="Fullscreen Video Background"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            ) : (
              <div className="absolute inset-0 overflow-hidden opacity-45 pointer-events-none">
                {/* Dynamic fluid ambient gradients according to music theme */}
                <div 
                  className={cn("absolute inset-0 bg-gradient-to-tr mix-blend-screen animate-pulse", musicTheme.bgGradients[0])}
                  style={{ animationDuration: '10s' }}
                />
                <div 
                  className={cn("absolute inset-0 bg-gradient-to-bl mix-blend-screen animate-pulse", musicTheme.bgGradients[1])}
                  style={{ animationDuration: '14s', animationDelay: '2s' }}
                />
                <div 
                  className={cn("absolute inset-0 bg-gradient-to-br mix-blend-color-dodge animate-pulse", musicTheme.bgGradients[2])}
                  style={{ animationDuration: '18s', animationDelay: '4s' }}
                />
                
                {/* Glowing moving ambient light fields from theme */}
                {musicTheme.ambientOrbs.map((orb, idx) => (
                  <div 
                    key={idx}
                    className={cn("absolute rounded-full blur-[110px] animate-pulse", orb.color, orb.size, orb.position)}
                    style={{ animationDuration: orb.duration, animationDelay: orb.delay }}
                  />
                ))}

                {/* Dynamic concentric orbital spinning rings matching theme colors */}
                <div className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full border opacity-45 animate-spin", musicTheme.orbitBorderColor)} style={{ animationDuration: '50s' }}>
                  <div className={cn("absolute inset-6 rounded-full border border-dashed opacity-40", musicTheme.orbitBorderColor)} />
                  <div className={cn("absolute inset-16 rounded-full border opacity-30", musicTheme.orbitBorderColor)} />
                  <div className={cn("absolute inset-32 rounded-full border border-dashed opacity-40", musicTheme.orbitBorderColor)} />
                </div>
                <div className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[750px] rounded-full border opacity-35 animate-spin", musicTheme.orbitBorderColor)} style={{ animationDuration: '75s', animationDirection: 'reverse' }}>
                  <div className={cn("absolute inset-14 rounded-full border border-dashed opacity-25", musicTheme.orbitBorderColor)} />
                  <div className={cn("absolute inset-28 rounded-full border opacity-30 animate-pulse", musicTheme.orbitBorderColor)} />
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[950px] h-[950px] rounded-full border border-dashed border-white/5 opacity-10 animate-spin" style={{ animationDuration: '120s' }} />

                {/* Ambient dynamic micro-star constellation floating particles */}
                <div className="absolute inset-0 opacity-25">
                  <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="15%" cy="25%" r="2" className="fill-white animate-pulse" style={{ animationDuration: '2.5s' }} />
                    <circle cx="85%" cy="15%" r="1.5" className="fill-white animate-pulse" style={{ animationDuration: '3.5s', animationDelay: '0.8s' }} />
                    <circle cx="12%" cy="75%" r="3" className="fill-white animate-pulse" style={{ animationDuration: '4.5s', animationDelay: '1.2s' }} />
                    <circle cx="88%" cy="70%" r="2.5" className="fill-white animate-pulse" style={{ animationDuration: '3s', animationDelay: '1.8s' }} />
                    <circle cx="50%" cy="10%" r="1" className="fill-white animate-pulse" style={{ animationDuration: '5.5s' }} />
                    <circle cx="40%" cy="90%" r="2" className="fill-white animate-pulse" style={{ animationDuration: '4s', animationDelay: '2.2s' }} />
                  </svg>
                </div>
              </div>
            )}

            <div 
              className="absolute inset-0 opacity-40 blur-[120px] scale-150 transition-all duration-[1500ms]"
              style={{
                backgroundImage: `url(${currentTrack.thumbnail})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                referrerPolicy: 'no-referrer',
              } as any}
            />
            {/* Animated ambient orbs */}
            <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[140px] animate-pulse" style={{ animationDuration: '6s' }} />
            <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[140px] animate-pulse" style={{ animationDuration: '8s', animationDelay: '1s' }} />
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/40 via-[#050505]/75 to-[#050505]" />
        {/* Subtle noise/grain overlay */}
        <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")'
        }} />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-5 py-5 md:px-10 md:py-6">
        <button onClick={onClose} className="w-11 h-11 rounded-2xl glass-premium border border-white/10 flex items-center justify-center transition-all active:scale-90 hover:bg-white/10 hover:border-primary/30">
          <ChevronDown className="w-5 h-5" />
        </button>
        
        <div className="text-center">
          <p className="text-[9px] font-black text-primary/80 uppercase tracking-[0.5em] mb-1.5">Now Playing</p>
          <div className="flex items-center justify-center gap-2">
             <div className="relative">
               <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping absolute" />
               <div className="w-1.5 h-1.5 rounded-full bg-primary" />
             </div>
             <p className="text-xs font-bold text-foreground/90 uppercase tracking-[0.25em] truncate max-w-[180px]">{currentTrack?.channel || 'Unknown'}</p>
          </div>
        </div>
        
        <button onClick={() => setShowQueue(!showQueue)} className={cn("w-11 h-11 rounded-2xl glass-premium border flex items-center justify-center transition-all active:scale-90", showQueue ? "bg-primary text-primary-foreground border-primary shadow-[0_0_20px_hsl(var(--primary)/0.4)]" : "border-white/10 hover:bg-white/10 hover:border-primary/30")}>
          <ListMusic className="w-5 h-5" />
        </button>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 pb-4 md:pb-6 overflow-y-auto min-h-0">
        <div className="flex flex-col items-center justify-center w-full max-w-2xl my-auto">
          {/* Album Art with vinyl ring */}
          <div className="relative mb-4 md:mb-6 group">
            <div className={cn(
              "absolute -inset-8 rounded-full blur-3xl transition-all duration-1000",
              isPlaying ? "bg-primary/30 opacity-100 scale-100" : "bg-primary/10 opacity-50 scale-90"
            )} />
            <div 
              className={cn(
                "absolute -inset-3 rounded-[3rem] border border-white/10",
                isPlaying && "animate-spin"
              )}
              style={{ animationDuration: '20s' }}
            >
              <div className="absolute top-2 left-1/2 w-2 h-2 rounded-full bg-primary -translate-x-1/2 shadow-[0_0_10px_hsl(var(--primary))]" />
            </div>
            <img 
              src={currentTrack?.thumbnail || '/placeholder.svg'} 
              alt={currentTrack?.title}
              className={cn(
                "w-40 h-40 sm:w-52 sm:h-52 md:w-60 md:h-60 rounded-[2rem] object-cover shadow-[0_30px_80px_rgba(0,0,0,0.6)] transition-all duration-700 relative z-10 ring-1 ring-white/10",
                isPlaying ? "scale-100" : "scale-95 opacity-90"
              )}
            />
          </div>

          {/* Title & Artist */}
          <div className="text-center mb-4 md:mb-5 max-w-xl px-4 flex flex-col items-center">
             <h2 className="text-lg sm:text-2xl md:text-3xl font-black text-foreground mb-1.5 tracking-tight italic uppercase line-clamp-2 leading-tight">
               {currentTrack?.title || 'Not Selected'}
             </h2>
             <p className="text-[10px] md:text-xs font-bold text-primary uppercase tracking-[0.35em]">{currentTrack?.channel || 'Unknown Artist'}</p>
             
             {/* Dynamic Theme Badge in offline ambient mode - only for custom themes */}
             {(!isOnline || isOfflineTrack) && currentTrack && musicTheme.id !== 'default' && (
               <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-3.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-[0.2em] text-foreground/80 shadow-md backdrop-blur-md animate-fade-in">
                 <span className={cn("w-1.5 h-1.5 rounded-full animate-ping absolute", musicTheme.pulsingColor)} />
                 <span className={cn("w-1.5 h-1.5 rounded-full relative", musicTheme.pulsingColor)} />
                 <span>{musicTheme.name} Theme</span>
               </div>
             )}
          </div>

          {/* Soundwave */}
          <div className="w-full max-w-md mb-4 px-4">
             <div className="glass-premium border border-white/10 px-6 py-3 rounded-3xl shadow-xl backdrop-blur-2xl">
                <SoundwaveVisualizer isPlaying={isPlaying} className="h-10 w-full" />
             </div>
          </div>

          {/* Progress */}
          <div className="w-full max-w-2xl px-4 mb-4 md:mb-5">
             <StyledProgressBar progress={progress} duration={duration} onSeek={onSeek} className="mb-2" />
             <div className="flex justify-between text-[11px] font-bold text-muted-foreground/70 tabular-nums tracking-widest">
                <span>{formatTime(progress)}</span>
                <span>-{formatTime(Math.max(0, duration - progress))}</span>
             </div>
          </div>

          {/* Main Controls */}
          <div className="flex items-center justify-center gap-3 sm:gap-5 md:gap-7">
             <button onClick={onToggleShuffle} className={cn("p-2.5 rounded-2xl transition-all active:scale-90", shuffleMode ? "text-primary bg-primary/15 shadow-[0_0_15px_hsl(var(--primary)/0.3)]" : "text-muted-foreground hover:text-foreground hover:bg-white/5")}>
                <Shuffle className="w-5 h-5" />
             </button>
             
             <button onClick={onPrevious} className="p-3 rounded-full hover:bg-white/10 transition-all active:scale-75 text-foreground">
                <SkipBack className="w-6 h-6 fill-current" />
             </button>
             
             <button 
               onClick={onPlayPause} 
               className={cn(
                 "w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90 relative",
                 "bg-primary text-primary-foreground",
                 "shadow-[0_15px_40px_hsl(var(--primary)/0.4),0_0_60px_hsl(var(--primary)/0.2)]",
                 "hover:scale-105 hover:shadow-[0_20px_50px_hsl(var(--primary)/0.5),0_0_80px_hsl(var(--primary)/0.3)]"
               )}
             >
                {isPlaying ? <Pause className="w-7 h-7 md:w-8 md:h-8 fill-current" /> : <Play className="w-7 h-7 md:w-8 md:h-8 fill-current ml-1" />}
             </button>

             <button onClick={onNext} className="p-3 rounded-full hover:bg-white/10 transition-all active:scale-75 text-foreground">
                <SkipForward className="w-6 h-6 fill-current" />
             </button>

              <button onClick={onCycleLoopMode} className={cn("p-2.5 rounded-2xl transition-all active:scale-90", loopMode === 'all' ? "text-primary bg-primary/15 shadow-[0_0_15px_hsl(var(--primary)/0.3)]" : "text-muted-foreground hover:text-foreground hover:bg-white/5")}>
                {loopMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
             </button>
              <button
                onClick={toggleLoopOne}
                className={cn(
                  "relative p-2.5 rounded-2xl transition-all active:scale-90",
                  loopOneCount > 0 ? "text-primary bg-primary/15 shadow-[0_0_15px_hsl(var(--primary)/0.3)]" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
                aria-label={loopOneCount > 0 ? `Replay ${loopOneCount} more times` : 'Add one song replay'}
                title={loopOneCount > 0 ? `Replay ${loopOneCount} more time${loopOneCount === 1 ? '' : 's'}` : 'Add one replay'}
              >
                <Repeat1 className="w-5 h-5" />
                {loopOneCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-black leading-none text-primary-foreground ring-1 ring-background/50">
                    {loopOneCount}
                  </span>
                )}
              </button>
          </div>

          {/* Volume Control Section */}
          <div className="mt-4 md:mt-5 flex items-center gap-4 px-6 py-2 rounded-2xl glass-premium border border-white/10 backdrop-blur-2xl w-full max-w-sm group/v-full">
             <button 
               onClick={() => setIsMuted(!isMuted)} 
               className="text-primary transition-all active:scale-90"
             >
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-muted-foreground" /> : <Volume2 className="w-5 h-5" />}
             </button>
             <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden relative">
                <div 
                  className="absolute inset-y-0 left-0 bg-primary neon-glow-sm transition-all duration-300"
                  style={{ width: `${isMuted ? 0 : volume}%` }}
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    setVolume(Number(e.target.value));
                    setIsMuted(false);
                  }}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                />
             </div>
             <div className="w-px h-6 bg-white/10 mx-1" />
             <button 
               onClick={() => setShowEQ(!showEQ)} 
               className={cn(
                 "w-10 h-10 rounded-xl transition-all flex items-center justify-center active:scale-90",
                 showEQ ? "bg-primary text-primary-foreground" : "hover:bg-white/10 text-muted-foreground hover:text-foreground"
               )}
               aria-label="Equalizer"
             >
                 <SlidersHorizontal className="w-4 h-4" />
             </button>
             <button 
               onClick={handleShare} 
               className="w-10 h-10 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all flex items-center justify-center active:scale-90"
               aria-label="Share"
             >
                 <Share2 className="w-4 h-4" />
             </button>
             {currentTrack && (
               <button
                 onClick={() => startDownload(currentTrack)}
                 className="w-10 h-10 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all flex items-center justify-center active:scale-90"
                 aria-label="Download"
               >
                 {isDownloading(currentTrack.id)
                   ? <Loader2 className="w-4 h-4 animate-spin text-primary" />
                   : <Download className="w-4 h-4" />}
               </button>
             )}
          </div>

          {/* Compact Up Next Strip */}
          {upNextCombined.length > 0 && (
            <div className="mt-4 md:mt-5 w-full max-w-xl px-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">⌛ Up Next · {upNextCombined.length}</p>
                <button onClick={() => setShowQueue(true)} className="text-[10px] font-bold text-muted-foreground hover:text-primary uppercase tracking-widest transition-colors">
                  View All
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 snap-x">
                {upNextCombined.slice(0, 6).map((track) => (
                  <button
                    key={`${track._source}-${track.id}`}
                    onClick={() => playUpNextItem(track)}
                    className="group relative flex-shrink-0 w-[180px] flex items-center gap-2.5 p-2 rounded-2xl glass-premium border border-white/10 hover:border-primary/40 hover:bg-white/5 transition-all active:scale-95 snap-start"
                  >
                    <img src={track.thumbnail} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">{track.title}</p>
                      <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest truncate flex items-center gap-1">
                        <span className={cn("w-1 h-1 rounded-full", track._source === 'queue' ? "bg-primary" : "bg-muted-foreground/40")} />
                        {track._source === 'queue' ? 'Queue' : 'Playlist'} · {track.channel}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>



        {/* Queue Overlay (Desktop Side) */}
        {showQueue && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6 md:p-10 animate-fade-in">
             <div className="w-full max-w-2xl h-full glass-premium border border-white/10 rounded-[3rem] flex flex-col overflow-hidden shadow-2xl backdrop-blur-3xl">
                <div className="p-8 border-b border-white/5 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <ListMusic className="w-8 h-8 text-primary" />
                      <div>
                         <h3 className="text-2xl font-black text-foreground uppercase tracking-tighter italic">Up Next</h3>
                         <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">{activeQueue.length} in Queue · {upcomingPlaylist.length} in Playlist</p>
                      </div>
                   </div>
                   <button onClick={() => setShowQueue(false)} className="w-12 h-12 rounded-2xl hover:bg-white/5 flex items-center justify-center">
                      <X className="w-6 h-6" />
                   </button>
                </div>
                <ScrollArea className="flex-1 p-4">
                   {upNextCombined.length > 0 ? (
                      <div className="space-y-4">
                         {activeQueue.length > 0 && (
                           <div>
                             <p className="px-3 mb-2 text-[10px] font-black text-primary uppercase tracking-[0.3em]">⌛ Queue</p>
                             <div className="space-y-1">
                               {activeQueue.map((track, idx) => (
                                  <div key={`q-${track.id}`} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 transition-all cursor-pointer group" onClick={() => activePlayFromQueue?.(track)}>
                                     <span className="text-xs font-black text-primary/60 w-6">{idx + 1}</span>
                                     <img src={track.thumbnail} className="w-12 h-12 rounded-xl object-cover" />
                                     <div className="flex-1 min-w-0">
                                        <p className="font-bold text-foreground truncate group-hover:text-primary transition-colors">{track.title}</p>
                                        <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest truncate">{track.channel}</p>
                                     </div>
                                     <button onClick={(e) => { e.stopPropagation(); activeRemoveFromQueue?.(track.id); }} className="p-2.5 rounded-xl hover:bg-destructive/20 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all">
                                        <Trash2 className="w-4 h-4" />
                                     </button>
                                  </div>
                               ))}
                             </div>
                           </div>
                         )}
                         {upcomingPlaylist.length > 0 && (
                           <div>
                             <p className="px-3 mb-2 text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">From Playlist</p>
                             <div className="space-y-1">
                               {upcomingPlaylist.filter(t => !queueIds.has(t.id)).map((track, idx) => (
                                  <div key={`p-${track.id}`} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 transition-all cursor-pointer group" onClick={() => handlePlayFromPlaylist(track)}>
                                     <span className="text-xs font-black text-muted-foreground/40 w-6">{idx + 1}</span>
                                     <img src={track.thumbnail} className="w-12 h-12 rounded-xl object-cover" />
                                     <div className="flex-1 min-w-0">
                                        <p className="font-bold text-foreground truncate group-hover:text-primary transition-colors">{track.title}</p>
                                        <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest truncate">{track.channel}</p>
                                     </div>
                                  </div>
                               ))}
                             </div>
                           </div>
                         )}
                      </div>
                   ) : (
                      <div className="flex flex-col items-center justify-center h-full opacity-20 py-20">
                         <Music2 className="w-20 h-20 mb-4" />
                         <p className="font-black uppercase tracking-widest">Nothing Up Next</p>
                         <p className="text-[10px] mt-2 tracking-widest">Add tracks to queue or playlist</p>
                      </div>
                   )}
                </ScrollArea>
             </div>
          </div>
        )}

        {/* Equalizer Overlay */}
        {showEQ && audioRef && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6 animate-fade-in">
             <div className="w-full max-w-sm glass-premium border border-white/10 rounded-[3rem] p-10 shadow-2xl backdrop-blur-3xl">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-xl font-black text-foreground uppercase italic tracking-tighter">Audio Matrix</h3>
                   <button onClick={() => setShowEQ(false)} className="w-10 h-10 rounded-xl hover:bg-white/5 flex items-center justify-center">
                      <X className="w-5 h-5" />
                   </button>
                </div>
                <EqualizerPanel audioRef={audioRef} isOpen={showEQ} onClose={() => setShowEQ(false)} />
             </div>
          </div>
        )}


      </main>
    </div>
  );

  return createPortal(node, document.body);
};

export default FullscreenPlayer;

