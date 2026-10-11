import { SlidersHorizontal, X, Sparkles } from 'lucide-react';
import jarvisAvatar from '@/assets/jarvis-avatar.gif';
import { useDjAudio } from '@/hooks/useDjAudio';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

interface EqualizerPanelProps {
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
  isOpen: boolean;
  onClose: () => void;
}

const EQFader = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => {
  const percentage = ((value + 12) / 24) * 100;
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/75">{label}</span>
      <div className="relative group flex flex-col items-center select-none" style={{ height: 100, width: 32 }}>
        {/* Fader Slot/Track */}
        <div className="absolute inset-y-0 w-1.5 bg-black/40 rounded-full border border-white/5 shadow-inner" />
        
        {/* Active Fill Glow */}
        <div 
          className="absolute bottom-0 w-1.5 rounded-full transition-all duration-100"
          style={{ 
            height: `${percentage}%`,
            background: 'linear-gradient(0deg, hsl(var(--primary)), #fff)',
            boxShadow: '0 0 10px hsl(var(--primary)/0.3)'
          }}
        />
        
        {/* Fader Knob */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 w-8 h-3.5 rounded-[3px] bg-gradient-to-b from-[#333] to-[#111] border border-white/10 shadow-lg flex flex-col items-center justify-center gap-0.5 cursor-ns-resize group-hover:border-primary/50 transition-colors"
          style={{ bottom: `calc(${percentage}% - 7px)` }}
        >
          <div className="w-4 h-[1px] bg-white/20" />
          <div className="w-4 h-[1px] bg-primary/40" />
        </div>

        <input 
          type="range" 
          min={-12} max={12} step={0.5} 
          value={value}
          onChange={e => onChange(+e.target.value)}
          className="absolute inset-0 opacity-0 cursor-ns-resize w-full h-full" 
          style={{ WebkitAppearance: 'slider-vertical' }}
        />
      </div>
      <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
        {value > 0 ? '+' : ''}{value.toFixed(1)} <span className="text-[7px] text-muted-foreground/30">dB</span>
      </span>
    </div>
  );
};

const EqualizerPanel = ({ isOpen, onClose }: EqualizerPanelProps) => {
  const { audioRef, isPlaying } = useMusicPlayer();
  const { state, apply, init } = useDjAudio(audioRef, isPlaying);

  if (!isOpen) return null;

  const handleFaderChange = (band: 'low' | 'mid' | 'high', val: number) => {
    // If the audio context hasn't been initialized yet, do it on user interaction
    if (!state.active) {
      init();
    }
    // patch only the changed band (spreading stale `state` here would undo init()'s active:true)
    apply({ [band]: val });
  };

  return (
    <div className="bg-card/95 backdrop-blur-xl border border-primary/20 rounded-2xl p-4 md:p-5 shadow-2xl shadow-primary/10 animate-scale-in w-[280px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Equalizer</h3>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3-Band Faders */}
      <div className="grid grid-cols-3 gap-2 bg-black/20 rounded-xl p-3 border border-white/5 mb-4">
        <EQFader label="Bass" value={state.low} onChange={v => handleFaderChange('low', v)} />
        <EQFader label="Mid" value={state.mid} onChange={v => handleFaderChange('mid', v)} />
        <EQFader label="High" value={state.high} onChange={v => handleFaderChange('high', v)} />
      </div>

      {/* Jarvis Connected Message */}
      <div className="flex items-center gap-3 bg-muted/40 rounded-xl px-3 py-2.5 border border-primary/10">
        <img
          src={jarvisAvatar}
          alt="Jarvis"
          className="w-8 h-8 rounded-full border-2 border-primary/30 flex-shrink-0 object-cover"
        />
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <span className="text-primary font-bold">JARVIS:</span>{' '}
          {state.active 
            ? 'Web Audio active. Custom 3-band filter connected.' 
            : 'Unlocking stream filters on first modifier adjustment...'} 🎧
        </p>
      </div>
    </div>
  );
};

export default EqualizerPanel;
