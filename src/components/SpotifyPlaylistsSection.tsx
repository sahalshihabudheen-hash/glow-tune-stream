import { useNavigate } from 'react-router-dom';
import { Play, Sparkles, Music2, Flame } from 'lucide-react';
import { SPOTIFY_BUILTIN_PLAYLISTS, SpotifyPlaylist } from '@/data/spotifyPlaylists';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { cn } from '@/lib/utils';

export const SpotifyIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={cn("text-[#1db954]", className)}
  >
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.307c-.218.357-.682.472-1.039.254-2.846-1.74-6.429-2.133-10.65-1.168-.409.094-.814-.162-.907-.57-.094-.408.162-.814.57-.907 4.629-1.057 8.586-.613 11.772 1.332.357.218.472.682.254 1.039zm1.47-3.268c-.274.446-.86.589-1.306.314-3.258-2.002-8.225-2.583-12.078-1.413-.501.152-1.033-.133-1.185-.634-.152-.501.133-1.033.634-1.185 4.412-1.339 9.89-.693 13.621 1.604.446.275.589.86.314 1.306zm.127-3.407C15.2 8.32 8.784 8.1 5.116 9.213c-.604.184-1.246-.16-1.43-.763-.184-.604.16-1.246.763-1.43 4.225-1.282 11.31-1.032 15.82 1.646.544.323.725 1.026.402 1.57-.323.543-1.026.724-1.57.402z" />
  </svg>
);

interface SpotifyPlaylistsSectionProps {
  onPlayTrack?: (track: any) => void;
}

const SpotifyPlaylistsSection = ({ onPlayTrack }: SpotifyPlaylistsSectionProps) => {
  const navigate = useNavigate();
  const { handlePlayTrack } = useMusicPlayer();

  const handleQuickPlay = (e: React.MouseEvent, playlist: SpotifyPlaylist) => {
    e.stopPropagation();
    if (playlist.tracks.length > 0) {
      const first = playlist.tracks[0];
      if (onPlayTrack) {
        onPlayTrack(first);
      } else {
        handlePlayTrack(first);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-[#1db954]/10 text-[#1db954] shadow-[0_0_20px_rgba(29,185,84,0.2)]">
            <SpotifyIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-3xl font-black tracking-tighter uppercase italic text-foreground">
                Spotify Built-in Hits
              </h2>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#1db954]/20 text-[#1db954] border border-[#1db954]/30">
                Official Curations
              </span>
            </div>
            <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.3em]">
              Top playlists ready to stream instantly • Zero setup required
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/playlists')}
          className="text-xs font-semibold text-[#1db954] hover:underline flex items-center gap-1 transition-all"
        >
          View all
          <span className="text-sm">→</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4 md:gap-6">
        {SPOTIFY_BUILTIN_PLAYLISTS.map((playlist) => (
          <div
            key={playlist.id}
            onClick={() => navigate(`/playlist/${playlist.id}`)}
            className="group relative bg-[#121212]/80 hover:bg-[#181818] border border-white/5 hover:border-[#1db954]/40 p-4 rounded-2xl transition-all duration-300 hover:shadow-[0_10px_30px_rgba(29,185,84,0.15)] hover:-translate-y-1 cursor-pointer flex flex-col justify-between overflow-hidden"
          >
            {/* Top Accent Glow */}
            <div
              className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none"
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
                
                {/* Spotify Pill Badge */}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md flex items-center gap-1.5 border border-white/10">
                  <SpotifyIcon className="w-3 h-3" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white">Spotify</span>
                </div>

                {/* Floating Play Button */}
                <button
                  onClick={(e) => handleQuickPlay(e, playlist)}
                  className="absolute bottom-2 right-2 w-11 h-11 rounded-full bg-[#1db954] text-black flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 hover:scale-110 active:scale-95 z-10"
                  title="Play playlist"
                >
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </button>
              </div>

              <h3 className="font-bold text-sm md:text-base text-foreground truncate group-hover:text-[#1db954] transition-colors">
                {playlist.name}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                {playlist.description}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/80">{playlist.tracks.length} tracks</span>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-primary/80">
                {playlist.category}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SpotifyPlaylistsSection;
