import { useEffect, useRef } from 'react';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

interface DesktopBridge {
  isDesktop: boolean;
  updatePresence: (payload: unknown) => void;
  clearPresence: () => void;
}

declare global {
  interface Window {
    nyraDesktop?: DesktopBridge;
  }
}

/**
 * Streams the current track, playback state and progress to the Electron main
 * process, which renders it as Discord Rich Presence with a live progress bar.
 * No-op in the browser.
 */
export function useDiscordPresence() {
  const { currentTrack, isPlaying, audioRef, ytPlayerRef } = useMusicPlayer();
  const lastKey = useRef<string>('');

  useEffect(() => {
    const bridge = window.nyraDesktop;
    if (!bridge?.isDesktop) return;

    const push = () => {
      if (!currentTrack) {
        if (lastKey.current !== 'idle') {
          lastKey.current = 'idle';
          bridge.clearPresence();
        }
        return;
      }

      let position = 0;
      let duration = 0;

      const audio = audioRef.current;
      if (audio && audio.src && !Number.isNaN(audio.duration)) {
        position = audio.currentTime || 0;
        duration = audio.duration || 0;
      } else if (ytPlayerRef.current?.getCurrentTime) {
        try {
          position = ytPlayerRef.current.getCurrentTime() || 0;
          duration = ytPlayerRef.current.getDuration?.() || 0;
        } catch {
          /* player not ready */
        }
      }

      const key = `${currentTrack.id}|${isPlaying}|${Math.floor(position)}|${Math.floor(duration)}`;
      if (key === lastKey.current) return;
      lastKey.current = key;

      bridge.updatePresence({
        title: currentTrack.title,
        artist: currentTrack.channel,
        artwork: currentTrack.thumbnail,
        isPlaying,
        position,
        duration,
      });
    };

    push();
    const interval = window.setInterval(push, 5000);
    return () => window.clearInterval(interval);
  }, [currentTrack, isPlaying, audioRef, ytPlayerRef]);
}

const DiscordPresence = () => {
  useDiscordPresence();
  return null;
};

export default DiscordPresence;
