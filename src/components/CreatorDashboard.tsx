import { useState } from 'react';
import { Sparkles, Code2, Cpu, ShieldCheck, Play, Heart, Share2, Check, Headphones, Globe, Radio, Flame, ExternalLink } from 'lucide-react';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { toast } from 'sonner';

interface CreatorDashboardProps {
  onPlayTrack?: (track: any) => void;
}

const SAHAL_SIGNATURE_TRACKS = [
  {
    id: '34Na4j8AVgA',
    title: 'The Weeknd - Starboy ft. Daft Punk',
    thumbnail: 'https://i.ytimg.com/vi/34Na4j8AVgA/hqdefault.jpg',
    channel: 'The Weeknd',
  },
  {
    id: '4NRXx6U8ABQ',
    title: 'The Weeknd - Blinding Lights',
    thumbnail: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg',
    channel: 'The Weeknd',
  },
  {
    id: 'ApXoWvfEYVU',
    title: 'Post Malone, Swae Lee - Sunflower',
    thumbnail: 'https://i.ytimg.com/vi/ApXoWvfEYVU/hqdefault.jpg',
    channel: 'Post Malone',
  },
  {
    id: 'kTJczUoc26U',
    title: 'The Kid LAROI, Justin Bieber - STAY',
    thumbnail: 'https://i.ytimg.com/vi/kTJczUoc26U/hqdefault.jpg',
    channel: 'The Kid LAROI',
  },
  {
    id: 'tvTRZJ-4EyI',
    title: 'Kendrick Lamar - HUMBLE.',
    thumbnail: 'https://i.ytimg.com/vi/tvTRZJ-4EyI/hqdefault.jpg',
    channel: 'Kendrick Lamar',
  }
];

const CreatorDashboard = ({ onPlayTrack }: CreatorDashboardProps) => {
  const { handlePlayTrack, handleAddToQueue } = useMusicPlayer();
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.origin + '/?q=sahal+shihabudheen');
    setCopied(true);
    toast.success('Creator profile link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const playCreatorMix = () => {
    const track = SAHAL_SIGNATURE_TRACKS[0];
    if (onPlayTrack) {
      onPlayTrack(track);
    } else {
      handlePlayTrack(track);
    }
    toast.success("Playing Sahal's Signature Mix!");
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c0d14] via-[#090b10] to-[#040406] border border-primary/30 p-6 md:p-10 shadow-[0_0_50px_rgba(var(--primary),0.15)] mb-12 animate-in-up">
      {/* Background Glow Orbs */}
      <div className="absolute top-0 right-1/4 w-80 h-80 bg-primary/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-[90px] pointer-events-none" />

      {/* Watermark Branding */}
      <div className="absolute -right-6 -bottom-8 select-none pointer-events-none text-white/[0.03] font-black text-8xl md:text-9xl italic uppercase tracking-tighter">
        NYRA
      </div>

      <div className="relative z-10">
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-black tracking-widest text-emerald-400 uppercase">
              Creator Verified Dashboard
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-foreground transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Share Profile'}</span>
            </button>
            <button
              onClick={playCreatorMix}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Play Creator Mix</span>
            </button>
          </div>
        </div>

        {/* Hero Creator Section */}
        <div className="mt-8 flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8">
          {/* Avatar Monogram */}
          <div className="relative group">
            <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl bg-gradient-to-tr from-primary via-indigo-500 to-cyan-400 p-[2px] shadow-[0_0_30px_rgba(var(--primary),0.3)]">
              <div className="w-full h-full rounded-2xl bg-[#0a0a0f] flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-primary/10 opacity-50 group-hover:opacity-100 transition-opacity" />
                <span className="text-2xl md:text-3xl font-black tracking-tighter bg-gradient-to-r from-primary to-cyan-300 bg-clip-text text-transparent">
                  SS
                </span>
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-primary/80 mt-1">
                  NYRA CORE
                </span>
              </div>
            </div>
            <div className="absolute -bottom-2 -right-2 p-1.5 rounded-full bg-primary text-black shadow-lg">
              <ShieldCheck className="w-4 h-4 fill-current" />
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-bold text-primary tracking-wide uppercase">
              <Sparkles className="w-3 h-3 text-primary animate-pulse" />
              Made By Sahal Shihabudheen
            </div>

            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white capitalize">
              Sahal Shihabudheen
            </h1>

            <p className="text-sm md:text-base text-muted-foreground max-w-2xl leading-relaxed">
              Founder & Lead Architect of <span className="text-primary font-semibold">NYRA Music</span>. Designed and engineered for pure high-fidelity sound, dynamic visualizers, and seamless ad-free streaming worldwide.
            </p>
          </div>
        </div>

        {/* Dashboard Architecture Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mt-8">
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-primary/30 transition-colors">
            <div className="flex items-center gap-2 text-primary mb-2">
              <Headphones className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Audio Core</span>
            </div>
            <div className="text-lg font-black text-white">320kbps Hi-Fi</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Lossless audio stream</div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-cyan-400/30 transition-colors">
            <div className="flex items-center gap-2 text-cyan-400 mb-2">
              <Cpu className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Visualizer</span>
            </div>
            <div className="text-lg font-black text-white">3D Reactive</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Beat-synced Three.js</div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-emerald-400/30 transition-colors">
            <div className="flex items-center gap-2 text-emerald-400 mb-2">
              <Globe className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Multi-Platform</span>
            </div>
            <div className="text-lg font-black text-white">Web / PWA / App</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Desktop & Android Ready</div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-purple-400/30 transition-colors">
            <div className="flex items-center gap-2 text-purple-400 mb-2">
              <Code2 className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Engineering</span>
            </div>
            <div className="text-lg font-black text-white">Modern Stack</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Vite, React 18, Supabase</div>
          </div>
        </div>

        {/* Sahal's Handpicked Signature Soundtrack */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400" />
                Sahal's Signature Soundtrack
              </h3>
              <p className="text-xs text-muted-foreground">Handpicked tracks featured by the creator</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SAHAL_SIGNATURE_TRACKS.map((track, idx) => (
              <div
                key={track.id}
                onClick={() => {
                  if (onPlayTrack) onPlayTrack(track);
                  else handlePlayTrack(track);
                }}
                className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-primary/40 transition-all cursor-pointer"
              >
                <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 shadow-sm bg-black/40">
                  <img
                    src={track.thumbnail}
                    alt={track.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-4 h-4 text-white fill-current" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-white truncate group-hover:text-primary transition-colors">
                    {track.title}
                  </h4>
                  <p className="text-xs text-muted-foreground truncate">{track.channel}</p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddToQueue(track);
                    toast.success(`Added "${track.title}" to queue`);
                  }}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-primary hover:text-primary-foreground flex items-center justify-center text-muted-foreground transition-all opacity-0 group-hover:opacity-100"
                  title="Add to queue"
                >
                  <span className="text-base leading-none font-bold">+</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatorDashboard;
