import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';

/**
 * Vercel serverless version of the Instagram downloader.
 * Routed from /api/instagram/{info,thumb,download} via vercel.json rewrites
 * (the action arrives as ?action=...). Mirrors instagramDownloader.ts used by server.ts.
 *
 * Optional env vars:
 *   INSTAGRAM_COOKIES  Netscape cookie file contents (needed for stories / login-gated posts)
 */

export const config = { maxDuration: 60 };

type Mode = 'audio' | 'video' | 'both';

const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com', 'instagr.am']);
const THUMB_HOST_SUFFIXES = ['.cdninstagram.com', '.fbcdn.net'];
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MAX_FILE_SIZE = '200M';
const INFO_TIMEOUT_MS = 40_000;
const DOWNLOAD_TIMEOUT_MS = 50_000;

class IgError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function normalizeInstagramUrl(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 500) {
    throw new IgError(400, 'invalid_url', 'Paste an Instagram reel, post or story link.');
  }
  let candidate = raw.trim();
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  let u: URL;
  try {
    u = new URL(candidate);
  } catch {
    throw new IgError(400, 'invalid_url', 'That does not look like a valid link.');
  }
  if (!INSTAGRAM_HOSTS.has(u.hostname.toLowerCase())) {
    throw new IgError(400, 'not_instagram', 'Only instagram.com links are supported.');
  }
  const segments = u.pathname.split('/').filter(Boolean);
  const kindIdx = segments.findIndex((s) => ['reel', 'reels', 'p', 'tv'].includes(s));
  if (kindIdx !== -1 && segments[kindIdx + 1] && /^[A-Za-z0-9_-]+$/.test(segments[kindIdx + 1])) {
    const kind = segments[kindIdx] === 'reels' ? 'reel' : segments[kindIdx];
    return `https://www.instagram.com/${kind}/${segments[kindIdx + 1]}/`;
  }
  if (
    segments[0] === 'stories' &&
    segments.length >= 3 &&
    /^[A-Za-z0-9._]+$/.test(segments[1]) &&
    /^\d+$/.test(segments[2])
  ) {
    return `https://www.instagram.com/stories/${segments[1]}/${segments[2]}/`;
  }
  throw new IgError(
    400,
    'unsupported_link',
    'Link must point to a specific reel, post or story (not a profile or the home page).',
  );
}

async function ensureYtDlp(): Promise<string> {
  const bin = path.join('/tmp', 'yt-dlp');
  if (fs.existsSync(bin)) return bin;
  const r = await fetch('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux');
  if (!r.ok) throw new IgError(502, 'tool_unavailable', `Downloader tool unavailable (${r.status}).`);
  fs.writeFileSync(bin, Buffer.from(await r.arrayBuffer()));
  fs.chmodSync(bin, 0o755);
  return bin;
}

/** ffmpeg comes from the ffmpeg-static package; copied to /tmp so it is executable. */
async function ensureFfmpeg(): Promise<string | null> {
  const target = path.join('/tmp', 'ffmpeg');
  if (fs.existsSync(target)) return target;
  try {
    const mod: any = await import('ffmpeg-static');
    const src: string | null = mod.default || mod;
    if (!src || !fs.existsSync(src)) return null;
    fs.copyFileSync(src, target);
    fs.chmodSync(target, 0o755);
    return target;
  } catch {
    return null;
  }
}

function cookiesArgs(): string[] {
  const text = process.env.INSTAGRAM_COOKIES;
  if (!text) return [];
  const file = path.join('/tmp', 'ig-cookies.txt');
  try {
    // yt-dlp may rewrite the jar, so always give it a fresh writable copy.
    fs.writeFileSync(file, text.replace(/\\n/g, '\n'));
    return ['--cookies', file];
  } catch {
    return [];
  }
}

function baseArgs(ffmpeg: string | null): string[] {
  return [
    '--no-playlist',
    '--no-warnings',
    '--no-progress',
    '--no-cache-dir',
    '--user-agent',
    USER_AGENT,
    '--add-header',
    'Accept-Language: en-US,en;q=0.9',
    '--max-filesize',
    MAX_FILE_SIZE,
    ...(ffmpeg ? ['--ffmpeg-location', ffmpeg] : []),
    ...cookiesArgs(),
  ];
}

function run(
  cmd: string,
  args: string[],
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new IgError(504, 'timeout', 'Instagram took too long to respond. Please try again.'));
    }, timeoutMs);
    child.stdout.on('data', (d) => {
      if (stdout.length < 20_000_000) stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      if (stderr.length < 200_000) stderr += d.toString();
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
  });
}

function mapYtDlpError(stderr: string): IgError {
  const s = stderr.toLowerCase();
  if (s.includes('login required') || s.includes('log in') || s.includes('cookies') || s.includes('restricted video')) {
    return new IgError(
      403,
      'login_required',
      'Instagram requires a login to view this. Stories and private accounts only work when the server has a logged-in session.',
    );
  }
  if (s.includes('rate-limit') || s.includes('rate limit') || s.includes('429') || s.includes('too many requests')) {
    return new IgError(429, 'rate_limited', 'Instagram is rate-limiting the server right now. Try again in a few minutes.');
  }
  if (s.includes('private') || s.includes('not available') || s.includes('unavailable') || s.includes('404')) {
    return new IgError(404, 'not_available', 'This post is private, expired or has been removed.');
  }
  if (s.includes('no video') || s.includes('there is no video') || s.includes('no media')) {
    return new IgError(422, 'no_video', 'This post has no video to download (it may be a photo post).');
  }
  if (s.includes('larger than')) {
    return new IgError(413, 'too_large', 'This video is larger than the 200 MB limit.');
  }
  if (s.includes('unsupported url')) {
    return new IgError(400, 'unsupported_link', 'That Instagram link type is not supported.');
  }
  return new IgError(502, 'extract_failed', 'Could not fetch this media. Instagram may have blocked the request, so please try again later.');
}

function safeFileName(title: string, fallback: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || fallback;
}

function sendError(res: any, err: unknown) {
  const e =
    err instanceof IgError
      ? err
      : new IgError(500, 'server_error', (err as Error)?.message || 'Unexpected server error');
  if (!res.headersSent) {
    res.status(e.status).json({ error: e.message, code: e.code });
  }
}

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);

async function handleInfo(req: any, res: any) {
  const url = normalizeInstagramUrl(first(req.query.url));
  const bin = await ensureYtDlp();
  const ffmpeg = await ensureFfmpeg();
  const { stdout, stderr, code } = await run(bin, [...baseArgs(ffmpeg), '-J', '--', url], INFO_TIMEOUT_MS);
  if (code !== 0 || !stdout.trim()) throw mapYtDlpError(stderr);

  let info: any;
  try {
    info = JSON.parse(stdout);
  } catch {
    throw new IgError(502, 'extract_failed', 'Instagram returned an unexpected response.');
  }
  if (Array.isArray(info.entries) && info.entries.length) {
    info = info.entries.find((e: any) => e && (e.formats || e.url)) || info.entries[0];
  }

  const formats: any[] = Array.isArray(info.formats) ? info.formats : [];
  const hasVideo = formats.length
    ? formats.some((f) => f.vcodec && f.vcodec !== 'none')
    : info.vcodec !== 'none' && !!info.url;
  if (!hasVideo) throw new IgError(422, 'no_video', 'This post has no video to download (it may be a photo post).');
  const hasAudio = formats.length ? formats.some((f) => f.acodec && f.acodec !== 'none') : info.acodec !== 'none';

  const title = (info.title || info.description || '').toString().split('\n')[0].slice(0, 120);
  res.status(200).json({
    url,
    id: info.id,
    title: title || `Instagram ${url.includes('/stories/') ? 'story' : 'reel'}`,
    uploader: info.uploader || info.channel || info.uploader_id || null,
    duration: typeof info.duration === 'number' ? Math.round(info.duration) : null,
    thumbnail: info.thumbnail ? `/api/instagram/thumb?src=${encodeURIComponent(info.thumbnail)}` : null,
    hasAudio,
    hasVideo,
  });
}

async function handleThumb(req: any, res: any) {
  let u: URL;
  try {
    u = new URL(String(first(req.query.src) || ''));
  } catch {
    return res.status(400).end();
  }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || !THUMB_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    return res.status(400).end();
  }
  const upstream = await fetch(u.toString(), { headers: { 'User-Agent': USER_AGENT } });
  const type = upstream.headers.get('content-type') || '';
  if (!upstream.ok || !type.startsWith('image/')) return res.status(502).end();
  const buf = Buffer.from(await upstream.arrayBuffer());
  if (buf.length > 5_000_000) return res.status(502).end();
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(buf);
}

async function handleDownload(req: any, res: any) {
  let workDir = '';
  const cleanup = () => {
    if (workDir) {
      const d = workDir;
      workDir = '';
      fs.promises.rm(d, { recursive: true, force: true }).catch(() => {});
    }
  };
  try {
    const url = normalizeInstagramUrl(first(req.query.url));
    const mode = String(first(req.query.mode) || 'both') as Mode;
    if (!['audio', 'video', 'both'].includes(mode)) {
      throw new IgError(400, 'invalid_mode', 'Mode must be audio, video or both.');
    }

    const bin = await ensureYtDlp();
    const ffmpeg = await ensureFfmpeg();
    if (!ffmpeg) {
      throw new IgError(500, 'ffmpeg_missing', 'Audio/video processing is not available on the server (ffmpeg missing).');
    }
    workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'nyra-ig-'));

    const args = [...baseArgs(ffmpeg), '-o', path.join(workDir, 'media.%(ext)s')];
    if (mode === 'audio') {
      args.push('-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '0');
    } else if (mode === 'both') {
      args.push('-f', 'bv*+ba/b', '--merge-output-format', 'mp4');
    } else {
      args.push('-f', 'bv*/b');
    }
    args.push('--', url);

    const { stderr, code } = await run(bin, args, DOWNLOAD_TIMEOUT_MS);
    if (code !== 0) throw mapYtDlpError(stderr);

    const downloaded = (await fs.promises.readdir(workDir)).find((f) => f.startsWith('media.'));
    if (!downloaded) throw new IgError(502, 'extract_failed', 'Download finished but no file was produced.');
    let finalPath = path.join(workDir, downloaded);

    if (mode === 'video') {
      const silent = path.join(workDir, 'video-only.mp4');
      const ff = await run(
        ffmpeg,
        ['-y', '-loglevel', 'error', '-i', finalPath, '-an', '-c:v', 'copy', '-movflags', '+faststart', silent],
        20_000,
      );
      if (ff.code !== 0 || !fs.existsSync(silent)) {
        throw new IgError(500, 'ffmpeg_failed', 'Could not remove the audio track from this video.');
      }
      finalPath = silent;
    }

    const isAudio = mode === 'audio';
    const name = safeFileName(String(first(req.query.title) || ''), `instagram-${mode}`);
    const fileName = `${name}${mode === 'video' ? ' (video only)' : ''}.${isAudio ? 'mp3' : 'mp4'}`;
    const stat = await fs.promises.stat(finalPath);

    res.statusCode = 200;
    res.setHeader('Content-Type', isAudio ? 'audio/mpeg' : 'video/mp4');
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    res.setHeader('Cache-Control', 'no-store');

    const stream = fs.createReadStream(finalPath);
    res.on('close', cleanup);
    stream.on('error', () => {
      cleanup();
      res.destroy();
    });
    stream.pipe(res);
  } catch (err) {
    cleanup();
    throw err;
  }
}

export default async function handler(req: any, res: any) {
  try {
    const action = String(first(req.query.action) || '');
    if (action === 'info') return await handleInfo(req, res);
    if (action === 'thumb') return await handleThumb(req, res);
    if (action === 'download') return await handleDownload(req, res);
    return res.status(404).json({ error: 'Unknown action', code: 'not_found' });
  } catch (err) {
    return sendError(res, err);
  }
}
