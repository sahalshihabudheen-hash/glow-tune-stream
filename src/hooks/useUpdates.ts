import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  UPDATES_EVENT,
  UPDATES_KEY,
  pickLatest,
  sanitizeReleases,
  type UpdateRelease,
} from '@/lib/updates';

/**
 * Reads the "What's new" releases from `app_settings`.
 * `releases` includes drafts (for the admin editor); `published` and `latest` are what users see.
 */
export function useUpdates() {
  const [releases, setReleases] = useState<UpdateRelease[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('app_settings').select('value').eq('key', UPDATES_KEY).maybeSingle();
      if (error) throw error;
      setReleases(sanitizeReleases(data?.value, false));
    } catch (err) {
      console.warn('Failed to fetch updates:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener(UPDATES_EVENT, handler);
    return () => window.removeEventListener(UPDATES_EVENT, handler);
  }, [refresh]);

  /**
   * Admin only (the database rejects anyone else). Replaces the whole list.
   * Reads first so we know whether the row exists, then updates or inserts.
   */
  const save = useCallback(async (next: UpdateRelease[]) => {
    const clean = sanitizeReleases({ releases: next }, false);
    const { data: current, error: readError } = await supabase
      .from('app_settings')
      .select('key')
      .eq('key', UPDATES_KEY)
      .maybeSingle();
    if (readError) throw readError;

    const value = { releases: clean } as any;
    if (current) {
      const { data: updated, error } = await supabase
        .from('app_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', UPDATES_KEY)
        .select('key');
      if (error) throw error;
      if (!updated || updated.length === 0) throw new Error('Only admins can edit updates');
    } else {
      const { error } = await supabase.from('app_settings').insert({ key: UPDATES_KEY, value });
      if (error) throw error;
    }

    setReleases(clean);
    window.dispatchEvent(new Event(UPDATES_EVENT));
    return clean;
  }, []);

  const published = useMemo(() => releases.filter((r) => r.published), [releases]);
  const latest = useMemo(() => pickLatest(releases), [releases]);

  return { releases, published, latest, loading, refresh, save };
}
