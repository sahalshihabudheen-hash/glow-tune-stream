/**
 * Upload a NYRA playlist to the person's own YouTube account.
 *
 * How it works
 *  - Google Identity Services opens Google's sign-in popup and returns a short-lived access token.
 *    No client secret is needed, so nothing sensitive lives in this app.
 *  - With that token the YouTube Data API creates a playlist and adds the songs one by one.
 *
 * Needs VITE_GOOGLE_CLIENT_ID (an OAuth "Web application" client ID, which is public by design).
 */

export type YouTubePrivacy = 'private' | 'unlisted' | 'public';

export const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const API = 'https://www.googleapis.com/youtube/v3';
const RECORD_PREFIX = 'nyra-yt-export:';

export const googleClientId = (): string => (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || '';

/** True for a real YouTube video id (11 chars). Tracks from other sources can't be added to a YouTube playlist. */
export const isYouTubeVideoId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id);

/** Error from Google/YouTube with a stable `reason` so the UI can explain what happened. */
export class YouTubeApiError extends Error {
  constructor(message: string, public reason: string, public status: number) {
    super(message);
    this.name = 'YouTubeApiError';
  }
}

/** Human-friendly text for the errors people can actually fix. */
export const friendlyYouTubeError = (e: unknown): string => {
  if (e instanceof YouTubeApiError) {
    switch (e.reason) {
      case 'quotaExceeded':
      case 'dailyLimitExceeded':
        return "YouTube's daily upload limit for this app has been reached. Try again tomorrow. Songs already added are kept.";
      case 'youtubeSignupRequired':
        return "That Google account doesn't have a YouTube channel yet. Create one at youtube.com, then try again.";
      case 'insufficientPermissions':
      case 'forbidden':
        return 'YouTube did not allow this. Sign in again and approve access to manage your YouTube playlists.';
      case 'accessNotConfigured':
        return 'The YouTube Data API is not turned on for this app yet. The site owner needs to enable it in Google Cloud.';
      case 'playlistContainsMaximumNumberOfVideos':
        return 'That YouTube playlist is full (5,000 videos).';
      case 'unauthorized':
        return 'Your Google sign-in expired. Please try again.';
      case 'conflict':
      case 'ABORTED':
        return 'YouTube was too busy to accept more songs right now. Open this window again in a minute to continue; songs already added are kept.';
      default:
        return e.message || 'YouTube returned an error.';
    }
  }
  return e instanceof Error ? e.message : 'Something went wrong talking to YouTube.';
};

// ---------------------------------------------------------------- Google sign-in

declare global {
  interface Window {
    google?: any;
  }
}

let gisPromise: Promise<void> | null = null;

const loadGoogleIdentity = (): Promise<void> => {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisPromise = null;
      reject(new Error("Couldn't load Google sign-in. Check your connection or ad blocker and try again."));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
};

/** Opens Google's sign-in popup and resolves with an access token that can manage YouTube playlists. */
export async function requestYouTubeToken(clientId = googleClientId()): Promise<string> {
  if (!clientId) throw new Error('YouTube upload is not set up yet (missing Google client ID).');
  await loadGoogleIdentity();

  return new Promise<string>((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: YOUTUBE_SCOPE,
      callback: (resp: any) => {
        if (resp?.error) {
          reject(new Error(resp.error === 'access_denied' ? 'You cancelled the Google sign-in.' : `Google sign-in failed (${resp.error}).`));
          return;
        }
        if (!window.google.accounts.oauth2.hasGrantedAllScopes(resp, YOUTUBE_SCOPE)) {
          reject(new YouTubeApiError('Permission to manage YouTube playlists was not granted.', 'insufficientPermissions', 403));
          return;
        }
        resolve(resp.access_token as string);
      },
      error_callback: (err: any) => {
        reject(new Error(err?.type === 'popup_closed' ? 'The Google sign-in window was closed.' : "Couldn't open the Google sign-in window. Allow pop-ups and try again."));
      },
    });
    client.requestAccessToken({ prompt: 'select_account' });
  });
}

// ---------------------------------------------------------------- YouTube Data API

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// YouTube answers fast back-to-back playlist inserts with HTTP 409 "The operation was aborted." (status ABORTED).
// It is temporary: waiting a moment and trying again works.
const MAX_RETRIES = 5;

async function youtubeFetch<T>(token: string, path: string, body: unknown, attempt = 0): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (netErr) {
    // Network hiccup (offline blip, blocked request): wait and retry before giving up.
    if (attempt < MAX_RETRIES) {
      await sleep(Math.min(1000 * 2 ** attempt, 8000));
      return youtubeFetch<T>(token, path, body, attempt + 1);
    }
    throw netErr;
  }

  if (res.ok) return (await res.json()) as T;

  let reason = res.status === 401 ? 'unauthorized' : 'unknown';
  let message = `YouTube error ${res.status}`;
  let apiStatus = '';
  try {
    const data = await res.json();
    reason = data?.error?.errors?.[0]?.reason || data?.error?.status || reason;
    message = data?.error?.message || message;
    apiStatus = data?.error?.status || '';
  } catch {
    /* non-JSON error body */
  }

  // Temporary problems: wait and retry a few times.
  const transient =
    res.status >= 500 ||
    res.status === 409 ||
    apiStatus === 'ABORTED' ||
    ['rateLimitExceeded', 'userRateLimitExceeded', 'backendError', 'conflict'].includes(reason);
  if (transient && attempt < MAX_RETRIES) {
    await sleep(Math.min(1000 * 2 ** attempt, 8000));
    return youtubeFetch<T>(token, path, body, attempt + 1);
  }
  throw new YouTubeApiError(message, reason, res.status);
}

const cleanTitle = (t: string) => t.replace(/[<>]/g, '').trim().slice(0, 150) || 'NYRA playlist';
const cleanDescription = (d: string) => d.replace(/[<>]/g, '').slice(0, 4900);

export async function createYouTubePlaylist(
  token: string,
  opts: { title: string; description: string; privacy: YouTubePrivacy },
): Promise<string> {
  const data = await youtubeFetch<{ id: string }>(token, '/playlists?part=snippet,status', {
    snippet: { title: cleanTitle(opts.title), description: cleanDescription(opts.description) },
    status: { privacyStatus: opts.privacy },
  });
  return data.id;
}

export async function addVideoToYouTubePlaylist(token: string, playlistId: string, videoId: string): Promise<void> {
  await youtubeFetch(token, '/playlistItems?part=snippet', {
    snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } },
  });
}

// ---------------------------------------------------------------- Remembering what was uploaded

export interface ExportRecord {
  youtubePlaylistId: string;
  addedIds: string[];
  /** Videos YouTube refused (private, removed, blocked). Remembered so they are not retried every time. */
  skippedIds?: string[];
}

export const getExportRecord = (playlistKey: string): ExportRecord | null => {
  try {
    const raw = localStorage.getItem(RECORD_PREFIX + playlistKey);
    const rec = raw ? (JSON.parse(raw) as ExportRecord) : null;
    return rec && rec.youtubePlaylistId && Array.isArray(rec.addedIds) ? rec : null;
  } catch {
    return null;
  }
};

const saveExportRecord = (playlistKey: string, rec: ExportRecord) => {
  try {
    localStorage.setItem(RECORD_PREFIX + playlistKey, JSON.stringify(rec));
  } catch {
    /* storage full or blocked: the upload still works, it just can't be continued later */
  }
};

export const clearExportRecord = (playlistKey: string) => {
  try {
    localStorage.removeItem(RECORD_PREFIX + playlistKey);
  } catch {
    /* ignore */
  }
};

export const youtubePlaylistUrl = (id: string) => `https://www.youtube.com/playlist?list=${id}`;

// ---------------------------------------------------------------- The whole upload

export interface ExportProgress {
  done: number;
  total: number;
  skipped: number;
}

export interface ExportResult {
  playlistId: string;
  url: string;
  added: number;
  skipped: number;
  /** Set when the upload stopped early (quota, expired login, ...). Songs added so far are kept. */
  stopped?: unknown;
  cancelled?: boolean;
}

/**
 * Creates (or continues) a YouTube playlist and adds the given videos.
 * Progress is saved after every song, so an interrupted upload can be continued without duplicates.
 */
export async function exportPlaylistToYouTube(opts: {
  token: string;
  playlistKey: string;
  title: string;
  description: string;
  privacy: YouTubePrivacy;
  videoIds: string[];
  onProgress?: (p: ExportProgress) => void;
  signal?: AbortSignal;
  /** Pause between songs. Tests set this to 0. */
  delayMs?: number;
}): Promise<ExportResult> {
  const { token, playlistKey, signal, onProgress, delayMs = 700 } = opts;
  const unique = Array.from(new Set(opts.videoIds.filter(isYouTubeVideoId)));

  let record = getExportRecord(playlistKey);
  const already = new Set([...(record?.addedIds ?? []), ...(record?.skippedIds ?? [])]);
  let todo = unique.filter((id) => !already.has(id));

  let playlistId = record?.youtubePlaylistId ?? '';
  let added = 0;
  let skipped = 0;
  let restarted = false;
  let total = todo.length;
  const continuingEarlierUpload = !!record;
  onProgress?.({ done: 0, total, skipped });

  const newPlaylist = async () => {
    playlistId = await createYouTubePlaylist(token, {
      title: opts.title,
      description: opts.description,
      privacy: opts.privacy,
    });
    record = { youtubePlaylistId: playlistId, addedIds: [], skippedIds: [] };
    saveExportRecord(playlistKey, record);
  };

  try {
    if (!playlistId) {
      if (todo.length === 0) throw new Error('There are no YouTube songs in this playlist to upload.');
      await newPlaylist();
    }

    for (let i = 0; i < todo.length; i++) {
      if (signal?.aborted) return { playlistId, url: youtubePlaylistUrl(playlistId), added, skipped, cancelled: true };
      const videoId = todo[i];

      try {
        await addVideoToYouTubePlaylist(token, playlistId, videoId);
      } catch (e) {
        if (e instanceof YouTubeApiError && e.reason === 'playlistNotFound' && continuingEarlierUpload && added === 0 && !restarted) {
          // The earlier YouTube playlist was deleted: start a fresh one and re-add everything.
          restarted = true;
          clearExportRecord(playlistKey);
          record = null;
          todo = unique;
          total = todo.length;
          await newPlaylist();
          onProgress?.({ done: 0, total, skipped });
          i = -1;
          continue;
        }
        if (e instanceof YouTubeApiError) {
          // "forbidden" is ambiguous: a permission problem at the start, but a blocked video once songs are going in.
          const songsWentIn = added > 0 || (record?.addedIds.length ?? 0) > 0;
          const videoProblem =
            ['videoNotFound', 'invalidArgument', 'playlistItemsNotAccessible'].includes(e.reason) ||
            (e.reason === 'forbidden' && songsWentIn);
          if (e.reason === 'videoAlreadyInPlaylist') {
            record!.addedIds.push(videoId);
            saveExportRecord(playlistKey, record!);
            onProgress?.({ done: added + skipped, total, skipped });
            continue;
          }
          if (videoProblem) {
            // This one video can't be added (private, removed, region-blocked...): skip it and carry on.
            skipped++;
            record!.skippedIds = [...(record!.skippedIds ?? []), videoId];
            saveExportRecord(playlistKey, record!);
            onProgress?.({ done: added + skipped, total, skipped });
            continue;
          }
        }
        return { playlistId, url: youtubePlaylistUrl(playlistId), added, skipped, stopped: e };
      }

      added++;
      record!.addedIds.push(videoId);
      saveExportRecord(playlistKey, record!);
      onProgress?.({ done: added + skipped, total, skipped });
      if (delayMs > 0 && i < todo.length - 1) await sleep(delayMs);
    }
  } catch (e) {
    return { playlistId, url: playlistId ? youtubePlaylistUrl(playlistId) : '', added, skipped, stopped: e };
  }

  return { playlistId, url: youtubePlaylistUrl(playlistId), added, skipped };
}
