import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getFunctionAuthHeaders } from '@/lib/functionAuth';
import Sidebar from '@/components/Sidebar';
import TrackGrid from '@/components/TrackGrid';
import { useDjAudio } from '@/hooks/useDjAudio';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { Slider } from '@/components/ui/slider';
import { Headphones, Power, RotateCcw, Loader2, Search, Zap, Music2, Activity, ChevronDown, ChevronUp, ListMusic, Wand2, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import MusicPlayer from '@/components/MusicPlayer';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { filterDjModeTracks, getLikelyDjModeTracks } from '@/lib/djStream';
import { djEngine, type DjAutoStyle, type DjChannelMode } from '@/lib/djEngine';

interface Track { id: string; title: string; thumbnail: string; channel: string; }

interface Playlist {
  id: string;
  name: string;
}

/* ─── Spinning Vinyl ─── */
const Vinyl = ({ spinning, level, side }: { spinning: boolean; level: number; side: 'L' | 'R' }) => (
  <div className="relative flex items-center justify-center">
    {/* Outer glow ring */}
    <div
      className="absolute rounded-full transition-all duration-100"
      style={{
        width: 180, height: 180,
        boxShadow: `0 0 ${20 + level * 60}px ${level * 40}px hsl(var(--primary)/0.3)`,
        opacity: 0.6 + level * 0.4,
      }}
    />
    {/* Vinyl record */}
    <div
      className={cn('relative rounded-full border-4 border-white/10 shadow-2xl transition-all duration-500', spinning && 'animate-spin')}
      style={{ 
        width: 'min(160px, 40vw)', 
        height: 'min(160px, 40vw)', 
        animationDuration: '2s', 
        background: 'radial-gradient(circle, #1a1a1a 30%, #111 50%, #0a0a0a 100%)' 
      }}
    >
      {/* Grooves */}
      {[0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map(scale => (
        <div key={scale} className="absolute rounded-full border border-white/5"
          style={{ 
            width: `${scale * 100}%`, 
            height: `${scale * 100}%`, 
            top: `${(1 - scale) * 50}%`, 
            left: `${(1 - scale) * 50}%` 
          }} />
      ))}
      {/* Label */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-[30%] h-[30%] rounded-full flex items-center justify-center border-2 border-primary/50"
          style={{ background: 'hsl(var(--primary)/0.2)' }}>
          <span className="text-[min(2xl,5vw)] font-black text-primary italic">{side}</span>
        </div>
      </div>
      {/* Needle line */}
      <div className="absolute top-1/2 left-1/2 w-full h-[1px] bg-primary/20 origin-left" style={{ transform: 'rotate(-30deg)' }} />
    </div>
  </div>
);

/* ─── VU Meter ─── */
const VuMeter = ({ level }: { level: number }) => {
  const bars = 16;
  return (
    <div className="flex items-end gap-0.5 h-8">
      {Array.from({ length: bars }).map((_, i) => {
        const threshold = (i + 1) / bars;
        const active = level >= threshold;
        const color = i < 10 ? 'bg-primary' : i < 13 ? 'bg-yellow-400' : 'bg-red-500';
        return (
          <div key={i}
            className={cn('flex-1 rounded-sm transition-all duration-75', active ? color : 'bg-white/5')}
            style={{ height: `${40 + i * 4}%` }}
          />
        );
      })}
    </div>
  );
};

/* ─── EQ Fader ─── */
const EQFader = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => {
  const percentage = ((value + 12) / 24) * 100;
  return (
    <div className="flex flex-col items-center gap-4">
      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/70">{label}</span>
      <div className="relative group flex flex-col items-center" style={{ height: 160, width: 40 }}>
        {/* Fader Slot/Track */}
        <div className="absolute inset-y-0 w-2 bg-black/40 rounded-full border border-white/5 shadow-inner" />
        
        {/* Active Fill Glow */}
        <div 
          className="absolute bottom-0 w-2 rounded-full transition-all duration-300"
          style={{ 
            height: `${percentage}%`,
            background: 'linear-gradient(0deg, hsl(var(--primary)), #fff)',
            boxShadow: '0 0 15px hsl(var(--primary)/0.4)'
          }}
        />

        {/* Tactical Tick Marks */}
        <div className="absolute inset-y-0 left-0 w-1 flex flex-col justify-between py-2 opacity-20">
          {[...Array(5)].map((_, i) => <div key={i} className="w-full h-[1px] bg-white" />)}
        </div>
        <div className="absolute inset-y-0 right-0 w-1 flex flex-col justify-between py-2 opacity-20">
          {[...Array(5)].map((_, i) => <div key={i} className="w-full h-[1px] bg-white" />)}
        </div>
        
        {/* Fader Knob (Tactile) */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 w-10 h-4 rounded-[4px] bg-gradient-to-b from-[#333] to-[#111] border border-white/10 shadow-2xl flex flex-col items-center justify-center gap-0.5 group-hover:border-primary/50 transition-all duration-200 cursor-ns-resize"
          style={{ bottom: `calc(${percentage}% - 8px)` }}
        >
          {/* Knob Grips */}
          <div className="w-6 h-[1px] bg-white/20" />
          <div className="w-6 h-[1px] bg-primary/40" />
          <div className="w-6 h-[1px] bg-white/20" />
        </div>

        {/* Invisible range input for interaction */}
        <input 
          type="range" 
          min={-12} max={12} step={0.5} 
          value={value}
          onChange={e => onChange(+e.target.value)}
          className="absolute inset-0 opacity-0 cursor-ns-resize w-full h-full" 
          style={{ WebkitAppearance: 'slider-vertical' }}
        />
      </div>
      <div className="flex flex-col items-center">
        <span className={cn('text-[11px] font-black tabular-nums transition-colors duration-300', value > 0 ? 'text-primary' : value < 0 ? 'text-red-400' : 'text-muted-foreground')}>
          {value > 0 ? '+' : ''}{value.toFixed(1)}
        </span>
        <span className="text-[8px] font-bold text-muted-foreground/30 uppercase tracking-tighter">dB</span>
      </div>
    </div>
  );
};

/* ─── Main Component ─── */
/* ─── Mixer slider (0–100) ─── */
const MixSlider = ({ label, value, onChange, disabled, hint }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean; hint?: string }) => (
  <div className={cn('space-y-2 transition-opacity', disabled && 'opacity-40')}>
    <div className="flex justify-between items-center">
      <span className="text-[9px] font-black uppercase tracking-[0.4em] text-muted-foreground">{label}</span>
      <span className="text-xs font-black tabular-nums text-primary">{Math.round(value * 100)}%</span>
    </div>
    <div className="relative h-3 md:h-2 bg-white/5 rounded-full overflow-hidden">
      <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-100"
        style={{ width: `${value * 100}%`, background: 'linear-gradient(90deg, hsl(var(--primary)), #a855f7)' }} />
      <input type="range" min={0} max={100} step={1} value={Math.round(value * 100)} disabled={disabled}
        onChange={e => onChange(+e.target.value / 100)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
    </div>
    {hint && <p className="text-[9px] text-muted-foreground/60">{hint}</p>}
  </div>
);

/* ─── ON/OFF chip ─── */
const FxChip = ({ label, on, onClick, disabled }: { label: string; on: boolean; onClick: () => void; disabled?: boolean }) => (
  <button onClick={onClick} disabled={disabled} aria-pressed={on}
    className={cn(
      'px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 disabled:opacity-40',
      on ? 'bg-primary/20 border-primary/50 text-primary shadow-[0_0_14px_hsl(var(--primary)/0.25)]' : 'bg-white/5 border-white/10 text-muted-foreground hover:text-white'
    )}>
    <span className={cn('w-1.5 h-1.5 rounded-full', on ? 'bg-primary shadow-[0_0_8px_hsl(var(--primary))]' : 'bg-white/20')} />
    {label}
  </button>
);

/* ─── Live spectrum (canvas, own rAF so it doesn't re-render the page) ─── */
const Spectrum = ({ getData, active }: { getData: () => Uint8Array; active: boolean }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const g = c.getContext('2d'); if (!g) return;
    let raf = 0;
    const draw = () => {
      const w = c.width, h = c.height;
      g.clearRect(0, 0, w, h);
      const d = active ? getData() : new Uint8Array(16);
      const n = d.length, bw = w / n;
      const grad = g.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, '#3b82f6'); grad.addColorStop(1, '#a855f7');
      g.fillStyle = grad;
      for (let i = 0; i < n; i++) {
        const v = Math.max(0.04, d[i] / 255);
        const bh = v * h;
        g.fillRect(i * bw + 2, h - bh, bw - 4, bh);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [getData, active]);
  return <canvas ref={ref} width={320} height={64} className="w-full h-14 rounded-lg bg-black/30" />;
};


const DjMode = () => {
  const { 
    currentTrack, isPlaying, activeSource, playlist, forceBackgroundPlayback, 
    handleAddToQueue, isFavorite, toggleFavorite, 
    useBackgroundAudioOnly, setUseBackgroundAudioOnly,
    showMiniPlayer, setShowMiniPlayer,
    handlePlayPause, handleNext, handlePrevious,
    handlePlayFromPlaylist, handlePlayFromQueue,
    handleAddToPlaylist, handleRemoveFromPlaylist,
    handleClearPlaylist, reorderPlaylist,
    ytPlayerRef, audioRef,
    shuffleMode, toggleShuffle,
    loopMode, cycleLoopMode,
    queue, removeFromQueue,
    nowPlayingOpen
  } = useMusicPlayer();
  const { state, apply, init, reSync, getLevels, getBassLevel, getFrequencyData, getLive, getBpm, getAutoOffsets, reset: resetDj, unlock } = useDjAudio(audioRef, isPlaying);
  const [activeDeck, setActiveDeck] = useState<'L' | 'R'>('L');
  const [levels, setLevels] = useState({ left: 0, right: 0 });
  const [smartBass, setSmartBass] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [forcing, setForcing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  
  // When the engine is running, show what you actually HEAR (manual + Auto DJ movement + L/R-only mode).
  const liveFx = state.active ? getLive() : null;
  const effectiveGainL = liveFx ? liveFx.gainL : state.leftGain * (state.balance <= 0 ? 1 : 1 - state.balance);
  const effectiveGainR = liveFx ? liveFx.gainR : state.rightGain * (state.balance >= 0 ? 1 : 1 + state.balance);
  const autoPan = state.active && state.auto.enabled ? getAutoOffsets().pan : 0;
  const liveBalance = Math.max(-1, Math.min(1, state.balance + autoPan));
  const [bpm, setBpm] = useState(120);
  useEffect(() => {
    if (!state.active) return;
    const id = setInterval(() => setBpm(getBpm()), 1000);
    return () => clearInterval(id);
  }, [state.active, getBpm]);

  const rafRef = useRef<number>();
  const [beat, setBeat] = useState(false);
  const beatRef = useRef<ReturnType<typeof setInterval>>();

  // Auto DJ is run by the engine (beat-aware, smooth, never overwrites manual values).
  const autoDjActive = state.auto.enabled;
  const setAutoDjActive = (on: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof on === 'function' ? on(djEngine.state.auto.enabled) : on;
    apply({ auto: { enabled: next } });
  };
  const latestStateRef = useRef(state);
  const searchRequestRef = useRef(0);
  
  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);


  const { user } = useAuth();
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [loadedPlaylistTracks, setLoadedPlaylistTracks] = useState<Track[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);

  useEffect(() => {
    if (user && showSearch) {
      fetchUserPlaylists();
    }
  }, [user, showSearch]);

  const fetchUserPlaylists = async () => {
    if (!user) return;
    setLoadingPlaylists(true);
    try {
      const { data, error } = await supabase
        .from('playlists')
        .select('id, name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setUserPlaylists(data);
    } catch (err) {
      console.error('Could not fetch playlists', err);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const loadPlaylistTracks = async (playlistId: string) => {
    setLoadingPlaylists(true);
    try {
      const { data, error } = await supabase
        .from('playlist_items')
        .select('*')
        .eq('playlist_id', playlistId)
        .order('position', { ascending: true });
        
      if (error) throw error;
      
      if (data) {
        const tracks: Track[] = data.map(item => ({
          id: item.track_id,
          title: item.track_title,
          thumbnail: item.track_thumbnail || '',
          channel: item.track_channel || 'Unknown',
        }));
        const likelyTracks = getLikelyDjModeTracks(tracks, 30);
        setLoadedPlaylistTracks([]);
        toast.info('Checking which playlist tracks support DJ Mode...');

        const compatibleTracks = await filterDjModeTracks(likelyTracks, 30);
        setLoadedPlaylistTracks(compatibleTracks);

        if (compatibleTracks.length > 0) {
          toast.success(`Loaded ${compatibleTracks.length} DJ-ready tracks`);
        } else {
          toast.error('No DJ-ready tracks found in this playlist.');
        }
      }
    } catch (err) {
      toast.error('Failed to load playlist tracks');
    } finally {
      setLoadingPlaylists(false);
    }
  };

  useEffect(() => {
    const tick = () => {
      const lvls = getLevels();
      setLevels(lvls);

      // Smart Bass Logic: Detect thumps and boost bass EQ automatically
      if (smartBass && state.active && isPlaying) {
        const bassLevel = getBassLevel();
        if (bassLevel > 0.6) { // High bass energy detected
          if (latestStateRef.current.low < 8) {
            apply({ ...latestStateRef.current, low: 10 });
          }
        } else if (bassLevel < 0.3) { // Bass dropped
          if (latestStateRef.current.low > 2) {
            apply({ ...latestStateRef.current, low: 0 });
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [getLevels, smartBass, state.active, apply, getBassLevel]);

  // Beat pulse for BPM indicator
  useEffect(() => {
    if (isPlaying && state.active) {
      beatRef.current = setInterval(() => { setBeat(b => !b); }, 500);
    } else {
      clearInterval(beatRef.current);
      setBeat(false);
    }
    return () => clearInterval(beatRef.current);
  }, [isPlaying, state.active]);

  const lastSyncedTrack = useRef<string | null>(null);

  // Sync engine on track change or when audio is ready
  useEffect(() => {
    if (!audioRef.current) return;

    const performSync = () => {
      if (activeSource === 'background' && isPlaying && currentTrack?.id) {
        if (currentTrack.id !== lastSyncedTrack.current) {
          console.log("DJ Engine: Event-Triggered Sync for track", currentTrack?.id);
          lastSyncedTrack.current = currentTrack.id;
          
          // Small delay to ensure browser media pipeline has settled
          setTimeout(() => {
            try {
              const ok = reSync();
              if (ok) {
                toast.success("DJ Engine Ready", { 
                  duration: 1500,
                  position: 'top-center',
                  id: 'dj-sync-toast'
                });
              }
            } catch (e) {
              console.error("DJ Sync Error:", e);
            }
          }, 100);
        }
      }
    };

    // Listen for both immediate changes and hardware ready events
    const audio = audioRef.current;
    audio.addEventListener('canplay', performSync);
    audio.addEventListener('playing', performSync);
    
    // Also run immediately in case it's already ready
    performSync();

    return () => {
      audio.removeEventListener('canplay', performSync);
      audio.removeEventListener('playing', performSync);
    };
  }, [currentTrack?.id, isPlaying, activeSource, reSync, audioRef]);

  const enable = async (): Promise<boolean> => {
    unlock();
    setUseBackgroundAudioOnly(true);
    setForcing(true);
    const ready = activeSource === 'background' ? true : await forceBackgroundPlayback();
    setForcing(false);
    if (!ready) {
      setUseBackgroundAudioOnly(false);
      return false;
    }
    const ok = init();
    if (ok) {
      setShowMiniPlayer(true);
    }
    if (!ok) {
      toast.error('DJ engine could not connect — needs audio stream mode');
      setUseBackgroundAudioOnly(false);
      return false;
    }
    return true;
  };

  const playForDj = async (track: Track, list?: Track[]) => {
    unlock();
    setUseBackgroundAudioOnly(true);
    setForcing(true);
    const ready = await forceBackgroundPlayback(track, { trackList: list || [track], fromPlaylist: false });
    setForcing(false);
    if (ready) {
      // Auto-init the engine if not already active, then re-sync
      if (!state.active) {
        const ok = init();
        if (ok) {
          setShowMiniPlayer(true);
        }
      }
      // Use reSync (not bare init) so active:true is properly preserved
      setTimeout(() => reSync(), 150);
    } else {
      setUseBackgroundAudioOnly(false);
    }
    setShowSearch(false);
    setResults([]);
  };

  const searchTracks = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-search?q=${encodeURIComponent(query)}`,
        { headers: await getFunctionAuthHeaders() }
      );
      const data = await res.json();
      const tracks = Array.isArray(data) ? data : [];
      const requestId = ++searchRequestRef.current;
      const likelyTracks = getLikelyDjModeTracks(tracks, 12);

      if (likelyTracks.length > 0) {
        toast.info('Checking DJ-compatible streams...');
        const compatibleTracks = await filterDjModeTracks(likelyTracks, 12);
        if (requestId !== searchRequestRef.current) return;

        setResults(compatibleTracks);
        if (compatibleTracks.length > 0) {
          toast.success(`${compatibleTracks.length} DJ-ready tracks found`);
        } else {
          toast.error('No DJ-ready songs found. Try a different search.');
        }
      } else {
        setResults([]);
        toast.error('No DJ-ready songs found. Try a different search.');
      }
    } catch { toast.error('DJ search failed'); }
    finally { setSearching(false); }
  };

  const reset = () => resetDj();

  const presets = [
    { label: '🔊 Bass Boost', fn: () => apply({ ...state, low: 8, mid: 0, high: -2 }) },
    { label: '🎤 Vocal Pop', fn: () => apply({ ...state, low: -4, mid: 3, high: 5 }) },
    { label: '🎧 Club Mix', fn: () => apply({ ...state, low: 6, mid: -2, high: 4 }) },
    { label: '🌊 Chill', fn: () => apply({ ...state, low: 2, mid: -1, high: -3 }) },
    { label: '⚡ Drop', fn: () => apply({ ...state, low: 12, mid: 0, high: 0 }) },
    { label: '↩ Reset', fn: reset },
  ];

  const totalLevel = (levels.left + levels.right) / 2;

  return (
    <div className="min-h-screen bg-[#030303] text-foreground overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-[160px] animate-pulse"
          style={{ background: `hsl(var(--primary)/0.12)`, animationDuration: '3s' }} />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-[160px] animate-pulse"
          style={{ background: `hsl(var(--primary)/0.08)`, animationDuration: '5s', animationDelay: '1.5s' }} />
        {/* Scanlines */}
        <div className="absolute inset-0 opacity-[0.015]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)' }} />
      </div>

      <Sidebar activeTab="dj" onTabChange={() => {}} />

      <div className={cn(
        "relative z-10 ml-0 md:ml-64 min-h-screen p-4 md:p-8 pb-32 transition-all duration-500",
        nowPlayingOpen && "xl:pr-[380px]"
      )}>

        {/* ── Header ── */}
        <div className="flex items-center gap-4 mb-8">
          <div className={cn(
            'w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all duration-300',
            state.active ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_30px_hsl(var(--primary)/0.5)]' : 'bg-primary/10 text-primary border-primary/20'
          )}>
            <Headphones className="w-7 h-7" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-5xl font-black tracking-tighter uppercase italic truncate" style={{
              background: 'linear-gradient(135deg, hsl(var(--primary)), #fff, hsl(var(--primary)))',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>DJ Mode <span className="text-[10px] opacity-20 not-italic hidden sm:inline">v2.2</span></h1>
            <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.5em] text-muted-foreground/50 mt-1 truncate">
              {state.active ? '● LIVE · ENGINE ACTIVE' : '○ OFFLINE · START ENGINE'}
            </p>
          </div>
          {/* BPM indicator */}
          {state.active && (
            <div className={cn('w-3 h-3 rounded-full transition-all duration-200', beat ? 'bg-primary shadow-[0_0_15px_hsl(var(--primary))]' : 'bg-primary/30')} />
          )}
          <div className="flex gap-1.5 md:gap-2">
            {state.active && (
              <button
                onClick={() => setAutoDjActive(a => !a)}
                className={cn(
                  'p-2.5 md:px-4 md:py-2 rounded-xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all flex items-center gap-2',
                  autoDjActive 
                    ? 'bg-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.4)]'
                    : 'border border-white/10 bg-white/5'
                )}
              >
                <Wand2 className={cn("w-4 h-4", autoDjActive && "animate-pulse")} />
                <span className="hidden sm:inline">Auto DJ</span>
              </button>
            )}
            <button
              onClick={() => setShowSearch(s => !s)}
              className="p-2.5 md:px-4 md:py-2 rounded-xl border border-white/10 bg-white/5 font-black text-[10px] md:text-xs uppercase tracking-widest transition-all flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Tracks</span>
              {showSearch ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            <button
              onClick={state.active ? reset : enable}
              disabled={forcing}
              className={cn(
                'p-2.5 md:px-5 md:py-2 rounded-xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all flex items-center gap-2',
                state.active
                  ? 'border border-white/10 bg-white/5'
                  : 'bg-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.4)]'
              )}
            >
              {forcing ? <Loader2 className="w-4 h-4 animate-spin" /> : state.active ? <RotateCcw className="w-4 h-4" /> : <Power className="w-4 h-4" />}
              <span className="hidden sm:inline">{forcing ? 'Loading' : state.active ? 'Reset' : 'Enable'}</span>
            </button>
          </div>
        </div>

        {/* ── Search Drawer ── */}
        {showSearch && (
          <div className="mb-8 p-6 rounded-3xl border border-white/10 bg-white/3 backdrop-blur-xl">
            <form onSubmit={searchTracks} className="flex gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search tracks to load into DJ..."
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm font-medium focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <button type="submit" disabled={searching}
                className="px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-50 flex items-center gap-2">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>
            </form>
            {results.length > 0 && (
              <div className="mb-6">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground mb-4">Search Results</p>
                <TrackGrid tracks={results} currentTrack={currentTrack} isPlaying={isPlaying}
                  onPlayTrack={t => playForDj(t, results)} onAddToQueue={handleAddToQueue}
                  isLoading={false} searchPerformed isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />
              </div>
            )}
            
            <div className="mb-6">
               <div className="flex items-center justify-between mb-4">
                 <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground">Import Your Playlist</p>
                 <button onClick={fetchUserPlaylists} className="text-[9px] uppercase font-bold text-primary hover:underline flex items-center gap-1">
                   <RotateCcw className={cn("w-3 h-3", loadingPlaylists && "animate-spin")} />
                   Sync
                 </button>
               </div>
               
               {loadingPlaylists ? (
                 <div className="flex gap-2 animate-pulse">
                   {Array.from({ length: 3 }).map((_, i) => (
                     <div key={i} className="w-32 h-10 rounded-xl bg-white/5" />
                   ))}
                 </div>
               ) : userPlaylists.length > 0 ? (
                 <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {userPlaylists.map(p => (
                       <button 
                         key={p.id} 
                         onClick={() => loadPlaylistTracks(p.id)}
                         className="shrink-0 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/50 text-xs font-bold transition-all flex items-center gap-2"
                       >
                         <ListMusic className="w-3.5 h-3.5 text-primary" />
                         {p.name}
                       </button>
                    ))}
                 </div>
               ) : (
                 <p className="text-[10px] text-muted-foreground italic">No playlists found. Create one in the library to import it here.</p>
               )}
            </div>

            {loadedPlaylistTracks.length > 0 && (
              <div className="mt-6">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Imported Playlist Deck</p>
                  <button onClick={() => setLoadedPlaylistTracks([])} className="text-[10px] uppercase font-bold text-muted-foreground hover:text-white">Clear</button>
                </div>
                <div className="h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  <div className="space-y-3">
                    {loadedPlaylistTracks.map((track, i) => (
                      <div
                        key={`${track.id}-${i}`}
                        className={cn(
                          'w-full flex items-center gap-4 p-3 rounded-2xl transition-all duration-500 group relative overflow-hidden',
                          currentTrack?.id === track.id
                            ? 'bg-primary/10 border border-primary/20 shadow-[0_0_30px_rgba(var(--primary),0.1)]'
                            : 'glass-premium border border-white/5 hover:bg-white/10 hover:border-white/10'
                        )}
                      >
                        {currentTrack?.id === track.id && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary animate-pulse" />
                        )}

                        <div className="relative shrink-0 group/art">
                          <img
                            src={track.thumbnail}
                            alt={track.title}
                            className="w-12 h-12 md:w-14 md:h-14 rounded-xl object-cover shadow-lg transition-transform duration-500 group-hover/art:scale-110"
                            loading="lazy"
                          />
                          <button
                            onClick={() => playForDj(track, loadedPlaylistTracks)}
                            className={cn(
                              "absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 backdrop-blur-[2px] transition-all",
                              currentTrack?.id === track.id ? "opacity-100" : "opacity-0 group-hover/art:opacity-100"
                            )}
                          >
                            {currentTrack?.id === track.id && isPlaying ? (
                              <Pause className="w-5 h-5 text-primary fill-current" />
                            ) : (
                              <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                            )}
                          </button>
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'font-bold truncate text-sm md:text-base tracking-tight transition-colors',
                            currentTrack?.id === track.id ? 'text-primary italic' : 'text-foreground'
                          )}>
                            {track.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] truncate">{track.channel}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={(e) => {
                               e.stopPropagation();
                               handleAddToQueue(track);
                            }}
                            className="px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-black text-[10px] uppercase tracking-widest transition-all active:scale-90"
                          >
                            Queue
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {playlist.length > 0 && loadedPlaylistTracks.length === 0 && (
              <div className="mt-6">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground mb-4">Up Next Queue Deck</p>
                <div className="h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  <div className="space-y-3">
                    {playlist.map((track) => (
                      <div
                        key={track.id}
                        className={cn(
                          'w-full flex items-center gap-4 p-3 rounded-2xl transition-all duration-500 group relative overflow-hidden',
                          currentTrack?.id === track.id
                            ? 'bg-primary/10 border border-primary/20 shadow-[0_0_30px_rgba(var(--primary),0.1)]'
                            : 'glass-premium border border-white/5 hover:bg-white/10 hover:border-white/10'
                        )}
                      >
                        {currentTrack?.id === track.id && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary animate-pulse" />
                        )}

                        <div className="relative shrink-0 group/art">
                          <img
                            src={track.thumbnail}
                            alt={track.title}
                            className="w-12 h-12 md:w-14 md:h-14 rounded-xl object-cover shadow-lg transition-transform duration-500 group-hover/art:scale-110"
                            loading="lazy"
                          />
                          <button
                            onClick={() => playForDj(track, playlist)}
                            className={cn(
                              "absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 backdrop-blur-[2px] transition-all",
                              currentTrack?.id === track.id ? "opacity-100" : "opacity-0 group-hover/art:opacity-100"
                            )}
                          >
                            {currentTrack?.id === track.id && isPlaying ? (
                              <Pause className="w-5 h-5 text-primary fill-current" />
                            ) : (
                              <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                            )}
                          </button>
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'font-bold truncate text-sm md:text-base tracking-tight transition-colors',
                            currentTrack?.id === track.id ? 'text-primary italic' : 'text-foreground'
                          )}>
                            {track.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] truncate">{track.channel}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={(e) => {
                               e.stopPropagation();
                               handleAddToQueue(track);
                            }}
                            className="px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-black text-[10px] uppercase tracking-widest transition-all active:scale-90"
                          >
                            Queue
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Now Playing strip ── */}
        {currentTrack && (
          <div className={cn(
            'mb-8 flex items-center gap-4 p-4 rounded-2xl border transition-all duration-500',
            state.active ? 'border-primary/30 bg-primary/5' : 'border-white/5 bg-white/3'
          )}>
            <div className="relative shrink-0">
              <img src={currentTrack.thumbnail} className="w-12 h-12 rounded-xl object-cover" />
              {isPlaying && state.active && (
                <div className="absolute -inset-1 rounded-xl border-2 border-primary animate-ping opacity-40" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-sm truncate">{currentTrack.title}</p>
              <p className="text-xs text-muted-foreground/60 truncate uppercase tracking-widest">{currentTrack.channel}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn('w-2 h-2 rounded-full', activeSource === 'background' ? 'bg-primary animate-pulse' : 'bg-red-500')} />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {activeSource === 'background' ? 'DJ Stream' : 'Not DJ'}
              </span>
            </div>
            {activeSource !== 'background' && (
              <button onClick={enable} disabled={forcing}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2">
                {forcing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                Force DJ
              </button>
            )}
          </div>
        )}

        {/* ── Main DJ Console ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px_1fr] gap-6 mb-6 items-stretch">

          {/* Deck L */}
          <div className={cn(
            'relative rounded-[2rem] border overflow-hidden p-6 flex flex-col gap-5 transition-all duration-300',
            state.active && levels.left > 0.3 ? 'border-primary/40' : 'border-white/8',
            'bg-gradient-to-b from-white/3 to-transparent backdrop-blur-xl'
          )}
            style={{
              boxShadow: state.active ? `0 0 ${20 + levels.left * 40}px hsl(var(--primary)/${0.05 + levels.left * 0.15})` : 'none'
            }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.5em] text-muted-foreground">« Deck L</span>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className={cn('w-1 h-1 rounded-full', j / 3 < levels.left ? 'bg-primary' : 'bg-white/10')} />
                ))}
              </div>
            </div>
            <div className="flex justify-center py-2">
              <Vinyl spinning={isPlaying && state.active} level={levels.left} side="L" />
            </div>
            <VuMeter level={levels.left} />
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-muted-foreground">Gain</span>
                <span className={cn("text-xs font-black tabular-nums transition-colors", effectiveGainL > 0 ? "text-primary" : "text-red-500/50")}>
                  {Math.round(effectiveGainL * 100)}%
                </span>
              </div>
              <div className="relative h-3 md:h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-100"
                  style={{ width: `${effectiveGainL * 100}%`, background: 'linear-gradient(90deg, hsl(var(--primary)), #fff)' }} />
                <input type="range" min={0} max={100} step={1} value={Math.round(state.leftGain * 100)}
                  onChange={e => apply({ ...state, leftGain: +e.target.value / 100 })}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </div>
              <div className="flex gap-2 mt-1">
                <button onClick={() => apply({ ...state, leftGain: Math.max(0, state.leftGain - 0.1) })}
                  className="flex-1 py-2.5 md:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-black transition-all active:scale-95">−</button>
                <button onClick={() => apply({ ...state, leftGain: Math.min(1, state.leftGain + 0.1) })}
                  className="flex-1 py-2.5 md:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-black transition-all active:scale-95">+</button>
              </div>
            </div>
          </div>

          {/* ── Center Column: Crossfader + Master + Auto DJ ── */}
          <div className="flex flex-col gap-4">
            {/* Master level */}
            <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-xl p-5 flex flex-col items-center gap-3">
              <Activity className="w-5 h-5 text-primary" />
              <span className="text-[9px] font-black uppercase tracking-[0.4em] text-muted-foreground">Master Level</span>
              <VuMeter level={totalLevel} />
              <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full bg-primary transition-all duration-75 rounded-full"
                  style={{ width: `${totalLevel * 100}%` }} />
              </div>
            </div>

            {/* Auto DJ Mode Toggle */}
            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  if (!state.active) {
                    const ok = await enable();
                    if (ok) {
                      setAutoDjActive(true);
                      toast.success('Auto DJ Mode Activated');
                    }
                  } else {
                    const newState = !autoDjActive;
                    setAutoDjActive(newState);
                    if (newState) toast.success('Auto DJ Mode Activated');
                    else toast.info('Auto DJ Mode Disabled');
                  }
                }}
                className={cn(
                  'w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex flex-col items-center gap-2 border',
                  autoDjActive 
                    ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_30px_hsl(var(--primary)/0.4)] scale-[1.02]'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                )}
              >
                <div className="flex items-center gap-2">
                  <Wand2 className={cn("w-5 h-5", autoDjActive && "animate-spin")} style={{ animationDuration: '3s' }} />
                  <span>Auto DJ Mode</span>
                </div>
                <span className="text-[8px] opacity-60">
                  {forcing ? 'INITIALIZING...' : autoDjActive ? `ACTIVE · ${state.auto.style.toUpperCase()} · ${bpm} BPM` : 'READY TO MIX'}
                </span>
              </button>

              {/* Mixing style */}
              <div className="grid grid-cols-3 gap-1.5">
                {([['chill', 'Chill'], ['club', 'Club'], ['insane', 'Insane']] as [DjAutoStyle, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => apply({ auto: { style: key } })}
                    className={cn(
                      "py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                      state.auto.style === key
                        ? key === 'insane' ? "bg-purple-500/20 border-purple-400/50 text-purple-300" : "bg-primary/20 border-primary/40 text-primary"
                        : "bg-transparent border-white/5 text-muted-foreground hover:text-white"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Smart Bass Toggle */}
              <button 
                onClick={() => setSmartBass(v => !v)}
                className={cn(
                  "w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-2",
                  smartBass 
                    ? "bg-primary text-primary-foreground border-primary shadow-[0_0_20px_hsl(var(--primary)/0.3)]" 
                    : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:text-white"
                )}
              >
                <Zap className={cn("w-3.5 h-3.5", smartBass && "animate-pulse")} />
                {smartBass ? "Smart Bass Active" : "Enable Smart Bass"}
              </button>
            </div>

            {/* Crossfader */}
            <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-xl p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-muted-foreground">Crossfader</span>
                <span className="text-[10px] font-black text-primary">
                  {Math.abs(liveBalance) < 0.01 ? 'CENTER' : liveBalance < 0 ? `${Math.round(-liveBalance * 100)}% L` : `${Math.round(liveBalance * 100)}% R`}
                </span>
              </div>
              <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="absolute inset-y-0 rounded-full transition-all duration-75"
                  style={{
                    left: `${liveBalance <= 0 ? 50 + liveBalance * 50 : 50}%`,
                    right: `${liveBalance >= 0 ? 50 - liveBalance * 50 : 50}%`,
                    background: 'hsl(var(--primary))',
                    minWidth: 4
                  }} />
                <input type="range" min={-100} max={100} step={1} value={Math.round(state.balance * 100)}
                  onChange={e => apply({ ...state, balance: +e.target.value / 100 })}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full" />
              </div>
              <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">
                <span>L</span><span>Mix</span><span>R</span>
              </div>
              <div className="flex gap-1.5 pt-1">
                {[['◄◄ L', -1], ['Center', 0], ['R ►►', 1]].map(([lbl, val]) => (
                  <button key={String(lbl)} onClick={() => apply({ ...state, balance: +val })}
                    className="flex-1 py-1.5 rounded-xl bg-white/5 hover:bg-primary/20 hover:text-primary text-[8px] font-black uppercase tracking-widest transition-all">
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* EQ */}
            <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-xl p-5 space-y-3 flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Music2 className="w-4 h-4 text-primary" />
                  <span className="text-[9px] font-black uppercase tracking-[0.4em] text-muted-foreground">3-Band EQ</span>
                </div>
                <button 
                  onClick={() => setUseBackgroundAudioOnly(v => !v)}
                  className={cn(
                    "px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-tighter transition-all border",
                    useBackgroundAudioOnly ? "bg-primary border-primary text-primary-foreground" : "bg-white/5 border-white/10 text-muted-foreground"
                  )}
                >
                  {useBackgroundAudioOnly ? "No Limit ON" : "No Limit OFF"}
                </button>
              </div>
              <div className="flex justify-around items-start pt-2">
                <EQFader label="Bass" value={state.low} onChange={v => apply({ ...state, low: v })} />
                <EQFader label="Mid" value={state.mid} onChange={v => apply({ ...state, mid: v })} />
                <EQFader label="High" value={state.high} onChange={v => apply({ ...state, high: v })} />
              </div>
            </div>
          </div>

          {/* Deck R */}
          <div className={cn(
            'relative rounded-[2rem] border overflow-hidden p-4 md:p-6 flex flex-col gap-4 md:gap-5 transition-all duration-300',
            state.active && levels.right > 0.3 ? 'border-primary/40' : 'border-white/8',
            'bg-gradient-to-b from-white/3 to-transparent backdrop-blur-xl',
            activeDeck === 'L' && 'hidden xl:flex'
          )}
            style={{
              boxShadow: state.active ? `0 0 ${20 + levels.right * 40}px hsl(var(--primary)/${0.05 + levels.right * 0.15})` : 'none'
            }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.5em] text-muted-foreground">Deck R »</span>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className={cn('w-1 h-1 rounded-full', j / 3 < levels.right ? 'bg-primary' : 'bg-white/10')} />
                ))}
              </div>
            </div>
            <div className="flex justify-center py-2">
              <Vinyl spinning={isPlaying && state.active} level={levels.right} side="R" />
            </div>
            <VuMeter level={levels.right} />
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-muted-foreground">Gain</span>
                <span className={cn("text-xs font-black tabular-nums transition-colors", effectiveGainR > 0 ? "text-primary" : "text-red-500/50")}>
                  {Math.round(effectiveGainR * 100)}%
                </span>
              </div>
              <div className="relative h-3 md:h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-100"
                  style={{ width: `${effectiveGainR * 100}%`, background: 'linear-gradient(90deg, hsl(var(--primary)), #fff)' }} />
                <input type="range" min={0} max={100} step={1} value={Math.round(state.rightGain * 100)}
                  onChange={e => apply({ ...state, rightGain: +e.target.value / 100 })}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </div>
              <div className="flex gap-2 mt-1">
                <button onClick={() => apply({ ...state, rightGain: Math.max(0, state.rightGain - 0.1) })}
                  className="flex-1 py-2.5 md:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-black transition-all active:scale-95">−</button>
                <button onClick={() => apply({ ...state, rightGain: Math.min(1, state.rightGain + 0.1) })}
                  className="flex-1 py-2.5 md:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-black transition-all active:scale-95">+</button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Mixer: master, bass boost, channel mode, per-effect switches ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-[0.5em] text-muted-foreground">Master &amp; Bass</span>
              <span className="text-[9px] font-black text-primary/80 tabular-nums">{state.active ? `${bpm} BPM` : '—'}</span>
            </div>
            <Spectrum getData={getFrequencyData} active={state.active} />
            <MixSlider label="Master Volume" value={Math.min(1, state.master)} onChange={v => apply({ master: v })} />
            <MixSlider label="Bass Boost" value={state.bassBoost} onChange={v => apply({ bassBoost: v })}
              hint="Smooth sub-bass lift with built-in limiter — no distortion." />
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-xl p-5 space-y-4">
            <span className="text-[9px] font-black uppercase tracking-[0.5em] text-muted-foreground">Channel Output</span>
            <div className="grid grid-cols-3 gap-2">
              {([['left', '◄ Left only'], ['stereo', 'Stereo'], ['right', 'Right only ►']] as [DjChannelMode, string][]).map(([mode, label]) => (
                <button key={mode} onClick={() => apply({ channelMode: mode })}
                  className={cn(
                    'py-3 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all active:scale-95',
                    state.channelMode === mode ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_18px_hsl(var(--primary)/0.4)]' : 'bg-white/5 border-white/10 text-muted-foreground hover:text-white'
                  )}>
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-muted-foreground/60">Use headphones: Left only silences the right ear and vice-versa. Set each side's volume with the deck gain sliders.</p>
            <button onClick={reset}
              className="w-full py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-primary/20 hover:text-primary text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95">
              <RotateCcw className="w-3.5 h-3.5" /> Reset everything
            </button>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-xl p-5 space-y-4">
            <span className="text-[9px] font-black uppercase tracking-[0.5em] text-muted-foreground">Effect Switches</span>
            <div className="flex flex-wrap gap-2">
              <FxChip label="L/R + Balance" on={state.fx.channels} onClick={() => apply({ fx: { channels: !state.fx.channels } })} />
              <FxChip label="3-Band EQ" on={state.fx.eq} onClick={() => apply({ fx: { eq: !state.fx.eq } })} />
              <FxChip label="Bass Boost" on={state.fx.bass} onClick={() => apply({ fx: { bass: !state.fx.bass } })} />
            </div>
            <div className="pt-1">
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-muted-foreground/70 mb-2">
                Auto DJ moves {autoDjActive ? '· live' : '· off'}
              </p>
              <div className="flex flex-wrap gap-2">
                <FxChip label="Auto-Pan" on={state.auto.pan} onClick={() => apply({ auto: { pan: !state.auto.pan } })} />
                <FxChip label="Bass Swell" on={state.auto.bass} onClick={() => apply({ auto: { bass: !state.auto.bass } })} />
                <FxChip label="Filter Sweep" on={state.auto.filter} onClick={() => apply({ auto: { filter: !state.auto.filter } })} />
                <FxChip label="Pump" on={state.auto.pump} onClick={() => apply({ auto: { pump: !state.auto.pump } })} />
              </div>
              {autoDjActive && (
                <button onClick={() => setAutoDjActive(false)}
                  className="mt-3 w-full py-2.5 rounded-xl border border-primary/40 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest active:scale-95">
                  Take manual control
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Presets ── */}
        <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-xl p-5">
          <p className="text-[9px] font-black uppercase tracking-[0.5em] text-muted-foreground mb-4">Quick Presets</p>
          <div className="flex flex-wrap gap-2">
            {presets.map(p => (
              <button key={p.label} onClick={p.fn}
                className="px-5 py-2.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-primary/20 hover:border-primary/40 hover:text-primary text-xs font-black uppercase tracking-widest transition-all active:scale-95">
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {currentTrack && (
        <MusicPlayer
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onAddToPlaylist={handleAddToPlaylist}
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
      )}
    </div>
  );
};

export default DjMode;
