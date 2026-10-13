/**
 * Bridge between the web player and the native Android app (system media controls, lock screen,
 * Bluetooth / car buttons).
 *
 *  - Native Kotlin app (android-app/)  -> `window.NyraAndroid`, injected by the app's WebMessageListener.
 *      page -> app : NyraAndroid.postMessage(JSON string)
 *      app -> page : 'message' events whose `data` is a JSON string
 *  - Legacy Capacitor app (android/)   -> `window.Capacitor` + the "NyraMedia" plugin
 *
 * In a normal browser neither exists, so every function here is a harmless no-op.
 */

interface NativeMessageEvent {
  data: string;
}

interface NyraAndroidPort {
  postMessage(message: string): void;
  addEventListener(type: 'message', listener: (event: NativeMessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: NativeMessageEvent) => void): void;
}

interface CapacitorNyraMedia {
  updateTrack(options: { title: string; artist: string; artwork: string; duration: number }): Promise<void>;
  setPlaybackState(options: { isPlaying: boolean; position: number }): Promise<void>;
  addListener(event: 'carCommand', handler: (data: { command: string; position: number }) => void): { remove(): void };
}

const androidPort = (): NyraAndroidPort | undefined => (window as any).NyraAndroid;

let capacitorPlugin: CapacitorNyraMedia | undefined;
const capacitorMedia = (): CapacitorNyraMedia | undefined => {
  const cap = (window as any).Capacitor;
  if (!cap?.isNativePlatform?.() || typeof cap.registerPlugin !== 'function') return undefined;
  if (!capacitorPlugin) capacitorPlugin = cap.registerPlugin('NyraMedia') as CapacitorNyraMedia;
  return capacitorPlugin;
};

/** True when running inside a native app shell (the Kotlin app or the legacy Capacitor app). */
export const isNative = () => !!androidPort() || !!(window as any).Capacitor?.isNativePlatform?.();

export async function notifyNativeTrack(
  title: string,
  artist: string,
  artwork: string,
  durationMs: number
) {
  try {
    const port = androidPort();
    if (port) {
      port.postMessage(JSON.stringify({ type: 'track', title, artist, artwork, duration: durationMs }));
      return;
    }
    await capacitorMedia()?.updateTrack({ title, artist, artwork, duration: durationMs });
  } catch {}
}

export async function notifyNativePlayback(isPlaying: boolean, positionMs: number) {
  try {
    const port = androidPort();
    if (port) {
      port.postMessage(JSON.stringify({ type: 'playback', isPlaying, position: positionMs }));
      return;
    }
    await capacitorMedia()?.setPlaybackState({ isPlaying, position: positionMs });
  } catch {}
}

/** Tells the app whether the current song is a favourite, so the heart on the notification matches. */
export async function notifyNativeLiked(liked: boolean) {
  try {
    androidPort()?.postMessage(JSON.stringify({ type: 'liked', value: liked }));
  } catch {}
}

export function listenCarCommands(
  onPlay: () => void,
  onPause: () => void,
  onSeek: (ms: number) => void,
  onNext?: () => void,
  onPrevious?: () => void,
  onToggleFavorite?: () => void
) {
  const dispatch = (command: string, position: number) => {
    if (command === 'play') onPlay();
    else if (command === 'pause') onPause();
    else if (command === 'seek') onSeek(position);
    else if (command === 'next') onNext?.();
    else if (command === 'previous') onPrevious?.();
    else if (command === 'like') onToggleFavorite?.();
  };

  const port = androidPort();
  if (port) {
    const handler = (event: NativeMessageEvent) => {
      try {
        const { command, position } = JSON.parse(event.data);
        dispatch(command, Number(position) || 0);
      } catch {}
    };
    port.addEventListener('message', handler);
    // The app can only reply to the page after the page has messaged it once.
    port.postMessage(JSON.stringify({ type: 'hello' }));
    return () => port.removeEventListener('message', handler);
  }

  const plugin = capacitorMedia();
  if (!plugin) return () => {};
  const handle = plugin.addListener('carCommand', ({ command, position }) => dispatch(command, position));
  return () => handle.remove();
}
