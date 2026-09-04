/**
 * Offline-first cache layer.
 * - JSON payloads (playlists, playlist items) live in localStorage for instant
 *   synchronous hydration on first paint.
 * - Thumbnails live in IndexedDB as blobs so they render instantly on flaky
 *   mobile connections without re-hitting the network.
 */

const JSON_PREFIX = 'nyra-cache:';
const DB_NAME = 'NyraCacheDB';
const DB_VERSION = 1;
const THUMB_STORE = 'thumbs';
const THUMB_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days

/* ---------------------------------- JSON --------------------------------- */

interface CacheEnvelope<T> {
  value: T;
  savedAt: number;
}

export function readCache<T>(key: string, maxAgeMs = Infinity): T | null {
  try {
    const raw = localStorage.getItem(JSON_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (Date.now() - parsed.savedAt > maxAgeMs) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  try {
    const envelope: CacheEnvelope<T> = { value, savedAt: Date.now() };
    localStorage.setItem(JSON_PREFIX + key, JSON.stringify(envelope));
  } catch {
    // Quota exceeded — drop the oldest cache entries and give up silently.
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(JSON_PREFIX))
        .slice(0, 5)
        .forEach(k => localStorage.removeItem(k));
    } catch {
      /* noop */
    }
  }
}

export function clearJsonCache(): void {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(JSON_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  } catch {
    /* noop */
  }
}

/* ------------------------------- Thumbnails ------------------------------- */

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(THUMB_STORE)) {
        db.createObjectStore(THUMB_STORE, { keyPath: 'url' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

interface ThumbRecord {
  url: string;
  blob: Blob;
  savedAt: number;
}

export async function getCachedThumb(url: string): Promise<Blob | null> {
  if (!url) return null;
  try {
    const db = await openDB();
    return await new Promise<Blob | null>((resolve) => {
      const tx = db.transaction(THUMB_STORE, 'readonly');
      const request = tx.objectStore(THUMB_STORE).get(url);
      request.onsuccess = () => {
        const record = request.result as ThumbRecord | undefined;
        if (!record) return resolve(null);
        if (Date.now() - record.savedAt > THUMB_TTL) return resolve(null);
        resolve(record.blob);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function putCachedThumb(url: string, blob: Blob): Promise<void> {
  if (!url || !blob || blob.size === 0) return;
  try {
    const db = await openDB();
    const tx = db.transaction(THUMB_STORE, 'readwrite');
    tx.objectStore(THUMB_STORE).put({ url, blob, savedAt: Date.now() } as ThumbRecord);
  } catch {
    /* noop */
  }
}

const inflight = new Map<string, Promise<Blob | null>>();

/** Fetches a thumbnail and stores it for offline reuse. Deduped per URL. */
export async function cacheThumb(url: string): Promise<Blob | null> {
  if (!url) return null;
  const existing = inflight.get(url);
  if (existing) return existing;

  const task = (async () => {
    try {
      const response = await fetch(url, { mode: 'cors', cache: 'force-cache' });
      if (!response.ok) return null;
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) return null;
      await putCachedThumb(url, blob);
      return blob;
    } catch {
      return null;
    } finally {
      inflight.delete(url);
    }
  })();

  inflight.set(url, task);
  return task;
}

/** Warms the thumbnail cache for a batch of URLs without blocking the UI. */
export function prefetchThumbs(urls: (string | undefined | null)[]): void {
  const unique = [...new Set(urls.filter(Boolean) as string[])].slice(0, 60);
  const run = () => unique.forEach(url => { void cacheThumb(url); });
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(run, { timeout: 3000 });
  } else {
    setTimeout(run, 800);
  }
}

export async function clearThumbCache(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(THUMB_STORE, 'readwrite');
    tx.objectStore(THUMB_STORE).clear();
  } catch {
    /* noop */
  }
}
