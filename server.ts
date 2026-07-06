process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

function getServerPort() {
  const cliPortIndex = process.argv.findIndex((arg) => arg === '--port' || arg === '-p');
  const cliPort = cliPortIndex >= 0 ? process.argv[cliPortIndex + 1] : undefined;
  const parsedPort = Number(process.env.PORT || cliPort || 3000);
  return Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000;
}

const PORT = getServerPort();

const COBALT_INSTANCES = [
  'https://api.cobalt.tools',
  'https://co.wuk.sh',
  'https://cobalt.api.ryboflops.lol',
  'https://cobalt.k6.ovh',
  'https://cobalt.shite.xyz',
  'https://cobalt.smartit.nu',
  'https://cobalt.drgns.space',
  'https://c.onon.app',
  'https://co.v6.sh',
  'https://cobalt.instgrm.lol',
  'https://cobalt.nyx.moe',
  'https://cobalt.q69.de',
  'https://co.dispp.li'
];

const PIPED_INSTANCES = [
  'https://api.piped.private.coffee',
  'https://pipedapi.kavin.rocks',
  'https://piped-api.lre.yt',
  'https://pipedapi.cl7.it',
  'https://piped-api.hostux.net',
  'https://pipedapi.adminforge.de',
  'https://api-piped.mha.fi',
  'https://pipedapi.swish.re',
  'https://pipedapi.spirit.com.de',
  'https://pipedapi.leptons.xyz',
  'https://api.piped.projectsegfau.lt',
  'https://pipedapi.moomoo.me',
  'https://pipedapi.river.rocks'
];

const INVIDIOUS_INSTANCES = [
  'https://yewtu.be',
  'https://invidious.flokinet.to',
  'https://invidious.projectsegfau.lt',
  'https://invidious.lre.yt',
  'https://invidious.slipfox.xyz',
  'https://invidious.nerdvpn.de',
  'https://inv.tux.im'
];

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const getTimeoutSignal = (ms: number) => {
  try {
    return AbortSignal.timeout(ms);
  } catch {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  }
};

async function safelyParseJson<T = any>(res: Response): Promise<T | null> {
  try {
    const text = await res.text();
    if (!text || text.trim() === '') return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function looksLikeAudio(contentType: string | null) {
  const type = (contentType || '').toLowerCase();
  return type.startsWith('audio/') || type.startsWith('video/') || type.includes('octet-stream');
}

function assertAudioBytes(bytes: Buffer, contentType: string | null) {
  const type = (contentType || '').toLowerCase();
  const head = bytes.subarray(0, 160).toString('utf8').trim().toLowerCase();
  if (!bytes.length) throw new Error('No audio bytes received');
  if (
    head.startsWith('<!doctype') ||
    head.startsWith('<html') ||
    head.startsWith('{"error"') ||
    head.startsWith('{"message"') ||
    head.includes('<body') ||
    type.includes('text/html') ||
    type.includes('application/json') ||
    !looksLikeAudio(type)
  ) {
    throw new Error('Provider returned non-audio content');
  }
}

function safeAudioTitle(title: string) {
  return (title || 'audio').replace(/[^\w\s-]/g, '').trim() || 'audio';
}

async function searchVideoIdByTitle(title: string): Promise<string | null> {
  const query = safeAudioTitle(title);
  if (!query || query.toLowerCase() === 'audio') return null;

  try {
    const piped = await fetch(`https://api.piped.private.coffee/search?q=${encodeURIComponent(query)}&filter=videos`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: getTimeoutSignal(8000),
    });
    if (piped.ok) {
      const data = await safelyParseJson<any>(piped);
      const item = data?.items?.find((entry: any) => entry?.type === 'stream' && /watch\?v=/.test(entry?.url || ''));
      const id = item?.url?.match(/[?&]v=([a-zA-Z0-9_-]{11})/)?.[1];
      if (id) return id;
    }
  } catch { /* try YouTube HTML search */ }

  try {
    const html = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: getTimeoutSignal(8000),
    }).then((r) => r.text());
    return html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/)?.[1] || null;
  } catch {
    return null;
  }
}

async function getInvidiousStreamInfo(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  // Layer 0: Prioritized proven high-performance Invidious Instance
  console.log(`[Express Server] Attempting prioritized Invidious resolution for ${videoId}`);
  const prioritizedInvidious = [
    'https://inv.thepixora.com',
    'https://yewtu.be',
    'https://invidious.projectsegfau.lt'
  ];

  for (const inst of prioritizedInvidious) {
    try {
      const testUrl = `${inst}/latest_version?id=${videoId}&local=true&itag=140`;
      const testRes = await fetch(testUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        signal: getTimeoutSignal(5000)
      });
      if (testRes.status === 200 || testRes.status === 206) {
        console.log(`[Express Server] Priority success via Invidious latest_version proxy: ${inst}`);
        return { url: testRes.url, mimeType: 'audio/mp4' };
      }
    } catch (e: any) {
      console.warn(`[Express Server] Priority fallback instance ${inst} failed: ${e.message}`);
    }
  }

  // Layer 1: Dynamic Invidious Registry Fallback
  try {
    console.log(`[Express Server] Fetching live Invidious registry...`);
    const regRes = await fetch('https://api.invidious.io/instances.json', { signal: getTimeoutSignal(5000) });
    if (regRes.ok) {
      const data = await safelyParseJson<any>(regRes);
      if (data) {
        const upInstances = data
          .map((item: any) => ({
            domain: item[0],
            uri: item[1].uri || `https://${item[0]}`,
            down: item[1].monitor?.down,
            status: item[1].monitor?.last_status
          }))
          .filter((inst: any) => !inst.down && inst.status === 200 && !prioritizedInvidious.includes(inst.uri));

        console.log(`[Express Server] Found ${upInstances.length} live dynamic Invidious candidates.`);
        const shuffledUp = shuffle(upInstances);
        for (const inst of shuffledUp.slice(0, 4)) {
          try {
            const testUrl = `${inst.uri}/latest_version?id=${videoId}&local=true&itag=140`;
            const testRes = await fetch(testUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
              },
              signal: getTimeoutSignal(5000)
            });
            if (testRes.status === 200 || testRes.status === 206) {
              console.log(`[Express Server] Dynamic success via Invidious latest_version proxy: ${inst.uri}`);
              return { url: testRes.url, mimeType: 'audio/mp4' };
            }
          } catch (e: any) {
            console.warn(`[Express Server] Dynamic instance ${inst.uri} failed: ${e.message}`);
          }
        }
      }
    }
  } catch (err: any) {
    console.error(`[Express Server] Dynamic Invidious registry fetch failed: ${err.message}`);
  }

  return null;
}

async function getCobaltStreamInfo(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  // Layer 2: Cobalt Extractors
  console.log(`[Express Server] Attempting Cobalt resolution for ${videoId}`);
  const shuffledCobalt = shuffle(COBALT_INSTANCES);
  for (const inst of shuffledCobalt.slice(0, 7)) {
    const endpoints = [`${inst}/api/json`, `${inst}/`].filter(Boolean);
    for (const endpoint of endpoints) {
      try {
        // Modern Cobalt v10 format: only accepts clean music flags to avoid 400 Bad Request error
        let res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          body: JSON.stringify({
            url: `https://www.youtube.com/watch?v=${videoId}`,
            downloadMode: 'audio',
            audioFormat: 'mp3',
            audioQuality: '128'
          }),
          signal: getTimeoutSignal(8000)
        });

        if (!res.ok) {
          // Legacy Cobalt format: wants isAudioOnly
          res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify({
              url: `https://www.youtube.com/watch?v=${videoId}`,
              isAudioOnly: true,
              audioFormat: 'mp3',
              audioQuality: '128'
            }),
            signal: getTimeoutSignal(8000)
          });
        }

        if (res.ok) {
          const data = await safelyParseJson<any>(res);
          if (data?.url) {
            console.log(`[Express Server] Success via Cobalt: ${endpoint}`);
            return { url: data.url, mimeType: 'audio/mpeg' };
          }
        }
      } catch (e: any) {
        // Continue silently
      }
    }
  }
  return null;
}

async function getPipedStreamInfo(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  // Layer 3: Piped Instances
  console.log(`[Express Server] Attempting Piped resolution for ${videoId}`);
  const shuffledPiped = shuffle(PIPED_INSTANCES);
  for (const inst of shuffledPiped.slice(0, 4)) {
    try {
      const res = await fetch(`${inst}/streams/${videoId}`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        signal: getTimeoutSignal(6000)
      });
      if (res.ok) {
        const data = await safelyParseJson<any>(res);
        if (!data) continue;
        const audioStreams = data.audioStreams || [];
        // Prioritize audio/mp4 for extreme iOS/Safari/macOS compatibility
        const best = audioStreams.find((s: any) => s.mimeType?.includes('audio/mp4')) ||
                     audioStreams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];
        if (best?.url) {
          console.log(`[Express Server] Success via Piped: ${inst}`);
          return { url: best.url, mimeType: best.mimeType || 'audio/webm' };
        }
      }
    } catch {
      // Continue
    }
  }
  return null;
}

async function getYtDlpStreamInfo(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  const cleanId = videoId.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 11);
  if (!cleanId || cleanId.length !== 11) {
    return null;
  }

  try {
    await ensureYtDlpInstalled();
  } catch (err) {
    console.warn('[Express Server] Dynamic yt-dlp installation check failed during stream resolution:', err);
  }

  console.log(`[Express Server] Attempting yt-dlp stream resolution for ${cleanId}`);

  // 1. Cookies file authentication mechanism
  const cookiesPath = path.join(process.cwd(), 'cookies.txt');
  let cookiesArg = '';
  if (fs.existsSync(cookiesPath)) {
    cookiesArg = `--cookies "${cookiesPath}"`;
    console.log(`[Express Server] [yt-dlp] Using local cookies.txt found at: ${cookiesPath}`);
  } else {
    console.log(`[Express Server] [yt-dlp] No cookies.txt found at ${cookiesPath}. Proceeding without cookie authentication.`);
  }

  // 2. Extractor arguments to spoof legitimate clients (iOS, Web, Android)
  const extractorArgs = '--extractor-args "youtube:player_client=ios,web,android"';

  // 3. Appropriate HTTP Headers to mimic a real web browser
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const headersArgs = `--user-agent "${userAgent}" --add-header "Accept-Language: en-US,en;q=0.9"`;

  // 4. CONFIGURATION PLACEHOLDER: Set your proxy URL here to bypass 429 Too Many Requests errors.
  // Example: 'http://username:password@proxy-host:port' or 'socks5://127.0.0.1:1080'
  const PROXY_URL = ''; 
  const proxyArg = PROXY_URL ? `--proxy "${PROXY_URL}"` : '';

  // 5. Strictly audio-only (preferring high-quality M4A or high-bitrate audio format)
  const formatArg = '-f "bestaudio[ext=m4a]/bestaudio/best"';

  // Build the yt-dlp command to extract the direct URL using python3 and absolute path to yt-dlp
  const command = `python3 "${path.join(process.cwd(), 'yt-dlp')}" ${cookiesArg} ${extractorArgs} ${headersArgs} ${proxyArg} ${formatArg} -g "https://www.youtube.com/watch?v=${cleanId}"`;

  try {
    const { stdout } = await execAsync(command);
    const resolvedUrl = stdout.trim();
    if (resolvedUrl && resolvedUrl.startsWith('http')) {
      console.log(`[Express Server] yt-dlp successfully resolved direct stream URL for ${cleanId}`);
      // Detect mime type based on extension or default to audio/mp4 (best audio)
      const mimeType = resolvedUrl.includes('ext=m4a') || resolvedUrl.includes('.m4a') ? 'audio/mp4' : 'audio/webm';
      return { url: resolvedUrl, mimeType };
    }
  } catch (err: any) {
    console.warn(`[Express Server] yt-dlp stream resolution failed for ${cleanId}:`, err.message || err);
  }

  return null;
}

async function streamYtDlpDirectly(videoId: string, res: any, shouldDownload: boolean, title: string) {
  const cleanId = videoId.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 11);
  if (!cleanId || cleanId.length !== 11) {
    if (!res.headersSent) {
      res.status(400).json({ error: 'Invalid Video ID' });
    }
    return;
  }

  try {
    await ensureYtDlpInstalled();
  } catch (err) {
    console.warn('[Express Server] Dynamic yt-dlp installation check failed during stream start:', err);
  }

  console.log(`[Express Server] Spawning direct yt-dlp process to transcode/stream ${cleanId}`);

  // 1. Cookies file authentication mechanism
  const cookiesPath = path.join(process.cwd(), 'cookies.txt');
  const args: string[] = [];
  if (fs.existsSync(cookiesPath)) {
    args.push('--cookies', cookiesPath);
    console.log(`[Express Server] [Direct yt-dlp Stream] Using local cookies.txt found at: ${cookiesPath}`);
  }

  // 2. Extractor arguments to spoof legitimate clients
  args.push('--extractor-args', 'youtube:player_client=ios,web,android');

  // 3. Appropriate HTTP Headers to mimic a real web browser
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  args.push('--user-agent', userAgent);
  args.push('--add-header', 'Accept-Language: en-US,en;q=0.9');

  // 4. CONFIGURATION PLACEHOLDER: Set your proxy URL here to bypass 429 Too Many Requests errors.
  const PROXY_URL = ''; 
  if (PROXY_URL) {
    args.push('--proxy', PROXY_URL);
  }

  // 5. Strictly audio-only with high-quality bitrate processing (MP3/M4A)
  args.push('-f', 'bestaudio/best');
  args.push('--extract-audio');
  args.push('--audio-format', 'mp3');
  args.push('--audio-quality', '0'); // highest quality Variable Bit Rate (VBR)
  args.push('-o', '-'); // Output to stdout
  args.push(`https://www.youtube.com/watch?v=${cleanId}`);

  // Set headers on response
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'no-cache');
  if (shouldDownload) {
    const cleanTitle = safeAudioTitle(title);
    res.setHeader('Content-Disposition', `attachment; filename="${cleanTitle}.mp3"`);
  }

  const child = spawn('python3', [path.join(process.cwd(), 'yt-dlp'), ...args]);

  child.stdout.pipe(res);

  child.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('[download]') || msg.includes('[ExtractAudio]')) {
      console.log(`[yt-dlp stream process] ${msg}`);
    }
  });

  child.on('close', (code) => {
    console.log(`[Express Server] Direct yt-dlp stream process finished with code ${code}`);
    res.end();
  });

  child.on('error', (err) => {
    console.error(`[Express Server] Direct yt-dlp spawn error:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Direct yt-dlp audio extraction failed' });
    }
  });
}

async function streamResolvedUrl(streamInfo: { url: string; mimeType: string }, req: any, res: any, shouldDownload: boolean, title: string) {
  const range = req.headers.range;
  const upstreamHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
  };
  if (range) upstreamHeaders['Range'] = range;

  const upstream = await fetch(streamInfo.url, { headers: upstreamHeaders, redirect: 'follow' });
  if (!upstream.ok && upstream.status !== 206) {
    throw new Error(`Upstream ${upstream.status}`);
  }

  const reader = upstream.body?.getReader();
  const first = reader ? await reader.read() : null;
  const firstBytes = first?.value ? Buffer.from(first.value) : Buffer.alloc(0);
  const upstreamType = upstream.headers.get('content-type') || streamInfo.mimeType;
  try {
    assertAudioBytes(firstBytes, upstreamType);
  } catch (error) {
    try { await reader?.cancel(); } catch { /* ignore */ }
    throw error;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', upstreamType.split(';')[0]);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-cache');

  if (shouldDownload) {
    const ext = upstreamType.includes('mp4') || upstreamType.includes('m4a') ? 'm4a' : upstreamType.includes('mpeg') ? 'mp3' : 'webm';
    res.setHeader('Content-Disposition', `attachment; filename="${safeAudioTitle(title)}.${ext}"`);
  }

  const contentLength = upstream.headers.get('content-length');
  const contentRange = upstream.headers.get('content-range');
  if (contentLength) res.setHeader('Content-Length', contentLength);
  if (contentRange) res.setHeader('Content-Range', contentRange);

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

async function getStreamInfo(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  // Try yt-dlp first (highly optimized with client spoofing, headers, cookies, etc.)
  const ytdlp = await getYtDlpStreamInfo(videoId);
  if (ytdlp) return ytdlp;

  // Try Invidious second
  const invidious = await getInvidiousStreamInfo(videoId);
  if (invidious) return invidious;

  // Try Cobalt third
  const cobalt = await getCobaltStreamInfo(videoId);
  if (cobalt) return cobalt;

  // Try Piped fourth
  const piped = await getPipedStreamInfo(videoId);
  if (piped) return piped;

  console.log(`[Express Server] Unified resolution completed for ${videoId}`);
  return null;
}

async function ensureYtDlpInstalled(): Promise<string> {
  const ytdlpPath = path.join(process.cwd(), 'yt-dlp');
  if (fs.existsSync(ytdlpPath)) {
    console.log(`[Express Server] [yt-dlp] Standalone yt-dlp binary already exists at ${ytdlpPath}`);
    return ytdlpPath;
  }

  console.log(`[Express Server] [yt-dlp] Standalone yt-dlp binary not found. Downloading the latest release dynamically...`);
  try {
    const res = await fetch('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp');
    if (!res.ok) {
      throw new Error(`Failed to download yt-dlp: HTTP status ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(ytdlpPath, buffer);
    fs.chmodSync(ytdlpPath, 0o755);
    console.log(`[Express Server] [yt-dlp] Successfully downloaded and configured yt-dlp standalone binary.`);
    return ytdlpPath;
  } catch (err: any) {
    console.error(`[Express Server] [yt-dlp] Error downloading yt-dlp standalone binary:`, err.message || err);
    throw err;
  }
}

async function startServer() {
  const app = express();

  // Ensure yt-dlp standalone binary is downloaded on boot
  try {
    await ensureYtDlpInstalled();
  } catch (e) {
    console.warn(`[Express Server] Pre-boot yt-dlp check failed. Will retry lazily when download/streaming is initiated.`);
  }

  // Setup loose CORS for local app consumption
  app.use(cors({ origin: '*' }));

  // API Route: get-audio-url (with built-in streaming/proxying and general proxyUrl capability)
  app.get('/api/get-audio-url', async (req, res) => {
    // 1. Support generic proxyUrl capability for direct bypass of CORS
    const proxyUrl = req.query.proxyUrl as string;
    if (proxyUrl) {
      try {
        const decodedUrl = decodeURIComponent(proxyUrl);
        console.log(`[Express Proxy] Streaming raw proxy URL parameters: ${decodedUrl.substring(0, 80)}`);
        
        const range = req.headers.range;
        const upstreamHeaders: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*',
        };
        if (range) upstreamHeaders['Range'] = range;

        const upstream = await fetch(decodedUrl, { headers: upstreamHeaders, redirect: 'follow' });
        if (!upstream.ok && upstream.status !== 206) throw new Error(`Upstream ${upstream.status}`);

        const reader = upstream.body?.getReader();
        const first = reader ? await reader.read() : null;
        const firstBytes = first?.value ? Buffer.from(first.value) : Buffer.alloc(0);
        const upstreamType = upstream.headers.get('content-type');
        try {
          assertAudioBytes(firstBytes, upstreamType);
        } catch (error) {
          try { await reader?.cancel(); } catch { /* ignore */ }
          throw error;
        }
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Content-Type', upstreamType || 'audio/mpeg');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'no-cache');

        const contentLength = upstream.headers.get('content-length');
        const contentRange = upstream.headers.get('content-range');
        if (contentLength) res.setHeader('Content-Length', contentLength);
        if (contentRange) res.setHeader('Content-Range', contentRange);

        res.status(upstream.status);

        if (firstBytes.length) res.write(firstBytes);
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
          }
          res.end();
        } else {
          res.end();
        }
        return;
      } catch (proxyErr: any) {
        console.log('[Express Proxy] Direct proxy URL streaming handled.');
        if (!res.headersSent) {
          return res.status(502).json({ error: proxyErr?.message || 'Audio proxy failed' });
        }
        return;
      }
    }

    // 2. Standard resolution proxying
    let videoId = (req.query.videoId || req.query.id || '') as string;
    const shouldStream = req.query.stream === '1';
    const shouldDownload = req.query.download === '1';
    const title = (req.query.title || 'audio') as string;

    if (!videoId) {
      return res.status(400).json({ error: 'Video ID required' });
    }

    const match = videoId.match(/(?:v=|\/|embed\/|shorts\/|^)([a-zA-Z0-9_-]{11})/);
    if (match) videoId = match[1];
    videoId = videoId.trim().substring(0, 11);

    let streamInfo = null;
    if (shouldDownload) {
      console.log(`[Express Server /get-audio-url] Download mode requested. Resolving with yt-dlp first...`);
      streamInfo = await getYtDlpStreamInfo(videoId);
    }
    if (!streamInfo) {
      streamInfo = await getStreamInfo(videoId);
    }

    // Fallback directly to spawning yt-dlp live transcode stream if URL resolution completely failed
    if (!streamInfo) {
      const replacementId = await searchVideoIdByTitle(title);
      if (replacementId && replacementId !== videoId) {
        streamInfo = await getStreamInfo(replacementId);
        if (streamInfo) videoId = replacementId;
      }
    }

    if (!streamInfo) {
      console.log(`[Express Server /get-audio-url] Stream resolution failed. Falling back to live transcoding/streaming with yt-dlp...`);
      return streamYtDlpDirectly(videoId, res, shouldDownload, title);
    }

    console.log(`[Express Server /get-audio-url] Resolved initial streamInfo:`, {
      mimeType: streamInfo.mimeType,
      url: streamInfo.url.substring(0, 150) + '...'
    });

    if (shouldStream || shouldDownload) {
      try {
        await streamResolvedUrl(streamInfo, req, res, shouldDownload, title);
      } catch (e: any) {
        console.log('[Express Proxy] Upstream stream error. Spawning live yt-dlp transcode stream as reliable fallback.', e.message || e);
        if (!res.headersSent) {
          const replacementId = await searchVideoIdByTitle(title);
          if (replacementId && replacementId !== videoId) {
            const replacementInfo = await getStreamInfo(replacementId);
            if (replacementInfo) {
              try {
                return await streamResolvedUrl(replacementInfo, req, res, shouldDownload, title);
              } catch (replacementErr: any) {
                console.warn('[Express Proxy] Replacement stream failed, using live yt-dlp fallback.', replacementErr?.message || replacementErr);
              }
            }
          }
          return streamYtDlpDirectly(videoId, res, shouldDownload, title);
        }
        return;
      }
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.json({ audioUrl: streamInfo.url, audioUrl1: streamInfo.url, success: true });
    }
  });

  // API Route: Social Embed OG metadata redirects
  app.get('/api/og', (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.secure ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}`;
    const trackId = req.query.id as string;
    const trackTitle = (req.query.title || 'Great Music') as string;
    const trackChannel = (req.query.channel || 'NYRA') as string;
    const trackThumbnail = (req.query.thumbnail || (trackId ? `https://i.ytimg.com/vi/${trackId}/hqdefault.jpg` : `${baseUrl}/headphones.png`)) as string;
    
    const appName = "NYRA";
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>🎧 ${trackTitle}</title>
  
  <!-- Primary Meta Tags -->
  <meta name="title" content="💖 ${trackTitle}">
  <meta name="description" content="✨ ${trackChannel} · NYRA PREMIUM • FEEL THE PULSE">

  <meta property="og:type" content="video.other">
  <meta property="og:site_name" content="NYRA • FEEL THE PULSE">
  <meta property="og:title" content="🎧 ${trackTitle}">
  <meta property="og:description" content="✨ ${trackChannel} • Click the link for full Soundwaves!">
  <meta property="og:image" content="${trackThumbnail}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta name="twitter:image" content="${trackThumbnail}">

  <!-- YouTube Fakeout to force Play Button -->
  <meta property="og:video" content="https://www.youtube.com/embed/${trackId}">
  <meta property="og:video:secure_url" content="https://www.youtube.com/embed/${trackId}">
  <meta property="og:video:type" content="text/html">
  <meta property="og:video:width" content="1280">
  <meta property="og:video:height" content="720">

  <meta name="twitter:card" content="player">
  <meta name="twitter:player" content="https://www.youtube.com/embed/${trackId}">
  <meta name="twitter:player:width" content="1280">
  <meta name="twitter:player:height" content="720">

  <meta name="theme-color" content="#ffd300">
  
  <meta http-equiv="refresh" content="0;url=${baseUrl}/?play=${trackId}&title=${encodeURIComponent(trackTitle)}&channel=${encodeURIComponent(trackChannel)}&thumbnail=${encodeURIComponent(trackThumbnail)}">
</head>
<body>
  <div style="background: #0b0b0b; color: white; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif;">
    <img src="${trackThumbnail}" style="width: 200px; height: 200px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
    <h1 style="margin: 0; font-size: 24px;">${trackTitle}</h1>
    <p style="color: #888; margin-top: 8px;">Opening in ${appName}...</p>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.send(html);
  });

  // API Route: Dynamic Workspace zip package download
  app.get('/api/download-zip', (req, res) => {
    try {
      console.log('[Express Server] Starting dynamic codebase bundling for download...');
      const zip = new AdmZip();
      const rootDir = process.cwd();

      const excludeList = ['node_modules', '.git', 'dist', 'build', '.next', '.svelte-kit', 'tmp', '.idea', '.vscode'];

      function addFilesToZipRecursively(currentDir: string) {
        const items = fs.readdirSync(currentDir);
        for (const item of items) {
          const itemPath = path.join(currentDir, item);
          const relativePath = path.relative(rootDir, itemPath);

          // Get stats and handle edge cases safely
          let stat;
          try {
            stat = fs.statSync(itemPath);
          } catch (e) {
            continue; // Skip broken symlinks or unreadable files
          }

          if (stat.isDirectory()) {
            if (excludeList.includes(item)) {
              continue;
            }
            addFilesToZipRecursively(itemPath);
          } else if (stat.isFile()) {
            // Exclude pre-existing ZIPs and local .env keys for security
            if (item === '.env' || item.endsWith('.zip')) {
              continue;
            }
            
            const zipFolder = path.dirname(relativePath);
            const targetZipFolder = zipFolder === '.' ? '' : zipFolder;
            zip.addLocalFile(itemPath, targetZipFolder);
          }
        }
      }

      addFilesToZipRecursively(rootDir);

      const zipBuffer = zip.toBuffer();
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="nyra-full-source.zip"');
      res.setHeader('Content-Length', zipBuffer.length);
      res.send(zipBuffer);
      console.log('[Express Server] Codebase compiled and delivered successfully!');
    } catch (err: any) {
      console.error('[Express Server] Failed to compile source zip:', err);
      res.status(500).json({ error: 'Zip compilation failed', details: err?.message });
    }
  });

  app.use('/api', (err: any, req: any, res: any, _next: any) => {
    console.error('[Express API] Unhandled API error:', err?.message || err);
    if (!res.headersSent) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');
      res.status(502).json({ error: err?.message || 'Audio request failed' });
    }
  });

  // Setup dev / production static asset routing
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA Fallback logic for client-side routing
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Express Server] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
