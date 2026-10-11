// JioSaavn audio source for DJ Mode.
//
// The `saavn-audio` backend function matches a (YouTube-style) track to the
// JioSaavn catalogue and returns direct CDN URLs. That CDN is CORS-open, so an
// <audio crossOrigin="anonymous"> element can be routed through the Web Audio
// API (required for real-time L/R, EQ and bass processing).
//
// This reuses the exact same function the offline downloader already uses.

export interface SaavnTrackInput {
  id: string;
  title: string;
  channel?: string;
  artist?: string;
  duration?: number;
}

export interface SaavnResolved {
  urls: string[];
  matchedTitle?: string;
  matchedArtist?: string;
}

const CACHE_TTL_MS = 20 * 60 * 1000; // CDN links are signed/expiring, keep short
const cache = new Map<string, { at: number; value: SaavnResolved | null }>();
const inflight = new Map<string, Promise<SaavnResolved | null>>();

const endpoint = () => {
  const base = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  return base ? `${base}/functions/v1/saavn-audio` : '';
};

export async function resolveSaavnStream(track: SaavnTrackInput): Promise<SaavnResolved | null> {
  const base = endpoint();
  if (!base || !track.title || track.title.trim().length < 2) return null;

  const hit = cache.get(track.id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const pending = inflight.get(track.id);
  if (pending) return pending;

  const run = (async (): Promise<SaavnResolved | null> => {
    try {
      const params = new URLSearchParams();
      params.set('title', track.title);
      const artist = track.artist || track.channel;
      if (artist) params.set('artist', artist);
      if (track.duration) params.set('duration', String(Math.round(track.duration)));

      const res = await fetch(`${base}?${params.toString()}`, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return null;
      if ((res.headers.get('content-type') || '').includes('text/html')) return null;
      const data = await res.json();
      const urls: string[] = [data?.audioUrl, ...(Array.isArray(data?.fallbackUrls) ? data.fallbackUrls : [])]
        .filter((u: unknown): u is string => typeof u === 'string' && /^https:\/\//.test(u));
      if (!urls.length) return null;
      return { urls, matchedTitle: data?.matchedTitle, matchedArtist: data?.matchedArtist };
    } catch {
      return null;
    }
  })();

  inflight.set(track.id, run);
  try {
    const value = await run;
    cache.set(track.id, { at: Date.now(), value });
    return value;
  } finally {
    inflight.delete(track.id);
  }
}
