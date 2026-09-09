import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import TrackCard from '@/components/TrackCard';
import MusicPlayer from '@/components/MusicPlayer';
import SoundwaveVisualizer from '@/components/SoundwaveVisualizer';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/hooks/useAuth';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { Link } from 'react-router-dom';
import SEO from '@/components/SEO';

interface Track {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
}

const Favorites = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { favoriteTracks, loading, isFavorite, toggleFavorite } = useFavorites();

  const {
    currentTrack, isPlaying,
    handlePlayTrack, handlePlayPause, handleNext, handlePrevious,
    handleAddToQueue, ytPlayerRef, audioRef,
    shuffleMode, toggleShuffle,
    queue, removeFromQueue,
  } = useMusicPlayer();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('favorites');

  const handlePlay = (track: Track) => {
    handlePlayTrack(track, favoriteTracks);
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="ml-0 md:ml-64">
          <Navbar searchQuery={searchQuery} onSearchChange={setSearchQuery} onSearch={handleSearch} />
          <main className="pt-28 pb-32 px-4 md:px-8">
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 rounded-full bg-primary/10 mb-4">
                <Heart className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Login to See Favorites</h2>
              <p className="text-muted-foreground max-w-md mb-6">
                Sign in to save and view your favorite tracks
              </p>
              <Link to="/auth">
                <Button>Login</Button>
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="My Favorites" 
        canonicalPath="/favorites"
        noindex={true}
      />
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="ml-0 md:ml-64">
        <Navbar searchQuery={searchQuery} onSearchChange={setSearchQuery} onSearch={handleSearch} />

        <main className="pt-28 pb-48 px-4 md:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Heart className="h-6 w-6 text-primary" fill="currentColor" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-foreground">Your Favorites</h1>
                  <SoundwaveVisualizer isPlaying={isPlaying} className="h-6" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {favoriteTracks.length} {favoriteTracks.length === 1 ? 'track' : 'tracks'} saved
                </p>
              </div>
            </div>
          </div>

          {/* Favorites Grid */}
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
          ) : favoriteTracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 rounded-full bg-muted/50 mb-4">
                <Music className="h-12 w-12 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">No Favorites Yet</h2>
              <p className="text-muted-foreground max-w-md mb-6">
                Start adding tracks to your favorites by clicking the heart icon
              </p>
              <Link to="/">
                <Button>Discover Music</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {favoriteTracks.map((track) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  isCurrent={currentTrack?.id === track.id}
                  isPlaying={isPlaying && currentTrack?.id === track.id}
                  onPlay={handlePlay}
                  onAddToQueue={handleAddToQueue}
                  isFavorite={isFavorite(track.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          )}
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
};

export default Favorites;
