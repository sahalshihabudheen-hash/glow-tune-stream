import { useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

/**
 * Optional artwork-driven atmosphere.
 * Renders a heavily blurred, low-opacity copy of the current artwork behind the app.
 * Purely decorative: pointer-events none, sits below all content, never affects layout.
 */
const DynamicMusicBackground = () => {
  const { settings } = useTheme();
  const { currentTrack } = useMusicPlayer();

  // Two layers so artwork changes can crossfade smoothly.
  const [layers, setLayers] = useState<{ a?: string; b?: string; showB: boolean }>({ showB: false });

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

  if (!settings.dynamicMusicUI) return null;

  const layerClass =
    'absolute inset-0 bg-center bg-cover transition-opacity duration-[1200ms] ease-out will-change-[opacity]';

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
          opacity: layers.showB ? 0 : 0.65,
          filter: 'blur(70px) saturate(200%) brightness(0.9)',
          transform: 'scale(1.25)',
        }}
      />
      <div
        className={layerClass}
        style={{
          backgroundImage: layers.b ? `url(${layers.b})` : undefined,
          opacity: layers.showB ? 0.65 : 0,
          filter: 'blur(70px) saturate(200%) brightness(0.9)',
          transform: 'scale(1.25)',
        }}
      />
      {/* Readability guard: keeps text contrast intact over artwork while letting colors shine through */}
      <div className="absolute inset-0 bg-background/50 backdrop-blur-xl" />
    </div>
  );
};

export default DynamicMusicBackground;
