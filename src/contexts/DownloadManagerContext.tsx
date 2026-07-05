import React, { createContext, useContext, useState, useCallback } from 'react';
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

// ── Blob fetcher for in-app (IndexedDB) downloads ──────────────────────────

async function fetchAudioBlob(
  audioUrl: string,
  onProgress: (p: number) => void
): Promise<{ blob: Blob; mimeType: string }> {
  onProgress(10);
  const response = await fetch(audioUrl, { signal: getTimeoutSignal(180_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const mimeType = (response.headers.get('content-type') || 'audio/webm').split(';')[0];
  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  const reader = response.body?.getReader();

  if (!reader) {
    const blob = await response.blob();
    if (blob.size < 50_000) throw new Error('File too small');
    return { blob, mimeType };
  }

  let received = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) onProgress(Math.min(Math.max(Math.round((received / total) * 100), 15), 98));
    else onProgress(50);
  }

  const blob = new Blob(chunks as BlobPart[], { type: mimeType });
  if (blob.size < 50_000) throw new Error('File too small');
  return { blob, mimeType };
}

// Edge-function endpoint that resolves + proxies YouTube audio server-side.
// Prefer Supabase when configured; fall back to the Vercel /api route so exports
// still work if the app is deployed without VITE_SUPABASE_URL.
const getAudioFunctionBases = () => {
  const backendUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const canUseNodeApi = host === 'localhost' || host === '127.0.0.1' || host.includes('vercel.app');
  const bases = canUseNodeApi ? ['/api/get-audio-url'] : [];
  if (backendUrl) bases.push(`${backendUrl}/functions/v1/get-audio-url`);
  if (!bases.length) bases.push('/api/get-audio-url');
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
    const head = new TextDecoder().decode(probe.slice(0, Math.min(probe.length, 96))).trim().toLowerCase();
    if (!probe.length || head.startsWith('<!doctype') || head.startsWith('<html') || head.startsWith('{"error"')) {
      throw new Error('Audio stream returned a webpage instead of music');
    }
    if (mimeType.includes('text/html') || mimeType.includes('application/json')) {
      throw new Error('Audio stream unavailable');
    }
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

const triggerBrowserDownload = (url: string, title: string, mimeType = 'audio/webm') => {
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFilename(title)}.${extForMime(mimeType)}`;
  link.target = '_blank';
  link.rel = 'noreferrer noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
  // Strategy: resolve audio URL client-side (residential IP, no Vercel involved),
  // then trigger a native <a> download. No blob fetching = no CORS issues.
  const downloadToDevice = useCallback(
    async (track: { id: string; title: string; thumbnail: string }) => {
      addItem({ id: track.id, title: track.title, thumbnail: track.thumbnail, status: 'preparing', progress: 0 });
      updateItem(track.id, { status: 'downloading', progress: 15 });

      try {
        toast.loading('Preparing download…', { id: `dl-${track.id}` });
        let downloadUrl = '';
        let mimeType = 'audio/webm';

        try {
          const ready = await firstReadyDownload(track, { download: true });
          downloadUrl = ready.url;
          mimeType = ready.mimeType;
        } catch (directErr) {
          console.warn('[Download] Direct backend download failed, trying locked proxy URL:', directErr);
          try {
            const serverAudio = await resolveServerAudioUrl(track);
            mimeType = serverAudio.mimeType;
            const ready = await firstReadyDownload(track, { proxyUrl: serverAudio.url, download: true });
            downloadUrl = ready.url;
            mimeType = ready.mimeType;
          } catch (proxyErr) {
            console.warn('[Download] Locked proxy preflight failed, trying browser resolver:', proxyErr);
            const fallbackUrl = await resolveAudioUrl(track.id);
            if (!fallbackUrl) throw new Error('Audio stream unavailable for this song');
            try {
              const ready = await firstReadyDownload(track, { proxyUrl: fallbackUrl, download: true });
              downloadUrl = ready.url;
              mimeType = ready.mimeType;
            } catch {
              downloadUrl = fallbackUrl;
              mimeType = fallbackUrl.includes('mime=audio%2Fmp4') || fallbackUrl.includes('.m4a') ? 'audio/mp4' : 'audio/webm';
            }
          }
        }

        toast.dismiss(`dl-${track.id}`);
        updateItem(track.id, { progress: 95 });
        triggerBrowserDownload(downloadUrl, track.title, mimeType);

        updateItem(track.id, { status: 'done', progress: 100 });
        toast.success(`🎵 Download started: ${track.title}`);
        removeItem(track.id, 15_000);
      } catch (err: any) {
        console.error('[Download] Device download failed:', err);
        toast.dismiss(`dl-${track.id}`);
        updateItem(track.id, { status: 'error', progress: 0 });
        toast.error(err.message || 'Download failed. Please try again.');
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

        let audioBlob: Blob | null = null;
        try {
            const streamUrl = (await firstReadyDownload(track, { stream: true })).url;
          const result = await fetchAudioBlob(streamUrl, (p) =>
            updateItem(track.id, { progress: Math.round(10 + p * 0.75) })
          );
          audioBlob = result.blob;
        } catch (directErr) {
          console.warn('[Download] Direct cache stream failed, retrying with resolved proxy:', directErr);
          try {
            const serverAudio = await resolveServerAudioUrl(track);
              const streamUrl = (await firstReadyDownload(track, { proxyUrl: serverAudio.url, stream: true })).url;
            const result = await fetchAudioBlob(streamUrl, (p) =>
              updateItem(track.id, { progress: Math.round(15 + p * 0.75) })
            );
            audioBlob = result.blob;
          } catch (proxyErr) {
            console.warn('[Download] Primary cache proxy failed, retrying with browser-resolved proxy:', proxyErr);
            const fallbackUrl = await resolveAudioUrl(track.id);
            if (!fallbackUrl) throw new Error('Audio stream unavailable for this song');
            const streamUrl = (await firstReadyDownload(track, { proxyUrl: fallbackUrl, stream: true })).url;
            const result = await fetchAudioBlob(streamUrl, (p) =>
              updateItem(track.id, { progress: Math.round(20 + p * 0.7) })
            );
            audioBlob = result.blob;
          }
        }
        toast.dismiss(`dl-app-${track.id}`);

        await saveTrackOffline(track, audioBlob);
        updateItem(track.id, { status: 'done', progress: 100 });
        toast.success(`🎵 Saved for offline: ${track.title}`);
        removeItem(track.id, 15_000);
      } catch (err: any) {
        console.error('[Download] In-app download failed:', err);
        toast.dismiss(`dl-app-${track.id}`);
        updateItem(track.id, { status: 'error', progress: 0 });
        toast.error(err.message || 'Failed to save for offline. Try Download to Device.');
        removeItem(track.id, 8_000);
      }

    },
    [addItem, updateItem, removeItem]
  );

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
