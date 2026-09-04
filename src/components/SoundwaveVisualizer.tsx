import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { useDjAudio } from '@/hooks/useDjAudio';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

export type SoundwaveShape = 'bars' | 'waves' | 'dots' | 'pulse' | 'spectrum';

interface SoundwaveVisualizerProps {
  isPlaying: boolean;
  className?: string;
  shape?: SoundwaveShape;
}

const SoundwaveVisualizer = ({ isPlaying, className, shape: propShape }: SoundwaveVisualizerProps) => {
  const { settings } = useTheme();
  const { audioRef } = useMusicPlayer();
  const { state, getFrequencyData } = useDjAudio(audioRef, isPlaying);
  const shape = propShape || settings.soundwaveShape || 'bars';
  const [barHeights, setBarHeights] = useState<number[]>(Array(16).fill(20));
  const [dotSizes, setDotSizes] = useState<number[]>(Array(8).fill(4));
  const [pulseScale, setPulseScale] = useState(1);
  const reactId = useId().replace(/:/g, '');
  const waveGradientId = `waveGradient-${reactId}`;
  const waveGlowId = `waveGlow-${reactId}`;
  const animationRef = useRef<number>();
  const isPlayingRef = useRef(isPlaying);
  const stateRef = useRef(state);
  const getFrequencyDataRef = useRef(getFrequencyData);

  // Keep refs in sync to avoid stale closures in animation loop
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { getFrequencyDataRef.current = getFrequencyData; }, [getFrequencyData]);

  useEffect(() => {
    if (!isPlaying) {
      setBarHeights(Array(16).fill(20));
      setDotSizes(Array(8).fill(4));
      setPulseScale(1);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    let running = true;
    // Phones get a slower refresh: heavy setState loops were causing audio/UI jank.
    const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < 768;
    const frameDelay = isSmallScreen ? 140 : 60;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const animate = () => {
      if (!running) return;

      if (typeof document !== 'undefined' && document.hidden) {
        timeoutId = setTimeout(animate, 500);
        return;
      }

      let freqArray: number[] = [];
      if (stateRef.current.active) {
        const rawFrequencies = getFrequencyDataRef.current();
        freqArray = Array.from(rawFrequencies).map(v => (v / 255) * 100);
      }

      // Smooth visual fallback keeps the wave alive on Vercel/YouTube iframe playback
      // where WebAudio frequency data is blocked or unavailable.
      const hasRealSignal = freqArray.some(v => v > 2);
      if (!hasRealSignal) {
        freqArray = Array(16).fill(0).map((_, i) => {
          const t = Date.now() / 260;
          const waveA = Math.sin(t + i * 0.72) * 22;
          const waveB = Math.sin(t * 0.55 + i * 1.35) * 14;
          return Math.max(10, Math.min(95, 42 + waveA + waveB));
        });
      }

      setBarHeights(freqArray);

      const newDots = Array(8).fill(0).map((_, i) => {
        const val = freqArray[i * 2] || 0;
        return (val / 100) * 8 + 2;
      });
      setDotSizes(newDots);

      const bassValue = (freqArray[0] || 0) + (freqArray[1] || 0) + (freqArray[2] || 0);
      setPulseScale(0.85 + (bassValue / 300) * 0.35);

      animationRef.current = requestAnimationFrame(() => {
        timeoutId = setTimeout(animate, frameDelay);
      });
    };

    animate();

    return () => {
      running = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying]);


  // Bars Shape (Classic) - heights in px, not % so they're visible in any container
  if (shape === 'bars') {
    return (
      <div className={cn('flex items-end justify-center gap-[3px] min-h-[16px]', className)}>
        {barHeights.slice(0, 12).map((height, index) => {
          // Convert 0-100 scale to a pixel height between 3px and 100% of container
          // Use a minimum of 4px and max via calc
          const pxHeight = isPlaying ? Math.max(5, Math.round(height * 0.42)) : 5;
          return (
            <div
              key={index}
              className="w-[3px] rounded-full bg-primary shrink-0"
              style={{
                height: `${pxHeight}px`,
                minHeight: '4px',
                maxHeight: '100%',
                boxShadow: isPlaying
                  ? '0 0 6px hsl(var(--primary)), 0 0 12px hsl(var(--primary) / 0.6)'
                  : '0 0 3px hsl(var(--primary) / 0.4)',
                transition: 'height 0.08s ease-out',
                opacity: isPlaying ? 1 : 0.5,
              }}
            />
          );
        })}
      </div>
    );
  }

  // Waves Shape (Smooth animated wave)
  if (shape === 'waves') {
    const points = barHeights.map((h, i) => {
      const x = (i / (barHeights.length - 1)) * 100;
      const y = isPlaying ? 20 + ((h - 50) / 3) : 20;
      return `${x},${y}`;
    });
    const pathData = `M 0,20 L ${points.join(' L ')} L 100,20`;

    return (
      <div className={cn('flex items-center justify-center overflow-hidden', className)}>
        <svg viewBox="0 0 100 40" className="w-full h-full min-h-[20px]" preserveAspectRatio="none">
          <defs>
            <linearGradient id={waveGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
              <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="1" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
            </linearGradient>
            <filter id={waveGlowId}>
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <path
            d={pathData}
            fill="none"
            stroke={`url(#${waveGradientId})`}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-75"
            style={{ filter: isPlaying ? `url(#${waveGlowId})` : 'none' }}
          />
          <path
            d={`${pathData} L 100,40 L 0,40 Z`}
            fill={`url(#${waveGradientId})`}
            opacity={isPlaying ? 0.2 : 0.05}
            className="transition-all duration-75"
          />
        </svg>
      </div>
    );
  }

  // Dots Shape (Bouncing dots)
  if (shape === 'dots') {
    return (
      <div className={cn('flex items-center justify-center gap-2', className)}>
        {dotSizes.map((size, index) => (
          <div
            key={index}
            className={cn('rounded-full transition-all duration-100', isPlaying ? 'bg-primary' : 'bg-primary/30')}
            style={{
              width: isPlaying ? `${size + 4}px` : '6px',
              height: isPlaying ? `${size + 4}px` : '6px',
              boxShadow: isPlaying ? `0 0 ${size * 2}px hsl(var(--primary) / 0.6)` : 'none',
              transform: isPlaying ? `translateY(${(size - 5) * 2}px)` : 'translateY(0)',
            }}
          />
        ))}
      </div>
    );
  }

  // Pulse Shape (Circular pulse)
  if (shape === 'pulse') {
    return (
      <div className={cn('flex items-center justify-center', className)}>
        <div className="relative">
          {[0, 1, 2].map((ring) => (
            <div
              key={ring}
              className="absolute inset-0 rounded-full border-2 border-primary/40"
              style={{
                transform: isPlaying ? `scale(${pulseScale + ring * 0.3})` : 'scale(1)',
                opacity: isPlaying ? 0.6 - ring * 0.2 : 0.3,
                transition: 'all 0.1s ease-out',
                width: '24px',
                height: '24px',
                marginLeft: `-${12 + ring * 6}px`,
                marginTop: `-${12 + ring * 6}px`,
                left: '50%',
                top: '50%',
              }}
            />
          ))}
          <div
            className={cn('w-6 h-6 rounded-full transition-all duration-100', isPlaying ? 'bg-primary' : 'bg-primary/30')}
            style={{
              transform: isPlaying ? `scale(${pulseScale})` : 'scale(1)',
              boxShadow: isPlaying ? '0 0 20px hsl(var(--primary) / 0.8)' : 'none',
            }}
          />
        </div>
      </div>
    );
  }

  // Spectrum Shape (Mirrored bars)
  if (shape === 'spectrum') {
    const halfBars = barHeights.slice(0, 8);
    const maxHeight = Math.max(...barHeights);
    return (
      <div className={cn('flex items-center justify-center gap-[2px] min-h-[16px]', className)}>
        {[...halfBars].reverse().map((height, index) => {
          const pxH = isPlaying ? Math.max(4, Math.round(height * 0.4)) : 6;
          return (
            <div
              key={`left-${index}`}
              className={cn('w-[2px] rounded-full transition-all duration-75', isPlaying ? 'bg-primary' : 'bg-primary/30')}
              style={{
                height: `${pxH}px`,
                boxShadow: isPlaying ? '0 0 4px hsl(var(--primary) / 0.5)' : 'none',
              }}
            />
          );
        })}
        <div
          className={cn('w-[3px] rounded-full transition-all duration-75', isPlaying ? 'bg-primary' : 'bg-primary/30')}
          style={{
            height: `${isPlaying ? Math.max(6, Math.round(maxHeight * 0.4)) : 10}px`,
            boxShadow: isPlaying ? '0 0 8px hsl(var(--primary))' : 'none',
          }}
        />
        {halfBars.map((height, index) => {
          const pxH = isPlaying ? Math.max(4, Math.round(height * 0.4)) : 6;
          return (
            <div
              key={`right-${index}`}
              className={cn('w-[2px] rounded-full transition-all duration-75', isPlaying ? 'bg-primary' : 'bg-primary/30')}
              style={{
                height: `${pxH}px`,
                boxShadow: isPlaying ? '0 0 4px hsl(var(--primary) / 0.5)' : 'none',
              }}
            />
          );
        })}
      </div>
    );
  }

  return null;
};

export default SoundwaveVisualizer;