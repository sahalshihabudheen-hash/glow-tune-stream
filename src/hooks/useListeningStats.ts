import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface HistoryRow {
  id: string;
  track_id: string;
  track_title: string;
  track_thumbnail: string;
  track_channel: string;
  played_at: string;
}

export interface TrackStat {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
  plays: number;
  lastPlayed: string;
}

/** Average play length used to estimate listening time (no duration stored in history). */
export const AVG_TRACK_SECONDS = 210;

const GENRE_KEYWORDS: Record<string, string[]> = {
  Lofi: ['lofi', 'lo-fi', 'chill beats', 'study'],
  'Hip Hop': ['rap', 'hip hop', 'hiphop', 'trap', 'drill'],
  EDM: ['edm', 'remix', 'drop', 'festival', 'house', 'techno', 'dubstep', 'bass'],
  Rock: ['rock', 'metal', 'band', 'guitar', 'punk'],
  Pop: ['pop', 'official video', 'official music video'],
  Classical: ['classical', 'piano', 'orchestra', 'symphony', 'violin'],
  Jazz: ['jazz', 'blues', 'saxophone', 'soul'],
  Devotional: ['bhajan', 'devotional', 'mantra', 'gospel'],
  Bollywood: ['bollywood', 'hindi', 'filmy'],
  Instrumental: ['instrumental', 'cover', 'karaoke', 'bgm', 'theme'],
};

export function guessGenre(title: string, channel: string): string {
  const text = `${title} ${channel}`.toLowerCase();
  for (const [genre, words] of Object.entries(GENRE_KEYWORDS)) {
    if (words.some((w) => text.includes(w))) return genre;
  }
  return 'Other';
}

export function useListeningStats() {
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setHistory([]);
      setFavoritesCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: hist }, { count }] = await Promise.all([
      supabase
        .from('listening_history')
        .select('*')
        .eq('user_id', user.id)
        .order('played_at', { ascending: false })
        .limit(5000),
      supabase
        .from('favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id),
    ]);
    setHistory((hist as HistoryRow[]) || []);
    setFavoritesCount(count || 0);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Live updates: refresh whenever a new play is recorded for this user.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`stats-history-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'listening_history', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setHistory((prev) => [payload.new as HistoryRow, ...prev]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const stats = useMemo(() => {
    const now = Date.now();
    const inRange = (row: HistoryRow, days: number) =>
      now - new Date(row.played_at).getTime() <= days * 86400000;

    const week = history.filter((r) => inRange(r, 7));
    const month = history.filter((r) => inRange(r, 30));

    const byTrack = new Map<string, TrackStat>();
    const byArtist = new Map<string, number>();
    const byGenre = new Map<string, number>();
    const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, plays: 0 }));
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const byWeekday = dayNames.map((day) => ({ day, plays: 0 }));
    const byDate = new Map<string, number>();

    for (const row of history) {
      const existing = byTrack.get(row.track_id);
      if (existing) existing.plays += 1;
      else
        byTrack.set(row.track_id, {
          id: row.track_id,
          title: row.track_title,
          thumbnail: row.track_thumbnail,
          channel: row.track_channel,
          plays: 1,
          lastPlayed: row.played_at,
        });

      byArtist.set(row.track_channel, (byArtist.get(row.track_channel) || 0) + 1);
      const genre = guessGenre(row.track_title, row.track_channel);
      byGenre.set(genre, (byGenre.get(genre) || 0) + 1);

      const d = new Date(row.played_at);
      byHour[d.getHours()].plays += 1;
      byWeekday[d.getDay()].plays += 1;
      const key = d.toISOString().slice(0, 10);
      byDate.set(key, (byDate.get(key) || 0) + 1);
    }

    // Last 30 days activity series (oldest -> newest)
    const activity = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now - (29 - i) * 86400000);
      const key = d.toISOString().slice(0, 10);
      return {
        date: key.slice(5),
        plays: byDate.get(key) || 0,
      };
    });

    const sortDesc = <T,>(m: Map<T, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, plays]) => ({ name: String(name), plays }));

    return {
      totalPlays: history.length,
      uniqueTracks: byTrack.size,
      uniqueArtists: byArtist.size,
      totalSeconds: history.length * AVG_TRACK_SECONDS,
      weekPlays: week.length,
      monthPlays: month.length,
      weekSeconds: week.length * AVG_TRACK_SECONDS,
      monthSeconds: month.length * AVG_TRACK_SECONDS,
      topTracks: [...byTrack.values()].sort((a, b) => b.plays - a.plays),
      topArtists: sortDesc(byArtist),
      topGenres: sortDesc(byGenre),
      byHour,
      byWeekday,
      activity,
      recent: history.slice(0, 20),
      favoritesCount,
    };
  }, [history, favoritesCount]);

  return { ...stats, loading, refresh: load };
}

export function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
