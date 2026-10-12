import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, createReadStream, existsSync, mkdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';

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
const DIR = '/tmp/nyra-og';
const FILE_TTL_MS = 15 * 60 * 1000;
const MAX_AUDIO_BYTES = 30 * 1024 * 1024;

/** ffmpeg comes from the ffmpeg-static package; copied to /tmp so it is executable. */
async function ensureFfmpeg(): Promise<string | null> {
  const target = join('/tmp', 'ffmpeg');
  if (existsSync(target)) return target;
  try {
    const mod: any = await import('ffmpeg-static');
    const src: string | null = mod.default || mod;
    if (!src || !existsSync(src)) return null;
    copyFileSync(src, target);
    chmodSync(target, 0o755);
    return target;
  } catch {
    return null;
  }
}

function runFfmpeg(bin: string, args: string[], timeoutMs: number): Promise<{ code: number | null; err: string }> {
  return new Promise((resolve) => {
    const p = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err = (err + d.toString()).slice(-1500); });
    const timer = setTimeout(() => p.kill('SIGKILL'), timeoutMs);
    p.on('error', (e) => { clearTimeout(timer); resolve({ code: -1, err: String(e) }); });
    p.on('close', (code) => { clearTimeout(timer); resolve({ code, err }); });
  });
}

async function downloadAudio(urls: string[], dest: string): Promise<boolean> {
  for (const src of urls) {
    try {
      const r = await fetch(src, { headers: { 'User-Agent': UA, Accept: '*/*', Referer: 'https://www.jiosaavn.com/' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 10_000 || buf.length > MAX_AUDIO_BYTES) continue;
      writeFileSync(dest, buf);
      return true;
    } catch {
      /* try the next quality */
    }
  }
  return false;
}

async function downloadCard(imgUrl: string, origin: string, dest: string): Promise<boolean> {
  try {
    const u = new URL(imgUrl);
    if (u.origin !== origin || u.pathname !== '/api/og-image') return false; // only our own card, never arbitrary URLs
    const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('image/png')) return false;
    writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
    return true;
  } catch {
    return false;
  }
}

const inflight = new Map<string, Promise<string | null>>();

/** Builds (or reuses) an MP4 = still card image + the song's AAC audio. Returns the file path, or null on failure. */
function buildVideo(title: string, artist: string, imgUrl: string, origin: string): Promise<string | null> {
  const key = createHash('sha1').update(`${title}|${artist}|${imgUrl}`).digest('hex').slice(0, 24);
  const out = join(DIR, `${key}.mp4`);
  try {
    if (existsSync(out) && Date.now() - statSync(out).mtimeMs < FILE_TTL_MS && statSync(out).size > 10_000) return Promise.resolve(out);
  } catch { /* rebuild */ }
  const running = inflight.get(key);
  if (running) return running;

  const job = (async (): Promise<string | null> => {
    try {
      mkdirSync(DIR, { recursive: true });
      const ffmpeg = await ensureFfmpeg();
      if (!ffmpeg) return null;
      const match = await resolveSaavn(title, artist);
      if (!match) return null;
      const audio = join(DIR, `${key}.audio`);
      if (!(await downloadAudio(match.urls, audio))) return null;
      const card = join(DIR, `${key}.png`);
      const haveCard = imgUrl ? await downloadCard(imgUrl, origin, card) : false;

      const input = haveCard
        ? ['-loop', '1', '-framerate', '5', '-i', card]
        : ['-f', 'lavfi', '-i', 'color=c=0x07080d:s=1200x630:r=5'];
      const tmp = join(DIR, `${key}.tmp.mp4`);
      const { code, err } = await runFfmpeg(
        ffmpeg,
        ['-hide_banner', '-loglevel', 'error', '-y', ...input, '-i', audio, '-map', '0:v:0', '-map', '1:a:0',
         '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-r', '5',
         '-c:a', 'copy', '-shortest', '-movflags', '+faststart', tmp],
        45000,
      );
      if (code !== 0 || !existsSync(tmp)) {
        console.error('[og-audio] ffmpeg failed', code, err);
        return null;
      }
      renameSync(tmp, out);
      try { unlinkSync(audio); unlinkSync(card); } catch { /* ignore */ }
      return out;
    } catch (e) {
      console.error('[og-audio] build failed', e);
      return null;
    }
  })();
  inflight.set(key, job);
  job.finally(() => inflight.delete(key));
  return job;
}

/** Serves a local file with HTTP Range support (needed for seeking and iOS). */
function serveFile(file: string, req: Request): Response {
  const size = statSync(file).size;
  const headers = new Headers(CORS);
  headers.set('Content-Type', 'video/mp4');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=600');

  let start = 0;
  let end = size - 1;
  let status = 200;
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') || '');
  if (m && (m[1] || m[2])) {
    if (m[1]) {
      start = parseInt(m[1], 10);
      if (m[2]) end = Math.min(parseInt(m[2], 10), size - 1);
    } else {
      start = Math.max(0, size - parseInt(m[2], 10)); // suffix range: last N bytes
    }
    if (start >= size || start > end) {
      headers.set('Content-Range', `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    status = 206;
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  }
  headers.set('Content-Length', String(end - start + 1));
  if (req.method === 'HEAD') return new Response(null, { status, headers });
  const body = Readable.toWeb(createReadStream(file, { start, end })) as unknown as ReadableStream;
  return new Response(body, { status, headers });
}

/** Old behaviour: stream the raw AAC/MP4 audio straight through (used if building the video fails). */
async function passthrough(req: Request, title: string, artist: string): Promise<Response> {
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
      headers.set('Content-Type', 'video/mp4');
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

async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: CORS });

  const url = new URL(req.url);
  const title = url.searchParams.get('title') || '';
  const artist = url.searchParams.get('artist') || url.searchParams.get('channel') || '';
  const img = url.searchParams.get('img') || '';

  if (url.searchParams.get('debug')) {
    // Diagnostics: open /api/og-audio?title=...&artist=...&debug=1 to see where the chain breaks.
    const report: Record<string, unknown> = { title, artist };
    report.ffmpeg = !!(await ensureFfmpeg());
    try {
      const p = new URLSearchParams({ title });
      if (artist) p.set('artist', artist);
      const r = await fetch(`${supabaseUrl()}/functions/v1/saavn-audio?${p}`, { signal: AbortSignal.timeout(9000) });
      const body = await r.text();
      report.saavnFunction = { status: r.status, body: body.slice(0, 300).replace(/https:\/\/[^"\s]+/g, (u) => new URL(u).host + '/…') };
    } catch (e) {
      report.saavnFunction = { error: String(e) };
    }
    const t0 = Date.now();
    const file = await buildVideo(title, artist, img, url.origin);
    report.videoBuilt = !!file;
    report.buildMs = Date.now() - t0;
    if (file) report.videoBytes = statSync(file).size;
    return new Response(JSON.stringify(report, null, 2), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  const file = await buildVideo(title, artist, img, url.origin);
  if (file) return serveFile(file, req);
  return passthrough(req, title, artist);
}

// Node.js runtime web handler (the Edge runtime rejects these modules at deploy time).
export default { fetch: handler };
