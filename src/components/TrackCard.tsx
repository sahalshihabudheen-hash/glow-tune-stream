import { Play, Pause, ListPlus, Heart, Download, Loader2, Share2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import AddToPlaylistDialog from './AddToPlaylistDialog';
import { toast } from 'sonner';
import { useDownloadManager } from '@/contexts/DownloadManagerContext';
import { useNavigate } from 'react-router-dom';
import { shareTrack } from '@/utils/shareUtils';

interface Track {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
}

interface TrackCardProps {
  track: Track;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (track: Track) => Promise<boolean>;
}

const TrackCard = ({ track, isCurrent, isPlaying, onPlay, onAddToQueue, isFavorite = false, onToggleFavorite }: TrackCardProps) => {

  const navigate = useNavigate();
  const { startDownload, isDownloading } = useDownloadManager();
  const downloading = isDownloading(track.id);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    startDownload(track);
  };
  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAddToQueue) {
      onAddToQueue(track);
    }
  };

  const handlePlayNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlay(track);
  };

  const handleCardClick = () => {
    navigate(`/song/${track.id}`, { state: { track } });
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      await onToggleFavorite(track);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    shareTrack(track);
  };

  return (
    <div
      className={cn(
        'group relative glass-premium rounded-[2rem] overflow-hidden border border-white/5 transition-all duration-500 cursor-pointer shadow-xl hover:shadow-primary/10 hover:-translate-y-1',
        isCurrent && 'ring-2 ring-primary/50 shadow-[0_0_30px_rgba(var(--primary),0.2)]'
      )}
      onClick={handleCardClick}

    >
      {/* Thumbnail Area */}
      <div className="relative aspect-square overflow-hidden m-2 rounded-[1.5rem]">
        <img
          src={track.thumbnail}
          alt={track.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        
        {/* Action Overlay (Bottom) - pointer-events-none so card body clicks pass through */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent transition-opacity duration-500 flex flex-col justify-end p-4 pointer-events-none",
          "opacity-100"
        )}>
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={handlePlayNow}
              className={cn(
                'w-11 h-11 rounded-full flex items-center justify-center transition-all duration-500 shadow-xl',
                isCurrent && isPlaying ? 'bg-primary text-primary-foreground neon-glow animate-pulse' : 'bg-primary text-primary-foreground hover:scale-110 active:scale-95'
              )}
            >
              {isCurrent && isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>



            {onAddToQueue && (
              <button 
                onClick={handleAddToQueue}
                className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition-all active:scale-95 shadow-lg"
                title="Add to Queue"
              >
                <ListPlus className="w-4 h-4" />
              </button>
            )}

            <button 
              onClick={handleToggleFavorite}
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 backdrop-blur-sm shadow-lg",
                isFavorite ? "bg-primary text-primary-foreground" : "bg-white/20 text-white hover:bg-white/30"
              )}
              title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
            >
              <Heart className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} />
            </button>

            <button 
              onClick={handleDownload}
              className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition-all active:scale-95 shadow-lg"
              title="Download"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            </button>
            <button 
              onClick={handleShare}
              className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition-all active:scale-95 shadow-lg"
              title="Share"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>


        {/* Top Actions Group (Secondary) - always visible on mobile, hover on desktop */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10 opacity-100 md:opacity-0 md:translate-x-4 md:group-hover:opacity-100 md:group-hover:translate-x-0 transition-all duration-500">
          <button onClick={handleDownload} aria-label="Download" className="w-8 h-8 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 text-white flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all active:scale-90 shadow-lg">
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          </button>
          <button onClick={handleShare} aria-label="Share" className="w-8 h-8 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 text-white flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all active:scale-90 shadow-lg">
            <Share2 className="w-3.5 h-3.5" />
          </button>
          <AddToPlaylistDialog
            track={track}
            trigger={
              <button aria-label="Add to playlist" className="w-8 h-8 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 text-white flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all active:scale-90 shadow-lg">
                <ListPlus className="w-3.5 h-3.5" />
              </button>
            }
          />
        </div>

        {/* Equalizer (playing state) */}
        {isCurrent && isPlaying && (
          <div className="absolute top-3 left-3 flex items-end gap-0.5 h-4 bg-primary/90 rounded-md px-1.5 py-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-0.5 bg-primary-foreground rounded-full equalizer-bar" style={{ height: '100%' }} />
            ))}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="p-4 pt-2">
        <h3 className="font-bold text-foreground truncate group-hover:text-primary transition-colors text-sm tracking-tight">
          {track.title}
        </h3>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-[10px] font-bold text-muted-foreground/60 truncate uppercase tracking-widest flex-1">{track.channel}</p>
          {isCurrent && isPlaying && <Zap className="w-3 h-3 text-primary animate-pulse" />}
        </div>
      </div>

    </div>
  );
};

export default TrackCard;

