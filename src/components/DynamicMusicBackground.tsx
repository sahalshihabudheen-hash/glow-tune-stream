import { useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { useDjAudio } from '@/hooks/useDjAudio';

/**
 * Artwork-driven dynamic atmosphere with beat and rhythm reactivity.
 * Renders crossfading artwork atmosphere behind the entire app.
 * Drives global CSS custom properties on :root so every element in the
 * app (buttons, cards, glow borders, the play button) pulses with the music.
 */
const DynamicMusicBackground = () => {
  const { settings } = useTheme();
  const { currentTrack, isPlaying, audioRef } = useMusicPlayer();
  const { state, getFrequencyData } = useDjAudio(audioRef, isPlaying);

  // Two layer DOM refs so artwork changes crossfade without React re-render overhead.
  const layerARef = useRef<HTMLDivElement>(null);
  const layerBRef = useRef<HTMLDivElement>(null);
  const showBRef = useRef(false);
  const prevSrcRef = useRef<string | undefined>(undefined);

  // Refs used inside rAF loop (avoids stale closures)
  const isPlayingRef = useRef(isPlaying);
  const settingsRef = useRef(settings);
  const stateRef = useRef(state);
  const getFrequencyDataRef = useRef(getFrequencyData);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { getFrequencyDataRef.current = getFrequencyData; }, [getFrequencyData]);

  // Artwork layer switching via direct DOM manipulation (zero re-render cost)
  useEffect(() => {
    if (!settings.dynamicMusicUI) return;
    const src = currentTrack?.thumbnail;
    if (!src || src === prevSrcRef.current) return;
    prevSrcRef.current = src;
    if (!showBRef.current) {
      if (layerBRef.current) layerBRef.current.style.backgroundImage = `url(${src})`;
      if (layerARef.current) layerARef.current.style.opacity = '0';
      if (layerBRef.current) layerBRef.current.style.opacity = '1';
      showBRef.current = true;
    } else {
      if (layerARef.current) layerARef.current.style.backgroundImage = `url(${src})`;
      if (layerBRef.current) layerBRef.current.style.opacity = '0';
      if (layerARef.current) layerARef.current.style.opacity = '1';
      showBRef.current = false;
    }
  }, [currentTrack?.thumbnail, settings.dynamicMusicUI]);

  // Beat & tone reactive animation loop — drives global CSS vars on <html>
  useEffect(() => {
    const root = document.documentElement;

    const resetGlobalVars = () => {
      root.style.setProperty('--beat-scale', '1');
      root.style.setProperty('--beat-glow-px', '0px');
      root.style.setProperty('--beat-glow-px-strong', '0px');
      root.style.setProperty('--beat-energy', '0');
      root.style.setProperty('--beat-bass', '0');
      root.style.setProperty('--beat-saturate', '1');
    };

    if (!settings.dynamicMusicUI || !settings.beatReactive || !isPlaying) {
      resetGlobalVars();
      return;
    }

    let running = true;
    let animId: number;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const isSmallScreen = window.innerWidth < 768;
    const frameDelay = isSmallScreen ? 100 : 40; // ~10fps mobile, ~25fps desktop
    const intensity = (settingsRef.current.dynamicIntensity ?? 70) / 100;

    const loop = () => {
      if (!running) return;

      if (document.hidden) {
        timeoutId = setTimeout(loop, 500);
        return;
      }

      const s = settingsRef.current;
      const currentIntensity = (s.dynamicIntensity ?? 70) / 100;

      let energy = 0;
      let bassEnergy = 0;

      if (stateRef.current.active) {
        // Real Web Audio frequency data
        const freqs = getFrequencyDataRef.current();
        const bass = ((freqs[0] || 0) + (freqs[1] || 0) + (freqs[2] || 0) + (freqs[3] || 0)) / (4 * 255);
        const mid = ((freqs[4] || 0) + (freqs[5] || 0) + (freqs[6] || 0)) / (3 * 255);
        bassEnergy = bass;
        energy = Math.min(1, bass * 0.7 + mid * 0.3);
      } else {
        // High-precision multi-harmonic beat rhythm generator
        const t = Date.now() / 1000;
        const beat1 = Math.pow(Math.max(0, Math.sin(t * Math.PI * 1.8)), 3);        // kick drum ~108bpm feel
        const beat2 = Math.pow(Math.max(0, Math.sin(t * Math.PI * 0.9 + 0.5)), 2) * 0.5; // half-time
        const beat3 = Math.max(0, Math.sin(t * Math.PI * 3.6)) * 0.15;              // hi-hat ghost
        bassEnergy = Math.min(1, beat1 * 0.8 + beat2 * 0.2);
        energy = Math.min(1, beat1 + beat2 + beat3);
      }

      // Scale with user intensity slider
      const scaledEnergy = energy * currentIntensity;
      const scaledBass = bassEnergy * currentIntensity;

      // --- CSS custom properties on :root ---
      // Scale: 1.0 (rest) → 1.0 + intensity*0.08 (max)
      const beatScale = 1 + scaledBass * 0.08;
      // Glow px: 0px → up to 30px on heavy beat
      const glowPx = scaledEnergy * 30 * currentIntensity;
      const glowPxStrong = scaledBass * 50 * currentIntensity;
      // Raw energy 0-1 for opacity/color tweaks
      const saturate = 1 + scaledEnergy * 0.5;

      root.style.setProperty('--beat-scale', beatScale.toFixed(4));
      root.style.setProperty('--beat-glow-px', `${glowPx.toFixed(1)}px`);
      root.style.setProperty('--beat-glow-px-strong', `${glowPxStrong.toFixed(1)}px`);
      root.style.setProperty('--beat-energy', scaledEnergy.toFixed(4));
      root.style.setProperty('--beat-bass', scaledBass.toFixed(4));
      root.style.setProperty('--beat-saturate', saturate.toFixed(3));

      // Also update artwork layer blur/scale on DOM directly
      const artScale = (1.2 + scaledBass * 0.08).toFixed(4);
      const baseOpacity = Math.max(0.2, Math.min(0.95, currentIntensity * 0.85));
      const activeOpacity = Math.min(1, baseOpacity + scaledEnergy * 0.3);
      const sat = 150 + Math.round(currentIntensity * 80);
      const filterStr = `blur(65px) saturate(${sat}%) brightness(0.92)`;
      const transformStr = `scale(${artScale})`;
      if (layerARef.current && parseFloat(layerARef.current.style.opacity || '0') > 0) {
        layerARef.current.style.filter = filterStr;
        layerARef.current.style.transform = transformStr;
        layerARef.current.style.opacity = String(activeOpacity);
      }
      if (layerBRef.current && parseFloat(layerBRef.current.style.opacity || '0') > 0) {
        layerBRef.current.style.filter = filterStr;
        layerBRef.current.style.transform = transformStr;
        layerBRef.current.style.opacity = String(activeOpacity);
      }

      animId = requestAnimationFrame(() => {
        timeoutId = setTimeout(loop, frameDelay);
      });
    };

    loop();

    return () => {
      running = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (animId) cancelAnimationFrame(animId);
      resetGlobalVars();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, settings.dynamicMusicUI, settings.beatReactive]);

  if (!settings.dynamicMusicUI) return null;

  const intensityPct = (settings.dynamicIntensity ?? 70) / 100;
  const baseOpacity = Math.max(0.2, Math.min(0.95, intensityPct * 0.85));
  const layerClass =
    'absolute inset-0 bg-center bg-cover will-change-[opacity,transform,filter]';

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ contain: 'strict' }}
    >
      <div
        ref={layerARef}
        className={layerClass}
        style={{
          opacity: 0,
          filter: `blur(65px) saturate(${150 + Math.round(intensityPct * 80)}%) brightness(0.92)`,
          transform: 'scale(1.2)',
          transition: 'opacity 1.2s ease-out',
        }}
      />
      <div
        ref={layerBRef}
        className={layerClass}
        style={{
          opacity: 0,
          filter: `blur(65px) saturate(${150 + Math.round(intensityPct * 80)}%) brightness(0.92)`,
          transform: 'scale(1.2)',
          transition: 'opacity 1.2s ease-out',
        }}
      />
      {/* Readability guard */}
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
