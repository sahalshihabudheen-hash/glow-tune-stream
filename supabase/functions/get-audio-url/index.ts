import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range, x-client-id',
  'Access-Control-Expose-Headers': 'content-length, content-range, accept-ranges, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// ─── Invidious "local proxy" resolution ───
// Invidious instances can proxy the IP-locked googlevideo audio stream through
// their OWN server (?local=true). The returned `/videoplayback` URL points at the
// instance host, NOT googlevideo, so it is NOT IP-locked and CAN be re-proxied by
// our edge function. This is the most reliable free path for raw audio right now.
const CURATED_INVIDIOUS = [
  'https://inv.thepixora.com',
  'https://invidious.nerdvpn.de',
  'https://yewtu.be',
  'https://invidious.jing.rocks',
  'https://iv.datura.network',
  'https://invidious.privacyredirect.com',
  'https://invidious.f5.si',
  'https://invidious.einfachzocken.eu',
];

let cachedInstances: string[] | null = null;
let cachedAt = 0;

const ITAG_MIME: Record<string, string> = {
  '251': 'audio/webm',
  '250': 'audio/webm',
  '249': 'audio/webm',
  '140': 'audio/mp4',
};

const COBALT_INSTANCES = [
  'https://api.cobalt.tools',
  'https://cobalt.api.ryboflops.lol',
  'https://co.wuk.sh',
];

async function fetchViaInnertube(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Youtube-Client-Name': '21',
        'X-Youtube-Client-Version': '6.29.58',
        'User-Agent': 'com.google.android.apps.youtube.music/6.29.58 (Linux; U; Android 11) gzip',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'ANDROID_MUSIC',
            clientVersion: '6.29.58',
            androidSdkVersion: 30,
            hl: 'en',
            gl: 'US',
          },
        },
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const formats: any[] = [
      ...(data?.streamingData?.adaptiveFormats || []),
      ...(data?.streamingData?.formats || []),
    ];
    const best = formats
      .filter((f: any) => (f.mimeType || '').startsWith('audio/') && f.url)
      .sort((a: any, b: any) => Number(b.bitrate || 0) - Number(a.bitrate || 0))[0];

    if (!best?.url) return null;
    return { url: best.url, mimeType: (best.mimeType || 'audio/webm').split(';')[0] };
  } catch {
    return null;
  }
}

function companionizeInvidiousUrl(rawUrl: string) {
  const secureUrl = rawUrl.replace(/^http:\/\//, 'https://');
  if (secureUrl.includes('/companion/videoplayback')) return secureUrl;
  return secureUrl
    .replace('/videoplayback?', '/companion/videoplayback?')
    .replace('/videoplayback/', '/companion/videoplayback/');
}

function extensionForMime(mimeType: string) {
  if (mimeType.includes('mp4') || mimeType.includes('m4a') || mimeType.includes('aac')) return 'm4a';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  return 'webm';
}

function safeTitle(title: string) {
  return (title || 'audio').replace(/[^\w\s-]/g, '').trim() || 'audio';
}

function looksLikeAudio(contentType: string | null, url = '') {
  const type = (contentType || '').toLowerCase();
  return type.startsWith('audio/') || type.includes('octet-stream') || url.includes('/videoplayback');
}

async function canProxyAudio(url: string) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(7000),
      headers: { 'User-Agent': 'Mozilla/5.0', 'Range': 'bytes=0-1', 'Accept': '*/*' },
      redirect: 'follow',
    });
    const ok = (res.ok || res.status === 206) && looksLikeAudio(res.headers.get('content-type'), res.url || url);
    try { await res.body?.cancel(); } catch { /* ignore */ }
    return ok;
  } catch {
    return false;
  }
}

async function getInvidiousInstances(): Promise<string[]> {
  const now = Date.now();
  if (cachedInstances && now - cachedAt < 10 * 60 * 1000) return cachedInstances;
  const dynamic: string[] = [];
  try {
    const res = await fetch('https://api.invidious.io/instances.json?pretty=0', {
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (res.ok) {
      const data = await res.json();
      for (const entry of data) {
        const info = entry?.[1];
        if (info?.type === 'https' && info?.api && info?.uri) dynamic.push(info.uri);
      }
    }
  } catch { /* ignore — fall back to curated */ }
  // Curated first (known-good), then any dynamic ones not already listed
  const merged = [...CURATED_INVIDIOUS];
  for (const u of dynamic) if (!merged.includes(u)) merged.push(u);
  cachedInstances = merged;
  cachedAt = now;
  return merged;
}

async function fetchViaInvidiousLocal(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  const instances = await getInvidiousInstances();
  for (const inst of instances) {
    for (const itag of ['251', '140', '250', '249']) {
      try {
        const latestUrl = `${inst}/latest_version?id=${videoId}&local=true&itag=${itag}`;
        const res = await fetch(latestUrl, {
          signal: AbortSignal.timeout(8000),
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Range': 'bytes=0-1',
          },
          redirect: 'follow',
        });
        const contentType = res.headers.get('content-type');
        if ((res.ok || res.status === 206) && looksLikeAudio(contentType, res.url || latestUrl)) {
          try { await res.body?.cancel(); } catch { /* ignore */ }
          const candidate = companionizeInvidiousUrl(res.url || latestUrl);
          if (!(await canProxyAudio(candidate))) continue;
          return {
            url: candidate,
            mimeType: (contentType || ITAG_MIME[itag] || 'audio/webm').split(';')[0],
          };
        }
        try { await res.body?.cancel(); } catch { /* ignore */ }
      } catch {
        continue;
      }
    }

    try {
      const res = await fetch(`${inst}/api/v1/videos/${videoId}?local=true`, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const audio = (data.adaptiveFormats || [])
        .filter((f: any) => (f.type || '').startsWith('audio/') && f.url)
        .sort((a: any, b: any) => Number(b.bitrate || 0) - Number(a.bitrate || 0));
      let best = audio[0];
      if (!best?.url) continue;
      // Invidious returns local-proxy URLs sometimes as http:// — force https
      const url = companionizeInvidiousUrl(best.url);
      if (!(await canProxyAudio(url))) continue;
      return { url, mimeType: (best.type || 'audio/webm').split(';')[0] };
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchViaCobalt(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  for (const inst of COBALT_INSTANCES) {
    for (const [endpoint, body] of [
      [`${inst}/`, JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}`, downloadMode: 'audio', audioFormat: 'mp3', audioBitrate: '128' })],
      [`${inst}/api/json`, JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}`, isAudioOnly: true, downloadMode: 'audio', audioFormat: 'mp3', audioQuality: '128' })],
    ] as [string, string][]) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body,
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) continue;
        const data = await res.json();
        if (data?.url) return { url: data.url, mimeType: 'audio/mpeg' };
      } catch { /* try next */ }
    }
  }
  return null;
}

// ─── Piped fallback (proxies through its own IP too) ───
const PIPED_INSTANCES = [
  'https://api.piped.private.coffee',
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.reallyaweso.me',
  'https://pipedapi.ducks.party',
];

async function fetchViaPiped(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  for (const inst of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${inst}/streams/${videoId}`, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const audioStreams: any[] = data.audioStreams || [];
      const best = audioStreams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];
      if (best?.url) return { url: best.url, mimeType: (best.mimeType || 'audio/webm').split(';')[0] };
    } catch {
      continue;
    }
  }
  return null;
}

async function getStreamInfo(videoId: string): Promise<{ url: string; mimeType: string } | null> {
  const innertube = await fetchViaInnertube(videoId);
  if (innertube) return innertube;
  // Invidious local-proxy is the most reliable free path — try it first.
  const inv = await fetchViaInvidiousLocal(videoId);
  if (inv) return inv;
  const piped = await fetchViaPiped(videoId);
  if (piped) return piped;
  const cobalt = await fetchViaCobalt(videoId);
  if (cobalt) return cobalt;
  return null;
}

// Proxy the audio stream from the source through our edge function.
// Adds permissive CORS headers so the browser <audio crossOrigin="anonymous">
// element stays "clean" and can be routed through the Web Audio API (channel
// split / EQ / crossfade) without tainting.
async function streamProxy(req: Request, sourceUrl: string, mimeType: string, download: boolean, title: string) {
  try {
    const range = req.headers.get('range');
    const upstreamHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*',
    };
    if (range) upstreamHeaders['Range'] = range;

    // Invidious API URLs without /companion can 403 when re-proxied. Retry the
    // companion proxy path before surfacing a 502 to the browser.
    const sourceCandidates = [sourceUrl];
    const companionUrl = companionizeInvidiousUrl(sourceUrl);
    if (companionUrl !== sourceUrl) sourceCandidates.push(companionUrl);

    let upstream: Response | null = null;
    let lastStatus = 0;
    for (const candidate of sourceCandidates) {
      // No timeout - let the stream run for the full song duration
      upstream = await fetch(candidate, { headers: upstreamHeaders, redirect: 'follow' });
      lastStatus = upstream.status;
      if (upstream.ok || upstream.status === 206) break;
      try { await upstream.body?.cancel(); } catch { /* ignore */ }
    }

    if (!upstream || (!upstream.ok && upstream.status !== 206)) {
      return new Response(
        JSON.stringify({ error: `Upstream returned ${lastStatus || 'unknown'}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const responseHeaders = new Headers(corsHeaders);
    const resolvedMimeType = (mimeType || upstream.headers.get('content-type') || 'audio/webm').split(';')[0];
    responseHeaders.set('Content-Type', resolvedMimeType);
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Cache-Control', 'no-cache');

    if (download) {
      responseHeaders.set('Content-Disposition', `attachment; filename="${safeTitle(title)}.${extensionForMime(resolvedMimeType)}"`);
    }

    const contentLength = upstream.headers.get('content-length');
    const contentRange = upstream.headers.get('content-range');
    if (contentLength) responseHeaders.set('Content-Length', contentLength);
    if (contentRange) responseHeaders.set('Content-Range', contentRange);

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: `Stream proxy failed: ${e.message}` }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

function returnJson(url: string, mimeType: string) {
  return new Response(
    JSON.stringify({ audioUrl: url, audioUrl1: url, mimeType, success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let videoId = url.searchParams.get('videoId') || url.searchParams.get('id') || '';
    const shouldStream = url.searchParams.get('stream') === '1';
    const shouldDownload = url.searchParams.get('download') === '1';
    const title = url.searchParams.get('title') || 'audio';

    // Allow direct proxying of an already-resolved client URL (used by client fallback).
    const proxyUrl = url.searchParams.get('proxyUrl');
    if (proxyUrl) {
      return await streamProxy(req, proxyUrl, '', shouldDownload, title);
    }

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'Video ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalise video ID
    if (videoId.length > 11 || videoId.includes('?') || videoId.includes('/')) {
      const match = videoId.match(/(?:v=|\/|embed\/|shorts\/|^)([a-zA-Z0-9_-]{11})/);
      if (match) videoId = match[1];
    }
    videoId = videoId.trim().substring(0, 11);

    const streamInfo = await getStreamInfo(videoId);

    if (!streamInfo) {
      return new Response(
        JSON.stringify({ error: 'Audio stream unavailable', videoId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (shouldStream || shouldDownload) {
      // Always proxy — the stream URL is IP-locked to the source server.
      // Redirecting to it won't work from the browser's IP.
      return await streamProxy(req, streamInfo.url, streamInfo.mimeType, shouldDownload, title);
    } else {
      return returnJson(streamInfo.url, streamInfo.mimeType);
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
