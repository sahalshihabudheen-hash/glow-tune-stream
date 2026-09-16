import { useState } from 'react';
import { Code2, Cpu, Share2, Check, Headphones, Globe, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface CreatorDashboardProps {
  onPlayTrack?: (track: any) => void;
}

const CreatorDashboard = ({ onPlayTrack }: CreatorDashboardProps) => {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.origin + '/?q=sahal+shihabudheen');
    setCopied(true);
    toast.success('Creator profile link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
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
        {/* Top Header Bar — Share + Know More buttons only */}
        <div className="flex flex-wrap items-center justify-end gap-4 pb-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-foreground transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Share Profile'}</span>
            </button>
            <a
              href="https://sahal-shihabudheen.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-foreground transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              <span>Know More</span>
            </a>
          </div>
        </div>

        {/* Hero Section */}
        <div className="mt-8 space-y-2">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white capitalize">
            Sahal Shihabudheen
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl leading-relaxed">
            Founder &amp; Lead Architect of <span className="text-primary font-semibold">NYRA Music</span>. Designed and engineered for pure high-fidelity sound, dynamic visualizers, and seamless ad-free streaming worldwide.
          </p>
        </div>

        {/* Architecture Badges */}
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
            <div className="text-[11px] text-muted-foreground mt-0.5">Desktop &amp; Android Ready</div>
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
      </div>
    </div>
  );
};

export default CreatorDashboard;
