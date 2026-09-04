import { useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

/**
 * Smart Music Transitions (modular add-on).
 *
 * When enabled in Settings -> Playback, this fades the audio out near the end of
 * a track and fades it back in when the next track starts, so songs blend instead
 * of cutting abruptly. It only touches the output volume of the existing player
 * (YouTube iframe or HTMLAudio) and never interferes with playback control.
 *
 * When disabled (default) it is a complete no-op.
 */
const SmartTransitions = () => {
  const { settings } = useTheme();
  const { currentTrack, isPlaying, volume, isMuted, audioRef, ytPlayerRef } = useMusicPlayer();

  const fadingInRef = useRef(false);
  const fadeInStartRef = useRef(0);
  const lastTrackIdRef = useRef<string | null>(null);
  const appliedRef = useRef(false);

  const enabled = settings.smartTransitions && (settings.transitionDuration ?? 0) > 0;

  // Reset fade-in whenever the track changes while the feature is on.
  useEffect(() => {
    const id = currentTrack?.id ?? null;
    if (id !== lastTrackIdRef.current) {
      lastTrackIdRef.current = id;
      if (enabled && id) {
        fadingInRef.current = true;
        fadeInStartRef.current = performance.now();
      }
    }
  }, [currentTrack?.id, enabled]);

  useEffect(() => {
    const baseVolume = isMuted ? 0 : volume; // 0-100

    const applyVolume = (v: number) => {
      const clamped = Math.max(0, Math.min(100, v));
      appliedRef.current = true;
      const el = audioRef.current;
      if (el) el.volume = clamped / 100;
      try {
        ytPlayerRef.current?.setVolume?.(Math.round(clamped));
      } catch {
        /* player not ready */
      }
    };

    const restore = () => {
      if (!appliedRef.current) return;
      appliedRef.current = false;
      applyVolume(baseVolume);
      appliedRef.current = false;
    };

    if (!enabled || !currentTrack) {
      restore();
      return;
    }

    const fadeSeconds = Math.max(0, Math.min(12, settings.transitionDuration ?? 0));

    const tick = () => {
      if (!isPlaying || baseVolume === 0) return;

      // Fade in on a freshly started track
      if (fadingInRef.current) {
        const elapsed = (performance.now() - fadeInStartRef.current) / 1000;
        if (elapsed >= fadeSeconds) {
          fadingInRef.current = false;
          applyVolume(baseVolume);
        } else {
          // equal-power-ish curve feels more natural than linear
          const ratio = Math.sin((elapsed / fadeSeconds) * (Math.PI / 2));
          applyVolume(baseVolume * ratio);
          return;
        }
      }

      // Fade out near the end of the current track
      const el = audioRef.current;
      let position = 0;
      let duration = 0;
      if (el && el.src && isFinite(el.duration) && el.duration > 0) {
        position = el.currentTime;
        duration = el.duration;
      } else {
        try {
          position = ytPlayerRef.current?.getCurrentTime?.() ?? 0;
          duration = ytPlayerRef.current?.getDuration?.() ?? 0;
        } catch {
          duration = 0;
        }
      }

      // Gracefully fall back to normal playback when no timing info exists
      if (!duration || !isFinite(duration) || duration <= fadeSeconds + 1) {
        restore();
        return;
      }

      const remaining = duration - position;
      if (remaining <= fadeSeconds) {
        const ratio = Math.sin((Math.max(0, remaining) / fadeSeconds) * (Math.PI / 2));
        applyVolume(baseVolume * ratio);
      } else if (appliedRef.current) {
        restore();
      }
    };

    const interval = window.setInterval(tick, 120);
    return () => {
      window.clearInterval(interval);
      restore();
    };
  }, [enabled, settings.transitionDuration, currentTrack, isPlaying, volume, isMuted, audioRef, ytPlayerRef]);

  return null;
};

export default SmartTransitions;
