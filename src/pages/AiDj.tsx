import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music2, Sparkles, Play, Loader2, Smile, Frown, CloudSun, Zap, Brain, Disc3, Music } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import MusicPlayer from '@/components/MusicPlayer';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import SEO from '@/components/SEO';

interface Song {
  title: string;
  artist: string;
}

interface DJResult {
  detectedMood: string;
  songs: Song[];
}

const quickMoods = [
  { label: 'Happy', icon: Smile, prompt: "I'm feeling really happy and want upbeat music!" },
  { label: 'Sad', icon: Frown, prompt: "I'm feeling sad and need some comforting music" },
  { label: 'Chill', icon: CloudSun, prompt: "I want to relax with some chill vibes" },
  { label: 'Energetic', icon: Zap, prompt: "I need high energy workout music!" },
  { label: 'Focus', icon: Brain, prompt: "I need to concentrate, play focus music" },
];

const AiDj = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { gradient } = useTheme();
  const [activeTab, setActiveTab] = useState('ai-dj');
  const [moodInput, setMoodInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DJResult | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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
    setShowMiniPlayer,
  } = useMusicPlayer();

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    setShowMiniPlayer(true);
  }, [setShowMiniPlayer]);

  const generatePlaylist = async (mood?: string) => {
    const moodText = mood || moodInput;
    if (!moodText.trim()) {
      toast.error('Please enter your mood first');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-mood-dj`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mood: moodText }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate playlist');
      }

      const data: DJResult = await response.json();
      setResult(data);
      toast.success('AI playlist generated!');
    } catch (error) {
      console.error('AI DJ error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate playlist');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaySong = async (song: Song, index: number) => {
    setPlayingIndex(index);
    try {
      const query = `${song.title} ${song.artist} official audio`;
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-search?q=${encodeURIComponent(query)}`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      if (!response.ok) throw new Error('Search failed');
      const results = await response.json();
      if (results.length > 0) {
        handlePlayTrack(results[0]);
      } else {
        toast.error('Song not found on YouTube');
      }
    } catch {
      toast.error('Failed to find song');
    } finally {
      setPlayingIndex(null);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background/80 gradient-bg noise-overlay">
      <SEO 
        title="AI Mood DJ - Smart Music Flow" 
        canonicalPath="/ai-dj"
        description="Experience NYRA AI Mood DJ. Continuous, intelligent music flow powered by AI, tailored in real-time to your mood, activity, and vibe."
      />
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="ml-0 md:ml-64">
        <Navbar searchQuery={searchQuery} onSearchChange={setSearchQuery} onSearch={handleSearch} />

        <main className="pt-24 md:pt-28 pb-48 md:pb-36 px-4 md:px-8">
          {/* Header */}
          <div className="mb-8 animate-in-up">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={gradient.enabled ? { background: 'var(--theme-gradient)' } : { backgroundColor: 'hsl(var(--primary))' }}
              >
                <Sparkles className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-foreground">AI Mood DJ</h1>
                <p className="text-muted-foreground text-sm">Your personal AI that picks music based on how you feel</p>
              </div>
            </div>
          </div>

          {/* Quick Mood Buttons */}
          <div className="flex flex-wrap gap-3 mb-6 animate-in-up" style={{ animationDelay: '0.1s' }}>
            {quickMoods.map((mood) => {
              const Icon = mood.icon;
              return (
                <button
                  key={mood.label}
                  onClick={() => {
                    setMoodInput(mood.prompt);
                    generatePlaylist(mood.prompt);
                  }}
                  disabled={loading}
                  className={cn(
                    "flex items-center gap-2 px-5 py-3 rounded-2xl font-medium text-sm transition-all active:scale-95",
                    "bg-secondary/80 text-foreground hover:bg-primary hover:text-primary-foreground",
                    "border border-border/50 backdrop-blur-sm"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {mood.label}
                </button>
              );
            })}
          </div>

          {/* Mood Input */}
          <div className="glass-premium rounded-3xl p-6 md:p-8 mb-8 animate-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Music2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Tell the AI how you're feeling..."
                  value={moodInput}
                  onChange={(e) => setMoodInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && generatePlaylist()}
                  disabled={loading}
                  className={cn(
                    "w-full pl-12 pr-4 py-4 rounded-2xl bg-secondary/60 border border-border/50",
                    "text-foreground placeholder:text-muted-foreground",
                    "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
                    "transition-all text-base"
                  )}
                />
              </div>
              <button
                onClick={() => generatePlaylist()}
                disabled={loading || !moodInput.trim()}
                className={cn(
                  "flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-base",
                  "text-primary-foreground transition-all active:scale-95",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                style={gradient.enabled ? { background: 'var(--theme-gradient)' } : { backgroundColor: 'hsl(var(--primary))' }}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
                {loading ? 'Generating...' : 'Generate AI Playlist'}
              </button>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="glass-premium rounded-3xl p-12 text-center animate-in-up">
              <Disc3 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
              <p className="text-foreground font-semibold text-lg">AI is analyzing your mood...</p>
              <p className="text-muted-foreground text-sm mt-2">Curating the perfect playlist just for you</p>
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <div className="animate-in-up" style={{ animationDelay: '0.1s' }}>
              {/* Mood Detected Card */}
              <div className="glass-premium rounded-3xl p-6 mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Mood Detected</p>
                    <p className="text-lg font-bold text-foreground">{result.detectedMood}</p>
                  </div>
                </div>
              </div>

              {/* Playlist Card */}
              <div className="glass-premium rounded-3xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={gradient.enabled ? { background: 'var(--theme-gradient)' } : { backgroundColor: 'hsl(var(--primary))' }}
                  >
                    <Music className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">Your AI Playlist</h2>
                </div>

                <div className="space-y-3">
                  {result.songs.map((song, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-2xl transition-all group",
                        "bg-secondary/40 hover:bg-secondary/80 border border-border/30",
                        "hover:border-primary/30"
                      )}
                    >
                      {/* Track Number */}
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-primary">{index + 1}</span>
                      </div>

                      {/* Music Note */}
                      <Music2 className="w-5 h-5 text-primary/60 flex-shrink-0" />

                      {/* Song Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground font-medium truncate">{song.title}</p>
                        <p className="text-muted-foreground text-sm truncate">{song.artist}</p>
                      </div>

                      {/* Play Button */}
                      <button
                        onClick={() => handlePlaySong(song, index)}
                        disabled={playingIndex === index}
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                          "transition-all active:scale-95",
                          "bg-primary text-primary-foreground hover:neon-glow",
                          "opacity-0 group-hover:opacity-100 md:opacity-70 md:group-hover:opacity-100"
                        )}
                      >
                        {playingIndex === index ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!result && !loading && (
            <div className="glass-premium rounded-3xl p-12 text-center animate-in-up" style={{ animationDelay: '0.3s' }}>
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Music2 className="w-10 h-10 text-primary" />
              </div>
              <p className="text-foreground font-semibold text-lg mb-2">Tell the AI your mood</p>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Type how you're feeling or pick a quick mood above, and the AI DJ will curate the perfect playlist for you
              </p>
            </div>
          )}
        </main>
      </div>

      <MusicPlayer
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onAddToPlaylist={handleAddToPlaylist}
        isInPlaylist={currentTrack ? isInPlaylist(currentTrack.id) : false}
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
    </div>
  );
};

export default AiDj;
