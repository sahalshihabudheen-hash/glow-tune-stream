// Song lookup helper, inlined so the function has no relative imports (ESM + Vercel Node can't resolve them).
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

const supabaseUrl = (): string => (env('VITE_SUPABASE_URL') || env('SUPABASE_URL') || FALLBACK_SUPABASE_URL).replace(/\/$/, '');

interface SaavnMatch {
  urls: string[];
  matchedTitle?: string;
  matchedArtist?: string;
}

const TTL_MS = 15 * 60 * 1000; // Saavn CDN links expire, so don't keep them long
const cache = new Map<string, { at: number; value: SaavnMatch | null }>();

async function resolveSaavn(title: string, artist: string, timeoutMs = 9000): Promise<SaavnMatch | null> {
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


/**
 * Playable audio for share-link embeds (Discord plays og:video when it is a real MP4 file).
 *
 * GET /api/og-audio?title=...&artist=...
 * Finds the song on JioSaavn and streams its AAC/MP4 file through this URL, so the link never
 * goes stale (Saavn CDN links expire) and Range requests (seeking, iPhone) keep working.
 */

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'range, content-type',
  'Access-Control-Expose-Headers': 'content-length, content-range, accept-ranges, content-type',
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: CORS });

  const url = new URL(req.url);
  const title = url.searchParams.get('title') || '';
  const artist = url.searchParams.get('artist') || url.searchParams.get('channel') || '';

  if (url.searchParams.get('debug')) {
    // Diagnostics: open /api/og-audio?title=...&artist=...&debug=1 to see where the audio chain breaks.
    const report: Record<string, unknown> = { title, artist };
    try {
      const p = new URLSearchParams({ title });
      if (artist) p.set('artist', artist);
      const r = await fetch(`${supabaseUrl()}/functions/v1/saavn-audio?${p}`, { signal: AbortSignal.timeout(9000) });
      const body = await r.text();
      report.saavnFunction = { status: r.status, contentType: r.headers.get('content-type'), body: body.slice(0, 300).replace(/https:\/\/[^"\s]+/g, (u) => new URL(u).host + '/…') };
    } catch (e) {
      report.saavnFunction = { error: String(e) };
    }
    const m = await resolveSaavn(title, artist);
    report.matched = !!m;
    report.upstream = [];
    for (const src of m?.urls || []) {
      try {
        const r = await fetch(src, { headers: { 'User-Agent': UA, Referer: 'https://www.jiosaavn.com/', Range: 'bytes=0-1' }, redirect: 'follow' });
        (report.upstream as unknown[]).push({ host: new URL(src).host, status: r.status, type: r.headers.get('content-type'), length: r.headers.get('content-length'), range: r.headers.get('content-range') });
      } catch (e) {
        (report.upstream as unknown[]).push({ host: new URL(src).host, error: String(e) });
      }
    }
    return new Response(JSON.stringify(report, null, 2), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  const match = await resolveSaavn(title, artist);
  if (!match) return new Response('No audio found for this song', { status: 404, headers: CORS });

  const range = req.headers.get('range');
  for (const src of match.urls) {
    try {
      const upstream = await fetch(src, {
        method: req.method,
        headers: { 'User-Agent': UA, Accept: '*/*', Referer: 'https://www.jiosaavn.com/', ...(range ? { Range: range } : {}) },
        redirect: 'follow',
      });
      if (!upstream.ok && upstream.status !== 206) continue;

      const headers = new Headers(CORS);
      headers.set('Content-Type', 'video/mp4'); // AAC in an MP4 container; Discord's player wants an mp4
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Cache-Control', 'public, max-age=600');
      const len = upstream.headers.get('content-length');
      const cr = upstream.headers.get('content-range');
      if (len) headers.set('Content-Length', len);
      if (cr) headers.set('Content-Range', cr);

      return new Response(req.method === 'HEAD' ? null : upstream.body, { status: upstream.status, headers });
    } catch {
      /* try the next quality */
    }
  }
  return new Response('Audio source unavailable', { status: 502, headers: CORS });
}

// Node.js runtime web handler (the Edge runtime rejects these modules at deploy time).
export default { fetch: handler };
