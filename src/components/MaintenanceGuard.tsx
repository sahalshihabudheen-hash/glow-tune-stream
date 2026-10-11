import { ReactNode, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useMaintenanceMode } from '@/hooks/useMaintenanceMode';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import MaintenancePage from '@/pages/MaintenancePage';
import Auth from '@/pages/Auth';
import { Loader2 } from 'lucide-react';

interface MaintenanceGuardProps {
  children: ReactNode;
}

const MaintenanceGuard = ({ children }: MaintenanceGuardProps) => {
  const { maintenance, loading, refetch } = useMaintenanceMode();
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckDone, setAdminCheckDone] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        if (!user) {
          setIsAdmin(false);
          return;
        }
        // Check via database role
        const { data, error } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
        if (error) throw error;
        setIsAdmin(!!data);
      } catch (err) {
        console.warn('Admin check failed or timed out:', err);
        setIsAdmin(false);
      } finally {
        setAdminCheckDone(true); // Always mark done, even if user is null
      }
    };
    checkAdmin();
  }, [user]);

  // While maintenance is on, re-check periodically so message edits (or maintenance
  // ending) reach people who already have the page open, without a manual refresh.
  useEffect(() => {
    if (!maintenance.enabled) return;
    const id = setInterval(refetch, 30_000);
    return () => clearInterval(id);
  }, [maintenance.enabled, refetch]);

  // Always allow admin route and auth route
  if (location.pathname === '/admin' || location.pathname === '/auth') {
    return <>{children}</>;
  }

  // Still loading
  if (loading || authLoading || !adminCheckDone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // If maintenance mode is off, show normal app
  if (!maintenance.enabled) {
    return <>{children}</>;
  }

  // If not logged in during maintenance, redirect to auth
  if (!user) {
    return <Auth />;
  }

  // Admins always bypass maintenance
  const userEmail = user?.email || '';

  // If user is admin or in the allowed list, let them through
  const isAllowed = isAdmin || maintenance.allowed_emails.includes(userEmail);

  if (isAllowed) {
    return <>{children}</>;
  }

  // Show maintenance page
  return <MaintenancePage config={maintenance.custom_message} />;
};

export default MaintenanceGuard;
