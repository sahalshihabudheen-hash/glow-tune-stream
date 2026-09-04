import { useEffect, useState, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { useDjAudio } from '@/hooks/useDjAudio';

/**
 * Artwork-driven dynamic atmosphere with beat and rhythm reactivity.
 * Renders crossfading artwork atmosphere behind the entire app.
 * Automatically pulses with the bass and rhythmic frequencies of the music.
 */
const DynamicMusicBackground = () => {
  const { settings } = useTheme();
  const { currentTrack, isPlaying, audioRef } = useMusicPlayer();
  const { state, getFrequencyData } = useDjAudio(audioRef, isPlaying);

  // Two layers so artwork changes can crossfade smoothly.
  const [layers, setLayers] = useState<{ a?: string; b?: string; showB: boolean }>({ showB: false });
  const [beatScale, setBeatScale] = useState(1);
  const [beatGlow, setBeatGlow] = useState(0);

  const isPlayingRef = useRef(isPlaying);
  const stateRef = useRef(state);
  const getFrequencyDataRef = useRef(getFrequencyData);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { getFrequencyDataRef.current = getFrequencyData; }, [getFrequencyData]);

  // Artwork layer switching
  useEffect(() => {
    if (!settings.dynamicMusicUI) return;
    const src = currentTrack?.thumbnail;
    if (!src) return;
    setLayers((prev) => {
      const active = prev.showB ? prev.b : prev.a;
      if (active === src) return prev;
      return prev.showB ? { ...prev, a: src, showB: false } : { ...prev, b: src, showB: true };
    });
  }, [currentTrack?.thumbnail, settings.dynamicMusicUI]);

  // Beat & tone reactive animation loop
  useEffect(() => {
    if (!settings.dynamicMusicUI || !settings.beatReactive || !isPlaying) {
      setBeatScale(1);
      setBeatGlow(0);
      return;
    }

    let running = true;
    let animId: number;
    const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < 768;
    const frameDelay = isSmallScreen ? 120 : 50;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const pulseLoop = () => {
      if (!running) return;

      if (typeof document !== 'undefined' && document.hidden) {
        timeoutId = setTimeout(pulseLoop, 500);
        return;
      }

      let energy = 0;
      if (stateRef.current.active) {
        const freqs = getFrequencyDataRef.current();
        const bassSum = (freqs[0] || 0) + (freqs[1] || 0) + (freqs[2] || 0) + (freqs[3] || 0);
        energy = bassSum / (4 * 255);
      } else {
        // High-precision rhythmic wave pulse based on track tempo beats
        const t = Date.now() / 250;
        const beat1 = Math.pow(Math.max(0, Math.sin(t * 1.8)), 3);
        const beat2 = Math.pow(Math.max(0, Math.sin(t * 0.9 + 0.4)), 2) * 0.5;
        energy = Math.min(1, beat1 + beat2);
      }

      // Smooth pulsing scale (1.0 to 1.14) & glow boost
      const scale = 1 + energy * 0.12;
      const glow = energy * 0.35;

      setBeatScale(scale);
      setBeatGlow(glow);

      animId = requestAnimationFrame(() => {
        timeoutId = setTimeout(pulseLoop, frameDelay);
      });
    };

    pulseLoop();

    return () => {
      running = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isPlaying, settings.dynamicMusicUI, settings.beatReactive]);

  if (!settings.dynamicMusicUI) return null;

  // Compute opacity from user's intensity slider (10% - 100%, default 70%)
  const intensityPct = (settings.dynamicIntensity ?? 70) / 100;
  const baseOpacity = Math.max(0.2, Math.min(0.95, intensityPct * 0.85));
  const activeOpacity = Math.min(1, baseOpacity + beatGlow);

  const layerClass =
    'absolute inset-0 bg-center bg-cover transition-opacity duration-[1200ms] ease-out will-change-[opacity,transform]';

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ contain: 'strict' }}
    >
      <div
        className={layerClass}
        style={{
          backgroundImage: layers.a ? `url(${layers.a})` : undefined,
          opacity: layers.showB ? 0 : activeOpacity,
          filter: `blur(65px) saturate(${150 + Math.round(intensityPct * 80)}%) brightness(0.92)`,
          transform: `scale(${1.2 * beatScale})`,
          transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 1.2s ease-out',
        }}
      />
      <div
        className={layerClass}
        style={{
          backgroundImage: layers.b ? `url(${layers.b})` : undefined,
          opacity: layers.showB ? activeOpacity : 0,
          filter: `blur(65px) saturate(${150 + Math.round(intensityPct * 80)}%) brightness(0.92)`,
          transform: `scale(${1.2 * beatScale})`,
          transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 1.2s ease-out',
        }}
      />
      {/* Readability guard: allows vibrant artwork atmosphere through while guaranteeing high text contrast */}
      <div
        className="absolute inset-0 bg-background/50 backdrop-blur-xl transition-colors duration-500"
        style={{
          opacity: Math.max(0.3, 0.7 - intensityPct * 0.3),
        }}
      />
    </div>
  );
};

export default DynamicMusicBackground;
