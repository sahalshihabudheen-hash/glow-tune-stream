import { resolveSaavnStream } from '@/lib/saavnSource';

const DJ_STREAM_PROBE_TIMEOUT_MS = 6500;
const YOUTUBE_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

const AUDIO_URL_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-audio-url`;

export const getDjStreamUrl = (videoId: string, options?: { stream?: boolean; title?: string }) => {
  const params = new URLSearchParams({ videoId });
  if (options?.stream) params.set('stream', '1');
  if (options?.title) params.set('title', options.title);
  return `${AUDIO_URL_BASE}?${params.toString()}`;
};

export async function canUseDjModeTrack(
  videoId: string,
  track?: { title?: string; channel?: string }
): Promise<boolean> {
  // JioSaavn first: its CDN is CORS-open, so it can be processed in real time by the DJ engine.
  if (track?.title) {
    const saavn = await resolveSaavnStream({ id: videoId, title: track.title, channel: track.channel });
    if (saavn) return true;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), DJ_STREAM_PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(getDjStreamUrl(videoId, { stream: true }), {
      signal: controller.signal,
      headers: { Range: 'bytes=0-1' },
    });
    return response.ok || response.status === 206;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function filterDjModeTracks<T extends { id: string }>(
  tracks: T[],
  limit = tracks.length
): Promise<T[]> {
  const uniqueTracks = getLikelyDjModeTracks(tracks, limit);

  const checked = await Promise.all(
    uniqueTracks.map(async track => (
      await canUseDjModeTrack(track.id, track as { title?: string; channel?: string }) ? track : null
    ))
  );

  return checked.filter(Boolean) as T[];
}

export function getLikelyDjModeTracks<T extends { id: string; title?: string }>(
  tracks: T[],
  limit = tracks.length
): T[] {
  return tracks
    .filter((track, index, all) => (
      YOUTUBE_VIDEO_ID_RE.test(track.id) &&
      Boolean(track.title?.trim()) &&
      all.findIndex(candidate => candidate.id === track.id) === index
    ))
    .slice(0, limit);
}
