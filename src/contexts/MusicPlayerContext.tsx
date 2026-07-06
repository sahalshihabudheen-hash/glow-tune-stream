import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { notifyNativeTrack, notifyNativePlayback, listenCarCommands } from '@/lib/nyraMediaBridge';
import { toast } from 'sonner';
import { usePlaylist } from '@/hooks/usePlaylist';
import { useQueue } from '@/hooks/useQueue';
import { useFavorites } from '@/hooks/useFavorites';
import { useListeningHistory } from '@/hooks/useListeningHistory';
import { useTheme } from '@/contexts/ThemeContext';
import { useTabTitle } from '@/hooks/useTabTitle';
import { getTrackOffline, isTrackDownloadedOffline } from '@/lib/offlineStore';
import { COBALT_INSTANCES, PIPED_INSTANCES } from '@/lib/instances';

const getAudioFunctionBase = () => {
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return '/api/get-audio-url';
  }
  const backendUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  return backendUrl ? `${backendUrl}/functions/v1/get-audio-url` : '/api/get-audio-url';
};

const getAudioUrlEndpoint = (videoId: string, options?: { stream?: boolean; download?: boolean; title?: string; proxyUrl?: string }) => {
  const baseUrl = getAudioFunctionBase();
  const params = new URLSearchParams();
  if (options?.proxyUrl) params.set('proxyUrl', options.proxyUrl);
  else params.set('videoId', videoId);
  if (options?.stream) params.append('stream', '1');
  if (options?.download) params.append('download', '1');
  if (options?.title) params.append('title', options.title);
  return `${baseUrl}?${params.toString()}`;
};

const PLAYBACK_START_TIMEOUT_MS = 6500;

const getTimeoutSignal = (ms: number): AbortSignal => AbortSignal.timeout(ms);

const isMobileLikeDevice = () => {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
};

const safelyParseJson = async <T,>(res: Response): Promise<T | null> => {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
};

const shuffle = <T,>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

async function raceFirstSuccess<T>(promises: Promise<T>[]): Promise<T> {
  return new Promise((resolve, reject) => {
    let resolved = false;
    let failedCount = 0;
    const total = promises.length;

    if (total === 0) {
      reject(new Error('No promises to race'));
      return;
    }

    promises.forEach(p => {
      p.then(val => {
        if (val && !resolved) {
          resolved = true;
          resolve(val);
        } else {
          failedCount++;
          if (failedCount === total && !resolved) {
            reject(new Error('All raced promises failed'));
          }
        }
      }).catch(err => {
        failedCount++;
        if (failedCount === total && !resolved) {
          reject(new Error('All raced promises failed'));
        }
      });
    });
  });
}

const tryCobaltInstance = async (inst: string, videoId: string): Promise<string | null> => {
  try {
    const res = await fetch(`${inst}/api/json`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        downloadMode: 'audio',
        audioFormat: 'mp3',
        audioQuality: '128'
      }),
      signal: getTimeoutSignal(5000)
    });

    if (res.ok) {
      const data = await safelyParseJson<any>(res);
      if (data?.url) {
        console.log(`[Client Resolver] Cobalt success: ${inst}`);
        return data.url;
      }
    }
  } catch (e: any) {
    try {
      const res = await fetch(`${inst}/api/json`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          isAudioOnly: true,
          audioFormat: 'mp3',
          audioQuality: '128'
        }),
        signal: getTimeoutSignal(5000)
      });
      if (res.ok) {
        const data = await safelyParseJson<any>(res);
        if (data?.url) {
          console.log(`[Client Resolver] Cobalt success (fallback): ${inst}`);
          return data.url;
        }
      }
    } catch {}
  }
  return null;
};

const tryInvidiousInstance = async (inst: string, videoId: string): Promise<string | null> => {
  try {
    const testUrl = `${inst}/latest_version?id=${videoId}&local=true&itag=140`;
    const res = await fetch(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      signal: getTimeoutSignal(5000)
    });
    if (res.status === 200 || res.status === 206) {
      console.log(`[Client Resolver] Invidious success: ${inst}`);
      return res.url;
    }
  } catch {}
  return null;
};

const tryPipedInstance = async (inst: string, videoId: string): Promise<string | null> => {
  try {
    const res = await fetch(`${inst}/streams/${videoId}`, {
      signal: getTimeoutSignal(5000),
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    });
    if (res.ok) {
      const data = await safelyParseJson<any>(res);
      if (data) {
        const audioStreams = data.audioStreams || [];
        const best = audioStreams.find((s: any) => s.mimeType?.includes('audio/mp4')) ||
                     audioStreams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];
        if (best?.url) {
          console.log(`[Client Resolver] Piped success: ${inst}`);
          return best.url;
        }
      }
    }
  } catch {}
  return null;
};

const resolveAudioUrlOnClient = async (videoId: string): Promise<string | null> => {
  console.log(`[Client Resolver] Resolving backup audio stream for ${videoId} in parallel...`);

  const cobaltPromises = shuffle(COBALT_INSTANCES).slice(0, 4).map(inst => tryCobaltInstance(inst, videoId));
  const invidiousPromises = shuffle([
    'https://inv.thepixora.com',
    'https://yewtu.be',
    'https://invidious.projectsegfau.lt',
    'https://inv.nadeko.net',
    'https://invidious.flokinet.to',
    'https://invidious.lre.yt'
  ]).slice(0, 4).map(inst => tryInvidiousInstance(inst, videoId));
  const pipedPromises = shuffle(PIPED_INSTANCES).slice(0, 4).map(inst => tryPipedInstance(inst, videoId));

  try {
    const url = await raceFirstSuccess([
      ...cobaltPromises,
      ...invidiousPromises,
      ...pipedPromises
    ]);
    return url;
  } catch (err) {
    console.error('[Client Resolver] All parallel resolution attempts failed:', err);
    return null;
  }
};

export interface Track {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
}

interface MusicPlayerContextType {
  // Playback state
  currentTrack: Track | null;
  isPlaying: boolean;
  useBackgroundAudioMode: boolean;
  activeSource: 'youtube' | 'background' | null;

  // Player refs
  ytPlayerRef: React.MutableRefObject<any>;
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;

  // Actions
  handlePlayTrack: (track: Track, trackList?: Track[]) => void;
  handlePlayPause: () => void;
  handleNext: () => void;
  handlePrevious: () => void;
  handlePlayFromPlaylist: (track: Track) => void;
  handlePlayFromQueue: (track: Track) => void;
  forceBackgroundPlayback: (track?: Track, options?: { trackList?: Track[]; fromPlaylist?: boolean }) => Promise<boolean>;
  handleAddToPlaylist: (track: Track) => void;
  handleAddToQueue: (track: Track) => void;
  handleRemoveFromPlaylist: (trackId: string) => void;
  handleClearPlaylist: () => void;

  // Playlist & Queue
  playlist: Track[];
  queue: Track[];
  isInPlaylist: (trackId: string) => boolean;
  removeFromQueue: (trackId: string) => void;
  reorderPlaylist: (startIndex: number, endIndex: number) => void;
  shuffleMode: boolean;
  toggleShuffle: () => void;
  loopMode: 'off' | 'all' | 'one';
  loopOneCount: number;
  cycleLoopMode: () => void;
  toggleLoopOne: () => void;

  // Favorites
  isFavorite: (trackId: string) => boolean;
  toggleFavorite: (track: Track) => Promise<boolean>;

  // Track list context (search results / famous songs)
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;

  // Panel state
  nowPlayingOpen: boolean;
  setNowPlayingOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Mini player visibility
  showMiniPlayer: boolean;
  setShowMiniPlayer: React.Dispatch<React.SetStateAction<boolean>>;

  // Volume state
  volume: number;
  setVolume: (value: number) => void;
  isMuted: boolean;
  setIsMuted: (value: boolean) => void;
  useBackgroundAudioOnly: boolean;
  setUseBackgroundAudioOnly: (v: boolean | ((prev: boolean) => boolean)) => void;
  setUseBackgroundAudioMode: (v: boolean) => void;
}


const MusicPlayerContext = createContext<MusicPlayerContextType | null>(null);

export function useMusicPlayer() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error('useMusicPlayer must be used within MusicPlayerProvider');
  return ctx;
}

export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useTheme();
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playingFromPlaylist, setPlayingFromPlaylist] = useState(false);
  const [useBackgroundAudioMode, setUseBackgroundAudioModeState] = useState(() => {
    return false;
  });

  const setUseBackgroundAudioMode = useCallback((val: boolean) => {
    setUseBackgroundAudioModeState(val);
    localStorage.setItem('nyra-bg-audio-mode', String(val));
  }, []);

  const [useBackgroundAudioOnly, setUseBackgroundAudioOnlyState] = useState(() => {
    const saved = localStorage.getItem('nyra-background-audio-only');
    if (saved !== null) return saved === 'true';
    return isMobileLikeDevice();
  });
  const useBackgroundAudioOnlyRef = useRef(useBackgroundAudioOnly);
  const isResolvingStreamRef = useRef(false);

  const setUseBackgroundAudioOnly = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
    setUseBackgroundAudioOnlyState(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      useBackgroundAudioOnlyRef.current = next;
      localStorage.setItem('nyra-background-audio-only', String(next));
      return next;
    });
  }, []);

  const [ytApiReady, setYtApiReady] = useState(false);
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);
  const [loopMode, setLoopMode] = useState<'off' | 'all' | 'one'>(() => {
    const savedCount = Number(localStorage.getItem('nyra-loop-one-count') || '0');
    if (savedCount > 0) return 'one';
    return (localStorage.getItem('nyra-loop-mode') as 'off' | 'all' | 'one') || 'off';
  });
  const [loopOneCount, setLoopOneCount] = useState(() => {
    const saved = Number(localStorage.getItem('nyra-loop-one-count') || '0');
    return Number.isFinite(saved) ? Math.max(0, Math.min(9, saved)) : 0;
  });
  const loopOneCountRef = useRef(loopOneCount);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('nyra-volume');
    return saved ? parseInt(saved, 10) : 80;
  });
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('nyra-muted') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('nyra-volume', volume.toString());
    if (primaryAudioRef.current) {
      primaryAudioRef.current.volume = isMuted ? 0 : volume / 100;
    }
    if (secondaryAudioRef.current) {
      secondaryAudioRef.current.volume = isMuted ? 0 : volume / 100;
    }
    if (ytPlayerRef.current && ytPlayerRef.current.setVolume) {
      ytPlayerRef.current.setVolume(isMuted ? 0 : volume);
    }
  }, [volume, isMuted]);

  useEffect(() => {
    localStorage.setItem('nyra-muted', isMuted.toString());
  }, [isMuted]);




  // Track which audio source is active to prevent state conflicts
  const activeSourceRef = useRef<'youtube' | 'background' | null>(null);
  const [activeSource, setActiveSource] = useState<'youtube' | 'background' | null>(null);

  const ytPlayerRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const primaryAudioRef = useRef<HTMLAudioElement | null>(null);
  const secondaryAudioRef = useRef<HTMLAudioElement | null>(null);
  const handleNextRef = useRef<() => void>();
  const audioPlayAttemptRef = useRef(0);

  const setPlaybackSource = useCallback((source: 'youtube' | 'background' | null) => {
    activeSourceRef.current = source;
    setActiveSource(source);
  }, []);

  const switchToAudioElement = useCallback((target: 'primary' | 'secondary') => {
    const current = audioRef.current;
    const targetAudio = target === 'primary' ? primaryAudioRef.current : secondaryAudioRef.current;
    
    if (!current || !targetAudio || current === targetAudio) return;

    console.log(`[Audio Element Switch] Seamlessly transferring playback from ${current.id || 'unknown'} to ${target}`);

    const wasPlaying = isPlaying && !current.paused;
    const currentTime = current.currentTime;
    const src = current.src;

    if (wasPlaying) {
      try { current.pause(); } catch {}
    }

    // Transfer source, position, parameters
    targetAudio.src = src;
    targetAudio.currentTime = currentTime;
    targetAudio.volume = isMuted ? 0 : volume / 100;
      targetAudio.loop = false;

    // Point the context-wide active audioRef to the target
    audioRef.current = targetAudio;

    if (wasPlaying) {
      targetAudio.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn('[Audio Element Switch] Resume failed on target:', err);
      });
    }
  }, [isPlaying, volume, isMuted, loopMode]);

  const safePlay = useCallback(async (audio: HTMLAudioElement, shouldApply: () => boolean = () => true) => {
    try {
      await audio.play();
      if (!shouldApply()) return false;
      setIsPlaying(true);
      return true;
    } catch (e: any) {
      if (e?.name === 'NotAllowedError') {
        toast.info('Tap Play once to start audio.');
        return false;
      }
      if (!useBackgroundAudioOnlyRef.current && (e.name === 'NotSupportedError' || e.message?.includes('suitable') || e.message?.includes('CORS'))) {
        console.warn('CORS/Suitability failure, retrying without crossOrigin');
        audio.removeAttribute('crossOrigin');
        audio.load();
        try {
          await audio.play();
          if (!shouldApply()) return false;
          setIsPlaying(true);
          return true;
        } catch (innerError) {
          console.error('Non-CORS fallback also failed:', innerError);
        }
      }
      return false;
    }
  }, []);

  const playAudioUrl = useCallback(async (url: string, crossOriginSetting: 'anonymous' | null) => {
    const audio = audioRef.current;
    if (!audio) return false;
    const attemptId = ++audioPlayAttemptRef.current;

    if (crossOriginSetting && audio === primaryAudioRef.current) {
      audio.crossOrigin = crossOriginSetting;
    } else {
      audio.removeAttribute('crossOrigin');
    }

    audio.src = url;
    audio.preload = 'auto';
    audio.load();

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<boolean>((resolve) => {
      timeoutId = setTimeout(() => resolve(false), PLAYBACK_START_TIMEOUT_MS);
    });

    const success = await Promise.race([
      safePlay(audio, () => attemptId === audioPlayAttemptRef.current),
      timeoutPromise,
    ]);
    if (timeoutId) clearTimeout(timeoutId);

    if (attemptId !== audioPlayAttemptRef.current) return false;

    if (!success && audio.src === url) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      setIsPlaying(false);
    }

    return success;
  }, [safePlay]);

  const {
    playlist, addToPlaylist, removeFromPlaylist, clearPlaylist,
    isInPlaylist, getNextTrack, getPreviousTrack, reorderPlaylist,
  } = usePlaylist();

  const {
    queue, addToQueue, removeFromQueue, clearQueue,
    getNextFromQueue, shuffleMode, toggleShuffle, setLastPlayed,
  } = useQueue();

  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);

  const { isFavorite, toggleFavorite } = useFavorites();
  const { recordPlay } = useListeningHistory();

    // Create background audio element on mount
    useEffect(() => {
      if (!primaryAudioRef.current) {
        const audio = new Audio();
        audio.id = 'primary-audio';
        audio.preload = 'auto';
        audio.controls = false;
        audio.disableRemotePlayback = false;
        (audio as any).playsInline = true;
        audio.setAttribute('playsinline', 'true');
        audio.setAttribute('webkit-playsinline', 'true');
        audio.setAttribute('x-webkit-airplay', 'allow');
        primaryAudioRef.current = audio;
      }
      if (!secondaryAudioRef.current) {
        const audio = new Audio();
        audio.id = 'secondary-audio';
        audio.preload = 'auto';
        audio.controls = false;
        audio.disableRemotePlayback = false;
        (audio as any).playsInline = true;
        audio.setAttribute('playsinline', 'true');
        audio.setAttribute('webkit-playsinline', 'true');
        audio.setAttribute('x-webkit-airplay', 'allow');
        secondaryAudioRef.current = audio;
      }

      // Point main audioRef to primary initially
      audioRef.current = primaryAudioRef.current;
  
      return () => {
        if (primaryAudioRef.current) {
          primaryAudioRef.current.pause();
          primaryAudioRef.current.src = '';
        }
        if (secondaryAudioRef.current) {
          secondaryAudioRef.current.pause();
          secondaryAudioRef.current.src = '';
        }
      };
    }, []);


    // Sync loop mode with audio elements
    useEffect(() => {
      loopOneCountRef.current = loopOneCount;
      if (primaryAudioRef.current) {
        primaryAudioRef.current.loop = false;
      }
      if (secondaryAudioRef.current) {
        secondaryAudioRef.current.loop = false;
      }
    }, [loopOneCount]);

  // Audio event listeners bound to both elements to track state seamlessly
  useEffect(() => {
    const primary = primaryAudioRef.current;
    const secondary = secondaryAudioRef.current;

    const handleEnded = () => {
      if (loopOneCountRef.current > 0) {
        loopOneCountRef.current -= 1;
        const nextCount = loopOneCountRef.current;
        setLoopOneCount(nextCount);
        localStorage.setItem('nyra-loop-one-count', String(nextCount));
        if (nextCount === 0) {
          setLoopMode('off');
          localStorage.setItem('nyra-loop-mode', 'off');
        }
        const audio = audioRef.current;
        if (audio) {
          audio.currentTime = 0;
          audio.play().catch(() => {});
          setIsPlaying(true);
        }
        return;
      }
      if (settings.autoPlayNext && handleNextRef.current) {
        handleNextRef.current();
      } else {
        setIsPlaying(false);
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleError = (e: any) => {
      if (isResolvingStreamRef.current) {
        console.warn('Audio element error ignored during active background resolution/retry phase');
        return;
      }
      console.warn('Audio error, falling back to YouTube player', e);
      if (!useBackgroundAudioOnlyRef.current) {
        setUseBackgroundAudioMode(false);
      } else {
        toast.error('Stream playback interrupted. Reconnecting...');
      }
    };

    if (primary) {
      primary.addEventListener('ended', handleEnded);
      primary.addEventListener('error', handleError);
      primary.addEventListener('play', handlePlay);
      primary.addEventListener('playing', handlePlay);
      primary.addEventListener('pause', handlePause);
    }
    if (secondary) {
      secondary.addEventListener('ended', handleEnded);
      secondary.addEventListener('error', handleError);
      secondary.addEventListener('play', handlePlay);
      secondary.addEventListener('playing', handlePlay);
      secondary.addEventListener('pause', handlePause);
    }

    return () => {
      if (primary) {
        primary.removeEventListener('ended', handleEnded);
        primary.removeEventListener('error', handleError);
        primary.removeEventListener('play', handlePlay);
        primary.removeEventListener('playing', handlePlay);
        primary.removeEventListener('pause', handlePause);
      }
      if (secondary) {
        secondary.removeEventListener('ended', handleEnded);
        secondary.removeEventListener('error', handleError);
        secondary.removeEventListener('play', handlePlay);
        secondary.removeEventListener('playing', handlePlay);
        secondary.removeEventListener('pause', handlePause);
      }
    };
    }, [settings.autoPlayNext]);

  // Sync isPlaying with actual audio or youtube playing state periodically to avoid state desyncs
  // Also updates lockscreen Media Session position progress
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (activeSourceRef.current === 'background') {
        const audio = audioRef.current;
        if (audio && audio.src) {
          const actuallyPlaying = !audio.paused;
          if (actuallyPlaying !== isPlaying) {
            setIsPlaying(actuallyPlaying);
          }

          // Update lockscreen Media Session seek/position state
          if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
            try {
              const dur = audio.duration;
              const pos = audio.currentTime;
              if (!isNaN(dur) && dur > 0 && !isNaN(pos) && pos >= 0 && pos <= dur) {
                navigator.mediaSession.setPositionState({
                  duration: dur,
                  playbackRate: audio.playbackRate || 1.0,
                  position: pos,
                });
              }
            } catch (err) {
              console.error('Error setting media session position state:', err);
            }
          }
        }
      } else if (activeSourceRef.current === 'youtube') {
        const ytPlayer = ytPlayerRef.current;
        if (ytPlayer && typeof ytPlayer.getPlayerState === 'function') {
          try {
            const state = ytPlayer.getPlayerState();
            const actuallyPlaying = state === 1 || state === 3; // 1 = PLAYING, 3 = BUFFERING
            if (actuallyPlaying !== isPlaying) {
              setIsPlaying(actuallyPlaying);
            }

            // Sync media session for YouTube source
            if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
              try {
                const dur = ytPlayer.getDuration() || 0;
                const pos = ytPlayer.getCurrentTime() || 0;
                if (dur > 0 && pos >= 0 && pos <= dur) {
                  navigator.mediaSession.setPositionState({
                    duration: dur,
                    playbackRate: 1.0,
                    position: pos,
                  });
                }
              } catch (err) {}
            }
          } catch (e) {
            // Player might not be initialized or destroyed
          }
        }
      }
    }, 1000);

    return () => clearInterval(syncInterval);
  }, [isPlaying]);

  // Mobile browsers suspend iframe/video playback aggressively in background.
  // Keep music on the native HTMLAudioElement path before the page is hidden.
  useEffect(() => {
    if (!isMobileLikeDevice()) return;

    const keepAudioAlive = () => {
      useBackgroundAudioOnlyRef.current = true;
      localStorage.setItem('nyra-background-audio-only', 'true');

      if (!currentTrack || !isPlaying) return;

      if (activeSourceRef.current !== 'background' || !audioRef.current?.src) {
        void forceBackgroundPlaybackRef.current?.(currentTrack, {
          trackList: tracks.length ? tracks : [currentTrack],
          fromPlaylist: playingFromPlaylist,
        });
        return;
      }

      audioRef.current.play().catch(() => {
        // Background policies vary by OS; the next foreground tap can resume.
      });
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') keepAudioAlive();
    };

    window.addEventListener('pagehide', keepAudioAlive);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pagehide', keepAudioAlive);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentTrack, isPlaying, tracks, playingFromPlaylist]);

  // Load YouTube IFrame API
  useEffect(() => {
    const yt = (window as any).YT;
    if (yt && yt.Player) {
      setYtApiReady(true);
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    (window as any).onYouTubeIframeAPIReady = () => {
      setYtApiReady(true);
    };
  }, []);



  const createPlayer = useCallback((videoId: string) => {
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.destroy(); } catch {}
      ytPlayerRef.current = null;
    }
    const container = document.getElementById('youtube-player-container');
    if (!container) return;
    container.innerHTML = '<div id="yt-player"></div>';

    const yt = (window as any).YT;
    if (!yt?.Player) return;

    ytPlayerRef.current = new yt.Player('yt-player', {
      height: '1', width: '1', videoId,
      playerVars: {
        autoplay: 1, controls: 0, disablekb: 1, fs: 0,
        iv_load_policy: 3, modestbranding: 1, rel: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: (e: any) => { 
          e.target.setVolume(80); 
          e.target.playVideo(); 
          setIsPlaying(true);
        },
        onStateChange: (e: any) => {
          if (activeSourceRef.current === 'background') return;
          if (e.data === yt.PlayerState.PLAYING || e.data === yt.PlayerState.BUFFERING) {
            setIsPlaying(true);
          } else if (e.data === yt.PlayerState.PAUSED) {
            setIsPlaying(false);
          } else if (e.data === yt.PlayerState.ENDED) {
            if (loopOneCountRef.current > 0) {
              loopOneCountRef.current -= 1;
              const nextCount = loopOneCountRef.current;
              setLoopOneCount(nextCount);
              localStorage.setItem('nyra-loop-one-count', String(nextCount));
              if (nextCount === 0) {
                setLoopMode('off');
                localStorage.setItem('nyra-loop-mode', 'off');
              }
              try { e.target.seekTo(0, true); e.target.playVideo(); } catch {}
              setIsPlaying(true);
              return;
            }
            if (settings.autoPlayNext && handleNextRef.current) handleNextRef.current();
            else setIsPlaying(false);
          }
        },
        onError: () => {
          toast.error('Could not play this track. Trying next...');
          if (settings.autoPlayNext && handleNextRef.current) {
            setTimeout(() => handleNextRef.current?.(), 1000);
          }
        },
      },
    });
  }, [settings.autoPlayNext, loopMode]);

  const nextTrackResolvedUrlRef = useRef<{ id: string, url: string, crossOriginSetting: 'anonymous' | null } | null>(null);

  const preloadNextTrack = useCallback(async () => {
    // Determine what track is next
    if (!currentTrack) return;
    let nextTrack: Track | null = null;

    // Check queue first
    const nextFromQueue = getNextFromQueue(playlist);
    if (nextFromQueue) {
      nextTrack = nextFromQueue;
    } else if (playingFromPlaylist) {
      nextTrack = getNextTrack(currentTrack.id);
      if (!nextTrack && loopMode === 'all' && playlist.length > 0) {
        nextTrack = playlist[0];
      }
    } else if (tracks.length > 0) {
      const nextIndex = currentTrackIndex + 1;
      if (nextIndex < tracks.length) {
        nextTrack = tracks[nextIndex];
      } else if (loopMode === 'all') {
        nextTrack = tracks[0];
      }
    }

    if (!nextTrack) return;
    const nextId = nextTrack.id;

    // Avoid redundant preload
    if (nextTrackResolvedUrlRef.current && nextTrackResolvedUrlRef.current.id === nextId) {
      return;
    }

    try {
      console.log('[Background Preload] Pre-resolving next track:', nextId);
      // Check offline cache first
      const offlineTrack = await getTrackOffline(nextId);
      if (offlineTrack && offlineTrack.audioBlob) {
        const localUrl = URL.createObjectURL(offlineTrack.audioBlob);
        nextTrackResolvedUrlRef.current = { id: nextId, url: localUrl, crossOriginSetting: null };
        console.log('[Background Preload] Next track cached offline pre-resolved.');
        return;
      }

      // Resolve via proxy endpoint
      const proxyStreamUrl = getAudioUrlEndpoint(nextId, { stream: true });
      nextTrackResolvedUrlRef.current = { id: nextId, url: proxyStreamUrl, crossOriginSetting: 'anonymous' };
      console.log('[Background Preload] Next track stream proxy url pre-resolved.');
    } catch (e) {
      console.error('[Background Preload] Failed to pre-resolve next track:', e);
    }
  }, [currentTrack, playlist, playingFromPlaylist, getNextTrack, getNextFromQueue, tracks, currentTrackIndex, loopMode]);

  // Preload next song as soon as current song starts
  useEffect(() => {
    if (currentTrack) {
      preloadNextTrack();
    }
  }, [currentTrack, preloadNextTrack]);

  const playWithBackgroundAudio = useCallback(async (videoId: string) => {
    // If we have a preloaded url matching this videoId, play it synchronously!
    if (nextTrackResolvedUrlRef.current && nextTrackResolvedUrlRef.current.id === videoId) {
      console.log('[Offline/Background Playback] Playing preloaded track instantly:', videoId);
      const preloaded = nextTrackResolvedUrlRef.current;
      // Clear preload ref so we don't play it twice
      nextTrackResolvedUrlRef.current = null;
      
      setPlaybackSource('background');
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.pauseVideo(); } catch {}
      }
      const success = await playAudioUrl(preloaded.url, preloaded.crossOriginSetting);
      if (success) {
        return;
      }
      console.warn('Preloaded playback failed, falling back to full resolution');
    }

    // Keep media session alive with a tiny slice of silence before setting src to empty
    if (activeSourceRef.current === 'background') {
      if (audioRef.current) {
        try {
          audioRef.current.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAGRhdGEAAAAA';
          audioRef.current.play().catch(() => {});
        } catch {}
      }
    }

    const tryRobustResolution = async (): Promise<boolean> => {
      isResolvingStreamRef.current = true;
      try {
        // 0. Check local offline cache first
        const offlineTrack = await getTrackOffline(videoId);
        if (offlineTrack && offlineTrack.audioBlob) {
          console.log('[Offline Playback] Playing cached track:', videoId);
          const localUrl = URL.createObjectURL(offlineTrack.audioBlob);
          const success = await playAudioUrl(localUrl, null);
          if (success) {
            isResolvingStreamRef.current = false;
            return true;
          }
        }

        // 1. Try local/Supabase stream proxy
        console.log('Resolving stream via edge proxy...');
        const proxyStreamUrl = getAudioUrlEndpoint(videoId, { stream: true });
        let success = await playAudioUrl(proxyStreamUrl, 'anonymous');
        if (success) {
          isResolvingStreamRef.current = false;
          return true;
        }

        // 2. Try direct audio URL from edge function
        try {
          console.log('Edge proxy failed. Querying direct url JSON...');
          const response = await fetch(getAudioUrlEndpoint(videoId));
          const data = response.ok ? await response.json() : null;
          const directAudioUrl = data?.audioUrl || data?.audioUrl1;
          if (directAudioUrl) {
            // Play with anonymous first to see if CORS is OK
            success = await playAudioUrl(directAudioUrl, 'anonymous');
            if (success) {
              isResolvingStreamRef.current = false;
              return true;
            }

            // If CORS fails, raw playback is only useful outside DJ-only mode.
            if (!useBackgroundAudioOnlyRef.current) {
              success = await playAudioUrl(directAudioUrl, null);
              if (success) {
                toast.warning('Audio filters disabled for this track (raw stream fallback).');
                isResolvingStreamRef.current = false;
                return true;
              }
            }
          }
        } catch (fallbackErr) {
          console.error('Edge direct json fetch failed:', fallbackErr);
        }

        // 3. Fallback to high-performance client-side resolver (Cobalt / Piped / Invidious)
        try {
          toast.info('Finding an optimal audio stream...');
          const clientUrl = await resolveAudioUrlOnClient(videoId);
          if (clientUrl) {
            success = await playAudioUrl(clientUrl, 'anonymous');
            if (success) {
              toast.success('High-quality stream connected!');
              isResolvingStreamRef.current = false;
              return true;
            }

            // Proxy the direct URL through our edge function to guarantee CORS compatibility!
            const proxiedUrl = getAudioUrlEndpoint(videoId, { proxyUrl: clientUrl });
            success = await playAudioUrl(proxiedUrl, 'anonymous');
            if (success) {
              toast.success('High-quality stream connected!');
              isResolvingStreamRef.current = false;
              return true;
            }

            if (!useBackgroundAudioOnlyRef.current) {
              success = await playAudioUrl(clientUrl, null);
              if (success) {
                toast.warning('Audio filters disabled for this track (CORS cloud fallback).');
                isResolvingStreamRef.current = false;
                return true;
              }
            }
          }
        } catch (clientErr) {
          console.error('Client resolver failed:', clientErr);
        }
      } finally {
        isResolvingStreamRef.current = false;
      }
      return false;
    };

    const isDownloaded = await isTrackDownloadedOffline(videoId);
    const forceBackground = useBackgroundAudioOnlyRef.current || isDownloaded || !navigator.onLine;

    if (forceBackground) {
      setPlaybackSource('background');
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.pauseVideo(); } catch {}
      }
      const resolved = await tryRobustResolution();
      if (!resolved) {
        toast.error('Local audio failed to load. Tap play to retry.');
      }
      return;
    }

    // Race a direct audio URL fetch against a fast timeout so playback starts
    // instantly via YouTube if the edge function is slow.
    const START_TIMEOUT_MS = 3500;
    let usedFallback = false;

    try {
      const controller = new AbortController();
      const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => {
          if (!usedFallback && !useBackgroundAudioOnlyRef.current) {
            usedFallback = true;
            console.log('Background audio timeout, using YT fallback');
            setPlaybackSource('youtube');
            const yt = (window as any).YT;
            if (ytApiReady && yt?.Player) {
              createPlayer(videoId);
            }
            controller.abort();
          }
          resolve(false);
        }, START_TIMEOUT_MS);
      });

      const fetchResolutionPromise = tryRobustResolution();
      const result = await Promise.race([fetchResolutionPromise, timeoutPromise]);

      if (usedFallback) return;

      if (result === true) {
        setPlaybackSource('background');
        if (ytPlayerRef.current) {
          try { ytPlayerRef.current.pauseVideo(); } catch {}
        }
        return;
      }
    } catch (error) {
      console.warn('Background audio race failed:', error);
    }

    if (usedFallback || useBackgroundAudioOnlyRef.current) return;
    // Final fallback to standard YouTube IFrame player
    setPlaybackSource('youtube');
    const yt = (window as any).YT;
    if (ytApiReady && yt?.Player) {
      createPlayer(videoId);
    } else {
      toast.error('Player not ready. Please try again.');
    }
  }, [ytApiReady, createPlayer, setPlaybackSource, playAudioUrl]);

  const forceBackgroundPlayback = useCallback(async (track = currentTrack, options?: { trackList?: Track[]; fromPlaylist?: boolean }): Promise<boolean> => {
    if (!track || !audioRef.current) {
      toast.error('Play or select a song first');
      return false;
    }

    try {
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.pauseVideo(); } catch {}
      }
      audioRef.current.pause();
      audioRef.current.src = '';
      setUseBackgroundAudioMode(true);

      if (options?.trackList) {
        setTracks(options.trackList);
        setCurrentTrackIndex(options.trackList.findIndex(t => t.id === track.id));
      }

      setCurrentTrack(track);
      setPlayingFromPlaylist(!!options?.fromPlaylist);
      setLastPlayed(track.id);
      recordPlay(track);
      setShowMiniPlayer(true);
      setPlaybackSource('background');

      const tryRobustResolution = async (): Promise<boolean> => {
        isResolvingStreamRef.current = true;
        try {
          // 0. Check local offline cache first
          const offlineTrack = await getTrackOffline(track.id);
          if (offlineTrack && offlineTrack.audioBlob) {
            console.log('[Offline Playback] Playing cached track force:', track.id);
            const localUrl = URL.createObjectURL(offlineTrack.audioBlob);
            const success = await playAudioUrl(localUrl, null);
            if (success) {
              isResolvingStreamRef.current = false;
              return true;
            }
          }

          // 1. Try local/Supabase stream proxy
          console.log('Resolving force stream via edge proxy...');
          const streamUrl = getAudioUrlEndpoint(track.id, { stream: true });
          let success = await playAudioUrl(streamUrl, 'anonymous');
          if (success) {
            isResolvingStreamRef.current = false;
            return true;
          }

          // 2. Try direct audio URL from edge function
          try {
            console.log('Edge proxy failed. Resolving direct url fallback...');
            const response = await fetch(getAudioUrlEndpoint(track.id));
            const data = response.ok ? await response.json() : null;
            const directAudioUrl = data?.audioUrl || data?.audioUrl1;
            if (directAudioUrl) {
              success = await playAudioUrl(directAudioUrl, 'anonymous');
              if (success) {
                isResolvingStreamRef.current = false;
                return true;
              }

              if (!useBackgroundAudioOnlyRef.current) {
                success = await playAudioUrl(directAudioUrl, null);
                if (success) {
                  toast.warning('Audio filters disabled for this track (raw stream fallback).');
                  isResolvingStreamRef.current = false;
                  return true;
                }
              }
            }
          } catch (fallbackErr: any) {
            console.error('Direct audio stream fallback failed:', fallbackErr);
          }

          // 3. Fallback to client-side resolver
          try {
            toast.info('Finding an optimal audio stream...');
            const clientUrl = await resolveAudioUrlOnClient(track.id);
            if (clientUrl) {
              success = await playAudioUrl(clientUrl, 'anonymous');
              if (success) {
                toast.success('High-quality stream connected!');
                isResolvingStreamRef.current = false;
                return true;
              }

              // Proxy the direct URL through our edge function to guarantee CORS compatibility!
              const proxiedUrl = getAudioUrlEndpoint(track.id, { proxyUrl: clientUrl });
              success = await playAudioUrl(proxiedUrl, 'anonymous');
              if (success) {
                toast.success('High-quality stream connected!');
                isResolvingStreamRef.current = false;
                return true;
              }

              if (!useBackgroundAudioOnlyRef.current) {
                success = await playAudioUrl(clientUrl, null);
                if (success) {
                  toast.warning('Audio filters disabled for this track (CORS cloud fallback).');
                  isResolvingStreamRef.current = false;
                  return true;
                }
              }
            }
          } catch (clientErr) {
            console.error('Client resolver failed:', clientErr);
          }
        } finally {
          isResolvingStreamRef.current = false;
        }
        return false;
      };

      const resolved = await tryRobustResolution();
      if (resolved) {
        return true;
      }

      if (useBackgroundAudioOnlyRef.current) {
        toast.error('Audio stream failed. Try another song.');
        return false;
      }

      // Final fallback to standard YouTube IFrame player (only if not background only)
      audioRef.current.src = '';
      setPlaybackSource('youtube');
      if (ytApiReady) createPlayer(track.id);
      toast.info('Playing via YouTube player.');
      return true;

    } catch (error: any) {
      console.warn('Force audio source failed:', error);
      if (useBackgroundAudioOnlyRef.current) {
        toast.error(`Audio failed: ${error?.message || 'Network error'}`);
        return false;
      }
      setPlaybackSource('youtube');
      toast.error(`Could not start audio: ${error?.message || 'Network error'}`);
      return false;
    }
  }, [currentTrack, setLastPlayed, recordPlay, setPlaybackSource, ytApiReady, createPlayer, playAudioUrl]);

  const playStandardOrOffline = useCallback(async (trackId: string) => {
    const isDownloaded = await isTrackDownloadedOffline(trackId);

    if (isDownloaded || useBackgroundAudioOnlyRef.current || !navigator.onLine) {
      playWithBackgroundAudio(trackId);
      return;
    }

    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      } catch {}
    }
    setPlaybackSource('youtube');
    if (ytApiReady) createPlayer(trackId);
    else toast.error('Player not ready. Please try again.');
  }, [playWithBackgroundAudio, ytApiReady, createPlayer, setPlaybackSource]);

  const handlePlayTrack = useCallback(async (track: Track, trackList?: Track[]) => {
    if (trackList) {
      setTracks(trackList);
      const idx = trackList.findIndex(t => t.id === track.id);
      setCurrentTrackIndex(idx);
    } else {
      const idx = tracks.findIndex(t => t.id === track.id);
      setCurrentTrackIndex(idx);
    }
    setCurrentTrack(track);
    setPlayingFromPlaylist(false);
    setLastPlayed(track.id);
    setShowMiniPlayer(true);
    recordPlay(track);
    
    const isDownloaded = await isTrackDownloadedOffline(track.id);

    if (!navigator.onLine && !isDownloaded) {
      toast.error('You are offline, and this track has not been downloaded for offline playback.');
      return;
    }

    playStandardOrOffline(track.id);
  }, [tracks, setLastPlayed, recordPlay, playStandardOrOffline]);

  const handlePlayFromPlaylist = useCallback(async (track: Track) => {
    setCurrentTrack(track);
    setPlayingFromPlaylist(true);
    setLastPlayed(track.id);
    setShowMiniPlayer(true);
    recordPlay(track);
    
    const isDownloaded = await isTrackDownloadedOffline(track.id);

    if (!navigator.onLine && !isDownloaded) {
      toast.error('You are offline, and this track has not been downloaded for offline playback.');
      return;
    }

    playStandardOrOffline(track.id);
  }, [setLastPlayed, recordPlay, playStandardOrOffline]);

  const handlePlayPause = useCallback(async () => {
    // If we have a track but no active source is playing it yet, start it up!
    const isDownloaded = currentTrack ? await isTrackDownloadedOffline(currentTrack.id) : false;
    const forceBackground = useBackgroundAudioOnlyRef.current || isDownloaded || !navigator.onLine;

    if (currentTrack && (
      !activeSourceRef.current || 
      (forceBackground && activeSourceRef.current !== 'background') ||
      (activeSourceRef.current === 'background' && audioRef.current && !audioRef.current.src)
    )) {
      if (forceBackground) {
        playWithBackgroundAudio(currentTrack.id);
      } else {
        setPlaybackSource('youtube');
        if (ytApiReady) createPlayer(currentTrack.id);
      }
      return;
    }

    if (activeSourceRef.current === 'background' && audioRef.current && audioRef.current.src) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        safePlay(audioRef.current).then(success => {
          if (!success) {
            toast.error("Playback failed. Reconnecting...");
            // Switch to YouTube as last resort if we are online and not forcing background
            if (!forceBackground) {
              setPlaybackSource('youtube');
            }
          }
        });
      }
      return;
    }
    if (!ytPlayerRef.current) return;
    try {
      if (isPlaying) { ytPlayerRef.current.pauseVideo(); setIsPlaying(false); }
      else { ytPlayerRef.current.playVideo(); setIsPlaying(true); }
    } catch {}
  }, [isPlaying, currentTrack, playWithBackgroundAudio, ytApiReady, createPlayer, safePlay]);

  const cycleLoopMode = useCallback(() => {
    setLoopMode(prev => {
      const next = prev === 'off' ? 'all' : 'off';
      loopOneCountRef.current = 0;
      setLoopOneCount(0);
      localStorage.setItem('nyra-loop-one-count', '0');
      localStorage.setItem('nyra-loop-mode', next);
      return next;
    });
  }, []);

  const toggleLoopOne = useCallback(() => {
    setLoopOneCount(prev => {
      const next = prev >= 9 ? 0 : prev + 1;
      loopOneCountRef.current = next;
      localStorage.setItem('nyra-loop-one-count', String(next));
      setLoopMode(next > 0 ? 'one' : 'off');
      localStorage.setItem('nyra-loop-mode', next > 0 ? 'one' : 'off');
      toast.success(next > 0 ? `Song will replay ${next} more time${next === 1 ? '' : 's'}` : 'Song repeat off');
      return next;
    });
  }, []);

  const handleNext = useCallback(async () => {
    const nextFromQueue = getNextFromQueue(playlist);
    if (nextFromQueue) {
      setCurrentTrack(nextFromQueue);
      setPlayingFromPlaylist(false);
      setLastPlayed(nextFromQueue.id);
      playStandardOrOffline(nextFromQueue.id);
      return;
    }
    if (playingFromPlaylist && currentTrack) {
      const nextTrack = getNextTrack(currentTrack.id);
      if (nextTrack) {
        setCurrentTrack(nextTrack);
        setLastPlayed(nextTrack.id);
        playStandardOrOffline(nextTrack.id);
        return;
      } else if (loopMode === 'all' && playlist.length > 0) {
        const firstTrack = playlist[0];
        setCurrentTrack(firstTrack);
        setLastPlayed(firstTrack.id);
        playStandardOrOffline(firstTrack.id);
        return;
      } else { setIsPlaying(false); toast.info('Playlist ended'); return; }
    }
    if (tracks.length === 0) return;
    const nextIndex = currentTrackIndex + 1;
    if (nextIndex >= tracks.length) {
      if (loopMode === 'all') {
        const firstTrack = tracks[0];
        setCurrentTrack(firstTrack);
        setCurrentTrackIndex(0);
        setLastPlayed(firstTrack.id);
        playStandardOrOffline(firstTrack.id);
        return;
      }
      setIsPlaying(false); toast.info('End of tracks'); return;
    }
    const nextTrack = tracks[nextIndex];
    setCurrentTrack(nextTrack);
    setCurrentTrackIndex(nextIndex);
    setPlayingFromPlaylist(false);
    setLastPlayed(nextTrack.id);
    playStandardOrOffline(nextTrack.id);
  }, [currentTrackIndex, tracks, playStandardOrOffline, playingFromPlaylist, currentTrack, getNextTrack, getNextFromQueue, playlist, setLastPlayed, loopMode, audioRef, ytPlayerRef]);

  useEffect(() => { handleNextRef.current = handleNext; }, [handleNext]);

  const handlePrevious = useCallback(() => {
    if (playingFromPlaylist && currentTrack) {
      const prevTrack = getPreviousTrack(currentTrack.id);
      if (prevTrack) {
        setCurrentTrack(prevTrack);
        setLastPlayed(prevTrack.id);
        playStandardOrOffline(prevTrack.id);
        return;
      }
    }
    if (tracks.length === 0) return;
    const prevIndex = currentTrackIndex <= 0 ? tracks.length - 1 : currentTrackIndex - 1;
    const prevTrack = tracks[prevIndex];
    setCurrentTrack(prevTrack);
    setCurrentTrackIndex(prevIndex);
    setPlayingFromPlaylist(false);
    setLastPlayed(prevTrack.id);
    playStandardOrOffline(prevTrack.id);
  }, [currentTrackIndex, tracks, playStandardOrOffline, playingFromPlaylist, currentTrack, getPreviousTrack, setLastPlayed, handleNext]);

  useEffect(() => {
    handleNextRef.current = handleNext;
  }, [handleNext]);

  const handleAddToPlaylist = useCallback((track: Track) => {
    if (isInPlaylist(track.id)) { toast.info('Track already in playlist'); return; }
    addToPlaylist(track);
    toast.success('Added to playlist');
  }, [addToPlaylist, isInPlaylist]);

  const handleAddToQueue = useCallback((track: Track) => {
    addToQueue(track);
    toast.success(`⌛ "${track.title.slice(0, 30)}..." added to queue`);
  }, [addToQueue]);

  const handleRemoveFromPlaylist = useCallback((trackId: string) => {
    removeFromPlaylist(trackId);
    toast.success('Removed from playlist');
  }, [removeFromPlaylist]);

  const handleClearPlaylist = useCallback(() => {
    clearPlaylist();
    clearQueue();
    toast.success('Playlist and queue cleared');
  }, [clearPlaylist, clearQueue]);

  const handlePlayFromQueue = useCallback((track: Track) => {
    removeFromQueue(track.id);
    setCurrentTrack(track);
    setPlayingFromPlaylist(false);
    setLastPlayed(track.id);
    playStandardOrOffline(track.id);
  }, [removeFromQueue, setLastPlayed, playStandardOrOffline]);

  // Media Session API
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.channel,
      album: 'NYRA Music',
      artwork: [
        { src: currentTrack.thumbnail, sizes: '512x512', type: 'image/jpeg' },
      ],
    });
  }, [currentTrack]);

  // --- Android Auto Bridge ---
  useEffect(() => {
    if (!currentTrack) return;
    notifyNativeTrack(
      currentTrack.title,
      currentTrack.channel,
      currentTrack.thumbnail,
      (audioRef.current?.duration || 0) * 1000
    );
  }, [currentTrack]);

  useEffect(() => {
    notifyNativePlayback(isPlaying, (audioRef.current?.currentTime || 0) * 1000);
  }, [isPlaying]);

  useEffect(() => {
    const unsub = listenCarCommands(
      () => { audioRef.current?.play()?.catch(() => {}); ytPlayerRef.current?.playVideo?.(); },
      () => { audioRef.current?.pause(); ytPlayerRef.current?.pauseVideo?.(); },
      (ms) => {
        if (audioRef.current) audioRef.current.currentTime = ms / 1000;
        ytPlayerRef.current?.seekTo?.(ms / 1000, true);
      }
    );
    return unsub;
  }, []);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => { audioRef.current?.play()?.catch(() => {}); ytPlayerRef.current?.playVideo?.(); }],
      ['pause', () => { audioRef.current?.pause(); ytPlayerRef.current?.pauseVideo?.(); }],
      ['previoustrack', handlePrevious],
      ['nexttrack', handleNext],
      ['seekto', (details) => {
        if (details.seekTime !== undefined) {
          if (audioRef.current) audioRef.current.currentTime = details.seekTime;
          ytPlayerRef.current?.seekTo(details.seekTime, true);
        }
      }],
      ['stop', () => {
        audioRef.current?.pause();
        if (audioRef.current) audioRef.current.currentTime = 0;
        ytPlayerRef.current?.stopVideo?.();
      }],
    ];
    for (const [action, handler] of handlers) {
      try { navigator.mediaSession.setActionHandler(action as any, handler); } catch {}
    }
    return () => {
      for (const [action] of handlers) {
        try { navigator.mediaSession.setActionHandler(action, null); } catch {}
      }
    };
  }, [handleNext, handlePrevious]);

  useTabTitle(currentTrack?.title || null, isPlaying);

  return (
    <MusicPlayerContext.Provider value={{
      currentTrack, isPlaying, useBackgroundAudioMode, activeSource,
      ytPlayerRef, audioRef,
      handlePlayTrack, handlePlayPause, handleNext, handlePrevious,
      handlePlayFromPlaylist, handlePlayFromQueue,
      forceBackgroundPlayback,
      handleAddToPlaylist, handleAddToQueue,
      handleRemoveFromPlaylist, handleClearPlaylist,
      playlist, queue, isInPlaylist, removeFromQueue, reorderPlaylist,
      shuffleMode, toggleShuffle,
      loopMode, loopOneCount, cycleLoopMode, toggleLoopOne,
      nowPlayingOpen, setNowPlayingOpen,
      isFavorite, toggleFavorite,
      tracks, setTracks,
      showMiniPlayer, setShowMiniPlayer,
      volume, setVolume,
      isMuted, setIsMuted,
      useBackgroundAudioOnly, setUseBackgroundAudioOnly,
      setUseBackgroundAudioMode,
    }}>

      {children}
      <div
        id="youtube-player-container"
        className="fixed -top-[1px] left-0 w-1 h-[1px] opacity-0 pointer-events-none overflow-hidden"
      />
    </MusicPlayerContext.Provider>
  );
}
