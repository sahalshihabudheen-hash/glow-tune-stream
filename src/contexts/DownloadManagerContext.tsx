import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useTheme } from '@/contexts/ThemeContext';
import { saveTrackOffline } from '@/lib/offlineStore';
import { COBALT_INSTANCES, PIPED_INSTANCES, INVIDIOUS_INSTANCES } from '@/lib/instances';
import { Download, Smartphone, Laptop, CheckSquare, Square, X } from 'lucide-react';

export interface DownloadItem {
  id: string;
  title: string;
  thumbnail: string;
  status: 'preparing' | 'downloading' | 'done' | 'error';
  progress: number; // 0-100
}

interface DownloadManagerContextType {
  downloads: DownloadItem[];
  startDownload: (track: { id: string; title: string; thumbnail: string; artist?: string; duration?: number }) => void;
  clearCompleted: () => void;
  isDownloading: (trackId: string) => boolean;
}

const DownloadManagerContext = createContext<DownloadManagerContextType | null>(null);

export function useDownloadManager() {
  const ctx = useContext(DownloadManagerContext);
  if (!ctx) throw new Error('useDownloadManager must be used within DownloadManagerProvider');
  return ctx;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const sanitizeFilename = (filename: string) =>
  filename.replace(/[<>:"/\\|?*]/g, '').trim();

const getTimeoutSignal = (ms: number) => {
  try {
    return AbortSignal.timeout(ms);
  } catch {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  }
};

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Audio URL Resolvers (client-side, uses residential IP — no server needed) ──

async function tryCobalt(inst: string, videoId: string): Promise<string | null> {
  // New Cobalt v10+ API (POST /)
  for (const [endpoint, body] of [
    [`${inst}/`, JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}`, downloadMode: 'audio', audioFormat: 'mp3', audioBitrate: '128' })],
    [`${inst}/api/json`, JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}`, isAudioOnly: true, downloadMode: 'audio', audioFormat: 'mp3', audioQuality: '128' })],
  ] as [string, string][]) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body,
        signal: getTimeoutSignal(6000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.url) return data.url;
      }
    } catch {}
  }
  return null;
}

async function tryPiped(inst: string, videoId: string): Promise<string | null> {
  try {
    const res = await fetch(`${inst}/streams/${videoId}`, {
      signal: getTimeoutSignal(5000),
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const streams: any[] = data.audioStreams || [];
    const best =
      streams.find((s: any) => s.mimeType?.includes('audio/mp4')) ||
      streams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];
    return best?.url ?? null;
  } catch {
    return null;
  }
}

async function tryInvidious(inst: string, videoId: string): Promise<string | null> {
  try {
    const testUrl = `${inst}/latest_version?id=${videoId}&local=true&itag=140`;
    const res = await fetch(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      signal: getTimeoutSignal(5000),
    });
    if (res.status === 200 || res.status === 206) {
      return res.url;
    }
  } catch {}
  return null;
}


// YouTube Innertube API — fetches directly from YT using ANDROID_MUSIC client.
// Works from browser (residential IP), no third-party service needed.
async function tryInnertube(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(
      'https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Youtube-Client-Name': '21',
          'X-Youtube-Client-Version': '6.29.58',
          'User-Agent': 'com.google.android.apps.youtube.music/6.29.58 (Linux; U; Android 11) gzip',
          'Origin': 'https://www.youtube.com',
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
        signal: getTimeoutSignal(8000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const formats: any[] = [
      ...(data?.streamingData?.adaptiveFormats || []),
      ...(data?.streamingData?.formats || []),
    ];
    const audioFormats = formats
      .filter((f: any) => f.mimeType?.startsWith('audio/') && f.url)
      .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
    return audioFormats[0]?.url ?? null;
  } catch {
    return null;
  }
}

async function searchVideoIdByTitle(title: string): Promise<string | null> {
  const query = sanitizeFilename(title);
  if (!query) return null;

  try {
    const res = await fetch(`https://api.piped.private.coffee/search?q=${encodeURIComponent(query)}&filter=videos`, {
      headers: { Accept: 'application/json' },
      signal: getTimeoutSignal(8000),
    });
    if (res.ok) {
      const data = await res.json();
      const item = data?.items?.find((entry: any) => entry?.type === 'stream' && /watch\?v=/.test(entry?.url || ''));
      const id = item?.url?.match(/[?&]v=([a-zA-Z0-9_-]{11})/)?.[1];
      if (id) return id;
    }
  } catch { /* try next source */ }

  try {
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      signal: getTimeoutSignal(8000),
    });
    const html = await res.text();
    return html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/)?.[1] || null;
  } catch {
    return null;
  }
}

// Race ALL resolvers in parallel — first one to return a non-null URL wins
async function resolveAudioUrl(videoId: string): Promise<string | null> {
  const promises: Promise<string | null>[] = [
    tryInnertube(videoId),
    ...shuffle(COBALT_INSTANCES).slice(0, 5).map((inst) => tryCobalt(inst, videoId)),
    ...shuffle(PIPED_INSTANCES).slice(0, 4).map((inst) => tryPiped(inst, videoId)),
    ...shuffle(INVIDIOUS_INSTANCES).slice(0, 4).map((inst) => tryInvidious(inst, videoId)),
  ];

  return new Promise((resolve) => {
    let settled = 0;
    let won = false;
    const total = promises.length;
    for (const p of promises) {
      p.then((url) => {
        settled++;
        if (url && !won) {
          won = true;
          resolve(url);
        } else if (settled === total && !won) {
          resolve(null);
        }
      }).catch(() => {
        settled++;
        if (settled === total && !won) resolve(null);
      });
    }
  });
}

async function resolveAudioUrlForTrack(track: { id: string; title: string }): Promise<string | null> {
  const original = await resolveAudioUrl(track.id);
  if (original) return original;

  const replacementId = await searchVideoIdByTitle(track.title);
  if (!replacementId || replacementId === track.id) return null;
  return resolveAudioUrl(replacementId);
}

// ── Bulletproof audio blob pipeline ─────────────────────────────────────────

const MIN_AUDIO_BYTES = 50_000;
const MAX_FETCH_RETRIES = 3;

type AudioBlobResult = { blob: Blob; mimeType: string; source: string };
type AudioCandidate = { url: string; label: string };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const looksLikeAudioMime = (mimeType: string) => {
  const type = mimeType.toLowerCase();
  return (
    type.startsWith('audio/') ||
    type.startsWith('video/') ||
    type.includes('application/octet-stream') ||
    type.includes('binary/octet-stream')
  );
};

const sniffTextHeader = (bytes: Uint8Array) =>
  new TextDecoder()
    .decode(bytes.slice(0, Math.min(bytes.length, 160)))
    .trim()
    .toLowerCase();

const validateAudioHeader = (bytes: Uint8Array, mimeType: string) => {
  const head = sniffTextHeader(bytes);
  if (!bytes.length) throw new Error('No audio bytes received');
  if (
    head.startsWith('<!doctype') ||
    head.startsWith('<html') ||
    head.startsWith('{"error"') ||
    head.startsWith('{"message"') ||
    head.includes('<body') ||
    mimeType.includes('text/html') ||
    mimeType.includes('application/json')
  ) {
    throw new Error('Provider returned a webpage/error instead of audio');
  }
  if (!looksLikeAudioMime(mimeType)) {
    throw new Error(`Unexpected content type: ${mimeType || 'unknown'}`);
  }
};

async function fetchAudioBlob(
  audioUrl: string,
  onProgress: (p: number) => void
): Promise<{ blob: Blob; mimeType: string }> {
  onProgress(10);
  const response = await fetch(audioUrl, {
    headers: { Accept: 'audio/*,video/*,application/octet-stream,*/*;q=0.5' },
    signal: getTimeoutSignal(180_000),
  });

  const responseType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.text();
      detail = body ? ` — ${body.slice(0, 120)}` : '';
    } catch { /* ignore body parse errors */ }
    throw new Error(`HTTP ${response.status}${detail}`);
  }

  const mimeType = responseType || 'audio/webm';
  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  const reader = response.body?.getReader();

  if (!reader) {
    const blob = await response.blob();
    const head = new Uint8Array(await blob.slice(0, 4096).arrayBuffer());
    validateAudioHeader(head, mimeType);
    if (blob.size < MIN_AUDIO_BYTES) throw new Error('Audio file was incomplete');
    return { blob: blob.type ? blob : new Blob([blob], { type: mimeType }), mimeType };
  }

  let received = 0;
  const chunks: Uint8Array[] = [];
  let firstChunkChecked = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!firstChunkChecked) {
      validateAudioHeader(value, mimeType);
      firstChunkChecked = true;
    }
    chunks.push(value);
    received += value.length;
    if (total > 0) onProgress(Math.min(Math.max(Math.round((received / total) * 100), 15), 98));
    else onProgress(Math.min(95, 25 + Math.round(received / 300_000)));
  }

  const blob = new Blob(chunks as BlobPart[], { type: mimeType });
  if (!firstChunkChecked) throw new Error('No audio bytes received');
  if (blob.size < MIN_AUDIO_BYTES) throw new Error('Audio file was incomplete');
  return { blob, mimeType };
}

// Edge-function endpoint that resolves + proxies YouTube audio server-side.
// Prefer Supabase when configured; fall back to the Vercel /api route so exports
// still work if the app is deployed without VITE_SUPABASE_URL.
const getAudioFunctionBases = () => {
  const backendUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const bases = ['/api/get-audio-url'];
  if (backendUrl) bases.push(`${backendUrl}/functions/v1/get-audio-url`);
  return [...new Set(bases)];
};

const buildAudioFunctionUrl = (
  track: { id: string; title: string },
  options: { stream?: boolean; download?: boolean; proxyUrl?: string; base?: string } = {}
) => {
  const params = new URLSearchParams();
  if (options.proxyUrl) params.set('proxyUrl', options.proxyUrl);
  else params.set('videoId', track.id);
  if (options.stream) params.set('stream', '1');
  if (options.download) params.set('download', '1');
  params.set('title', sanitizeFilename(track.title) || 'audio');
  return `${options.base || getAudioFunctionBases()[0]}?${params.toString()}`;
};

const extForMime = (mimeType: string) => {
  if (mimeType.includes('mp4') || mimeType.includes('m4a') || mimeType.includes('aac')) return 'm4a';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  return 'webm';
};

const resolveServerAudioUrl = async (track: { id: string; title: string }) => {
  let lastError: unknown;
  for (const base of getAudioFunctionBases()) {
    try {
      const response = await fetch(buildAudioFunctionUrl(track, { base }), {
        signal: getTimeoutSignal(35_000),
      });
      if (!response.ok) {
        throw new Error(`Audio link failed (HTTP ${response.status})`);
      }
      const responseType = response.headers.get('content-type') || '';
      if (responseType.includes('text/html')) throw new Error('Resolver returned HTML');
      const data = await response.json();
      const url = data?.audioUrl || data?.audioUrl1;
      if (!url) throw new Error('No audio link found');
      return { url, mimeType: data?.mimeType || 'audio/webm', base };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('No audio link found');
};

const assertDownloadUrlReady = async (url: string) => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 45_000);
  const response = await fetch(url, {
    headers: { Range: 'bytes=0-4095' },
    signal: controller.signal,
  });
  try {
    if (!response.ok && response.status !== 206) {
      throw new Error(`HTTP ${response.status}`);
    }
    const mimeType = (response.headers.get('content-type') || 'audio/webm').split(';')[0];
    const reader = response.body?.getReader();
    const first = reader ? await reader.read() : null;
    const probe = first?.value || new Uint8Array();
    try { await reader?.cancel(); } catch { /* ignore */ }
    validateAudioHeader(probe, mimeType);
    return mimeType;
  } finally {
    window.clearTimeout(timer);
    controller.abort();
  }
};

const firstReadyDownload = async (track: { id: string; title: string }, options: { download?: boolean; stream?: boolean; proxyUrl?: string } = {}) => {
  let lastError: unknown;
  for (const base of getAudioFunctionBases()) {
    const url = buildAudioFunctionUrl(track, { ...options, base });
    try {
      const mimeType = await assertDownloadUrlReady(url);
      return { url, mimeType, base };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Audio stream unavailable');
};

const fetchAudioBlobWithRetries = async (
  candidate: AudioCandidate,
  onProgress: (p: number) => void
): Promise<AudioBlobResult> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_FETCH_RETRIES; attempt++) {
    try {
      const result = await fetchAudioBlob(candidate.url, onProgress);
      return { ...result, source: candidate.label };
    } catch (err) {
      lastError = err;
      console.warn(`[Download] ${candidate.label} attempt ${attempt} failed:`, err);
      if (attempt < MAX_FETCH_RETRIES) await wait(700 * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${candidate.label} failed`);
};

const buildBackendCandidates = (
  track: { id: string; title: string },
  mode: 'download' | 'stream',
  proxyUrl?: string
): AudioCandidate[] =>
  getAudioFunctionBases().map((base) => ({
    url: buildAudioFunctionUrl(track, {
      base,
      proxyUrl,
      download: mode === 'download',
      stream: mode === 'stream',
    }),
    label: `${base.includes('/api/') ? 'Vercel' : 'Backend'} ${proxyUrl ? 'proxy' : 'resolver'}`,
  }));

const fetchFirstAudioBlob = async (
  track: { id: string; title: string },
  mode: 'download' | 'stream',
  onProgress: (p: number) => void
): Promise<AudioBlobResult> => {
  const errors: string[] = [];

  const tryCandidates = async (candidates: AudioCandidate[]) => {
    for (const candidate of candidates) {
      try {
        return await fetchAudioBlobWithRetries(candidate, onProgress);
      } catch (err: any) {
        errors.push(`${candidate.label}: ${err?.message || 'failed'}`);
      }
    }
    return null;
  };

  const direct = await tryCandidates(buildBackendCandidates(track, mode));
  if (direct) return direct;

  try {
    const serverAudio = await resolveServerAudioUrl(track);
    const proxied = await tryCandidates(buildBackendCandidates(track, mode, serverAudio.url));
    if (proxied) return proxied;
  } catch (err: any) {
    errors.push(`Backend resolver: ${err?.message || 'failed'}`);
  }

  try {
    const fallbackUrl = await resolveAudioUrlForTrack(track);
    if (fallbackUrl) {
      const clientProxied = await tryCandidates(buildBackendCandidates(track, mode, fallbackUrl));
      if (clientProxied) return clientProxied;
    } else {
      errors.push('Browser resolver: no audio URL found');
    }
  } catch (err: any) {
    errors.push(`Browser resolver: ${err?.message || 'failed'}`);
  }

  throw new Error(`No valid audio blob found. ${errors.slice(-3).join(' | ')}`);
};

const triggerBrowserDownload = (blob: Blob, title: string, mimeType = 'audio/webm') => {
  const blobUrl = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: mimeType }));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `${sanitizeFilename(title)}.${extForMime(mimeType)}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
};

// ── Provider ──────────────────────────────────────────────────────────────────

export function DownloadManagerProvider({ children }: { children: React.ReactNode }) {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const { settings, updateSettings } = useTheme();

  const [promptOpen, setPromptOpen] = useState(false);
  const [pendingTrack, setPendingTrack] = useState<{
    id: string;
    title: string;
    thumbnail: string;
    artist?: string;
    duration?: number;
  } | null>(null);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const queueCacheInFlight = useRef(new Set<string>());

  const addItem = useCallback((item: DownloadItem) => {
    setDownloads((prev) => [item, ...prev.filter((d) => d.id !== item.id)]);
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<DownloadItem>) => {
    setDownloads((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
  }, []);

  const removeItem = useCallback(
    (id: string, delayMs = 0) => {
      setTimeout(() => setDownloads((prev) => prev.filter((d) => d.id !== id)), delayMs);
    },
    []
  );

  const isDownloading = useCallback(
    (trackId: string) =>
      downloads.some(
        (d) => d.id === trackId && (d.status === 'preparing' || d.status === 'downloading')
      ),
    [downloads]
  );

  // ── Download to Device ──────────────────────────────────────────────────────
  // Always fetches and validates a real audio Blob before creating the file.
  // If every resolver fails, it shows a clear error instead of saving HTML/JSON.
  const downloadToDevice = useCallback(
    async (track: { id: string; title: string; thumbnail: string }) => {
      addItem({ id: track.id, title: track.title, thumbnail: track.thumbnail, status: 'preparing', progress: 0 });
      updateItem(track.id, { status: 'downloading', progress: 5 });

      try {
        toast.loading('Preparing verified audio file…', { id: `dl-${track.id}` });
        const result = await fetchFirstAudioBlob(track, 'download', (p) =>
          updateItem(track.id, { progress: Math.round(5 + p * 0.9) })
        );

        toast.dismiss(`dl-${track.id}`);
        updateItem(track.id, { progress: 95 });
        triggerBrowserDownload(result.blob, track.title, result.mimeType);

        updateItem(track.id, { status: 'done', progress: 100 });
        toast.success(`🎵 Audio download ready: ${track.title}`);
        removeItem(track.id, 15_000);
      } catch (err: any) {
        console.error('[Download] Device download failed:', err);
        toast.dismiss(`dl-${track.id}`);
        updateItem(track.id, { status: 'error', progress: 0 });
        toast.error(err.message || 'Could not get a valid audio file. Please try again.');
        removeItem(track.id, 8_000);
      }
    },
    [addItem, updateItem, removeItem]
  );

  // ── Download In-App (IndexedDB) ─────────────────────────────────────────────
  const downloadInApp = useCallback(
    async (track: { id: string; title: string; thumbnail: string; artist?: string; duration?: number }) => {
      addItem({ id: track.id, title: track.title, thumbnail: track.thumbnail, status: 'preparing', progress: 0 });
      updateItem(track.id, { status: 'downloading', progress: 5 });

      try {
        toast.loading('Finding audio stream…', { id: `dl-app-${track.id}` });

        const { blob: audioBlob } = await fetchFirstAudioBlob(track, 'stream', (p) =>
          updateItem(track.id, { progress: Math.round(10 + p * 0.8) })
        );
        toast.dismiss(`dl-app-${track.id}`);

        await saveTrackOffline(track, audioBlob);
        updateItem(track.id, { status: 'done', progress: 100 });
        toast.success(`🎵 Saved for offline: ${track.title}`);
        removeItem(track.id, 15_000);
      } catch (err: any) {
        console.error('[Download] In-app download failed:', err);
        toast.dismiss(`dl-app-${track.id}`);
        toast.info('Offline save failed, switching to device download…');
        await downloadToDevice(track);
      }

    },
    [addItem, updateItem, removeItem, downloadToDevice]
  );

  // Queueing a song also warms its full audio blob in IndexedDB. This is best
  // effort and intentionally silent: playback remains available while caching,
  // and a failed provider can be retried the next time the song is queued.
  useEffect(() => {
    type QueuedTrack = { id: string; title: string; thumbnail: string; channel?: string };
    const cacheQueuedTrack = async (track: QueuedTrack) => {
      if (!track?.id || queueCacheInFlight.current.has(track.id)) return;
      queueCacheInFlight.current.add(track.id);
      try {
        const result = await fetchFirstAudioBlob(track, 'stream', () => {});
        await saveTrackOffline({ ...track, artist: track.channel }, result.blob);
        window.dispatchEvent(new CustomEvent('nyra:offline-cache-updated', { detail: { id: track.id } }));
      } catch (error) {
        console.warn('[Queue Cache] Could not cache queued track yet:', error);
      } finally {
        queueCacheInFlight.current.delete(track.id);
      }
    };

    const handleQueuedTrack = (event: Event) => {
      const track = (event as CustomEvent<QueuedTrack>).detail;
      void cacheQueuedTrack(track);
    };

    window.addEventListener('nyra:cache-queued-track', handleQueuedTrack);
    // Warm only the next few restored queue entries, sequentially, to avoid
    // saturating a weak mobile connection when the app launches.
    try {
      const restored = JSON.parse(localStorage.getItem('nyra-queue') || '[]') as QueuedTrack[];
      void restored.slice(0, 3).reduce(
        (previous, track) => previous.then(() => cacheQueuedTrack(track)),
        Promise.resolve(),
      );
    } catch {
      // A malformed legacy queue should not block the player.
    }
    return () => window.removeEventListener('nyra:cache-queued-track', handleQueuedTrack);
  }, []);

  // ── Entry point ─────────────────────────────────────────────────────────────
  const startDownload = useCallback(
    (track: { id: string; title: string; thumbnail: string; artist?: string; duration?: number }) => {
      if (isDownloading(track.id)) {
        toast.info('Already downloading this track');
        return;
      }

      const pref = settings.downloadPreference || 'ask';
      if (pref === 'ask') {
        setPendingTrack(track);
        setDontAskAgain(false);
        setPromptOpen(true);
      } else if (pref === 'device') {
        downloadToDevice(track);
      } else {
        downloadInApp(track);
      }
    },
    [settings.downloadPreference, isDownloading, downloadToDevice, downloadInApp]
  );

  const handleSelectOption = (option: 'device' | 'app') => {
    if (!pendingTrack) return;
    if (dontAskAgain) {
      updateSettings({ downloadPreference: option });
      toast.success('Preference saved! You can change this in Settings.');
    }
    if (option === 'device') downloadToDevice(pendingTrack);
    else downloadInApp(pendingTrack);
    setPromptOpen(false);
    setPendingTrack(null);
  };

  const clearCompleted = useCallback(() => {
    setDownloads((prev) => prev.filter((d) => d.status === 'preparing' || d.status === 'downloading'));
  }, []);

  return (
    <DownloadManagerContext.Provider value={{ downloads, startDownload, clearCompleted, isDownloading }}>
      {children}

      {/* Choice Prompt Dialog */}
      {promptOpen && pendingTrack && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-md z-[1000] flex items-center justify-center p-4"
          onClick={() => setPromptOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl relative overflow-hidden flex flex-col gap-5 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient Background Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Download className="w-5 h-5 text-primary animate-bounce" />
                Download Options
              </h3>
              <button
                onClick={() => setPromptOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Track Info */}
            <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-2xl border border-border">
              <img
                src={pendingTrack.thumbnail}
                alt={pendingTrack.title}
                className="w-12 h-12 object-cover rounded-xl shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{pendingTrack.title}</p>
                <p className="text-xs text-muted-foreground truncate">{pendingTrack.artist || 'YouTube Stream'}</p>
              </div>
            </div>

            {/* Selection Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleSelectOption('device')}
                className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-background hover:bg-primary/5 hover:border-primary/30 transition-all text-left cursor-pointer active:scale-98"
              >
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  <Laptop className="w-5 h-5 text-foreground" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Download to Device</h4>
                  <p className="text-xs text-muted-foreground">Saves an audio file to your downloads folder.</p>
                </div>
              </button>

              <button
                onClick={() => handleSelectOption('app')}
                className="flex items-center gap-4 p-4 rounded-2xl border border-primary/20 bg-primary/10 hover:bg-primary/15 hover:border-primary/40 transition-all text-left cursor-pointer active:scale-98"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 animate-pulse">
                  <Smartphone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Save in App (Offline Mode)</h4>
                  <p className="text-xs text-muted-foreground">Caches in local storage for playing inside the app completely offline.</p>
                </div>
              </button>
            </div>

            {/* Never Ask Again Checkbox */}
            <button
              onClick={() => setDontAskAgain((prev) => !prev)}
              className="flex items-center gap-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 text-left select-none cursor-pointer"
            >
              {dontAskAgain ? (
                <CheckSquare className="w-4 h-4 text-primary" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span>Remember selection and never ask again</span>
            </button>
          </div>
        </div>
      )}
    </DownloadManagerContext.Provider>
  );
}
