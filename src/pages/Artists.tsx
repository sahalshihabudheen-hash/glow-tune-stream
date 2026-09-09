import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import ArtistCard from '@/components/ArtistCard';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import SoundwaveVisualizer from '@/components/SoundwaveVisualizer';
import { useAllArtists } from '@/hooks/useArtist';
import { useAuth } from '@/hooks/useAuth';
import SEO from '@/components/SEO';

const Artists = () => {
  const { artists, loading } = useAllArtists();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('artists');

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Featured Artists & Discographies" 
        canonicalPath="/artists"
        description="Discover trending and verified artists on NYRA. Explore artist discographies, top music tracks, albums, and biography highlights."
      />
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="ml-0 md:ml-64">
        <Navbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearch={handleSearch}
        />

        <main className="pt-28 pb-32 px-4 md:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 relative">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-foreground">Artists</h1>
                    <SoundwaveVisualizer isPlaying={true} className="h-6" />
                  </div>
                  <p className="text-sm text-muted-foreground">Discover amazing artists and their music</p>
                </div>
              </div>
              {user && (
                <Link to="/become-artist">
                  <Button variant="outline" className="gap-2">
                    <Music className="h-4 w-4" />
                    Become an Artist
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Artists Grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-square rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : artists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 rounded-full bg-muted/50 mb-4">
                <Music className="h-12 w-12 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">No Artists Yet</h2>
              <p className="text-muted-foreground max-w-md mb-6">
                Be the first to share your music with the world!
              </p>
              {user && (
                <Link to="/become-artist">
                  <Button className="gap-2">
                    <Music className="h-4 w-4" />
                    Become an Artist
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {artists.map((artist) => {
                const latestAlbum = artist.albums[0];
                const totalSongs = artist.albums.reduce((acc, album) => acc + album.songs.length, 0);

                return (
                  <ArtistCard
                    key={artist.id}
                    id={artist.id}
                    artistName={artist.artist_name}
                    albumName={latestAlbum?.album_name}
                    coverImageUrl={latestAlbum?.cover_image_url || artist.profile_image_url}
                    songCount={totalSongs}
                  />
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Artists;
