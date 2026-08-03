import { useState, useEffect, useCallback, useRef } from 'react';

interface Track {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
}

const QUEUE_STORAGE_KEY = 'nyra-queue';
const SHUFFLE_STORAGE_KEY = 'nyra-shuffle';
const LAST_PLAYED_STORAGE_KEY = 'nyra-last-played';

export function useQueue() {
  const [queue, setQueue] = useState<Track[]>([]);
  const [shuffleMode, setShuffleMode] = useState(false);
  const lastPlayedIdRef = useRef<string | null>(null);

  // Load queue and shuffle state from localStorage on mount
  useEffect(() => {
    const storedQueue = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (storedQueue) {
      try {
        setQueue(JSON.parse(storedQueue));
      } catch (e) {
        console.error('Failed to parse queue:', e);
      }
    }

    const storedShuffle = localStorage.getItem(SHUFFLE_STORAGE_KEY);
    if (storedShuffle) {
      setShuffleMode(storedShuffle === 'true');
    }

    const storedLastPlayed = localStorage.getItem(LAST_PLAYED_STORAGE_KEY);
    if (storedLastPlayed) {
      lastPlayedIdRef.current = storedLastPlayed;
    }
  }, []);

  // Save queue to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  }, [queue]);

  // Save shuffle state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(SHUFFLE_STORAGE_KEY, String(shuffleMode));
  }, [shuffleMode]);

  const addToQueue = useCallback((track: Track) => {
    setQueue(prev => {
      // Check if track already exists
      if (prev.some(t => t.id === track.id)) {
        return prev;
      }
      return [...prev, track];
    });
  }, []);

  const removeFromQueue = useCallback((trackId: string) => {
    setQueue(prev => prev.filter(t => t.id !== trackId));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const isInQueue = useCallback((trackId: string) => {
    return queue.some(t => t.id === trackId);
  }, [queue]);

  const getNextFromQueue = useCallback((playlist: Track[] = []) => {
    // If shuffle is ON and queue has songs, pick random from queue
    if (shuffleMode && queue.length > 0) {
      let availableQueue = queue.filter(t => t.id !== lastPlayedIdRef.current);
      if (availableQueue.length === 0) availableQueue = queue;
      const randomIndex = Math.floor(Math.random() * availableQueue.length);
      const track = availableQueue[randomIndex];
      lastPlayedIdRef.current = track.id;
      localStorage.setItem(LAST_PLAYED_STORAGE_KEY, track.id);
      // Remove from queue after playing
      setQueue(prev => prev.filter(t => t.id !== track.id));
      return track;
    }

    // If shuffle is ON and queue is empty, pick random from playlist
    if (shuffleMode && queue.length === 0 && playlist.length > 0) {
      let availablePlaylist = playlist.filter(t => t.id !== lastPlayedIdRef.current);
      if (availablePlaylist.length === 0) availablePlaylist = playlist;
      const randomIndex = Math.floor(Math.random() * availablePlaylist.length);
      const track = availablePlaylist[randomIndex];
      lastPlayedIdRef.current = track.id;
      localStorage.setItem(LAST_PLAYED_STORAGE_KEY, track.id);
      return track;
    }

    // If shuffle is OFF, play next from queue in order
    if (queue.length > 0) {
      const track = queue[0];
      lastPlayedIdRef.current = track.id;
      localStorage.setItem(LAST_PLAYED_STORAGE_KEY, track.id);
      setQueue(prev => prev.slice(1));
      return track;
    }

    // Queue is empty
    return null;
  }, [queue, shuffleMode]);

  const peekNextFromQueue = useCallback((playlist: Track[] = []) => {
    if (queue.length > 0) return queue[0];
    if (shuffleMode && playlist.length > 0) {
      return playlist.find(track => track.id !== lastPlayedIdRef.current) || playlist[0];
    }
    return null;
  }, [queue, shuffleMode]);

  const toggleShuffle = useCallback(() => {
    setShuffleMode(prev => !prev);
  }, []);

  const setLastPlayed = useCallback((trackId: string) => {
    lastPlayedIdRef.current = trackId;
    localStorage.setItem(LAST_PLAYED_STORAGE_KEY, trackId);
  }, []);

  return {
    queue,
    addToQueue,
    removeFromQueue,
    clearQueue,
    isInQueue,
    getNextFromQueue,
    peekNextFromQueue,
    shuffleMode,
    toggleShuffle,
    setLastPlayed,
  };
}
