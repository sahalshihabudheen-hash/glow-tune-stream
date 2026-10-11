import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getFunctionAuthHeaders } from '@/lib/functionAuth';
import Sidebar from '@/components/Sidebar';
import TrackGrid from '@/components/TrackGrid';
import { useDjAudio } from '@/hooks/useDjAudio';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import {
  Headphones, Power, RotateCcw, Loader2, Search, Zap, Music2, ListMusic, Wand2, Play, Pause,
  SlidersHorizontal, Volume2, Sparkles, X, Plus, Minus,
} from 'lucide-react';
import MusicPlayer from '@/components/MusicPlayer';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { filterDjModeTracks, getLikelyDjModeTracks } from '@/lib/djStream';
import { djEngine, type DjAutoStyle, type DjChannelMode } from '@/lib/djEngine';
import {
  ACCENT_GRADIENT, Chip, HFader, Label, LevelMeter, Panel, Platter, Spectrum, VFader, buzz,
} from '@/components/dj/DjPrimitives';

interface Track { id: string; title: string; thumbnail: string; channel: string; }

interface Playlist {
  id: string;
  name: string;
}

type Tab = 'mix' | 'eq' | 'sound' | 'fx';

const TABS: { key: Tab; label: string; Icon: typeof Music2 }[] = [
  { key: 'mix', label: 'Mix', Icon: Wand2 },
  { key: 'eq', label: 'EQ', Icon: SlidersHorizontal },
  { key: 'sound', label: 'Sound', Icon: Volume2 },
  { key: 'fx', label: 'FX', Icon: Sparkles },
];

const STYLES: { key: DjAutoStyle; label: string; hint: string }[] = [
  { key: 'chill', label: 'Chill', hint: 'slow drift' },
  { key: 'club', label: 'Club', hint: 'pan + pump' },
  { key: 'insane', label: 'Insane', hint: 'fast & wild' },
];

/* ─── One row in a track list (whole row is tappable) ─── */
const TrackRow = ({
  track, active, playing, onPlay, onQueue,
}: { track: Track; active: boolean; playing: boolean; onPlay: () => void; onQueue: () => void }) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onPlay}
    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPlay(); } }}
    className={cn(
      'relative flex items-center gap-3 p-2.5 pr-3 rounded-2xl border cursor-pointer transition-colors active:scale-[0.99]',
      active ? 'bg-primary/10 border-primary/30' : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.07]'
    )}
  >
    {active && <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r bg-primary" />}
    <div className="relative shrink-0">
      <img src={track.thumbnail} alt="" loading="lazy" className="w-12 h-12 rounded-xl object-cover" />
      <span className="absolute inset-0 rounded-xl bg-black/45 flex items-center justify-center">
        {active && playing ? <Pause className="w-5 h-5 text-primary fill-current" /> : <Play className="w-5 h-5 text-white fill-current ml-0.5" />}
      </span>
    </div>
    <div className="flex-1 min-w-0">
      <p className={cn('font-bold truncate text-sm', active && 'text-primary')}>{track.title}</p>
      <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest truncate">{track.channel}</p>
    </div>
    <button
      onClick={e => { e.stopPropagation(); buzz(); onQueue(); }}
      className="shrink-0 min-h-[40px] px-3.5 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground text-[10px] font-black uppercase tracking-widest transition-all active:scale-90"
    >
      Queue
    </button>
  </div>
);

/* ─── A deck (left or right channel) ─── */
const Deck = ({
  side, level, gain, liveGain, onGain, spinning, art, solo, muted, onSolo,
}: {
  side: 'L' | 'R'; level: number; gain: number; liveGain: number; onGain: (v: number) => void;
  spinning: boolean; art?: string; solo: boolean; muted: boolean; onSolo: () => void;
}) => (
  <section
    className={cn(
      'rounded-3xl border p-3 sm:p-4 flex flex-col gap-3 backdrop-blur-xl bg-gradient-to-b from-white/[0.05] to-transparent transition-[border-color,opacity] duration-300',
      level > 0.3 ? 'border-primary/40' : 'border-white/[0.08]',
      muted && 'opacity-60'
    )}
    style={{ boxShadow: `0 0 ${16 + level * 36}px hsl(var(--primary) / ${0.04 + level * 0.14})` }}
  >
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] font-black uppercase tracking-[0.35em] text-muted-foreground">
        {side === 'L' ? '« Deck L' : 'Deck R »'}
      </span>
      <button
        onClick={() => { buzz(); onSolo(); }}
        aria-pressed={solo}
        title={solo ? 'Back to stereo' : `Play ${side === 'L' ? 'left' : 'right'} ear only`}
        className={cn(
          'min-h-[32px] px-2.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all active:scale-95',
          solo ? 'bg-primary text-primary-foreground border-primary' : muted ? 'border-red-400/40 text-red-300 bg-red-500/10' : 'border-white/10 text-muted-foreground bg-white/[0.04] hover:text-white'
        )}
      >
        {muted ? 'Muted' : 'Solo'}
      </button>
    </div>

    <Platter side={side} spinning={spinning} level={level} art={art} />
    <LevelMeter level={level} />

    <div>
      <Label right={<span className={cn('text-xs font-black tabular-nums', liveGain > 0 ? 'text-primary' : 'text-red-400')}>{Math.round(liveGain * 100)}%</span>}>
        Gain
      </Label>
      <HFader
        ariaLabel={`Deck ${side} gain`}
        value={Math.round(gain * 100)}
        live={Math.round(liveGain * 100)}
        onChange={v => onGain(v / 100)}
      />
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => { buzz(); onGain(Math.max(0, gain - 0.1)); }} aria-label={`Lower deck ${side} gain`}
          className="min-h-[44px] rounded-xl bg-white/[0.05] hover:bg-white/10 flex items-center justify-center transition-all active:scale-95"><Minus className="w-4 h-4" /></button>
        <button onClick={() => { buzz(); onGain(Math.min(1, gain + 0.1)); }} aria-label={`Raise deck ${side} gain`}
          className="min-h-[44px] rounded-xl bg-white/[0.05] hover:bg-white/10 flex items-center justify-center transition-all active:scale-95"><Plus className="w-4 h-4" /></button>
      </div>
    </div>
  </section>
);

/* ─── Labelled slider row ─── */
const SliderRow = ({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: string }) => (
  <div>
    <Label right={<span className="text-xs font-black tabular-nums text-primary">{Math.round(value * 100)}%</span>}>{label}</Label>
    <HFader ariaLabel={label} value={Math.round(value * 100)} onChange={v => onChange(v / 100)} />
    {hint && <p className="text-[10px] text-muted-foreground/60 -mt-1">{hint}</p>}
  </div>
);

/* ─── Main Component ─── */
const DjMode = () => {
  const {
    currentTrack, isPlaying, activeSource, playlist, forceBackgroundPlayback,
    handleAddToQueue, isFavorite, toggleFavorite,
    useBackgroundAudioOnly, setUseBackgroundAudioOnly,
    setShowMiniPlayer,
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
  const [levels, setLevels] = useState({ left: 0, right: 0 });
  const lastLevels = useRef({ left: 0, right: 0 });
  const [smartBass, setSmartBass] = useState(false);
  const [tab, setTab] = useState<Tab>('mix');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [forcing, setForcing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // When the engine is running, show what you actually HEAR (manual + Auto DJ movement + L/R-only mode).
  const liveFx = state.active ? getLive() : null;
  const effectiveGainL = liveFx ? liveFx.gainL : state.leftGain * (state.balance <= 0 ? 1 : 1 - state.balance);
  const effectiveGainR = liveFx ? liveFx.gainR : state.rightGain * (state.balance >= 0 ? 1 : 1 + state.balance);
  const eqAuto = state.active && state.auto.enabled && state.fx.eq && (state.auto.bass || state.auto.filter);
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
      const { data } = await supabase
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

  // Level meters + Smart Bass. Only re-render when a level actually moved (keeps phones smooth).
  useEffect(() => {
    const tick = () => {
      const lvls = getLevels();
      if (Math.abs(lvls.left - lastLevels.current.left) > 0.015 || Math.abs(lvls.right - lastLevels.current.right) > 0.015) {
        lastLevels.current = lvls;
        setLevels(lvls);
      }

      // Smart Bass Logic: Detect thumps and boost bass EQ automatically
      if (smartBass && state.active && isPlaying) {
        const bassLevel = getBassLevel();
        if (bassLevel > 0.6) { // High bass energy detected
          if (latestStateRef.current.low < 8) {
            apply({ low: 10 });
          }
        } else if (bassLevel < 0.3) { // Bass dropped
          if (latestStateRef.current.low > 2) {
            apply({ low: 0 });
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [getLevels, smartBass, state.active, isPlaying, apply, getBassLevel]);

  // Beat LED follows the real BPM
  useEffect(() => {
    if (isPlaying && state.active) {
      const ms = Math.max(150, 30000 / Math.min(200, Math.max(60, bpm)));
      beatRef.current = setInterval(() => { setBeat(b => !b); }, ms);
    } else {
      clearInterval(beatRef.current);
      setBeat(false);
    }
    return () => clearInterval(beatRef.current);
  }, [isPlaying, state.active, bpm]);

  // Desktop shortcuts: A auto · C center · [ ] crossfade · B smart bass
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'a') { if (djEngine.state.active) apply({ auto: { enabled: !djEngine.state.auto.enabled } }); }
      else if (k === 'c') apply({ balance: 0 });
      else if (k === '[') apply({ balance: Math.max(-1, djEngine.state.balance - 0.1) });
      else if (k === ']') apply({ balance: Math.min(1, djEngine.state.balance + 0.1) });
      else if (k === 'b') setSmartBass(v => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [apply]);

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

  const toggleAuto = async () => {
    buzz(14);
    if (!state.active) {
      const ok = await enable();
      if (ok) {
        setAutoDjActive(true);
        toast.success('Auto DJ Mode Activated');
      }
    } else {
      const next = !autoDjActive;
      setAutoDjActive(next);
      if (next) toast.success('Auto DJ Mode Activated');
      else toast.info('Auto DJ Mode Disabled');
    }
  };

  const presets = [
    { label: '🔊 Bass Boost', fn: () => apply({ low: 8, mid: 0, high: -2 }) },
    { label: '🎤 Vocal Pop', fn: () => apply({ low: -4, mid: 3, high: 5 }) },
    { label: '🎧 Club Mix', fn: () => apply({ low: 6, mid: -2, high: 4 }) },
    { label: '🌊 Chill', fn: () => apply({ low: 2, mid: -1, high: -3 }) },
    { label: '⚡ Drop', fn: () => apply({ low: 12, mid: 0, high: 0 }) },
    { label: '↩ Flat', fn: () => apply({ low: 0, mid: 0, high: 0 }) },
  ];

  const totalLevel = (levels.left + levels.right) / 2;
  const soloLeft = state.channelMode === 'left';
  const soloRight = state.channelMode === 'right';
  const toggleSolo = (mode: Exclude<DjChannelMode, 'stereo'>) =>
    apply({ channelMode: state.channelMode === mode ? 'stereo' : mode });
  const spinning = isPlaying && state.active;

  const tabClass = (t: Tab) => cn(tab === t ? 'block' : 'hidden', 'xl:block');

  return (
    <div className="min-h-screen bg-[#050505] text-foreground overflow-x-hidden">
      {/* Beat-reactive glow (cheap gradients instead of heavy blurs) */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            `radial-gradient(60% 45% at 15% 0%, hsl(var(--primary) / ${0.1 + totalLevel * 0.14}), transparent 70%),` +
            `radial-gradient(55% 45% at 90% 100%, rgba(255,138,0,${0.07 + totalLevel * 0.12}), transparent 70%)`,
        }}
      />

      <Sidebar activeTab="dj" onTabChange={() => {}} />

      <main className={cn(
        'relative z-10 ml-0 md:ml-64 min-h-screen px-3 sm:px-5 md:px-8 pt-4 md:pt-8 pb-52 md:pb-44 transition-all duration-500 max-w-[1500px]',
        nowPlayingOpen && 'xl:pr-[380px]'
      )}>

        {/* ── Header ── */}
        <header className="flex flex-wrap items-center gap-x-4 gap-y-3 mb-4">
          <div className={cn(
            'w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center border-2 transition-all duration-300 shrink-0',
            state.active ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_30px_hsl(var(--primary)/0.5)]' : 'bg-primary/10 text-primary border-primary/20'
          )}>
            <Headphones className="w-6 h-6 md:w-7 md:h-7" />
          </div>
          <div className="flex-1 min-w-[140px]">
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic leading-none" style={{
              background: 'linear-gradient(135deg, hsl(var(--primary)), #fff, #ff8a00)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>DJ Mode</h1>
            <p className="mt-1.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/70">
              <span className={cn('w-2 h-2 rounded-full transition-all duration-150', state.active ? (beat ? 'bg-primary shadow-[0_0_12px_hsl(var(--primary))] scale-125' : 'bg-primary/40') : 'bg-white/20')} />
              {state.active ? `Live · ${bpm} BPM` : 'Offline'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowSearch(s => !s)}
              aria-expanded={showSearch}
              className={cn(
                'min-h-[48px] px-5 rounded-2xl border font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2',
                showSearch ? 'border-primary/50 bg-primary/10 text-primary' : 'border-white/10 bg-white/[0.04]'
              )}
            >
              {showSearch ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              Tracks
            </button>
            <button
              onClick={state.active ? reset : enable}
              disabled={forcing}
              className={cn(
                'min-h-[48px] px-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60',
                state.active ? 'border border-white/10 bg-white/[0.04]' : 'text-primary-foreground shadow-[0_0_24px_hsl(var(--primary)/0.4)]'
              )}
              style={state.active ? undefined : { background: ACCENT_GRADIENT }}
            >
              {forcing ? <Loader2 className="w-4 h-4 animate-spin" /> : state.active ? <RotateCcw className="w-4 h-4" /> : <Power className="w-4 h-4" />}
              {forcing ? 'Loading' : state.active ? 'Reset' : 'Start'}
            </button>
          </div>
        </header>

        {/* ── Friendly getting-started banner ── */}
        {!state.active && (
          <Panel className="mb-4 border-primary/30 bg-primary/[0.06]">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-black text-base">Let&apos;s get the party started 🎧</p>
                <ol className="mt-2 grid sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
                  {['Pick a track', 'Tap Start', 'Mix it, or tap Auto DJ'].map((s, i) => (
                    <li key={s} className="flex items-center gap-2">
                      <span className="w-6 h-6 shrink-0 rounded-full bg-primary/20 text-primary font-black flex items-center justify-center text-[11px]">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-[11px] text-muted-foreground/70">Tip: use headphones to really hear the left / right effects.</p>
              </div>
              <button
                onClick={() => (currentTrack ? enable() : setShowSearch(true))}
                disabled={forcing}
                className="min-h-[48px] px-6 rounded-2xl text-primary-foreground font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60"
                style={{ background: ACCENT_GRADIENT }}
              >
                {currentTrack ? <><Power className="w-4 h-4" /> Start engine</> : <><Search className="w-4 h-4" /> Choose a track</>}
              </button>
            </div>
          </Panel>
        )}

        {/* ── Track drawer ── */}
        {showSearch && (
          <Panel className="mb-4">
            <form onSubmit={searchTracks} className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search tracks to load into DJ…"
                  enterKeyHint="search"
                  className="w-full min-h-[48px] pl-10 pr-4 rounded-2xl bg-white/[0.05] border border-white/10 text-sm font-medium focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <button type="submit" disabled={searching}
                className="min-h-[48px] px-5 rounded-2xl text-primary-foreground font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                style={{ background: ACCENT_GRADIENT }}>
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span className="hidden sm:inline">Search</span>
              </button>
            </form>

            {results.length > 0 && (
              <div className="mb-5">
                <Label>Search results</Label>
                <div className="mt-3">
                  <TrackGrid tracks={results} currentTrack={currentTrack} isPlaying={isPlaying}
                    onPlayTrack={t => playForDj(t, results)} onAddToQueue={handleAddToQueue}
                    isLoading={false} searchPerformed isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />
                </div>
              </div>
            )}

            <div className="mb-5">
              <Label right={
                <button onClick={fetchUserPlaylists} className="min-h-[32px] text-[10px] uppercase font-bold text-primary flex items-center gap-1">
                  <RotateCcw className={cn('w-3 h-3', loadingPlaylists && 'animate-spin')} /> Sync
                </button>
              }>Import your playlist</Label>
              <div className="mt-3">
                {loadingPlaylists ? (
                  <div className="flex gap-2 animate-pulse">
                    {Array.from({ length: 3 }).map((_, i) => <div key={i} className="w-32 h-11 rounded-xl bg-white/5" />)}
                  </div>
                ) : userPlaylists.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
                    {userPlaylists.map(p => (
                      <button key={p.id} onClick={() => loadPlaylistTracks(p.id)}
                        className="shrink-0 min-h-[44px] px-4 rounded-xl bg-white/[0.05] border border-white/10 hover:bg-white/10 hover:border-primary/50 text-xs font-bold transition-all flex items-center gap-2 active:scale-95">
                        <ListMusic className="w-3.5 h-3.5 text-primary" />
                        {p.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No playlists found. Create one in the library to import it here.</p>
                )}
              </div>
            </div>

            {loadedPlaylistTracks.length > 0 ? (
              <div>
                <Label right={<button onClick={() => setLoadedPlaylistTracks([])} className="min-h-[32px] text-[10px] uppercase font-bold text-muted-foreground hover:text-white">Clear</button>}>
                  <span className="text-primary">Imported playlist</span>
                </Label>
                <div className="mt-3 max-h-[380px] overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                  {loadedPlaylistTracks.map((track, i) => (
                    <TrackRow key={`${track.id}-${i}`} track={track} active={currentTrack?.id === track.id} playing={isPlaying}
                      onPlay={() => playForDj(track, loadedPlaylistTracks)} onQueue={() => handleAddToQueue(track)} />
                  ))}
                </div>
              </div>
            ) : playlist.length > 0 ? (
              <div>
                <Label>Up next</Label>
                <div className="mt-3 max-h-[380px] overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                  {playlist.map(track => (
                    <TrackRow key={track.id} track={track} active={currentTrack?.id === track.id} playing={isPlaying}
                      onPlay={() => playForDj(track, playlist)} onQueue={() => handleAddToQueue(track)} />
                  ))}
                </div>
              </div>
            ) : null}
          </Panel>
        )}

        {/* ── Now playing ── */}
        {currentTrack && (
          <div className={cn(
            'mb-4 flex items-center gap-3 p-3 rounded-2xl border transition-colors duration-500',
            state.active ? 'border-primary/30 bg-primary/[0.05]' : 'border-white/5 bg-white/[0.03]'
          )}>
            <img src={currentTrack.thumbnail} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-black text-sm truncate">{currentTrack.title}</p>
              <p className="text-[10px] text-muted-foreground/70 truncate uppercase tracking-widest">{currentTrack.channel}</p>
            </div>
            <span className={cn(
              'hidden sm:flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest',
              activeSource === 'background' ? 'text-primary' : 'text-red-400'
            )}>
              <span className={cn('w-2 h-2 rounded-full', activeSource === 'background' ? 'bg-primary animate-pulse' : 'bg-red-500')} />
              {activeSource === 'background' ? 'DJ stream' : 'Not DJ'}
            </span>
            {activeSource !== 'background' && (
              <button onClick={enable} disabled={forcing}
                className="shrink-0 min-h-[44px] px-4 rounded-xl text-primary-foreground text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center gap-2"
                style={{ background: ACCENT_GRADIENT }}>
                {forcing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                Force DJ
              </button>
            )}
          </div>
        )}

        {/* ── Console: both decks always visible (side by side on phones) ── */}
        <div className="grid grid-cols-2 xl:grid-cols-[1fr_340px_1fr] gap-3 md:gap-4 items-start">
          <div className="order-1">
            <Deck side="L" level={levels.left} gain={state.leftGain} liveGain={effectiveGainL}
              onGain={v => apply({ leftGain: v })} spinning={spinning} art={currentTrack?.thumbnail}
              solo={soloLeft} muted={soloRight} onSolo={() => toggleSolo('left')} />
          </div>
          <div className="order-2 xl:order-3">
            <Deck side="R" level={levels.right} gain={state.rightGain} liveGain={effectiveGainR}
              onGain={v => apply({ rightGain: v })} spinning={spinning} art={currentTrack?.thumbnail}
              solo={soloRight} muted={soloLeft} onSolo={() => toggleSolo('right')} />
          </div>

          {/* Section tabs (phones / tablets). On wide screens everything is visible at once. */}
          <nav className="order-3 col-span-2 xl:hidden grid grid-cols-4 gap-1.5 p-1.5 rounded-2xl bg-white/[0.04] border border-white/[0.08]" aria-label="Mixer sections">
            {TABS.map(({ key, label, Icon }) => (
              <button key={key} onClick={() => { buzz(); setTab(key); }} aria-pressed={tab === key}
                className={cn(
                  'min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95',
                  tab === key ? 'text-primary-foreground shadow-[0_0_18px_hsl(var(--primary)/0.35)]' : 'text-muted-foreground hover:text-white'
                )}
                style={tab === key ? { background: ACCENT_GRADIENT } : undefined}>
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>

          {/* ── Mix: master meter, Auto DJ, crossfader ── */}
          <div className={cn('order-4 col-span-2 xl:order-2 xl:col-span-1 flex-col gap-3', tab === 'mix' ? 'flex' : 'hidden', 'xl:flex')}>
            <Panel>
              <Label right={<span className="text-[10px] font-black tabular-nums text-primary">{Math.round(totalLevel * 100)}%</span>}>Master level</Label>
              <LevelMeter level={totalLevel} segments={20} className="mt-3 h-6" />
            </Panel>

            {/* Auto DJ */}
            <div className="flex flex-col gap-2">
              <button
                onClick={toggleAuto}
                aria-pressed={autoDjActive}
                className={cn(
                  'w-full min-h-[84px] py-4 rounded-3xl font-black uppercase tracking-[0.2em] transition-all duration-200 flex flex-col items-center justify-center gap-1.5 border active:scale-[0.98]',
                  autoDjActive ? 'text-primary-foreground border-transparent' : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08]'
                )}
                style={autoDjActive ? {
                  background: 'linear-gradient(135deg, hsl(var(--primary)), #ff8a00)',
                  boxShadow: `0 0 ${beat ? 44 : 24}px hsl(var(--primary) / ${beat ? 0.55 : 0.3})`,
                  transform: beat ? 'scale(1.015)' : undefined,
                } : undefined}
              >
                <span className="flex items-center gap-2 text-sm">
                  <Wand2 className={cn('w-5 h-5', autoDjActive && 'animate-spin')} style={{ animationDuration: '3s' }} />
                  Auto DJ Mode
                </span>
                <span className="text-[10px] opacity-70 tracking-[0.15em]">
                  {forcing ? 'Initializing…' : autoDjActive ? `Active · ${state.auto.style} · ${bpm} BPM` : 'Tap to let the DJ mix for you'}
                </span>
              </button>

              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Auto DJ style">
                {STYLES.map(({ key, label, hint }) => (
                  <button key={key} onClick={() => { buzz(); apply({ auto: { style: key } }); }} aria-pressed={state.auto.style === key}
                    className={cn(
                      'min-h-[52px] rounded-2xl border flex flex-col items-center justify-center transition-all active:scale-95',
                      state.auto.style === key
                        ? key === 'insane' ? 'bg-purple-500/20 border-purple-400/60 text-purple-200' : 'bg-primary/15 border-primary/50 text-primary'
                        : 'bg-white/[0.03] border-white/[0.06] text-muted-foreground hover:text-white'
                    )}>
                    <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
                    <span className="text-[9px] opacity-60 font-medium">{hint}</span>
                  </button>
                ))}
              </div>

              <Chip on={smartBass} onClick={() => setSmartBass(v => !v)} className="w-full">
                <Zap className={cn('w-3.5 h-3.5', smartBass && 'animate-pulse')} />
                {smartBass ? 'Smart Bass active' : 'Enable Smart Bass'}
              </Chip>
            </div>

            {/* Crossfader */}
            <Panel>
              <Label right={
                <span className="text-[11px] font-black text-primary tabular-nums">
                  {Math.abs(liveBalance) < 0.01 ? 'CENTER' : liveBalance < 0 ? `${Math.round(-liveBalance * 100)}% L` : `${Math.round(liveBalance * 100)}% R`}
                </span>
              }>Crossfader</Label>
              <div className="mt-1">
                <HFader ariaLabel="Crossfader" center min={-100} max={100}
                  value={Math.round(state.balance * 100)} live={Math.round(liveBalance * 100)}
                  onChange={v => apply({ balance: v / 100 })} />
              </div>
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 -mt-1 mb-3 px-1">
                <span>L</span><span>Mix</span><span>R</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([['◄ L', -1], ['Center', 0], ['R ►', 1]] as [string, number][]).map(([lbl, val]) => (
                  <button key={lbl} onClick={() => { buzz(); apply({ balance: val }); }}
                    className="min-h-[44px] rounded-xl bg-white/[0.05] hover:bg-primary/20 hover:text-primary text-[11px] font-black uppercase tracking-widest transition-all active:scale-95">
                    {lbl}
                  </button>
                ))}
              </div>
              {autoDjActive && state.auto.pan && (
                <p className="mt-2 text-[10px] text-muted-foreground/60">The white diamond is where Auto DJ is moving the mix right now.</p>
              )}
            </Panel>
          </div>
        </div>

        {/* ── EQ · Sound · FX ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 md:gap-4 mt-3 md:mt-4 items-start">
          {/* EQ */}
          <Panel className={tabClass('eq')}>
            <Label right={
              <button onClick={() => { buzz(); setUseBackgroundAudioOnly(v => !v); }} aria-pressed={useBackgroundAudioOnly}
                title="Streams audio through the DJ engine so effects can reach it"
                className={cn(
                  'min-h-[32px] px-3 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all',
                  useBackgroundAudioOnly ? 'bg-primary border-primary text-primary-foreground' : 'bg-white/5 border-white/10 text-muted-foreground'
                )}>
                No limit {useBackgroundAudioOnly ? 'on' : 'off'}
              </button>
            }>
              <span className="inline-flex items-center gap-2"><Music2 className="w-4 h-4 text-primary" /> 3-band EQ</span>
            </Label>
            <div className="flex justify-around items-start pt-4 pb-2">
              <VFader label="Bass" auto={eqAuto} value={eqAuto && liveFx ? liveFx.low : state.low} onChange={v => apply({ low: v })} />
              <VFader label="Mid" auto={eqAuto} value={eqAuto && liveFx ? liveFx.mid : state.mid} onChange={v => apply({ mid: v })} />
              <VFader label="High" auto={eqAuto} value={eqAuto && liveFx ? liveFx.high : state.high} onChange={v => apply({ high: v })} />
            </div>
            <p className="text-center text-[10px] text-muted-foreground/50 mb-3">Drag a fader · double-tap to reset to 0</p>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
              {presets.map(p => (
                <button key={p.label} onClick={() => { buzz(); p.fn(); }}
                  className="shrink-0 min-h-[44px] px-4 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-primary/20 hover:border-primary/40 hover:text-primary text-[11px] font-black uppercase tracking-wider transition-all active:scale-95">
                  {p.label}
                </button>
              ))}
            </div>
          </Panel>

          {/* Sound */}
          <Panel className={cn(tabClass('sound'), 'space-y-4')}>
            <Label right={<span className="text-[10px] font-black text-primary tabular-nums">{state.active ? `${bpm} BPM` : '—'}</span>}>Master &amp; bass</Label>
            <Spectrum getData={getFrequencyData} active={state.active} />
            <SliderRow label="Master volume" value={Math.min(1, state.master)} onChange={v => apply({ master: v })} />
            <SliderRow label="Bass boost" value={state.bassBoost} onChange={v => apply({ bassBoost: v })}
              hint="Smooth sub-bass lift with a built-in limiter — no distortion." />
            <div>
              <Label>Channel output</Label>
              <div className="grid grid-cols-3 gap-2 mt-2" role="group" aria-label="Channel output">
                {([['left', '◄ Left'], ['stereo', 'Stereo'], ['right', 'Right ►']] as [DjChannelMode, string][]).map(([mode, label]) => (
                  <button key={mode} onClick={() => { buzz(); apply({ channelMode: mode }); }} aria-pressed={state.channelMode === mode}
                    className={cn(
                      'min-h-[48px] rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all active:scale-95',
                      state.channelMode === mode ? 'text-primary-foreground border-transparent shadow-[0_0_18px_hsl(var(--primary)/0.4)]' : 'bg-white/[0.04] border-white/10 text-muted-foreground hover:text-white'
                    )}
                    style={state.channelMode === mode ? { background: ACCENT_GRADIENT } : undefined}>
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground/60">Use headphones: Left silences the right ear and vice-versa.</p>
            </div>
          </Panel>

          {/* FX */}
          <Panel className={cn(tabClass('fx'), 'space-y-4')}>
            <div>
              <Label>Effect switches</Label>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Chip on={state.fx.channels} onClick={() => apply({ fx: { channels: !state.fx.channels } })}>L/R + Balance</Chip>
                <Chip on={state.fx.eq} onClick={() => apply({ fx: { eq: !state.fx.eq } })}>3-Band EQ</Chip>
                <Chip on={state.fx.bass} onClick={() => apply({ fx: { bass: !state.fx.bass } })} className="col-span-2">Bass boost</Chip>
              </div>
            </div>
            <div>
              <Label right={<span className={cn('text-[10px] font-black uppercase', autoDjActive ? 'text-primary' : 'text-muted-foreground/50')}>{autoDjActive ? 'live' : 'off'}</span>}>Auto DJ moves</Label>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Chip on={state.auto.pan} onClick={() => apply({ auto: { pan: !state.auto.pan } })}>Auto-pan</Chip>
                <Chip on={state.auto.bass} onClick={() => apply({ auto: { bass: !state.auto.bass } })}>Bass swell</Chip>
                <Chip on={state.auto.filter} onClick={() => apply({ auto: { filter: !state.auto.filter } })}>Filter sweep</Chip>
                <Chip on={state.auto.pump} onClick={() => apply({ auto: { pump: !state.auto.pump } })}>Pump</Chip>
              </div>
              {autoDjActive && (
                <button onClick={() => setAutoDjActive(false)}
                  className="mt-3 w-full min-h-[48px] rounded-xl border border-primary/40 bg-primary/10 text-primary text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all">
                  Take manual control
                </button>
              )}
            </div>
            <button onClick={() => { buzz(); reset(); }}
              className="w-full min-h-[48px] rounded-xl border border-white/10 bg-white/[0.04] hover:bg-primary/20 hover:text-primary text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95">
              <RotateCcw className="w-3.5 h-3.5" /> Reset everything
            </button>
          </Panel>
        </div>

        {/* Desktop shortcut hints */}
        <p className="hidden xl:flex flex-wrap items-center gap-x-5 gap-y-1 mt-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
          <span>Shortcuts</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/70">A</kbd> Auto DJ</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/70">C</kbd> Center</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/70">[</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/70">]</kbd> Crossfade</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/70">B</kbd> Smart bass</span>
        </p>
      </main>

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
