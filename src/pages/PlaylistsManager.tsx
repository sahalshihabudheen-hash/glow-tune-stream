import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListMusic, Trash2, Play, Music2, Sparkles, Flame, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import CreatePlaylistDialog from '@/components/CreatePlaylistDialog';
import ImportYouTubePlaylistDialog from '@/components/ImportYouTubePlaylistDialog';
import PlaylistGridPhoto from '@/components/PlaylistGridPhoto';
import { SpotifyIcon } from '@/components/SpotifyPlaylistsSection';
import { SPOTIFY_BUILTIN_PLAYLISTS, SpotifyPlaylist } from '@/data/spotifyPlaylists';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { cn } from '@/lib/utils';
import { readCache, writeCache, prefetchThumbs } from '@/lib/offlineCache';
import SEO from '@/components/SEO';

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  track_count?: number;
  thumbnails?: string[];
}

const CATEGORIES = [
  { id: 'all', label: 'All Hits' },
  { id: 'pop', label: 'Pop' },
  { id: 'hip-hop', label: 'Hip-Hop' },
  { id: 'chill', label: 'Chill & Lo-Fi' },
  { id: 'rock', label: 'Rock' },
  { id: 'desi', label: 'Desi / Bollywood' },
  { id: 'workout', label: 'Workout' },
  { id: 'charts', label: 'Charts' },
];

const PlaylistsManager = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { handlePlayTrack } = useMusicPlayer();
  const [activeView, setActiveView] = useState<'spotify' | 'my-library'>('spotify');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [playlists, setPlaylists] = useState<Playlist[]>(
    () => readCache<Playlist[]>('playlists') || []
  );
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('playlists');

  useEffect(() => {
    if (user) {
      fetchPlaylists();
    }
  }, [user]);

  const fetchPlaylists = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('playlists')
        .select(`
          *,
          playlist_items(track_thumbnail)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const playlistsWithDetails = data?.map(p => ({
        ...p,
        track_count: p.playlist_items?.length || 0,
        thumbnails: p.playlist_items?.map((item: any) => item.track_thumbnail) || [],
      })) || [];

      setPlaylists(playlistsWithDetails);
      writeCache('playlists', playlistsWithDetails);
      prefetchThumbs(playlistsWithDetails.flatMap(p => p.thumbnails || []));
    } catch (error: any) {
      if (playlists.length === 0) toast.error('Failed to load playlists');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    if (!confirm('Are you sure you want to delete this playlist?')) return;

    try {
      const { error: itemsError } = await supabase.from('playlist_items').delete().eq('playlist_id', id);
      if (itemsError) throw itemsError;

      const { error } = await supabase.from('playlists').delete().eq('id', id);
      if (error) throw error;
      
      toast.success('Playlist deleted');
      fetchPlaylists();
    } catch (error: any) {
      console.error('Delete playlist error:', error);
      toast.error(error.message || 'Failed to delete playlist');
    }
  };

  const filteredSpotifyPlaylists = SPOTIFY_BUILTIN_PLAYLISTS.filter(p => {
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    return true;
  });

  const handlePlaySpotifyPlaylist = (e: React.MouseEvent, playlist: SpotifyPlaylist) => {
    e.stopPropagation();
    if (playlist.tracks.length > 0) {
      handlePlayTrack(playlist.tracks[0]);
      toast.success(`Playing "${playlist.name}"`);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO 
        title="Curated Playlists & Collections" 
        canonicalPath="/playlists"
        description="Organize, manage, and explore built-in Spotify playlists with custom cover artwork and high fidelity sound on NYRA."
      />
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearch={() => navigate(`/?q=${encodeURIComponent(searchQuery)}`)}
      />
      
      <main className="flex-1 md:ml-64 pt-20 pb-32 px-4 md:px-8">
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-4xl font-black neon-text">Playlists</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-muted-foreground">
                  {activeView === 'spotify' ? `${SPOTIFY_BUILTIN_PLAYLISTS.length} Built-in` : `${playlists.length} Saved`}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {activeView === 'spotify' 
                  ? "Explore ready-to-stream curated Spotify global playlists built directly into NYRA."
                  : "Manage your personal custom playlists and saved collections."}
              </p>
            </div>

            {/* View Switcher Tabs */}
            <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-secondary/80 border border-border backdrop-blur-md">
              <button
                onClick={() => setActiveView('spotify')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all",
                  activeView === 'spotify'
                    ? "bg-[#1db954] text-black shadow-lg shadow-[#1db954]/20"
                    : "text-muted-foreground hover:text-white"
                )}
              >
                <SpotifyIcon className={cn("w-4 h-4", activeView === 'spotify' ? "text-black" : "text-[#1db954]")} />
                <span>Spotify Curated</span>
              </button>

              <button
                onClick={() => {
                  if (!user) {
                    toast.info('Sign in to view and manage your personal library');
                    navigate('/auth');
                    return;
                  }
                  setActiveView('my-library');
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all",
                  activeView === 'my-library'
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "text-muted-foreground hover:text-white"
                )}
              >
                <ListMusic className="w-4 h-4" />
                <span>My Library</span>
              </button>
            </div>
          </div>

          {/* Controls bar per view */}
          {activeView === 'spotify' ? (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex-shrink-0 border",
                    selectedCategory === cat.id
                      ? "bg-white text-black border-white shadow-sm"
                      : "bg-white/5 text-muted-foreground border-white/10 hover:border-white/30 hover:text-white"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <ImportYouTubePlaylistDialog onPlaylistImported={fetchPlaylists} />
              <CreatePlaylistDialog onPlaylistCreated={fetchPlaylists} />
            </div>
          )}
        </div>

        {/* SPOTIFY CURATED TAB CONTENT */}
        {activeView === 'spotify' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 md:gap-6">
            {filteredSpotifyPlaylists.map((playlist) => (
              <div
                key={playlist.id}
                onClick={() => navigate(`/playlist/${playlist.id}`)}
                className="group relative bg-[#121212]/90 hover:bg-[#181818] border border-white/5 hover:border-[#1db954]/50 p-4 rounded-2xl transition-all duration-300 hover:shadow-[0_10px_30px_rgba(29,185,84,0.15)] hover:-translate-y-1 cursor-pointer flex flex-col justify-between overflow-hidden"
              >
                {/* Glow accent */}
                <div
                  className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none"
                  style={{ backgroundColor: playlist.accentColor }}
                />

                <div>
                  <div className="relative aspect-square rounded-xl overflow-hidden mb-3.5 shadow-md bg-black/40">
                    <img
                      src={playlist.cover}
                      alt={playlist.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />

                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md flex items-center gap-1.5 border border-white/10">
                      <SpotifyIcon className="w-3 h-3" />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-white">Spotify</span>
                    </div>

                    <button
                      onClick={(e) => handlePlaySpotifyPlaylist(e, playlist)}
                      className="absolute bottom-2 right-2 w-11 h-11 rounded-full bg-[#1db954] text-black flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 hover:scale-110 active:scale-95 z-10"
                      title="Play playlist"
                    >
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </button>
                  </div>

                  <h3 className="font-bold text-base text-foreground truncate group-hover:text-[#1db954] transition-colors">
                    {playlist.name}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                    {playlist.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-semibold text-white/90">{playlist.tracks.length} tracks</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {playlist.followers} followers
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MY LIBRARY TAB CONTENT */}
        {activeView === 'my-library' && (
          <>
            {playlists.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <ListMusic className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-xl font-medium">No playlists created yet</p>
                <p className="text-sm mt-1 text-muted-foreground">
                  Create a custom playlist or save one from Spotify Curated to get started.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {playlists.map((playlist) => (
                  <div
                    key={playlist.id}
                    className={cn(
                      'group relative p-6 rounded-xl transition-all cursor-pointer',
                      'bg-card hover:bg-card/80 border border-border hover:border-primary/50'
                    )}
                    onClick={() => navigate(`/playlist/${playlist.id}`)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <PlaylistGridPhoto 
                        thumbnails={playlist.thumbnails || []} 
                        size="sm" 
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePlaylist(playlist.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity w-10 h-10 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive hover:text-white flex items-center justify-center border border-transparent hover:border-destructive/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <h3 className="font-bold text-lg mb-2 truncate text-foreground">
                      {playlist.name}
                    </h3>
                    {playlist.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {playlist.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {playlist.track_count} {playlist.track_count === 1 ? 'track' : 'tracks'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default PlaylistsManager;
