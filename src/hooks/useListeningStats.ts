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

/** YYYY-MM-DD in the viewer's local time (so days, hours and streaks all agree). */
export const localDayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export type PersonaId = 'night-owl' | 'early-bird' | 'loyalist' | 'explorer' | 'streaker' | 'newcomer' | 'all-rounder';

export interface Persona {
  id: PersonaId;
  name: string;
  line: string;
}

export function guessGenre(title: string, channel: string): string {
  const text = `${title} ${channel}`.toLowerCase();
  for (const [genre, words] of Object.entries(GENRE_KEYWORDS)) {
    if (words.some((w) => text.includes(w))) return genre;
  }
  return 'Other';
}

export function useListeningStats(targetUserId?: string) {
  const { user } = useAuth();
  const subjectId = targetUserId || user?.id;
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!subjectId) {
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
        .eq('user_id', subjectId)
        .order('played_at', { ascending: false })
        .limit(5000),
      supabase
        .from('favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', subjectId),
    ]);
    setHistory((hist as HistoryRow[]) || []);
    setFavoritesCount(count || 0);
    setLoading(false);
  }, [subjectId]);

  useEffect(() => {
    load();
  }, [load]);

  // Live updates: refresh whenever a new play is recorded for this user.
  useEffect(() => {
    if (!subjectId) return;
    const channel = supabase
      .channel(`stats-history-${subjectId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'listening_history', filter: `user_id=eq.${subjectId}` },
        (payload) => {
          setHistory((prev) => [payload.new as HistoryRow, ...prev]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [subjectId]);

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
      const key = localDayKey(d);
      byDate.set(key, (byDate.get(key) || 0) + 1);
    }

    // Last 30 days activity series (oldest -> newest)
    const activity = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now - (29 - i) * 86400000);
      const key = localDayKey(d);
      return {
        date: key.slice(5),
        plays: byDate.get(key) || 0,
      };
    });

    const sortDesc = <T,>(m: Map<T, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, plays]) => ({ name: String(name), plays }));

    const todayKey = localDayKey(new Date());
    const todayRows = history.filter((r) => localDayKey(new Date(r.played_at)) === todayKey);
    const todayUnique = new Set(todayRows.map((r) => r.track_id)).size;

    // Last 12 weeks as a calendar grid (oldest -> newest, local days)
    const calendar = Array.from({ length: 84 }, (_, i) => {
      const d = new Date(now - (83 - i) * 86400000);
      const key = localDayKey(d);
      return { date: key, weekday: d.getDay(), plays: byDate.get(key) || 0 };
    });

    // Streaks: consecutive local days with at least one play
    let longestStreak = 0;
    let run = 0;
    const sortedDays = [...byDate.keys()].sort();
    let prev: number | null = null;
    for (const key of sortedDays) {
      const t = new Date(`${key}T12:00:00`).getTime();
      run = prev !== null && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1;
      longestStreak = Math.max(longestStreak, run);
      prev = t;
    }
    // Current streak counts back from today (or yesterday, if nothing played yet today)
    let currentStreak = 0;
    const cursor = new Date();
    if (!byDate.has(localDayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (byDate.has(localDayKey(cursor))) {
      currentStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const peakHourEntry = byHour.reduce((best, h) => (h.plays > best.plays ? h : best), byHour[0]);
    const peakHour = peakHourEntry.plays > 0 ? peakHourEntry.hour : null;
    const total = history.length;
    const nightPlays = byHour.filter((h) => h.hour >= 22 || h.hour < 4).reduce((s, h) => s + h.plays, 0);
    const morningPlays = byHour.filter((h) => h.hour >= 5 && h.hour < 10).reduce((s, h) => s + h.plays, 0);
    const repeatRate = total ? 1 - byTrack.size / total : 0;
    const discoveryRate = total ? byTrack.size / total : 0;

    let persona: Persona;
    if (total < 15) {
      persona = { id: 'newcomer', name: 'The Newcomer', line: 'Your sound is still taking shape. Keep playing.' };
    } else if (currentStreak >= 7) {
      persona = { id: 'streaker', name: 'The Streaker', line: `${currentStreak} days in a row. The music never stops.` };
    } else if (nightPlays / total > 0.35) {
      persona = { id: 'night-owl', name: 'The Night Owl', line: 'Most of your listening happens after dark.' };
    } else if (morningPlays / total > 0.35) {
      persona = { id: 'early-bird', name: 'The Early Bird', line: 'You start the day with a soundtrack.' };
    } else if (repeatRate > 0.6) {
      persona = { id: 'loyalist', name: 'The Loyalist', line: 'You know what you love and you play it again.' };
    } else if (discoveryRate > 0.7) {
      persona = { id: 'explorer', name: 'The Explorer', line: 'Almost every song you play is a different one.' };
    } else {
      persona = { id: 'all-rounder', name: 'The All-Rounder', line: 'A balanced mix of favourites and fresh finds.' };
    }

    return {
      calendar,
      currentStreak,
      longestStreak,
      peakHour,
      repeatRate,
      discoveryRate,
      activeDays: byDate.size,
      persona,
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
      todayPlays: todayRows.length,
      todayUnique,
      todaySeconds: todayRows.length * AVG_TRACK_SECONDS,
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
