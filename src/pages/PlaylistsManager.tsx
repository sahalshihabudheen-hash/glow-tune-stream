import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListMusic, Trash2, Music2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import CreatePlaylistDialog from '@/components/CreatePlaylistDialog';
import ImportYouTubePlaylistDialog from '@/components/ImportYouTubePlaylistDialog';
import PlaylistGridPhoto from '@/components/PlaylistGridPhoto';
import { cn } from '@/lib/utils';
import { readCache, writeCache, prefetchThumbs } from '@/lib/offlineCache';

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  track_count?: number;
  thumbnails?: string[];
}

const PlaylistsManager = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>(
    () => readCache<Playlist[]>('playlists') || []
  );
  const [loading, setLoading] = useState(() => !readCache<Playlist[]>('playlists'));
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('playlists');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (user) {
      fetchPlaylists();
    }
  }, [user, authLoading, navigate]);

  const fetchPlaylists = async () => {
    if (!user) return;
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
      // Keep whatever was cached so the page still works offline.
      if (playlists.length === 0) toast.error('Failed to load playlists');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    if (!confirm('Are you sure you want to delete this playlist?')) return;

    try {
      // First delete all items in the playlist
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearch={() => navigate('/')}
      />
      
      <main className="flex-1 md:ml-64 pt-20 pb-32 px-4 md:px-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold neon-text mb-2">Your Playlists</h1>
              <p className="text-muted-foreground">{playlists.length} playlists</p>
            </div>
            <div className="flex items-center gap-2">
              <ImportYouTubePlaylistDialog onPlaylistImported={fetchPlaylists} />
              <CreatePlaylistDialog onPlaylistCreated={fetchPlaylists} />
            </div>
          </div>
        </div>

        {playlists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <ListMusic className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-xl font-medium">No playlists yet</p>
            <p className="text-sm">Create your first playlist to get started</p>
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
      </main>
    </div>
  );
};

export default PlaylistsManager;
