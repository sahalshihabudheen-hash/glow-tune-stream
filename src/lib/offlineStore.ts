export interface OfflineTrack {
  id: string;
  title: string;
  thumbnail: string;
  audioBlob: Blob;
  downloadedAt: number;
  size: number;
  artist?: string;
  duration?: number;
}

const DB_NAME = 'NyraOfflineDB';
const STORE_NAME = 'tracks';
const DB_VERSION = 1;

export type OfflineTrackInput = {
  id: string;
  title: string;
  thumbnail: string;
  artist?: string;
  channel?: string;
  duration?: number;
};

function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open offline database');
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function saveTrackOffline(
  track: OfflineTrackInput,
  audioBlob: Blob
): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const offlineTrack: OfflineTrack = {
      id: track.id,
      title: track.title,
      thumbnail: track.thumbnail,
      audioBlob,
      downloadedAt: Date.now(),
      size: audioBlob.size,
      artist: track.artist || track.channel || 'Unknown Artist',
      duration: track.duration || 0,
    };

    const request = store.put(offlineTrack);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function getTrackOffline(id: string): Promise<OfflineTrack | null> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error getting offline track:', error);
    return null;
  }
}

export async function deleteOfflineTrack(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function getAllOfflineTracks(): Promise<Omit<OfflineTrack, 'audioBlob'>[]> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        // Map to exclude heavy audioBlob from the list view query to save memory/processing
        const list = results.map(({ audioBlob, ...rest }) => rest);
        resolve(list);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error getting all offline tracks:', error);
    return [];
  }
}

export async function isTrackDownloadedOffline(id: string): Promise<boolean> {
  const track = await getTrackOffline(id);
  return !!track;
}

export async function clearAllOfflineTracks(): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
