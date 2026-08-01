import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SplashScreen from '@/components/SplashScreen';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import TrackGrid from '@/components/TrackGrid';
import MusicPlayer from '@/components/MusicPlayer';
import TrendingSection from '@/components/TrendingSection';
import HeroSection from '@/components/HeroSection';
import PersonalizedSection from '@/components/PersonalizedSection';
import RecentlyPlayedSection from '@/components/RecentlyPlayedSection';
import GenreOnboarding from '@/components/GenreOnboarding';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { famousSongs } from '@/data/famousSongs';
import { cn } from '@/lib/utils';
import { Sparkles, TrendingUp, Compass, Users } from 'lucide-react';
import FavoriteArtistsSection from '@/components/FavoriteArtistsSection';
import { getFunctionAuthHeaders } from '@/lib/functionAuth';


const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { settings } = useTheme();
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [mounted, setMounted] = useState(false);

  const {
    currentTrack, isPlaying, ytPlayerRef, audioRef,
    handlePlayTrack, handlePlayPause, handleNext, handlePrevious,
    handlePlayFromPlaylist, handlePlayFromQueue,
    handleAddToPlaylist, handleAddToQueue,
    handleRemoveFromPlaylist, handleClearPlaylist,
    playlist, queue, isInPlaylist, removeFromQueue, reorderPlaylist,
    shuffleMode, toggleShuffle,
    loopMode, cycleLoopMode,
    isFavorite, toggleFavorite,
    tracks, setTracks,
    setShowMiniPlayer,
  } = useMusicPlayer();

  const { preferences, showOnboarding, savePreferences } = useUserPreferences();
  const { location } = useUserLocation();

  useEffect(() => {
    setMounted(true);
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!searchPerformed && tracks.length === 0) {
      setTracks(famousSongs);
    }
  }, [searchPerformed, tracks.length, setTracks]);

  useEffect(() => {
    setShowMiniPlayer(true);
  }, [setShowMiniPlayer]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    setIsLoading(true);
    setSearchPerformed(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-search?q=${encodeURIComponent(searchQuery)}`,
        {
          headers: await getFunctionAuthHeaders(),
        }
      );

      if (!response.ok) throw new Error('Search failed');
      const results = await response.json();
      if (results.error) throw new Error(results.error);

      setTracks(results);
      toast.success(`Found ${results.length} tracks`);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-foreground relative overflow-hidden">
      {/* Immersive Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[150px] animate-pulse-slow" />
        <div className="absolute bottom-[10%] left-[-5%] w-[40%] h-[40%] rounded-full bg-blue-500/5 blur-[120px] animate-pulse-slow" style={{ animationDelay: '3s' }} />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] brightness-100 contrast-150" />
      </div>

      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="relative z-10 ml-0 md:ml-64 min-h-screen flex flex-col">
        <Navbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearch={handleSearch}
          onClearSearch={() => {
            setSearchPerformed(false);
            setTracks(famousSongs);
          }}
        />

        <main className={cn(
          "flex-1 pt-24 md:pt-28 pb-64 px-4 md:px-10 transition-all duration-1000",
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}>
          <GenreOnboarding
            open={showOnboarding && !showSplash}
            onComplete={savePreferences}
          />

          {!searchPerformed && (
            <div className="animate-in-up">
               <HeroSection onPlayTrack={handlePlayTrack} />
            </div>
          )}

          <div className="space-y-16 mt-12">
            {!searchPerformed && (
              <section className="animate-in-up" style={{ animationDelay: '0.2s' }}>
                <RecentlyPlayedSection
                  onPlayTrack={handlePlayTrack}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  onAddToQueue={handleAddToQueue}
                  isFavorite={isFavorite}
                  onToggleFavorite={toggleFavorite}
                />
              </section>
            )}

            {!searchPerformed && (
              <section className="animate-in-up" style={{ animationDelay: '0.22s' }}>
                <MadeForYouSection
                  onPlayTrack={handlePlayTrack}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  onAddToQueue={handleAddToQueue}
                  isFavorite={isFavorite}
                  onToggleFavorite={toggleFavorite}
                />
              </section>
            )}

            {!searchPerformed && (
              <section className="animate-in-up" style={{ animationDelay: '0.25s' }}>
                <FavoriteArtistsSection />
              </section>
            )}


            {!searchPerformed && (

              <section className="animate-in-up" style={{ animationDelay: '0.3s' }}>
                <div className="flex items-center gap-3 mb-8 group cursor-default">
                  <div className="p-2.5 rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 shadow-lg">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-3xl font-black tracking-tighter uppercase italic group-hover:neon-text transition-all duration-500">Global Pulse</h2>
                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.3em]">Trending worldwide right now</p>
                  </div>
                </div>
                <TrendingSection 
                  onPlayTrack={handlePlayTrack}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  onAddToQueue={handleAddToQueue}
                  isFavorite={isFavorite}
                  onToggleFavorite={toggleFavorite}
                />
              </section>
            )}

            {!searchPerformed && location?.country && (
              <section className="animate-in-up" style={{ animationDelay: '0.4s' }}>
                 <div className="flex items-center gap-3 mb-8 group cursor-default">
                  <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all duration-500 shadow-lg">
                    <Compass className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-3xl font-black tracking-tighter uppercase italic group-hover:text-blue-400 transition-all duration-500">Local Vibes</h2>
                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.3em]">Hits from {location.state || location.country}</p>
                  </div>
                </div>
                <PersonalizedSection
                  title={`Hits from ${location.state || location.country}`}
                  subtitle={`Popular songs in ${location.city ? `${location.city}, ` : ''}${location.state || location.country}`}
                  icon="regional"
                  searchParams={{ type: 'regional', state: location.state || '', country: location.country || '' }}
                  onPlayTrack={handlePlayTrack}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  onAddToQueue={handleAddToQueue}
                  isFavorite={isFavorite}
                  onToggleFavorite={toggleFavorite}
                />
              </section>
            )}

            {!searchPerformed && preferences?.genres && preferences.genres.length > 0 && (
              preferences.genres.map((genre, idx) => (
                <section key={genre} className="animate-in-up" style={{ animationDelay: `${0.5 + idx * 0.1}s` }}>
                   <div className="flex items-center gap-3 mb-8 group cursor-default">
                    <div className="p-2.5 rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 shadow-lg">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-3xl font-black tracking-tighter uppercase italic group-hover:neon-text transition-all duration-500">{genre} Essence</h2>
                      <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.3em]">Because you love this rhythm</p>
                    </div>
                  </div>
                  <PersonalizedSection
                    title={genre}
                    subtitle={`Handpicked ${genre} tracks for you`}
                    icon="genre"
                    searchParams={{ type: 'genre', genre }}
                    onPlayTrack={handlePlayTrack}
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    onAddToQueue={handleAddToQueue}
                    isFavorite={isFavorite}
                    onToggleFavorite={toggleFavorite}
                  />
                </section>
              ))
            )}

            {searchPerformed && tracks.length > 0 && (
              <div className="mb-12 animate-in-up">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                  <h1 className="text-2xl md:text-4xl font-black tracking-tighter uppercase italic neon-text">Results</h1>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                </div>
                <p className="text-center text-xs font-bold text-muted-foreground uppercase tracking-[0.5em]">
                  Discovered {tracks.length} tracks for "<span className="text-primary">{searchQuery}</span>"
                </p>
              </div>
            )}

            {!searchPerformed && (
              <div className="pt-12 border-t border-white/5">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-1.5 h-10 rounded-full bg-primary shadow-[0_0_15px_rgba(var(--primary),0.5)]" />
                  <div>
                    <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase italic">The Collection</h2>
                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.3em]">Discover trending hits and popular tracks</p>
                  </div>
                </div>
              </div>
            )}

            <TrackGrid
              tracks={tracks}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onPlayTrack={handlePlayTrack}
              onAddToQueue={handleAddToQueue}
              isLoading={isLoading}
              searchPerformed={searchPerformed}
              isFavorite={isFavorite}
              onToggleFavorite={toggleFavorite}
            />
          </div>
        </main>
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

export default Index;
