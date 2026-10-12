import { resolveSaavn } from './_saavn';

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

  const match = await resolveSaavn(title, artist);
  if (!match) return new Response('No audio found for this song', { status: 404, headers: CORS });

  const range = req.headers.get('range');
  for (const src of match.urls) {
    try {
      const upstream = await fetch(src, {
        method: req.method,
        headers: { 'User-Agent': UA, Accept: '*/*', ...(range ? { Range: range } : {}) },
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
