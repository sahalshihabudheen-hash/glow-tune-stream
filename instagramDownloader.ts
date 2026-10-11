import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import type { Express, Request, Response } from 'express';

/**
 * Instagram reel / post / story downloader.
 *
 * Endpoints:
 *   GET /api/instagram/info?url=...                 -> metadata + preview
 *   GET /api/instagram/thumb?src=...                -> thumbnail proxy (Instagram CDN only)
 *   GET /api/instagram/download?url=...&mode=...    -> mode = audio | video | both
 *
 * Uses the same standalone yt-dlp binary the rest of the server already uses,
 * plus ffmpeg (must be installed on the host) for MP3 conversion / stripping audio.
 *
 * Only publicly accessible media works by default. Stories almost always need a
 * logged-in session: put a Netscape-format cookie export in `instagram-cookies.txt`
 * (or set INSTAGRAM_COOKIES_PATH). Never commit that file.
 */

type Mode = 'audio' | 'video' | 'both';

const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com', 'instagr.am']);
const THUMB_HOST_SUFFIXES = ['.cdninstagram.com', '.fbcdn.net'];
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const MAX_FILE_SIZE = '200M';
const INFO_TIMEOUT_MS = 45_000;
const DOWNLOAD_TIMEOUT_MS = 180_000;
const MAX_CONCURRENT_JOBS = 3;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 12;

let activeJobs = 0;
const hits = new Map<string, number[]>();

class IgError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Validates and normalises an Instagram media URL. Throws IgError if not acceptable. */
export function normalizeInstagramUrl(raw: unknown): string {
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
  // /reel/ID, /reels/ID, /p/ID, /tv/ID, /<user>/reel/ID, /<user>/p/ID
  const kindIdx = segments.findIndex((s) => ['reel', 'reels', 'p', 'tv'].includes(s));
  if (kindIdx !== -1 && segments[kindIdx + 1] && /^[A-Za-z0-9_-]+$/.test(segments[kindIdx + 1])) {
    const kind = segments[kindIdx] === 'reels' ? 'reel' : segments[kindIdx];
    return `https://www.instagram.com/${kind}/${segments[kindIdx + 1]}/`;
  }
  // /stories/<username>/<numeric id>  or  /stories/highlights/<numeric id>
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

function cookiesArgs(): string[] {
  const candidates = [
    process.env.INSTAGRAM_COOKIES_PATH,
    path.join(process.cwd(), 'instagram-cookies.txt'),
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    if (fs.existsSync(p)) return ['--cookies', p];
  }
  return [];
}

function baseArgs(): string[] {
  return [
    '--no-playlist',
    '--no-warnings',
    '--no-progress',
    '--user-agent',
    USER_AGENT,
    '--add-header',
    'Accept-Language: en-US,en;q=0.9',
    '--max-filesize',
    MAX_FILE_SIZE,
    ...cookiesArgs(),
  ];
}

function runProcess(
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
  if (s.includes('file is larger than max-filesize') || s.includes('larger than')) {
    return new IgError(413, 'too_large', 'This video is larger than the 200 MB limit.');
  }
  if (s.includes('unsupported url')) {
    return new IgError(400, 'unsupported_link', 'That Instagram link type is not supported.');
  }
  return new IgError(502, 'extract_failed', 'Could not fetch this media. Instagram may have blocked the request, so please try again later.');
}

function clientIp(req: Request): string {
  return (req.ip || req.socket.remoteAddress || 'unknown').toString();
}

function checkRateLimit(req: Request) {
  const ip = clientIp(req);
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    throw new IgError(429, 'too_many_requests', 'Too many requests. Please wait a minute and try again.');
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < RATE_LIMIT_WINDOW_MS)) hits.delete(k);
  }
}

function safeFileName(title: string, fallback: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || fallback;
}

function sendError(res: Response, err: unknown) {
  const e =
    err instanceof IgError
      ? err
      : new IgError(500, 'server_error', (err as Error)?.message || 'Unexpected server error');
  if (!res.headersSent) {
    res.status(e.status).json({ error: e.message, code: e.code });
  }
}

async function removeDir(dir: string) {
  try {
    await fs.promises.rm(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

export function registerInstagramRoutes(app: Express, ensureYtDlpInstalled: () => Promise<string>) {
  const ytDlp = async () => {
    await ensureYtDlpInstalled();
    return path.join(process.cwd(), 'yt-dlp');
  };

  // ---- Metadata ----
  app.get('/api/instagram/info', async (req, res) => {
    try {
      checkRateLimit(req);
      const url = normalizeInstagramUrl(req.query.url);
      const bin = await ytDlp();
      const { stdout, stderr, code } = await runProcess(
        'python3',
        [bin, ...baseArgs(), '-J', '--', url],
        INFO_TIMEOUT_MS,
      );
      if (code !== 0 || !stdout.trim()) throw mapYtDlpError(stderr);

      let info: any;
      try {
        info = JSON.parse(stdout);
      } catch {
        throw new IgError(502, 'extract_failed', 'Instagram returned an unexpected response.');
      }
      // Carousel posts come back as a playlist; use the first entry that has video.
      if (Array.isArray(info.entries) && info.entries.length) {
        info = info.entries.find((e: any) => e && (e.formats || e.url)) || info.entries[0];
      }

      const formats: any[] = Array.isArray(info.formats) ? info.formats : [];
      const hasVideo = formats.length
        ? formats.some((f) => f.vcodec && f.vcodec !== 'none')
        : info.vcodec !== 'none' && !!info.url;
      if (!hasVideo) throw new IgError(422, 'no_video', 'This post has no video to download (it may be a photo post).');

      const hasAudio = formats.length
        ? formats.some((f) => f.acodec && f.acodec !== 'none')
        : info.acodec !== 'none';

      const title = (info.title || info.description || '').toString().split('\n')[0].slice(0, 120);
      res.json({
        url,
        id: info.id,
        title: title || `Instagram ${url.includes('/stories/') ? 'story' : 'reel'}`,
        uploader: info.uploader || info.channel || info.uploader_id || null,
        duration: typeof info.duration === 'number' ? Math.round(info.duration) : null,
        thumbnail: info.thumbnail ? `/api/instagram/thumb?src=${encodeURIComponent(info.thumbnail)}` : null,
        hasAudio,
        hasVideo,
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ---- Thumbnail proxy (Instagram CDN blocks hotlinking with a Referer) ----
  app.get('/api/instagram/thumb', async (req, res) => {
    try {
      const src = String(req.query.src || '');
      let u: URL;
      try {
        u = new URL(src);
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
      res.send(buf);
    } catch {
      res.status(502).end();
    }
  });

  // ---- Download ----
  app.get('/api/instagram/download', async (req, res) => {
    let workDir = '';
    let counted = false;
    try {
      checkRateLimit(req);
      const url = normalizeInstagramUrl(req.query.url);
      const mode = String(req.query.mode || 'both') as Mode;
      if (!['audio', 'video', 'both'].includes(mode)) {
        throw new IgError(400, 'invalid_mode', 'Mode must be audio, video or both.');
      }
      if (activeJobs >= MAX_CONCURRENT_JOBS) {
        throw new IgError(503, 'busy', 'The server is busy with other downloads. Try again in a moment.');
      }
      activeJobs++;
      counted = true;

      const bin = await ytDlp();
      workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'nyra-ig-'));
      const outTemplate = path.join(workDir, 'media.%(ext)s');

      const args = [bin, ...baseArgs(), '-o', outTemplate];
      if (mode === 'audio') {
        args.push('-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '0');
      } else if (mode === 'both') {
        args.push('-f', 'bv*+ba/b', '--merge-output-format', 'mp4');
      } else {
        args.push('-f', 'bv*/b');
      }
      args.push('--', url);

      const { stderr, code } = await runProcess('python3', args, DOWNLOAD_TIMEOUT_MS);
      if (code !== 0) throw mapYtDlpError(stderr);

      const files = await fs.promises.readdir(workDir);
      const downloaded = files.find((f) => f.startsWith('media.'));
      if (!downloaded) throw new IgError(502, 'extract_failed', 'Download finished but no file was produced.');
      let finalPath = path.join(workDir, downloaded);

      // Video only: strip the audio track without re-encoding.
      if (mode === 'video') {
        const silentPath = path.join(workDir, 'video-only.mp4');
        const ff = await runProcess(
          'ffmpeg',
          ['-y', '-loglevel', 'error', '-i', finalPath, '-an', '-c:v', 'copy', '-movflags', '+faststart', silentPath],
          DOWNLOAD_TIMEOUT_MS,
        );
        if (ff.code !== 0 || !fs.existsSync(silentPath)) {
          throw new IgError(500, 'ffmpeg_failed', 'Could not remove the audio track. Is ffmpeg installed on the server?');
        }
        finalPath = silentPath;
      }

      const isAudio = mode === 'audio';
      const ext = isAudio ? 'mp3' : 'mp4';
      const fallback = `instagram-${mode}`;
      const name = safeFileName(String(req.query.title || ''), fallback);
      const suffix = mode === 'video' ? ' (video only)' : '';
      const fileName = `${name}${suffix}.${ext}`;

      const stat = await fs.promises.stat(finalPath);
      res.setHeader('Content-Type', isAudio ? 'audio/mpeg' : 'video/mp4');
      res.setHeader('Content-Length', stat.size);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      );
      res.setHeader('Cache-Control', 'no-store');

      const stream = fs.createReadStream(finalPath);
      const cleanup = () => {
        if (workDir) {
          const d = workDir;
          workDir = '';
          void removeDir(d);
        }
      };
      res.on('close', cleanup);
      stream.on('error', () => {
        cleanup();
        res.destroy();
      });
      stream.pipe(res);
    } catch (err) {
      if (workDir) await removeDir(workDir);
      workDir = '';
      sendError(res, err);
    } finally {
      if (counted) activeJobs--;
    }
  });
}
