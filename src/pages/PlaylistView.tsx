import { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Pause, Trash2, Shuffle, Repeat, Repeat1, ArrowLeft, Search, Music2, Download, Check, Filter, Flame, Heart, Zap, Moon, Dumbbell, Sparkles } from 'lucide-react';
import { getFunctionAuthHeaders } from '@/lib/functionAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import Navbar from '@/components/Navbar';
import MusicPlayer from '@/components/MusicPlayer';
import Sidebar from '@/components/Sidebar';
import PlaylistGridPhoto from '@/components/PlaylistGridPhoto';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { useDownloadManager } from '@/contexts/DownloadManagerContext';
import { isTrackDownloadedOffline } from '@/lib/offlineStore';

interface Track {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
}

interface PlaylistItem {
  id: string;
  track_id: string;
  track_title: string;
  track_thumbnail: string;
  track_channel: string;
}

interface Playlist {
  id: string;
  name: string;
  description: string | null;
}

type MoodFilter = 'all' | 'hype' | 'chill' | 'sad' | 'romance' | 'workout';
type PlaylistMode = 'original' | 'mood-flow' | 'energy' | 'artist';

const MOOD_FILTERS: { id: MoodFilter; label: string; icon: typeof Music2; keywords: string[] }[] = [
  { id: 'all', label: 'All', icon: Music2, keywords: [] },
  { id: 'hype', label: 'Hype', icon: Flame, keywords: ['hype', 'party', 'dance', 'club', 'remix', 'edm', 'trap', 'bass', 'funk', 'rock', 'gangnam', 'uptown', 'empire'] },
  { id: 'chill', label: 'Chill', icon: Moon, keywords: ['chill', 'lofi', 'slow', 'soft', 'acoustic', 'ambient', 'faded', 'calm', 'relax', 'night'] },
  { id: 'sad', label: 'Sad', icon: Heart, keywords: ['sad', 'alone', 'tears', 'cry', 'lost', 'goodbye', 'see you again', 'hurt', 'broken', 'miss'] },
  { id: 'romance', label: 'Love', icon: Sparkles, keywords: ['love', 'baby', 'girl', 'shape of you', 'despacito', 'sorry', 'heart', 'romance', 'kiss'] },
  { id: 'workout', label: 'Workout', icon: Dumbbell, keywords: ['workout', 'run', 'power', 'strong', 'roar', 'waka waka', 'lights', 'energy', 'speed', 'pump'] },
];

const PLAYLIST_MODES: { id: PlaylistMode; label: string; icon: typeof Music2 }[] = [
  { id: 'original', label: 'Original', icon: Music2 },
  { id: 'mood-flow', label: 'Mood Flow', icon: Filter },
  { id: 'energy', label: 'Energy', icon: Zap },
  { id: 'artist', label: 'Artist', icon: Sparkles },
];

const normalizeTrackText = (track: Track) => `${track.title} ${track.channel}`.toLowerCase();

const getMoodScore = (track: Track, mood: MoodFilter) => {
  if (mood === 'all') return 1;
  const text = normalizeTrackText(track);
  const filter = MOOD_FILTERS.find(item => item.id === mood);
  return filter?.keywords.reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0) || 0;
};

const getDominantMoodIndex = (track: Track) => {
  const scores = MOOD_FILTERS.slice(1).map((mood, index) => ({ index, score: getMoodScore(track, mood.id) }));
  return scores.sort((a, b) => b.score - a.score)[0]?.index ?? 0;
};

const getEnergyScore = (track: Track) => (
  getMoodScore(track, 'hype') * 3 +
  getMoodScore(track, 'workout') * 2 +
  (normalizeTrackText(track).includes('remix') ? 2 : 0) -
  getMoodScore(track, 'chill') -
  getMoodScore(track, 'sad')
);

const PlaylistView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const {
    currentTrack, isPlaying,
    handlePlayPause, handlePlayTrack,
    ytPlayerRef, audioRef,
    shuffleMode, toggleShuffle,
    loopMode, cycleLoopMode,
    queue, removeFromQueue,
  } = useMusicPlayer();

  const { downloads, startDownload, isDownloading } = useDownloadManager();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [downloadedTrackIds, setDownloadedTrackIds] = useState<Set<string>>(new Set());
  const [navSearchQuery, setNavSearchQuery] = useState('');
  const [playlistSearchQuery, setPlaylistSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('playlists');
  const [activeMoodFilter, setActiveMoodFilter] = useState<MoodFilter>('all');
  const [playlistMode, setPlaylistMode] = useState<PlaylistMode>('original');
  
  const [loading, setLoading] = useState(true);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchDragIndex, setTouchDragIndex] = useState<number | null>(null);

  const visiblePlaylistTracks = useMemo(() => {
    const filtered = activeMoodFilter === 'all'
      ? [...playlistTracks]
      : playlistTracks.filter(track => getMoodScore(track, activeMoodFilter) > 0);

    switch (playlistMode) {
      case 'mood-flow':
        return filtered.sort((a, b) => getDominantMoodIndex(a) - getDominantMoodIndex(b));
      case 'energy':
        return filtered.sort((a, b) => getEnergyScore(b) - getEnergyScore(a));
      case 'artist':
        return filtered.sort((a, b) => a.channel.localeCompare(b.channel));
      default:
        return filtered;
    }
  }, [activeMoodFilter, playlistMode, playlistTracks]);

  useEffect(() => {
    const checkDownloadedTracks = async () => {
      const downloaded = new Set<string>();
      for (const track of playlistTracks) {
        const isDownloaded = await isTrackDownloadedOffline(track.id);
        if (isDownloaded) {
          downloaded.add(track.id);
        }
      }
      setDownloadedTrackIds(downloaded);
    };
    if (playlistTracks.length > 0) {
      checkDownloadedTracks();
    } else {
      setDownloadedTrackIds(new Set());
    }
  }, [playlistTracks, downloads]);

  const handleDownloadAll = () => {
    if (playlistTracks.length === 0) {
      toast.info('No tracks to download!');
      return;
    }
    
    const tracksToDownload = visiblePlaylistTracks.filter(track => {
      const isDownloaded = downloadedTrackIds.has(track.id);
      const downloading = isDownloading(track.id);
      return !isDownloaded && !downloading;
    });

    if (tracksToDownload.length === 0) {
      toast.info('All tracks in this playlist are already downloaded or downloading!');
      return;
    }

    toast.success(`Starting download for ${tracksToDownload.length} tracks to Download Page...`);
    tracksToDownload.forEach(track => {
      startDownload({
        id: track.id,
        title: track.title,
        thumbnail: track.thumbnail,
        artist: track.channel,
      });
    });
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (user && id) {
      fetchPlaylist();
    }
  }, [user, authLoading, id, navigate]);

  const fetchPlaylist = async () => {
    if (!user) return;
    try {
      const { data: playlistData, error: playlistError } = await supabase
        .from('playlists')
        .select('*')
        .eq('id', id!)
        .eq('user_id', user.id)
        .single();

      if (playlistError) throw playlistError;
      setPlaylist(playlistData);

      const { data: itemsData, error: itemsError } = await supabase
        .from('playlist_items')
        .select('*')
        .eq('playlist_id', id!)
        .order('position', { ascending: true });

      if (itemsError) throw itemsError;

      const tracks = itemsData?.map((item: PlaylistItem) => ({
        id: item.track_id,
        title: item.track_title,
        thumbnail: item.track_thumbnail,
        channel: item.track_channel,
      })) || [];

      setPlaylistTracks(tracks);
    } catch (error: any) {
      toast.error('Failed to load playlist');
      navigate('/playlists');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayFromPlaylistView = useCallback((track: Track) => {
    handlePlayTrack(track, visiblePlaylistTracks);
  }, [handlePlayTrack, visiblePlaylistTracks]);

  const handleNextInPlaylist = useCallback(() => {
    if (!currentTrack || visiblePlaylistTracks.length === 0) return;
    const currentIndex = visiblePlaylistTracks.findIndex(t => t.id === currentTrack.id);

    if (loopMode === 'one') {
      if (audioRef.current && audioRef.current.src) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      } else if (ytPlayerRef.current) {
        ytPlayerRef.current.seekTo(0);
        ytPlayerRef.current.playVideo();
      }
      return;
    }

    let nextIndex: number;
    if (loopMode === 'all') {
      nextIndex = (currentIndex + 1) % visiblePlaylistTracks.length;
    } else {
      nextIndex = currentIndex + 1;
      if (nextIndex >= visiblePlaylistTracks.length) {
        toast.info('Playlist ended');
        return;
      }
    }
    handlePlayTrack(visiblePlaylistTracks[nextIndex], visiblePlaylistTracks);
  }, [currentTrack, visiblePlaylistTracks, loopMode, handlePlayTrack, audioRef, ytPlayerRef]);

  const handlePreviousInPlaylist = useCallback(() => {
    if (!currentTrack || visiblePlaylistTracks.length === 0) return;
    const currentIndex = visiblePlaylistTracks.findIndex(t => t.id === currentTrack.id);
    const prevIndex = currentIndex <= 0 ? visiblePlaylistTracks.length - 1 : currentIndex - 1;
    handlePlayTrack(visiblePlaylistTracks[prevIndex], visiblePlaylistTracks);
  }, [currentTrack, visiblePlaylistTracks, handlePlayTrack]);

  const handleRemoveTrack = async (trackId: string) => {
    try {
      const { error } = await supabase
        .from('playlist_items')
        .delete()
        .eq('playlist_id', id!)
        .eq('track_id', trackId);
      if (error) throw error;
      toast.success('Track removed');
      fetchPlaylist();
    } catch {
      toast.error('Failed to remove track');
    }
  };

  const handlePlaylistSearch = async () => {
    if (!playlistSearchQuery.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-search?q=${encodeURIComponent(playlistSearchQuery)}`,
        {
          headers: await getFunctionAuthHeaders(),
        }
      );
      if (!response.ok) throw new Error('Search failed');
      const results = await response.json();
      if (results.error) throw new Error(results.error);
      setSearchResults(results);
    } catch {
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddToPlaylistDB = async (track: Track) => {
    try {
      const exists = playlistTracks.some(t => t.id === track.id);
      if (exists) { toast.info('Track already in playlist'); return; }

      // Always append to the very end: read the real max position from the DB
      // instead of assuming it equals the local track count (gaps break ordering).
      const { data: lastItem } = await supabase
        .from('playlist_items')
        .select('position')
        .eq('playlist_id', id!)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = lastItem && lastItem.length > 0 ? (lastItem[0].position ?? 0) + 1 : 0;

      const { error } = await supabase.from('playlist_items').insert({
        playlist_id: id!,
        track_id: track.id,
        track_title: track.title,
        track_thumbnail: track.thumbnail,
        track_channel: track.channel,
        position: nextPosition,
      });
      if (error) throw error;
      toast.success('Added to the end of the playlist!');
      setActiveMoodFilter('all');
      setPlaylistMode('original');
      await fetchPlaylist();
      setSearchResults([]);
      setPlaylistSearchQuery('');
    } catch {
      toast.error('Failed to add track');
    }
  };


  const getLoopIcon = () => {
    switch (loopMode) {
      case 'one': return <Repeat1 className="w-5 h-5" />;
      default: return <Repeat className="w-5 h-5" />;
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }
    const reordered = [...playlistTracks];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(dropIndex, 0, removed);
    setPlaylistTracks(reordered);
    setDraggedIndex(null);
    try {
      for (let i = 0; i < reordered.length; i++) {
        await supabase.from('playlist_items').update({ position: i }).eq('playlist_id', id!).eq('track_id', reordered[i].id);
      }
    } catch {}
  };

  const handleTouchStart = (index: number, e: React.TouchEvent) => {
    e.stopPropagation();
    setTouchStartY(e.touches[0].clientY);
    setTouchDragIndex(index);
    setDraggedIndex(index);
  };

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchDragIndex === null || touchStartY === null) return;
    const diff = e.touches[0].clientY - touchStartY;
    const moveCount = Math.round(diff / 80);
    if (moveCount !== 0) {
      const newIndex = Math.max(0, Math.min(playlistTracks.length - 1, touchDragIndex + moveCount));
      if (newIndex !== touchDragIndex) {
        const reordered = [...playlistTracks];
        const [removed] = reordered.splice(touchDragIndex, 1);
        reordered.splice(newIndex, 0, removed);
        setPlaylistTracks(reordered);
        setTouchDragIndex(newIndex);
        setTouchStartY(e.touches[0].clientY);
      }
    }
  }, [touchDragIndex, touchStartY, playlistTracks]);

  const handleTouchEnd = async () => {
    if (touchDragIndex !== null) {
      try {
        for (let i = 0; i < playlistTracks.length; i++) {
          await supabase.from('playlist_items').update({ position: i }).eq('playlist_id', id!).eq('track_id', playlistTracks[i].id);
        }
      } catch {}
    }
    setTouchStartY(null);
    setTouchDragIndex(null);
    setDraggedIndex(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/80 flex flex-col">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <Navbar
        searchQuery={navSearchQuery}
        onSearchChange={setNavSearchQuery}
        onSearch={() => navigate('/')}
      />
      
      <main className="flex-1 md:ml-64 pt-20 pb-64 px-4 md:px-8">
        <div className="mb-8 animate-in-up">
          <button
            onClick={() => navigate('/playlists')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-bold text-sm uppercase tracking-widest">Back to Playlists</span>
          </button>
          
          <div className="flex flex-col md:flex-row items-center md:items-end gap-8">
            <PlaylistGridPhoto 
              thumbnails={playlistTracks.map(t => t.thumbnail)} 
              size="lg"
            />
            
            <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left">
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-3">Private Playlist</p>
              <h1 className="text-4xl md:text-7xl font-black tracking-tighter uppercase italic neon-text mb-4 leading-none">
                {playlist?.name}
              </h1>
              <div className="flex flex-col gap-4">
                {playlist?.description && (
                  <p className="text-muted-foreground text-sm font-medium max-w-2xl">{playlist.description}</p>
                )}
                <div className="flex items-center gap-2 text-xs font-bold">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <Music2 className="w-3 h-3 text-primary" />
                  </div>
                  <span className="text-foreground font-black uppercase italic tracking-widest">{user?.email?.split('@')[0]}</span>
                  <span className="text-muted-foreground/40">•</span>
                  <span className="text-muted-foreground">{playlistTracks.length} tracks</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
               <button
                onClick={toggleShuffle}
                className={cn(
                  'w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg',
                  shuffleMode
                    ? 'bg-primary text-primary-foreground neon-glow'
                    : 'bg-white/5 text-muted-foreground hover:text-foreground border border-white/5'
                )}
                title="Shuffle"
              >
                <Shuffle className="w-5 h-5" />
              </button>
              
              <button
                onClick={cycleLoopMode}
                className={cn(
                  'w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg',
                  loopMode !== 'off'
                    ? 'bg-primary text-primary-foreground neon-glow'
                    : 'bg-white/5 text-muted-foreground hover:text-foreground border border-white/5'
                )}
                title={`Loop: ${loopMode}`}
              >
                {getLoopIcon()}
              </button>

              <button
                onClick={handleDownloadAll}
                disabled={playlistTracks.length === 0}
                className={cn(
                  'w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg border border-white/5',
                  'bg-white/5 text-muted-foreground hover:text-primary hover:border-primary/20 disabled:opacity-50'
                )}
                title="Download entire playlist"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Search within playlist page */}
        <div className="mb-8 glass-premium border border-white/5 p-6 rounded-[2rem] shadow-xl animate-in-up">
          <div className="flex items-center gap-3 mb-6">
             <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center">
                <Search className="w-5 h-5 text-primary" />
             </div>
             <div>
                <h3 className="text-xl font-black text-foreground uppercase italic tracking-tighter">Add Songs</h3>
                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Find your next favorite</p>
             </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                type="text"
                placeholder="Search YouTube for songs..."
                value={playlistSearchQuery}
                onChange={(e) => setPlaylistSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePlaylistSearch()}
                className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl focus:border-primary/50 focus:ring-primary/20 transition-all font-medium placeholder:text-muted-foreground/40"
              />
            </div>
            <button 
              onClick={handlePlaylistSearch} 
              disabled={isSearching}
              className="h-14 px-8 rounded-2xl bg-primary text-primary-foreground font-black uppercase tracking-widest text-xs hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-8 border-t border-white/5 pt-6">
              <ScrollArea className="h-[400px] pr-4 -mr-4">
                <div className="grid grid-cols-1 gap-3">
                  {searchResults.map((track) => (
                    <div
                      key={track.id}
                      className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/5 transition-all group"
                    >
                      <div className="relative w-14 h-14 flex-shrink-0">
                         <img src={track.thumbnail} alt={track.title} className="w-full h-full rounded-xl object-cover" />
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-xl transition-opacity">
                            <Play className="w-5 h-5 text-white" fill="currentColor" />
                         </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{track.title}</p>
                        <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">{track.channel}</p>
                      </div>
                      <button 
                        onClick={() => handleAddToPlaylistDB(track)}
                        className="px-5 py-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-black text-[10px] uppercase tracking-widest transition-all active:scale-90"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Mood filters and playlist modes */}
        {playlistTracks.length > 0 && (
          <div className="mb-6 space-y-4 animate-in-up">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-primary/15 flex items-center justify-center">
                <Filter className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-black text-foreground uppercase italic tracking-widest">Mood Filter</h3>
                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                  {visiblePlaylistTracks.length} of {playlistTracks.length} tracks showing
                </p>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {MOOD_FILTERS.map((mood) => {
                const Icon = mood.icon;
                const selected = activeMoodFilter === mood.id;
                const count = mood.id === 'all' ? playlistTracks.length : playlistTracks.filter(track => getMoodScore(track, mood.id) > 0).length;
                return (
                  <button
                    key={mood.id}
                    onClick={() => setActiveMoodFilter(mood.id)}
                    className={cn(
                      'h-11 px-4 rounded-2xl flex items-center gap-2 shrink-0 border transition-all active:scale-95',
                      selected
                        ? 'bg-primary text-primary-foreground border-primary neon-glow'
                        : 'bg-white/5 text-muted-foreground border-white/10 hover:text-foreground hover:border-primary/30'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-black uppercase tracking-widest">{mood.label}</span>
                    <span className={cn('text-[10px] font-black', selected ? 'text-primary-foreground/70' : 'text-muted-foreground/50')}>{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {PLAYLIST_MODES.map((mode) => {
                const Icon = mode.icon;
                const selected = playlistMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => setPlaylistMode(mode.id)}
                    className={cn(
                      'h-12 rounded-2xl flex items-center justify-center gap-2 border transition-all active:scale-95',
                      selected
                        ? 'bg-primary/15 text-primary border-primary/40'
                        : 'bg-white/5 text-muted-foreground border-white/10 hover:text-foreground hover:border-white/20'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">{mode.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Playlist Tracks */}
        {playlistTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Play className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-xl font-medium">This playlist is empty</p>
            <p className="text-sm">Use the search above to add songs</p>
          </div>
        ) : visiblePlaylistTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground glass-premium border border-white/5 rounded-[2rem]">
            <Filter className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-lg font-black uppercase italic tracking-tight">No tracks match this mood</p>
            <button
              onClick={() => setActiveMoodFilter('all')}
              className="mt-4 px-5 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all text-xs font-black uppercase tracking-widest"
            >
              Show All
            </button>
          </div>
        ) : (
          <div className="h-[calc(100vh-500px)] min-h-64 overflow-y-auto pr-2 custom-scrollbar">
            <div className="space-y-3">
              {visiblePlaylistTracks.map((track) => {
                const index = playlistTracks.findIndex(item => item.id === track.id);
                const canReorder = activeMoodFilter === 'all' && playlistMode === 'original';
                return (
                <div
                  key={track.id}
                  draggable={canReorder}
                  onDragStart={(e) => {
                    if (canReorder) handleDragStart(e, index);
                  }}
                  onDragOver={handleDragOver}
                  onDrop={(e) => {
                    if (canReorder) handleDrop(e, index);
                  }}
                  onDragEnd={() => setDraggedIndex(null)}
                  onTouchMove={canReorder ? handleTouchMove : undefined}
                  onTouchEnd={canReorder ? handleTouchEnd : undefined}
                  className={cn(
                    'w-full flex items-center gap-4 p-3 rounded-2xl transition-all duration-500 group relative overflow-hidden',
                    currentTrack?.id === track.id
                      ? 'bg-primary/10 border border-primary/20 shadow-[0_0_30px_rgba(var(--primary),0.1)]'
                      : 'glass-premium border border-white/5 hover:bg-white/10 hover:border-white/10',
                    draggedIndex === index && 'opacity-50 scale-[0.98]'
                  )}
                >
                  {/* Playing Indicator Line */}
                  {currentTrack?.id === track.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary animate-pulse" />
                  )}

                  {/* Drag Handle */}
                  <div
                    className={cn(
                      'touch-manipulation flex-shrink-0 transition-all p-2 rounded-xl',
                      canReorder ? 'cursor-grab active:cursor-grabbing opacity-20 group-hover:opacity-100 hover:bg-white/5' : 'opacity-10 cursor-default'
                    )}
                    onTouchStart={(e) => {
                      if (canReorder) handleTouchStart(index, e);
                    }}
                  >
                    <div className="flex flex-col gap-1 w-4">
                      <div className="h-0.5 w-full bg-foreground rounded-full"></div>
                      <div className="h-0.5 w-full bg-foreground rounded-full"></div>
                    </div>
                  </div>

                  <div className="relative shrink-0 group/art">
                    <img
                      src={track.thumbnail}
                      alt={track.title}
                      className="w-12 h-12 md:w-14 md:h-14 rounded-xl object-cover shadow-lg transition-transform duration-500 group-hover/art:scale-110"
                      loading="lazy"
                    />
                    <button
                      onClick={() => {
                        if (currentTrack?.id === track.id) {
                          handlePlayPause();
                        } else {
                          handlePlayFromPlaylistView(track);
                        }
                      }}
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

                  {/* Time Indicator */}
                  <div className="hidden sm:flex items-center gap-6 mr-4">
                     <span className="text-[11px] font-black text-muted-foreground/40 tabular-nums tracking-[0.2em]">
                        {/* Mock time for now, can be replaced with real duration if available */}
                        0{Math.floor(Math.random() * 3) + 2}:{Math.floor(Math.random() * 50) + 10}
                     </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        const isDownloaded = downloadedTrackIds.has(track.id);
                        if (isDownloaded) {
                          toast.info('Track is already downloaded and available offline!');
                          return;
                        }
                        startDownload({
                          id: track.id,
                          title: track.title,
                          thumbnail: track.thumbnail,
                          artist: track.channel,
                        });
                      }}
                      disabled={isDownloading(track.id)}
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90",
                        downloadedTrackIds.has(track.id)
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/10"
                          : isDownloading(track.id)
                          ? "bg-amber-500/15 text-amber-400 animate-pulse border border-amber-500/10"
                          : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border border-transparent"
                      )}
                      title={downloadedTrackIds.has(track.id) ? "Downloaded offline" : isDownloading(track.id) ? "Downloading..." : "Download to offline"}
                    >
                      {downloadedTrackIds.has(track.id) ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={() => handleRemoveTrack(track.id)}
                      className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive hover:text-white transition-all active:scale-90"
                      title="Remove from playlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );})}
            </div>
          </div>
        )}

        {playlistTracks.length > 0 && (
          <div className="mt-12 pt-8 border-t border-white/5">
            <MadeForYouSection
              title="Smart Picks"
              subtitle="Matched to this playlist & what you listen to"
              seedTracks={playlistTracks.slice(0, 20)}
              excludeIds={playlistTracks.map(t => t.id)}
              onPlayTrack={handlePlayFromPlaylistView}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onAddToQueue={handleAddToPlaylistDB}
            />
          </div>
        )}
      </main>


      {currentTrack && (
        <MusicPlayer
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onNext={handleNextInPlaylist}
          onPrevious={handlePreviousInPlaylist}
          playlist={visiblePlaylistTracks}
          onPlayFromPlaylist={handlePlayFromPlaylistView}
          onRemoveFromPlaylist={handleRemoveTrack}
          onClearPlaylist={() => {}}
          ytPlayerRef={ytPlayerRef}
          audioRef={audioRef}
          shuffleMode={shuffleMode}
          onToggleShuffle={toggleShuffle}
          loopMode={loopMode}
          onCycleLoopMode={cycleLoopMode}
          queue={queue}
          onRemoveFromQueue={removeFromQueue}
        />
      )}
    </div>
  );
};

export default PlaylistView;
