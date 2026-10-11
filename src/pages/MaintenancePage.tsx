import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Volume2, VolumeX, LogOut, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  MaintenanceMessageConfig,
  DEFAULT_TITLE,
  sanitizeMessageConfig,
  titleStyle,
  messageStyle,
} from '@/lib/maintenanceMessage';

interface MaintenancePageProps {
  /** Admin-defined message + styling. Falls back to the original text when empty. */
  config?: MaintenanceMessageConfig;
  /** Admin preview: no audio, no logout, shows a close button. */
  preview?: boolean;
  /** Small inline preview (scaled down inside the admin editor): no buttons, fills its parent. */
  embedded?: boolean;
  onClosePreview?: () => void;
}

const MaintenancePage = ({ config: rawConfig, preview = false, embedded = false, onClosePreview }: MaintenancePageProps) => {
  const isPreview = preview || embedded;
  const config = rawConfig ? sanitizeMessageConfig(rawConfig) : undefined;
  const customMessage = config?.message.trim() ? config.message.trim() : '';
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (isPreview) return;
    const audio = new Audio('https://files.catbox.moe/jfdd5u.wav');
    audio.loop = true;
    audio.volume = 0.5;
    audioRef.current = audio;

    // Auto-play with user interaction fallback
    const playAudio = () => {
      audio.play().catch(() => {
        // Auto-play blocked, will play on user interaction
        const handleClick = () => {
          audio.play();
          document.removeEventListener('click', handleClick);
        };
        document.addEventListener('click', handleClick);
      });
    };
    playAudio();

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [isPreview]);

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  const page = (
    <div className={`${embedded ? 'h-full w-full' : 'min-h-screen'} bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden`}>
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -top-48 -left-48 animate-pulse" />
        <div className="absolute w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl -bottom-32 -right-32 animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Top buttons */}
      {embedded ? null : preview ? (
        <div className="absolute top-6 right-6 flex items-center gap-3 z-10">
          <span className="text-xs px-3 py-1.5 rounded-full bg-primary/15 text-primary font-medium">Preview</span>
          <button
            onClick={onClosePreview}
            className="p-3 rounded-full bg-secondary/80 hover:bg-secondary transition-colors"
            title="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : (
      <div className="absolute top-6 right-6 flex items-center gap-3 z-10">
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.reload();
          }}
          className="p-3 rounded-full bg-secondary/80 hover:bg-secondary transition-colors"
          title="Log Out"
        >
          <LogOut className="w-5 h-5 text-muted-foreground hover:text-destructive" />
        </button>
        <button
          onClick={toggleMute}
          className="p-3 rounded-full bg-secondary/80 hover:bg-secondary transition-colors"
        >
          {muted ? (
            <VolumeX className="w-5 h-5 text-muted-foreground" />
          ) : (
            <Volume2 className="w-5 h-5 text-primary" />
          )}
        </button>
      </div>
      )}

      <div className={`relative z-10 text-center w-full ${customMessage ? 'max-w-2xl' : 'max-w-lg'}`}>
        {/* Spinning gear */}
        <div className="mx-auto w-24 h-24 mb-8 relative">
          <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '3s' }} />
          <div className="relative w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
            <Settings className="w-12 h-12 text-primary animate-spin" style={{ animationDuration: '8s' }} />
          </div>
        </div>

        <h1
          className="font-bold text-foreground mb-4 tracking-tight"
          style={config ? titleStyle(config) : { fontSize: '36px', lineHeight: 1.15 }}
        >
          {config?.title.trim() || DEFAULT_TITLE}
        </h1>

        {customMessage && config ? (
          <p className="text-muted-foreground mb-8" style={messageStyle(config)}>
            {customMessage}
          </p>
        ) : (
          <>
            <p className="text-lg text-muted-foreground mb-2">
              JARVIS is working faster than you think
            </p>

            <p className="text-sm text-muted-foreground/70 mb-8">
              We're upgrading our systems to serve you better. Please check back soon.
            </p>
          </>
        )}

        {/* Animated progress bar */}
        <div className="w-full max-w-xs mx-auto h-1.5 bg-secondary rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full animate-pulse"
            style={{
              width: '60%',
              animation: 'maintenance-progress 2s ease-in-out infinite alternate',
            }}
          />
        </div>

        <style>{`
          @keyframes maintenance-progress {
            0% { width: 20%; margin-left: 0; }
            100% { width: 60%; margin-left: 40%; }
          }
        `}</style>

        <p className="text-xs text-muted-foreground/50 mt-8">
          If you believe you should have access, contact the administrator.
        </p>
      </div>
    </div>
  );

  if (preview && !embedded) {
    return <div className="fixed inset-0 z-[300] overflow-auto bg-background">{page}</div>;
  }
  return page;
};

export default MaintenancePage;
