import { registerPlugin } from '@capacitor/core';

interface NyraMediaPlugin {
  updateTrack(options: { title: string; artist: string; artwork: string; duration: number }): Promise<void>;
  setPlaybackState(options: { isPlaying: boolean; position: number }): Promise<void>;
  addListener(event: 'carCommand', handler: (data: { command: string; position: number }) => void): any;
}

const NyraMedia = registerPlugin<NyraMediaPlugin>('NyraMedia');

/** Returns true if running inside the Capacitor native shell */
export const isNative = () => !!(window as any).Capacitor?.isNativePlatform?.();

export async function notifyNativeTrack(
  title: string,
  artist: string,
  artwork: string,
  durationMs: number
) {
  if (!isNative()) return;
  try {
    await NyraMedia.updateTrack({ title, artist, artwork, duration: durationMs });
  } catch {}
}

export async function notifyNativePlayback(isPlaying: boolean, positionMs: number) {
  if (!isNative()) return;
  try {
    await NyraMedia.setPlaybackState({ isPlaying, position: positionMs });
  } catch {}
}

export function listenCarCommands(
  onPlay: () => void,
  onPause: () => void,
  onSeek: (ms: number) => void,
  onNext?: () => void,
  onPrevious?: () => void
) {
  if (!isNative()) return () => {};
  const handle = NyraMedia.addListener('carCommand', ({ command, position }) => {
    if (command === 'play') onPlay();
    else if (command === 'pause') onPause();
    else if (command === 'seek') onSeek(position);
    else if (command === 'next') onNext?.();
    else if (command === 'previous') onPrevious?.();
  });
  return () => handle.remove();
}
