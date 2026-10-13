import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UsageSeriesPoint {
  date: string;
  plays: number;
  activeUsers: number;
  signups: number;
}

export interface UsageStats {
  generatedAt: string;
  days: number;
  truncated: boolean;
  totals: {
    users: number;
    confirmedUsers: number;
    newUsers: number;
    playsInRange: number;
    playsAllTime: number;
    favorites: number;
    playlists: number;
    playlistItems: number;
    listenersInRange: number;
    avgPlaysPerListener: number;
    uniqueTracksInRange: number;
    uniqueArtistsInRange: number;
    gameSessions: number;
    activeGameSessions: number;
  };
  activity: { activeNow: number; dau: number; wau: number; mau: number; stickiness: number };
  series: UsageSeriesPoint[];
  /** [weekday 0=Sun..6=Sat][hour 0..23] play counts in the admin's local time */
  heatmap: number[][];
  topTracks: { id: string; title: string; channel: string; thumbnail: string; count: number; listeners: number }[];
  topArtists: { name: string; count: number; listeners: number }[];
  genres: { name: string; count: number }[];
  topListeners: { id: string; name: string; avatar_url: string | null; count: number; uniqueTracks: number; lastPlayed: string }[];
  countries: { name: string; count: number }[];
  devices: { name: string; count: number }[];
  vpnUsers: number;
  locatedUsers: number;
  games: { name: string; count: number; minutes: number; players: number }[];
}

export type UsageRange = 7 | 30 | 90;

/**
 * Loads app-wide usage numbers (all users) from the admin-only backend function.
 * The function itself verifies the admin role, so a non-admin simply gets an error.
 */
export function useAdminUsageStats(days: UsageRange, enabled: boolean) {
  const [data, setData] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Please sign in again.');

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-usage-stats`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ days, tzOffset: -new Date().getTimezoneOffset() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
      setData(body as UsageStats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load usage stats');
    } finally {
      setLoading(false);
    }
  }, [days, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep the "live" numbers fresh while the page stays open.
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(load, 60000);
    return () => window.clearInterval(id);
  }, [enabled, load]);

  return { data, loading, error, refresh: load };
}
