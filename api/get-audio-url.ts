import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export const config = { maxDuration: 60 };

const cors = (res: any) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type, range');
  res.setHeader('Access-Control-Expose-Headers', 'content-length, content-range, accept-ranges, content-type, content-disposition');
};

const cleanId = (raw = '') => {
  const match = raw.match(/(?:v=|\/|embed\/|shorts\/|^)([a-zA-Z0-9_-]{11})/);
  return (match?.[1] || raw).replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 11);
};

const safeTitle = (title = 'audio') => title.replace(/[^\w\s-]/g, '').trim() || 'audio';

const looksLikeAudio = (contentType: string | null) => {
  const type = (contentType || '').toLowerCase();
  return type.startsWith('audio/') || type.includes('video/') || type.includes('octet-stream');
};

async function searchVideoIdByTitle(title: string): Promise<string | null> {
  const query = safeTitle(title);
  if (!query || query.toLowerCase() === 'audio') return null;

  try {
    const piped = await fetch(`https://api.piped.private.coffee/search?q=${encodeURIComponent(query)}&filter=videos`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (piped.ok) {
      const data = await piped.json();
      const item = data?.items?.find((entry: any) => entry?.type === 'stream' && /watch\?v=/.test(entry?.url || ''));
      const id = item?.url?.match(/[?&]v=([a-zA-Z0-9_-]{11})/)?.[1];
      if (id) return id;
    }
  } catch { /* try html search */ }

  try {
    const html = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    }).then((r) => r.text());
    return html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/)?.[1] || null;
  } catch {
    return null;
  }
}

async function ensureYtDlp() {
  const bin = path.join('/tmp', 'yt-dlp');
  if (fs.existsSync(bin)) return bin;
  const r = await fetch('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux');
  if (!r.ok) throw new Error(`yt-dlp unavailable (${r.status})`);
  fs.writeFileSync(bin, Buffer.from(await r.arrayBuffer()));
  fs.chmodSync(bin, 0o755);
  return bin;
}

async function resolveYtDlp(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  try {
    const bin = await ensureYtDlp();
    return await new Promise((resolve) => {
      const child = spawn(bin, [
        '--no-playlist',
        '--extractor-args', 'youtube:player_client=ios,web,android',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        '-f', 'bestaudio[ext=m4a]/bestaudio/best',
        '-g',
        `https://www.youtube.com/watch?v=${videoId}`,
      ]);
      let out = '';
      const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(null); }, 25_000);
      child.stdout.on('data', (d) => { out += d.toString(); });
      child.on('error', () => { clearTimeout(timer); resolve(null); });
      child.on('close', () => {
        clearTimeout(timer);
        const url = out.split('\n').find((line) => line.startsWith('http'));
        resolve(url ? { url, mimeType: url.includes('mime=audio%2Fmp4') ? 'audio/mp4' : 'audio/webm' } : null);
      });
    });
  } catch {
    return null;
  }
}

async function streamProxy(req: any, res: any, sourceUrl: string, mimeType = 'audio/webm', download = false, title = 'audio') {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    Accept: '*/*',
  };
  if (req.headers.range) headers.Range = req.headers.range;
  const upstream = await fetch(sourceUrl, { headers, redirect: 'follow' });
  if (!upstream.ok && upstream.status !== 206) throw new Error(`Upstream ${upstream.status}`);

  const reader = upstream.body?.getReader();
  const first = reader ? await reader.read() : null;
  const firstBytes = first?.value ? Buffer.from(first.value) : Buffer.alloc(0);
  const firstText = firstBytes.subarray(0, 96).toString('utf8').trim().toLowerCase();
  const upstreamType = upstream.headers.get('content-type');
  if (!firstBytes.length || firstText.startsWith('<!doctype') || firstText.startsWith('<html') || firstText.startsWith('{"error"') || !looksLikeAudio(upstreamType || mimeType)) {
    try { await reader?.cancel(); } catch { /* ignore */ }
    throw new Error('Resolved URL was not an audio stream');
  }

  cors(res);
  const type = (upstreamType || mimeType).split(';')[0];
  res.setHeader('Content-Type', type);
  res.setHeader('Accept-Ranges', 'bytes');
  if (download) res.setHeader('Content-Disposition', `attachment; filename="${safeTitle(title)}.${type.includes('mp4') ? 'm4a' : 'webm'}"`);
  const len = upstream.headers.get('content-length');
  const range = upstream.headers.get('content-range');
  if (len) res.setHeader('Content-Length', len);
  if (range) res.setHeader('Content-Range', range);
  res.status(upstream.status);
  if (firstBytes.length) res.write(firstBytes);
  if (!reader) return res.end();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(Buffer.from(value));
  }
  res.end();
}

export default async function handler(req: any, res: any) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const proxyUrl = Array.isArray(req.query.proxyUrl) ? req.query.proxyUrl[0] : req.query.proxyUrl;
    const title = String(Array.isArray(req.query.title) ? req.query.title[0] : req.query.title || 'audio');
    const download = req.query.download === '1';
    if (proxyUrl) return streamProxy(req, res, String(proxyUrl), '', download, title);

    let videoId = cleanId(String(req.query.videoId || req.query.id || ''));
    if (videoId.length !== 11) return res.status(400).json({ error: 'Video ID required' });
    let info = await resolveYtDlp(videoId);
    if (!info) {
      const replacementId = await searchVideoIdByTitle(title);
      if (replacementId && replacementId !== videoId) {
        const replacementInfo = await resolveYtDlp(replacementId);
        if (replacementInfo) {
          videoId = replacementId;
          info = replacementInfo;
        }
      }
    }
    if (!info) return res.status(500).json({ error: 'Audio stream unavailable', videoId });
    if (req.query.stream === '1' || download) {
      try {
        return await streamProxy(req, res, info.url, info.mimeType, download, title);
      } catch (streamError) {
        const replacementId = await searchVideoIdByTitle(title);
        if (replacementId && replacementId !== videoId) {
          const replacementInfo = await resolveYtDlp(replacementId);
          if (replacementInfo) return streamProxy(req, res, replacementInfo.url, replacementInfo.mimeType, download, title);
        }
        throw streamError;
      }
    }
    return res.status(200).json({ audioUrl: info.url, audioUrl1: info.url, mimeType: info.mimeType, success: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Audio resolver failed' });
  }
}