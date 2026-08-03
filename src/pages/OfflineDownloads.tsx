import React, { useState, useEffect } from 'react';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { getAllOfflineTracks, deleteOfflineTrack } from '@/lib/offlineStore';
import { Download, Play, Trash2, Music, Wifi, WifiOff, FolderHeart, AlertCircle, Search, Shuffle, Disc, ArrowLeft, Layers, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import MusicPlayer from '@/components/MusicPlayer';
import { motion, AnimatePresence } from 'motion/react';

interface OfflineTrackItem {
  id: string;
  title: string;
  thumbnail: string;
  downloadedAt: number;
  size: number;
  artist?: string;
  duration?: number;
}

export default function OfflineDownloads() {
  const [offlineTracks, setOfflineTracks] = useState<OfflineTrackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { 
    handlePlayTrack, 
    currentTrack, 
    isPlaying, 
    handlePlayPause,
    handleNext,
    handlePrevious,
    ytPlayerRef,
    audioRef,
    shuffleMode,
    toggleShuffle,
    queue,
    removeFromQueue
  } = useMusicPlayer();

  const loadTracks = async () => {
    try {
      const list = await getAllOfflineTracks();
      // Sort by newest downloaded
      list.sort((a, b) => b.downloadedAt - a.downloadedAt);
      setOfflineTracks(list);
    } catch (err) {
      console.error('Failed to load offline tracks:', err);
      toast.error('Could not load offline downloads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTracks();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('nyra:offline-cache-updated', loadTracks);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('nyra:offline-cache-updated', loadTracks);
    };
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    try {
      await deleteOfflineTrack(id);
      toast.success(`Removed offline track: ${title}`);
      await loadTracks();
    } catch (err) {
      toast.error('Failed to remove track');
    }
  };

  const handlePlayOffline = (track: OfflineTrackItem) => {
    if (currentTrack?.id === track.id) {
      handlePlayPause();
      return;
    }
    // Map offline track back to standard Track structure
    const mappedTrack = {
      id: track.id,
      title: track.title,
      thumbnail: track.thumbnail,
      artist: track.artist || 'Unknown Artist',
      channel: track.artist || 'Unknown Artist',
      duration: track.duration || 0,
    };
    
    // Play track in standard list context
    const mappedTrackList = filteredTracks.map(t => ({
      id: t.id,
      title: t.title,
      thumbnail: t.thumbnail,
      artist: t.artist || 'Unknown Artist',
      channel: t.artist || 'Unknown Artist',
      duration: t.duration || 0,
    }));

    handlePlayTrack(mappedTrack, mappedTrackList);
  };

  const handleShufflePlayAll = () => {
    if (offlineTracks.length === 0) return;
    const shuffled = [...offlineTracks].sort(() => Math.random() - 0.5);
    
    const mappedTrack = {
      id: shuffled[0].id,
      title: shuffled[0].title,
      thumbnail: shuffled[0].thumbnail,
      artist: shuffled[0].artist || 'Unknown Artist',
      channel: shuffled[0].artist || 'Unknown Artist',
      duration: shuffled[0].duration || 0,
    };
    
    const mappedTrackList = shuffled.map(t => ({
      id: t.id,
      title: t.title,
      thumbnail: t.thumbnail,
      artist: t.artist || 'Unknown Artist',
      channel: t.artist || 'Unknown Artist',
      duration: t.duration || 0,
    }));
    
    handlePlayTrack(mappedTrack, mappedTrackList);
    toast.success('🔀 Shuffled offline downloads list!');
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0.0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Just now';
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const filteredTracks = offlineTracks.filter(track => 
    track.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (track.artist && track.artist.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalBytes = offlineTracks.reduce((acc, curr) => acc + curr.size, 0);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar activeTab="offline" onTabChange={() => {}} />

      {/* Main Content Page Column with md:ml-64 to accommodate desktop sidebar spacing */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden md:ml-64">
        {/* Main Content Pane */}
        <main className="flex-1 overflow-y-auto pb-32">
          <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 md:px-8">
          
          {/* Header Area */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-border/60 pb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]">
                  <Download className="w-6 h-6 text-primary animate-pulse" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground theme-gradient-text">
                    Offline Downloads
                  </h1>
                </div>
              </div>
              <p className="text-sm text-muted-foreground max-w-xl">
                Your localized premium offline vault. Stream, skip, and experience your curated musical items instantly without consuming cellular bandwidth.
              </p>
            </div>

            {/* Connection Status Badge */}
            <div className="shrink-0 flex items-center gap-3">
              {isOnline ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.05)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Online Mode
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Offline Mode Active
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-sm text-muted-foreground animate-pulse font-medium">Interrogating browser local storage database...</p>
            </div>
          ) : offlineTracks.length === 0 ? (
            /* Elegant Empty State Container */
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center text-center py-20 px-6 border border-dashed border-border/80 rounded-3xl bg-card/20 backdrop-blur-sm"
            >
              <div className="w-20 h-20 rounded-3xl bg-secondary/50 flex items-center justify-center mb-6 border border-border shadow-inner">
                <Music className="w-10 h-10 text-muted-foreground animate-bounce" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">No Offline Music Cached</h3>
              <p className="text-sm text-muted-foreground max-w-md mb-8 leading-relaxed">
                Build your self-contained musical library! Tap the download icon next to your favorite tunes to cache high-quality audio files directly in your browser.
              </p>
              <a 
                href="/"
                className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 active:scale-95 transition-all shadow-lg hover:shadow-primary/20"
              >
                Go Discover Music
              </a>
            </motion.div>
          ) : (
            <div className="space-y-6">
              
              {/* Filtering Controls */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search inside offline downloads..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card/40 border border-border/60 hover:border-border/100 focus:border-primary focus:outline-none text-sm transition-all placeholder:text-muted-foreground/60"
                  />
                </div>
                {offlineTracks.length > 0 && (
                  <button
                    onClick={handleShufflePlayAll}
                    className="py-2.5 px-5 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-primary/10 shrink-0"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    Shuffle Play All
                  </button>
                )}
              </div>

              {/* Tracks List */}
              <div className="space-y-2">
                {filteredTracks.length === 0 ? (
                  <div className="text-center py-10 border border-border/50 rounded-2xl bg-card/10">
                    <p className="text-sm text-muted-foreground">No cached tracks match "{searchQuery}"</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    <AnimatePresence>
                      {filteredTracks.map((track, index) => {
                        const isCurrent = currentTrack?.id === track.id;
                        return (
                          <motion.div
                            key={track.id}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.2, delay: index * 0.03 }}
                            onClick={() => handlePlayOffline(track)}
                            className={`group flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                              isCurrent 
                                ? 'bg-primary/10 border-primary/40 shadow-md shadow-primary/5' 
                                : 'bg-card/40 border-border/60 hover:border-primary/20 hover:bg-card/80'
                            }`}
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              {/* Thumbnail with cool hover trigger */}
                              <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-secondary shadow-md border border-border/40">
                                <img 
                                  src={track.thumbnail} 
                                  alt={track.title} 
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  referrerPolicy="no-referrer"
                                />
                                <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-200 ${
                                  isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                }`}>
                                  <Play className={`w-5 h-5 text-primary-foreground ${isCurrent && isPlaying ? 'animate-pulse scale-110' : 'scale-90 hover:scale-110'} transition-all`} />
                                </div>
                              </div>

                              {/* Song details */}
                              <div className="min-w-0">
                                <h4 className={`text-sm font-bold truncate leading-snug ${isCurrent ? 'text-primary' : 'text-foreground'}`}>
                                  {track.title}
                                </h4>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {track.artist || 'YouTube Audio'}
                                </p>
                                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground/80">
                                  <span className="font-semibold text-foreground/70 bg-secondary/80 px-1.5 py-0.5 rounded text-[9px]">{formatSize(track.size)}</span>
                                  <span>•</span>
                                  <span>Saved {formatDate(track.downloadedAt)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Row Actions */}
                            <div className="flex items-center gap-2 shrink-0 relative z-10">
                              <button
                                onClick={(e) => handleDelete(e, track.id, track.title)}
                                className="w-9 h-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all flex items-center justify-center cursor-pointer active:scale-90"
                                title="Delete from cache"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Offline notice panel */}
          {!isOnline && (
            <div className="mt-8 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-3 backdrop-blur-md">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-400">Offline playback is active</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  You are utilizing localized IndexedDB audio binaries. Streaming non-cached videos or using external metadata queries is locked until an active internet handshake is registered.
                </p>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Music Player */}
      <MusicPlayer
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onNext={handleNext}
        onPrevious={handlePrevious}
        ytPlayerRef={ytPlayerRef}
        audioRef={audioRef}
        shuffleMode={shuffleMode}
        onToggleShuffle={toggleShuffle}
        queue={queue}
        onRemoveFromQueue={removeFromQueue}
      />
    </div>
  </div>
);
}
