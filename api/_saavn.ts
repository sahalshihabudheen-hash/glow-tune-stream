/**
 * Server-side JioSaavn lookup, shared by the share-link endpoints.
 *
 * YouTube blocks audio downloads from server IPs, so (like DJ Mode and the offline downloader)
 * we match the track on JioSaavn through the existing `saavn-audio` Supabase function, which
 * returns direct AAC/MP4 CDN links. Files starting with "_" are helpers, not routes, on Vercel.
 */

// Public project URL (it is already committed in .env). Env vars win if they are set on Vercel.
const FALLBACK_SUPABASE_URL = 'https://nsznavxgjkjlkiicmqmq.supabase.co';

const env = (name: string): string => ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name] || '').trim();

export const supabaseUrl = (): string => (env('VITE_SUPABASE_URL') || env('SUPABASE_URL') || FALLBACK_SUPABASE_URL).replace(/\/$/, '');

export interface SaavnMatch {
  urls: string[];
  matchedTitle?: string;
  matchedArtist?: string;
}

const TTL_MS = 15 * 60 * 1000; // Saavn CDN links expire, so don't keep them long
const cache = new Map<string, { at: number; value: SaavnMatch | null }>();

export async function resolveSaavn(title: string, artist: string, timeoutMs = 9000): Promise<SaavnMatch | null> {
  const t = title.trim().slice(0, 300);
  if (t.length < 2) return null;
  const key = `${t.toLowerCase()}|${artist.trim().toLowerCase()}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  let value: SaavnMatch | null = null;
  try {
    const params = new URLSearchParams({ title: t });
    if (artist.trim()) params.set('artist', artist.trim().slice(0, 200));
    const res = await fetch(`${supabaseUrl()}/functions/v1/saavn-audio?${params}`, { signal: AbortSignal.timeout(timeoutMs) });
    if (res.ok && !(res.headers.get('content-type') || '').includes('text/html')) {
      const data = await res.json();
      const urls = [data?.audioUrl, ...(Array.isArray(data?.fallbackUrls) ? data.fallbackUrls : [])].filter(
        (u: unknown): u is string => typeof u === 'string' && /^https:\/\//.test(u),
      );
      if (urls.length) value = { urls, matchedTitle: data?.matchedTitle, matchedArtist: data?.matchedArtist };
    }
  } catch {
    value = null;
  }

  // Remember "no match" briefly too, so a dead song doesn't hammer the backend.
  cache.set(key, { at: Date.now() - (value ? 0 : TTL_MS - 60_000), value });
  return value;
}
