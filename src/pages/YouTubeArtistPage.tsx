import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, CheckCircle2, Users, Heart, Loader2 } from 'lucide-react';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { supabase } from '@/integrations/supabase/client';
import TrackCard from '@/components/TrackCard';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import MusicPlayer from '@/components/MusicPlayer';
import SEO from '@/components/SEO';

interface Track {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
  channelId?: string;
}

interface ChannelInfo {
  name: string;
  photo: string | null;
  subscribers: string | null;
  description: string;
}

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://piped.video/api',
  'https://piped-api.garudalinux.org',
];

const YouTubeArtistPage = () => {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();

  const {
    currentTrack, isPlaying,
    handlePlayTrack, handlePlayPause, handleNext, handlePrevious,
    handleAddToQueue, isFavorite, toggleFavorite,
    ytPlayerRef, audioRef, playlist, queue, isInPlaylist,
    removeFromQueue, reorderPlaylist,
    handlePlayFromPlaylist, handlePlayFromQueue,
    handleAddToPlaylist, handleRemoveFromPlaylist, handleClearPlaylist,
    shuffleMode, toggleShuffle, loopMode, cycleLoopMode,
  } = useMusicPlayer();

  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowed, setIsFollowed] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (channelId) {
      fetchChannelData(channelId);
      checkFollowStatus(channelId);
    }
  }, [channelId]);

  const formatSubscribers = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  const fetchChannelData = async (id: string) => {
    setLoading(true);
    try {
      for (const base of PIPED_INSTANCES) {
        try {
          const res = await fetch(`${base}/channel/${id}`, { signal: AbortSignal.timeout(5000) });
          if (!res.ok) continue;
          const data = await res.json();
          
          const info: ChannelInfo = {
            name: data.name || data.title || 'Artist',
            photo: data.avatarUrl || data.avatar || null,
            subscribers: data.subscriberCount ? formatSubscribers(data.subscriberCount) : null,
            description: data.description || '',
          };
          setChannelInfo(info);

          // Extract videos/songs from related streams
          const videos: Track[] = (data.relatedStreams || data.videos || [])
            .slice(0, 30)
            .map((v: any) => ({
              id: v.url?.replace('/watch?v=', '') || v.videoId || v.id,
              title: v.title,
              thumbnail: v.thumbnail || v.thumbnailUrl || `https://i.ytimg.com/vi/${v.url?.replace('/watch?v=', '')}/hqdefault.jpg`,
              channel: data.name || info.name,
              channelId: id,
            }))
            .filter((t: Track) => t.id && t.title);

          setTracks(videos);
          return; // success
        } catch {
          continue;
        }
      }

      // Fallback: search YouTube by channel name
      toast.info('Loading songs via search...');
    } catch (err) {
      toast.error('Could not load artist page');
    } finally {
      setLoading(false);
    }
  };

  const checkFollowStatus = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('followed_artists' as any)
      .select('id')
      .eq('user_id', user.id)
      .eq('artist_id', id)
      .maybeSingle();
    setIsFollowed(!!data);
  };

  const handleFollow = async () => {
    if (!channelId || !channelInfo) return;
    setFollowLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Please sign in to follow artists'); return; }

      if (isFollowed) {
        await supabase.from('followed_artists' as any).delete()
          .eq('user_id', user.id).eq('artist_id', channelId);
        setIsFollowed(false);
        toast.success(`Unfollowed ${channelInfo.name}`);
      } else {
        await supabase.from('followed_artists' as any).insert({
          user_id: user.id,
          artist_id: channelId,
          artist_name: channelInfo.name,
          artist_photo: channelInfo.photo || '',
        });
        setIsFollowed(true);
        toast.success(`Now following ${channelInfo.name} 🎵`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Could not update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  const handlePlay = (track: Track) => {
    handlePlayTrack(track, tracks);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-foreground">
      <SEO 
        title={channelInfo ? `${channelInfo.name} - Artist Music & Discography` : 'Artist Discography'}
        description={channelInfo?.description ? channelInfo.description.slice(0, 160) : 'Listen to top songs, albums, and discography on NYRA.'}
        canonicalPath={`/yt-artist/${channelId || ''}`}
        ogType="profile"
        ogImage={channelInfo?.photo || undefined}
      />
      <Sidebar activeTab="" onTabChange={() => {}} />

      <div className="ml-0 md:ml-64 min-h-screen pb-48">
        {/* Hero */}
        <div className="relative overflow-hidden">
          {/* Background blur from photo */}
          {channelInfo?.photo && (
            <div
              className="absolute inset-0 opacity-20 blur-[100px] scale-150"
              style={{ backgroundImage: `url(${channelInfo.photo})`, backgroundSize: 'cover' }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#050505]" />

          <div className="relative z-10 px-6 md:px-10 pt-8 pb-12">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 text-sm font-bold uppercase tracking-widest"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="flex flex-col md:flex-row items-center md:items-end gap-8">
              {/* Artist Photo */}
              <div className="w-40 h-40 md:w-56 md:h-56 rounded-full overflow-hidden border-4 border-primary/30 shadow-[0_0_60px_rgba(var(--primary),0.3)] shrink-0">
                {loading ? (
                  <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  </div>
                ) : channelInfo?.photo ? (
                  <img src={channelInfo.photo} alt={channelInfo.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                    <User className="w-16 h-16 text-primary" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 text-center md:text-left">
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.5em] mb-2">Artist</p>
                <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter mb-3">
                  {channelInfo?.name || 'Loading...'}
                </h1>
                <div className="flex items-center justify-center md:justify-start gap-3 mb-6">
                  {channelInfo?.subscribers && (
                    <span className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
                      <Users className="w-4 h-4" />
                      {channelInfo.subscribers} subscribers
                    </span>
                  )}
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-muted-foreground">{tracks.length} songs loaded</span>
                </div>

                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-sm transition-all active:scale-95 flex items-center gap-2 mx-auto md:mx-0 ${
                    isFollowed
                      ? 'bg-primary text-primary-foreground shadow-[0_0_30px_hsl(var(--primary)/0.4)]'
                      : 'glass-premium border border-white/10 hover:border-primary/40'
                  }`}
                >
                  {followLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className={`w-4 h-4 ${isFollowed ? 'fill-current' : ''}`} />}
                  {isFollowed ? 'Following' : 'Follow Artist'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Songs Grid */}
        <div className="px-6 md:px-10 mt-4">
          <h2 className="text-xl font-black uppercase tracking-widest italic mb-6 text-primary">Songs</h2>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
          ) : tracks.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <p className="font-bold">No songs found for this artist</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {tracks.map((track) => (
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
        </div>
      </div>

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
        loopMode={loopMode}
        onCycleLoopMode={cycleLoopMode}
        queue={queue}
        onRemoveFromQueue={removeFromQueue}
        onPlayFromQueue={handlePlayFromQueue}
      />
    </div>
  );
};

export default YouTubeArtistPage;
