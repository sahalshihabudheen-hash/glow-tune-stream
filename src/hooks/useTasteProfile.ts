import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface TasteProfile {
  topArtists: string[];
  topKeywords: string[];
  query: string;
  loading: boolean;
}

const STOP_WORDS = new Set([
  'official', 'video', 'music', 'audio', 'lyrics', 'lyric', 'song', 'songs', 'full',
  'hd', 'the', 'and', 'feat', 'ft', 'with', 'live', 'new', 'remix', 'version', 'mv',
  'from', 'you', 'for', 'your', 'vevo', 'topic', 'records', 'entertainment',
]);

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[\[\](){}|"'“”‘’.,!?/\\-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word) && !/^\d+$/.test(word));

const rank = (items: string[], limit: number) => {
  const counts = new Map<string, number>();
  items.forEach(item => counts.set(item, (counts.get(item) || 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
};

const cleanChannel = (channel: string) =>
  channel.replace(/\s*-\s*topic$/i, '').replace(/vevo$/i, '').trim();

/**
 * Analyses the user's listening history (and optional seed tracks such as the
 * current playlist) to derive the artists and keywords they gravitate towards.
 */
export function useTasteProfile(seedTracks: { title: string; channel: string }[] = []) {
  const { user } = useAuth();
  const [topArtists, setTopArtists] = useState<string[]>([]);
  const [topKeywords, setTopKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const seedSignature = seedTracks.map(track => track.title).join('|');

  const analyse = useCallback(async () => {
    setLoading(true);
    try {
      let history: { track_title: string; track_channel: string }[] = [];

      if (user) {
        const { data } = await supabase
          .from('listening_history')
          .select('track_title, track_channel')
          .eq('user_id', user.id)
          .order('played_at', { ascending: false })
          .limit(60);
        history = data || [];
      }

      const combined = [
        ...history.map(row => ({ title: row.track_title || '', channel: row.track_channel || '' })),
        ...seedTracks,
      ];

      const artists = rank(
        combined.map(track => cleanChannel(track.channel || '')).filter(Boolean),
        4
      );
      const keywords = rank(combined.flatMap(track => tokenize(track.title || '')), 5);

      setTopArtists(artists);
      setTopKeywords(keywords);
    } catch (error) {
      console.error('Taste profile analysis failed:', error);
    } finally {
      setLoading(false);
    }
  }, [user, seedSignature]);

  useEffect(() => {
    analyse();
  }, [analyse]);

  const query = [
    ...topArtists.slice(0, 2),
    ...topKeywords.slice(0, 2),
  ].join(' ').trim();

  return {
    topArtists,
    topKeywords,
    query: query ? `${query} songs` : 'trending songs this week',
    loading,
    refresh: analyse,
  };
}
