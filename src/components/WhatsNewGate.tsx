import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUpdates } from '@/hooks/useUpdates';
import { getSeenUpdate, markUpdateSeen, shouldShowUpdate } from '@/lib/updates';
import WhatsNewOverlay from '@/components/WhatsNewOverlay';

/**
 * Shows the latest published update once to each signed-in user.
 *
 * - Waits until the user has finished first-run onboarding and the tutorial, so it never
 *   stacks on top of them (a brand-new user sees it from their next visit).
 * - "Seen" is remembered per user on this device; publishing a new release (or using
 *   "re-send" in the admin editor) shows it again.
 * - Reads the session directly instead of useAuth(), which fires a location-tracking
 *   request every time it is mounted.
 */
const WhatsNewGate = () => {
  const location = useLocation();
  const { published, latest } = useUpdates();
  const [userId, setUserId] = useState<string | null>(null);
  const [firstRunDone, setFirstRunDone] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setUserId(data.session?.user?.id ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setFirstRunDone(false);
    if (!userId) return;
    let cancelled = false;
    supabase
      .from('user_preferences')
      .select('onboarding_complete, tutorial_complete')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setFirstRunDone(!!data?.onboarding_complete && !!data?.tutorial_complete);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const latestNotifyId = latest?.notifyId ?? null;
  useEffect(() => {
    if (!userId || !firstRunDone || !latest) return;
    if (location.pathname === '/auth') return;
    if (shouldShowUpdate(latest, getSeenUpdate(userId))) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, firstRunDone, latestNotifyId, location.pathname]);

  const close = useCallback(() => {
    if (userId && latest) markUpdateSeen(userId, latest.notifyId);
    setOpen(false);
  }, [userId, latest]);

  if (!open || !latest) return null;
  return <WhatsNewOverlay releases={published} latestId={latest.id} onClose={close} />;
};

export default WhatsNewGate;
