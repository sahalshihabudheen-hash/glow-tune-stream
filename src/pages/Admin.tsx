import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Shield, ShieldAlert, Users, LogOut, ArrowLeft, Loader2, Music, ListMusic, Clock, Gamepad2, MapPin, Smartphone, Monitor, Laptop, Tablet, Copy, KeyRound, Wrench, X, Plus, Trash2, Circle, Search, Watch, Wifi, WifiOff, Key, RefreshCw, CheckCircle, XCircle, AlertTriangle, GraduationCap, Settings2, MessageCircle, ScrollText, Download, Upload, Zap, Activity, BarChart3 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useMaintenanceMode } from '@/hooks/useMaintenanceMode';
import AdminTutorial from '@/components/AdminTutorial';
import AdminAppSettings from '@/components/AdminAppSettings';
import AdminChat from '@/components/AdminChat';
import AdminActivityLogs from '@/components/AdminActivityLogs';
import AdminHealthMonitor from '@/components/AdminHealthMonitor';

const COUNTRY_TO_CODE: Record<string, string> = {
  'Afghanistan': 'AF', 'Albania': 'AL', 'Algeria': 'DZ', 'Argentina': 'AR', 'Australia': 'AU',
  'Austria': 'AT', 'Bangladesh': 'BD', 'Belgium': 'BE', 'Brazil': 'BR', 'Canada': 'CA',
  'Chile': 'CL', 'China': 'CN', 'Colombia': 'CO', 'Czech Republic': 'CZ', 'Czechia': 'CZ',
  'Denmark': 'DK', 'Egypt': 'EG', 'Finland': 'FI', 'France': 'FR', 'Germany': 'DE',
  'Greece': 'GR', 'Hong Kong': 'HK', 'Hungary': 'HU', 'India': 'IN', 'Indonesia': 'ID',
  'Iran': 'IR', 'Iraq': 'IQ', 'Ireland': 'IE', 'Israel': 'IL', 'Italy': 'IT',
  'Japan': 'JP', 'Kenya': 'KE', 'Kuwait': 'KW', 'Malaysia': 'MY', 'Mexico': 'MX',
  'Nepal': 'NP', 'Netherlands': 'NL', 'New Zealand': 'NZ', 'Nigeria': 'NG', 'Norway': 'NO',
  'Pakistan': 'PK', 'Philippines': 'PH', 'Poland': 'PL', 'Portugal': 'PT', 'Qatar': 'QA',
  'Romania': 'RO', 'Russia': 'RU', 'Saudi Arabia': 'SA', 'Singapore': 'SG', 'South Africa': 'ZA',
  'South Korea': 'KR', 'Spain': 'ES', 'Sri Lanka': 'LK', 'Sweden': 'SE', 'Switzerland': 'CH',
  'Taiwan': 'TW', 'Thailand': 'TH', 'Turkey': 'TR', 'Ukraine': 'UA', 'United Arab Emirates': 'AE',
  'United Kingdom': 'UK', 'United States': 'US', 'Vietnam': 'VN',
};

const getCountryFlagUrl = (country: string | undefined): string | null => {
  if (!country) return null;
  const code = COUNTRY_TO_CODE[country]?.toLowerCase();
  if (!code) return null;
  return `https://flagcdn.com/w160/${code}.png`;
};

const VPN_KEYWORDS = ['vpn', 'proxy', 'hosting', 'datacenter', 'data center', 'cloud', 'server', 'colocation', 'colo', 'digital ocean', 'digitalocean', 'amazon', 'aws', 'google cloud', 'azure', 'linode', 'vultr', 'ovh', 'hetzner', 'contabo'];

const isLikelyVpn = (user: AdminUser): boolean => {
  if (user.location?.is_vpn) return true;
  if (!user.location?.isp) return false;
  const lower = user.location.isp.toLowerCase();
  return VPN_KEYWORDS.some((kw) => lower.includes(kw));
};

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  roles: string[];
  display_name: string | null;
  avatar_url: string | null;
  location: {
    country: string;
    state: string;
    city: string;
    timezone: string;
    isp: string;
    last_updated: string;
    device_type: string | null;
    device_info: string | null;
    is_vpn: boolean;
  } | null;
}

interface ListeningHistoryItem {
  id: string;
  user_id: string;
  user_email: string;
  track_id: string;
  track_title: string;
  track_thumbnail: string;
  track_channel: string;
  played_at: string;
}

interface PlaylistWithItems {
  id: string;
  name: string;
  description: string | null;
  user_id: string;
  user_email: string;
  created_at: string;
  playlist_items: {
    id: string;
    track_id: string;
    track_title: string;
    track_thumbnail: string;
    track_channel: string;
  }[];
}

interface GameSession {
  id: string;
  user_id: string;
  user_email: string;
  game_name: string;
  score: number;
  gems_collected: number;
  duration_seconds: number;
  track_playing: string | null;
  track_source: string | null;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
}

const Admin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [listeningHistory, setListeningHistory] = useState<ListeningHistoryItem[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistWithItems[]>([]);
  const [gameSessions, setGameSessions] = useState<GameSession[]>([]);
  const [activeGamersCount, setActiveGamersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [youtubeKeys, setYoutubeKeys] = useState<{key: string; status: string; message: string; enabled?: boolean; isCurrentlyUsed?: boolean; deletable?: boolean}[]>([]);
  const [backupKeys, setBackupKeys] = useState<{key: string; status: string; message: string}[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addKeyDialogOpen, setAddKeyDialogOpen] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [addingKey, setAddingKey] = useState(false);
  const [addBackupKeyDialogOpen, setAddBackupKeyDialogOpen] = useState(false);
  const [newBackupKeyValue, setNewBackupKeyValue] = useState('');
  const [newBackupKeyName, setNewBackupKeyName] = useState('');
  const [addingBackupKey, setAddingBackupKey] = useState(false);
  
  // Admin login state
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Password reset state
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Delete user state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = useState<AdminUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Maintenance mode
  const { maintenance, toggleMaintenance, updateAllowedEmails } = useMaintenanceMode();
  const [allowedEmailInput, setAllowedEmailInput] = useState('');
  const [roleLoading, setRoleLoading] = useState<string | null>(null);

  // Quota reset countdown timer
  const [quotaResetCountdown, setQuotaResetCountdown] = useState('');
  
  // Auto-maintenance
  const [autoMaintenanceEnabled, setAutoMaintenanceEnabled] = useState(false);
  
  // APK management
  const [apkUploading, setApkUploading] = useState(false);
  const [apkFiles, setApkFiles] = useState<{ name: string; url: string; size: number; uploaded_at: string; version: string }[]>([]);
  const apkInputRef = useRef<HTMLInputElement>(null);
  const [quotaResetLocalTime, setQuotaResetLocalTime] = useState('');
  const [pacificCurrentTime, setPacificCurrentTime] = useState('');

  // Admin tutorial
  const adminTutorialKey = user ? `admin_tutorial_done_${user.id}` : '';
  const [showAdminTutorial, setShowAdminTutorial] = useState(false);

  useEffect(() => {
    if (isAdminLoggedIn && adminTutorialKey && !localStorage.getItem(adminTutorialKey)) {
      setShowAdminTutorial(true);
    }
  }, [isAdminLoggedIn, adminTutorialKey]);

  const completeAdminTutorial = () => {
    if (adminTutorialKey) localStorage.setItem(adminTutorialKey, 'true');
    setShowAdminTutorial(false);
  };

  const replayAdminTutorial = () => {
    setShowAdminTutorial(true);
  };

  useEffect(() => {
    const pacificDateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const getTimeZoneOffsetMs = (date: Date, timeZone: string) => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).formatToParts(date);

      const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
      const year = get('year');
      const month = get('month');
      const day = get('day');
      const hour = get('hour');
      const minute = get('minute');
      const second = get('second');

      const asUtcTimestamp = Date.UTC(year, month - 1, day, hour, minute, second);
      return asUtcTimestamp - date.getTime();
    };

    const zonedDateTimeToUtc = (
      year: number,
      month: number,
      day: number,
      hour: number,
      minute: number,
      second: number,
      timeZone: string,
    ) => {
      let utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
      // Run twice to stabilize around DST boundaries
      for (let i = 0; i < 2; i += 1) {
        const offset = getTimeZoneOffsetMs(utcDate, timeZone);
        utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second) - offset);
      }
      return utcDate;
    };

    const calcCountdown = () => {
      const now = new Date();
      const pacificTodayParts = pacificDateFormatter
        .formatToParts(now)
        .reduce<Record<string, string>>((acc, part) => {
          if (part.type !== 'literal') acc[part.type] = part.value;
          return acc;
        }, {});

      const pacificYear = Number(pacificTodayParts.year);
      const pacificMonth = Number(pacificTodayParts.month);
      const pacificDay = Number(pacificTodayParts.day);

      const pacificTodayUtcBase = Date.UTC(pacificYear, pacificMonth - 1, pacificDay);
      const pacificTomorrow = new Date(pacificTodayUtcBase + 24 * 60 * 60 * 1000);

      const nextMidnightPacificUtc = zonedDateTimeToUtc(
        pacificTomorrow.getUTCFullYear(),
        pacificTomorrow.getUTCMonth() + 1,
        pacificTomorrow.getUTCDate(),
        0,
        0,
        0,
        'America/Los_Angeles',
      ).getTime();

      const diff = Math.max(0, nextMidnightPacificUtc - now.getTime());
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const localReset = new Date(nextMidnightPacificUtc).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
        hour12: true,
      });
      setQuotaResetLocalTime(localReset);

      const pacificNow = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(now);
      setPacificCurrentTime(pacificNow);

      if (hours > 0) {
        setQuotaResetCountdown(`~${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setQuotaResetCountdown(`~${minutes}m`);
      } else {
        setQuotaResetCountdown(`${seconds}s`);
      }
    };

    calcCountdown();
    const interval = setInterval(calcCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [deviceFilter, setDeviceFilter] = useState<'all' | 'Phone' | 'Desktop PC' | 'Laptop' | 'Tablet' | 'Smartwatch'>('all');
  const [vpnFilter, setVpnFilter] = useState<'all' | 'vpn' | 'no-vpn'>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');

  const handleToggleAdminRole = async (targetUser: AdminUser) => {
    const isCurrentlyAdmin = targetUser.roles.includes('admin');
    const action = isCurrentlyAdmin ? 'revoke' : 'grant';
    
    try {
      setRoleLoading(targetUser.id);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-role`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ target_user_id: targetUser.id, action }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      toast.success(data.message);
      await logAdminAction('role_change', `${action === 'grant' ? 'Granted' : 'Revoked'} admin role for ${targetUser.email}`, targetUser.id, targetUser.email);
      // Update local state
      setUsers(prev => prev.map(u => {
        if (u.id === targetUser.id) {
          return {
            ...u,
            roles: action === 'grant' 
              ? [...u.roles, 'admin']
              : u.roles.filter(r => r !== 'admin'),
          };
        }
        return u;
      }));
    } catch (err: any) {
      toast.error(err.message || 'Failed to update role');
    } finally {
      setRoleLoading(null);
    }
  };

  // Check if current user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (authLoading) return;
      if (!user) {
        setIsAdminLoggedIn(false);
        setLoading(false);
        return;
      }
      // Authorization is based solely on the database admin role.
      const { data } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (data) {
        setIsAdminLoggedIn(true);
      } else {
        setIsAdminLoggedIn(false);
        setError('Access denied. You are not an admin.');
      }
      setLoading(false);
    };
    checkAdmin();
  }, [user, authLoading]);

  // Fetch data when admin is logged in
  useEffect(() => {
    if (isAdminLoggedIn) {
      fetchAllData();
    }
  }, [isAdminLoggedIn]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([fetchUsers(), fetchActivity(), fetchGameSessions(), fetchYoutubeKeyStatus(), fetchApkFiles(), fetchAutoMaintenanceSetting()]);
    setLoading(false);
  };

  const fetchAutoMaintenanceSetting = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'auto_maintenance')
      .maybeSingle();
    if (data?.value) {
      const val = data.value as unknown as { enabled: boolean };
      setAutoMaintenanceEnabled(val.enabled ?? false);
    }
  };

  const toggleAutoMaintenance = async (enabled: boolean) => {
    try {
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'auto_maintenance')
        .maybeSingle();

      if (existing) {
        await supabase
          .from('app_settings')
          .update({ value: { enabled } as any, updated_at: new Date().toISOString() })
          .eq('key', 'auto_maintenance');
      } else {
        await supabase
          .from('app_settings')
          .insert({ key: 'auto_maintenance', value: { enabled } as any });
      }
      setAutoMaintenanceEnabled(enabled);
      toast.success(enabled ? 'Auto-maintenance enabled' : 'Auto-maintenance disabled');
    } catch {
      toast.error('Failed to update auto-maintenance setting');
    }
  };

  const fetchApkFiles = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'apk_files')
      .maybeSingle();
    if (data?.value) {
      setApkFiles((data.value as any).files || []);
    }
  };

  const handleApkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.apk')) {
      toast.error('Only .apk files are allowed');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      toast.error('File must be under 100MB');
      return;
    }
    setApkUploading(true);
    try {
      const path = `apk/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('admin-chat')
        .upload(path, file, { contentType: 'application/vnd.android.package-archive' });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('admin-chat').getPublicUrl(path);
      
      const newFile = {
        name: file.name,
        url: urlData.publicUrl,
        size: file.size,
        uploaded_at: new Date().toISOString(),
        version: file.name.replace('.apk', '').replace(/.*v?(\d)/, '$1') || '1.0',
      };
      const updated = [...apkFiles, newFile];
      
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'apk_files')
        .maybeSingle();

      if (existing) {
        await supabase
          .from('app_settings')
          .update({ value: { files: updated } as any, updated_at: new Date().toISOString() })
          .eq('key', 'apk_files');
      } else {
        await supabase
          .from('app_settings')
          .insert({ key: 'apk_files', value: { files: updated } as any });
      }
      setApkFiles(updated);
      toast.success('APK uploaded successfully!');
    } catch (err) {
      toast.error('Failed to upload APK');
    } finally {
      setApkUploading(false);
      if (apkInputRef.current) apkInputRef.current.value = '';
    }
  };

  const deleteApkFile = async (index: number) => {
    const updated = apkFiles.filter((_, i) => i !== index);
    await supabase
      .from('app_settings')
      .update({ value: { files: updated } as any, updated_at: new Date().toISOString() })
      .eq('key', 'apk_files');
    setApkFiles(updated);
    toast.success('APK removed');
  };

  const fetchYoutubeKeyStatus = async () => {
    setKeysLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-youtube-keys`,
        { headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' } }
      );
      const data = await response.json();
      if (response.ok) {
        setYoutubeKeys(data.keys || []);
        setBackupKeys(data.backupKeys || []);
      }
    } catch (err) {
      console.error('Error fetching YouTube key status:', err);
    } finally {
      setKeysLoading(false);
    }
  };

  const toggleYoutubeKey = async (keyLabel: string, enabled: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-youtube-keys`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyLabel, enabled }),
        }
      );
      if (response.ok) {
        setYoutubeKeys(prev => prev.map(k => k.key === keyLabel ? { ...k, enabled, status: enabled ? 'active' : 'disabled', message: enabled ? 'Checking...' : 'Disabled', isCurrentlyUsed: false } : k));
        toast.success(`${keyLabel} ${enabled ? 'enabled' : 'disabled'}`);
        // Refresh status after toggle
        setTimeout(() => fetchYoutubeKeyStatus(), 1000);
      }
    } catch (err) {
      toast.error('Failed to toggle key');
    }
  };

  const addYoutubeKey = async () => {
    if (!newKeyValue.trim()) { toast.error('Please enter an API key'); return; }
    setAddingKey(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const keyName = newKeyName.trim() || `YOUTUBE_API_KEY_${youtubeKeys.length + 1}`;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-youtube-keys`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'add_key', keyName, keyValue: newKeyValue.trim() }),
        }
      );
      if (response.ok) {
        toast.success(`${keyName} added and activated!`);
        setAddKeyDialogOpen(false);
        setNewKeyValue('');
        setNewKeyName('');
        fetchYoutubeKeyStatus();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to add key');
      }
    } catch (err) {
      toast.error('Failed to add key');
    } finally {
      setAddingKey(false);
    }
  };

  const deletePrimaryKey = async (keyName: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      // Try to delete from extra keys
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-youtube-keys`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_key', keyName }),
        }
      );
      // Also disable it (for env-based keys that can't be deleted)
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-youtube-keys`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyLabel: keyName, enabled: false }),
        }
      );
      toast.success(`${keyName} removed`);
      fetchYoutubeKeyStatus();
    } catch (err) {
      toast.error('Failed to delete key');
    }
  };

  const addBackupKey = async () => {
    if (!newBackupKeyValue.trim()) { toast.error('Please enter an API key'); return; }
    setAddingBackupKey(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const keyName = newBackupKeyName.trim() || `BACKUP_API_${backupKeys.length + 1}`;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-youtube-keys`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'add_backup_key', keyName, keyValue: newBackupKeyValue.trim() }),
        }
      );
      if (response.ok) {
        toast.success(`Backup key ${keyName} added!`);
        setAddBackupKeyDialogOpen(false);
        setNewBackupKeyValue('');
        setNewBackupKeyName('');
        fetchYoutubeKeyStatus();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to add backup key');
      }
    } catch (err) {
      toast.error('Failed to add backup key');
    } finally {
      setAddingBackupKey(false);
    }
  };

  const deleteBackupKey = async (keyName: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-youtube-keys`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_backup_key', keyName }),
        }
      );
      if (response.ok) {
        toast.success(`Backup key ${keyName} deleted`);
        fetchYoutubeKeyStatus();
      }
    } catch (err) {
      toast.error('Failed to delete backup key');
    }
  };

  const fetchUsers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-list-users`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      if (response.ok) {
        const sorted = (data.users || []).sort((a: AdminUser, b: AdminUser) => {
          const dateA = a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : 0;
          const dateB = b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : 0;
          return dateB - dateA;
        });
        setUsers(sorted);
      }
    } catch (err: any) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchActivity = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-activity`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      if (response.ok) {
        setListeningHistory(data.listeningHistory || []);
        setPlaylists(data.playlists || []);
      }
    } catch (err: any) {
      console.error('Error fetching activity:', err);
    }
  };

  const fetchGameSessions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-game-sessions`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      if (response.ok) {
        setGameSessions(data.gameSessions || []);
        setActiveGamersCount(data.activeCount || 0);
      }
    } catch (err: any) {
      console.error('Error fetching game sessions:', err);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setError(null);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      if (data.user) {
        // Authorization is based solely on the database admin role.
        const { data: hasAdmin } = await supabase.rpc('has_role', {
          _user_id: data.user.id,
          _role: 'admin',
        });
        if (!hasAdmin) {
          await supabase.auth.signOut();
          throw new Error('Access denied. You are not an admin.');
        }
        setIsAdminLoggedIn(true);
        toast.success('Logged in as admin');
        logAdminAction('login', 'Admin logged in to dashboard');
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setIsAdminLoggedIn(false);
    navigate('/');
  };

  const copyPlaylistToAdmin = async (playlist: PlaylistWithItems) => {
    try {
      if (!user) return;
      
      // Create a new playlist for the admin
      const { data: newPlaylist, error: createError } = await supabase
        .from('playlists')
        .insert({
          user_id: user.id,
          name: `${playlist.name} (from ${playlist.user_email})`,
          description: playlist.description || `Copied from ${playlist.user_email}`,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Copy all playlist items
      if (playlist.playlist_items.length > 0) {
        const items = playlist.playlist_items.map((item, index) => ({
          playlist_id: newPlaylist.id,
          track_id: item.track_id,
          track_title: item.track_title,
          track_thumbnail: item.track_thumbnail,
          track_channel: item.track_channel,
          position: index,
        }));

        const { error: itemsError } = await supabase
          .from('playlist_items')
          .insert(items);

        if (itemsError) throw itemsError;
      }

      toast.success(`Playlist "${playlist.name}" copied to your account!`);
    } catch (err: any) {
      console.error('Error copying playlist:', err);
      toast.error('Failed to copy playlist');
    }
  };

  // Admin activity logger
  const logAdminAction = async (actionType: string, actionDetails: string, targetUserId?: string, targetEmail?: string) => {
    if (!user) return;
    try {
      await supabase.from('admin_activity_logs').insert({
        admin_id: user.id,
        admin_email: user.email || '',
        action_type: actionType,
        action_details: actionDetails,
        target_user_id: targetUserId || null,
        target_email: targetEmail || null,
      });
    } catch (err) {
      console.warn('Failed to log admin action:', err);
    }
  };


  const handleResetPassword = async () => {
    if (!resetTargetUser || !newPassword) return;
    setResetLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: resetTargetUser.id,
            newPassword,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      toast.success(`Password updated for ${resetTargetUser.email}`);
      await logAdminAction('password_reset', `Reset password for ${resetTargetUser.email}`, resetTargetUser.id, resetTargetUser.email);
      setResetDialogOpen(false);
      setNewPassword('');
      setResetTargetUser(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setResetLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTargetUser) return;
    setDeleteLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ target_user_id: deleteTargetUser.id }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      toast.success(`User ${deleteTargetUser.email} deleted`);
      await logAdminAction('user_delete', `Deleted user ${deleteTargetUser.email}`, deleteTargetUser.id, deleteTargetUser.email);
      setUsers(prev => prev.filter(u => u.id !== deleteTargetUser.id));
      setDeleteDialogOpen(false);
      setDeleteTargetUser(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete user');
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isUserOnline = (u: AdminUser): boolean => {
    const lastActive = u.location?.last_updated || u.last_sign_in_at;
    if (!lastActive) return false;
    const diffMs = Date.now() - new Date(lastActive).getTime();
    return diffMs < 5 * 60 * 1000; // 5 minutes
  };

  const onlineCount = users.filter(isUserOnline).length;

  const filteredUsers = users.filter((u) => {
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        u.email?.toLowerCase().includes(q) ||
        u.display_name?.toLowerCase().includes(q) ||
        u.location?.city?.toLowerCase().includes(q) ||
        u.location?.state?.toLowerCase().includes(q) ||
        u.location?.country?.toLowerCase().includes(q) ||
        u.location?.isp?.toLowerCase().includes(q) ||
        u.location?.device_info?.toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }
    // Status
    if (statusFilter === 'online' && !isUserOnline(u)) return false;
    if (statusFilter === 'offline' && isUserOnline(u)) return false;
    // Device
    if (deviceFilter !== 'all' && u.location?.device_type !== deviceFilter) return false;
    // VPN
    if (vpnFilter === 'vpn' && !isLikelyVpn(u)) return false;
    if (vpnFilter === 'no-vpn' && isLikelyVpn(u)) return false;
    // Country
    if (countryFilter !== 'all' && u.location?.country !== countryFilter) return false;
    return true;
  });

  // Get unique countries with counts
  const countryCounts = users.reduce<Record<string, number>>((acc, u) => {
    const country = u.location?.country || 'Unknown';
    acc[country] = (acc[country] || 0) + 1;
    return acc;
  }, {});
  const sortedCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Show login form if not authenticated or not admin
  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Admin Login</CardTitle>
            <CardDescription>
              Enter your admin credentials to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loginLoading}>
                {loginLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  'Login as Admin'
                )}
              </Button>
            </form>
            
            <div className="mt-4 text-center">
              <Button variant="link" onClick={() => navigate('/')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to App
              </Button>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm sm:text-lg truncate">Admin Dashboard</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={replayAdminTutorial} className="h-8 px-2 sm:px-3" title="Tutorial">
              <GraduationCap className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Tutorial</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/')} className="h-8 px-2 sm:px-3">
              <ArrowLeft className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Back to App</span>
            </Button>
            <Button variant="destructive" size="sm" onClick={handleSignOut} className="h-8 px-2 sm:px-3">
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <Tabs defaultValue="users" className="space-y-4 sm:space-y-6">
          <TabsList className="flex w-full overflow-x-auto no-scrollbar">
            <TabsTrigger value="users" className="flex items-center gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
              <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Activity</span>
            </TabsTrigger>
            <TabsTrigger value="playlists" className="flex items-center gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
              <ListMusic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Playlists</span>
            </TabsTrigger>
            <TabsTrigger value="games" className="flex items-center gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
              <Gamepad2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Games</span>
              {activeGamersCount > 0 && (
                <span className="ml-1 px-1 py-0.5 text-[10px] bg-green-500 text-white rounded-full">
                  {activeGamersCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="api-keys" className="flex items-center gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
              <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Keys</span>
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="flex items-center gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
              <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Maint.</span>
              {maintenance.enabled && (
                <span className="ml-1 w-2 h-2 rounded-full bg-destructive animate-pulse" />
              )}
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
              <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="app-settings" className="flex items-center gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
              <Settings2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">App</span>
            </TabsTrigger>
            <TabsTrigger value="apk" className="flex items-center gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">APK</span>
            </TabsTrigger>
            <TabsTrigger value="health" className="flex items-center gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
              <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Health</span>
            </TabsTrigger>
            {isAdminLoggedIn && (
              <TabsTrigger value="logs" className="flex items-center gap-1.5 text-xs sm:text-sm px-2 sm:px-3">
                <ScrollText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Logs</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-primary" />
                    <div>
                      <CardTitle>Registered Users</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        {users.length} total users
                        <span className="inline-flex items-center gap-1 text-xs">
                          <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
                          {onlineCount} online
                        </span>
                      </CardDescription>
                    </div>
                  </div>
                  <Button onClick={fetchAllData} variant="outline" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filter Bar */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, email, location, ISP..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                    {/* Status filter */}
                    {(['all', 'online', 'offline'] as const).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={statusFilter === s ? 'default' : 'outline'}
                        className="h-7 sm:h-8 text-[10px] sm:text-xs capitalize px-1.5 sm:px-3"
                        onClick={() => setStatusFilter(s)}
                      >
                        {s === 'online' && <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500 mr-0.5 sm:mr-1" />}
                        {s === 'offline' && <Circle className="w-2 h-2 fill-muted-foreground text-muted-foreground mr-0.5 sm:mr-1" />}
                        {s === 'all' ? `All (${users.length})` : s === 'online' ? `Online (${onlineCount})` : `Offline (${users.length - onlineCount})`}
                      </Button>
                    ))}
                    {/* Device filter */}
                    {(['all', 'Phone', 'Desktop PC', 'Laptop', 'Tablet', 'Smartwatch'] as const).map((d) => {
                      const icon = d === 'Phone' ? <Smartphone className="w-3 h-3 mr-1" /> 
                        : d === 'Tablet' ? <Tablet className="w-3 h-3 mr-1" />
                        : d === 'Laptop' ? <Laptop className="w-3 h-3 mr-1" />
                        : d === 'Smartwatch' ? <Watch className="w-3 h-3 mr-1" />
                        : d === 'Desktop PC' ? <Monitor className="w-3 h-3 mr-1" />
                        : null;
                      if (d === 'all') return null;
                      const count = users.filter(u => u.location?.device_type === d).length;
                      if (count === 0) return null;
                      return (
                        <Button
                          key={d}
                          size="sm"
                          variant={deviceFilter === d ? 'default' : 'outline'}
                          className="h-8 text-xs"
                          onClick={() => setDeviceFilter(deviceFilter === d ? 'all' : d)}
                        >
                          {icon}{d} ({count})
                        </Button>
                      );
                    })}
                    {/* VPN filter */}
                    <Button
                      size="sm"
                      variant={vpnFilter === 'vpn' ? 'destructive' : 'outline'}
                      className="h-8 text-xs"
                      onClick={() => setVpnFilter(vpnFilter === 'vpn' ? 'all' : 'vpn')}
                    >
                      <ShieldAlert className="w-3 h-3 mr-1" />
                      VPN ({users.filter(u => isLikelyVpn(u)).length})
                    </Button>
                    {/* Country filter */}
                    {sortedCountries.length > 1 && (
                      <select
                        value={countryFilter}
                        onChange={(e) => setCountryFilter(e.target.value)}
                        className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                      >
                        <option value="all">🌍 All Countries</option>
                        {sortedCountries.map(([country, count]) => (
                          <option key={country} value={country}>
                            {country} ({count})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Showing {filteredUsers.length} of {users.length} users
                </p>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-3">
                      {filteredUsers.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">No users found</div>
                      ) : (
                        filteredUsers.map((u) => {
                          const online = isUserOnline(u);
                          return (
                            <div
                              key={u.id}
                              className="relative flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border border-border bg-card hover:bg-secondary/30 transition-colors overflow-hidden"
                            >
                              {/* Country flag watermark */}
                              {getCountryFlagUrl(u.location?.country) && (
                                <img
                                  src={getCountryFlagUrl(u.location?.country)!}
                                  alt=""
                                  className="absolute right-3 top-1/2 -translate-y-1/2 w-16 h-auto opacity-[0.12] pointer-events-none select-none"
                                />
                              )}
                              {/* Online indicator + Avatar + Email */}
                              <div className="flex items-center gap-3 min-w-0 sm:w-[240px]">
                                <div className="relative flex-shrink-0">
                                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary uppercase overflow-hidden">
                                    {u.avatar_url ? (
                                      <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      u.email?.[0] || '?'
                                    )}
                                  </div>
                                  <Circle
                                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${
                                      online
                                        ? 'fill-emerald-500 text-emerald-500'
                                        : 'fill-muted-foreground/40 text-muted-foreground/40'
                                    }`}
                                  />
                                </div>
                                <div className="min-w-0">
                                  {u.display_name && (
                                    <p className="text-sm font-semibold truncate text-foreground">{u.display_name}</p>
                                  )}
                                  <p className={`text-sm truncate ${u.display_name ? 'text-muted-foreground text-xs' : 'font-medium'}`}>{u.email}</p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {online ? (
                                      <span className="text-emerald-500 font-medium">Online now</span>
                                    ) : (
                                      <>Last seen {formatDate(u.last_sign_in_at)}</>
                                    )}
                                  </p>
                                </div>
                              </div>

                              {/* Location */}
                              <div className="flex items-center gap-2 sm:w-[180px] min-w-0">
                                <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                {u.location ? (
                                  <div className="min-w-0">
                                    <p className="text-sm truncate">
                                      {u.location.city}, {u.location.state}
                                      {isLikelyVpn(u) && (
                                        <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/15 text-destructive">
                                          <ShieldAlert className="w-2.5 h-2.5" />
                                          VPN
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground truncate">{u.location.country}</p>
                                    {u.location.isp && (
                                      <p className="text-[10px] text-muted-foreground/70 truncate">📡 {u.location.isp}</p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">No data</span>
                                )}
                              </div>

                              {/* Device */}
                              <div className="flex items-center gap-2 sm:min-w-[180px] sm:max-w-[260px]">
                                {u.location?.device_type ? (
                                  <>
                                    {u.location.device_type === 'Phone' ? (
                                      <Smartphone className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                    ) : u.location.device_type === 'Tablet' ? (
                                      <Tablet className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                    ) : u.location.device_type === 'Laptop' ? (
                                      <Laptop className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                    ) : (
                                      <Monitor className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                    )}
                                    <div className="min-w-0">
                                      <p className="text-sm">{u.location.device_type}</p>
                                      {u.location.device_info && (
                                        <p className="text-[11px] text-muted-foreground break-words">{u.location.device_info}</p>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <Monitor className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                    <span className="text-xs text-muted-foreground italic">Unknown</span>
                                  </>
                                )}
                              </div>

                              {/* Role + Status badges */}
                              <div className="flex items-center gap-1.5 sm:w-[120px]">
                                {u.roles.includes('admin') && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-primary/15 text-primary font-semibold">
                                    <Shield className="w-3 h-3" />
                                    Admin
                                  </span>
                                )}
                                {u.email_confirmed_at ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-500">
                                    Verified
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-amber-500/10 text-amber-500">
                                    Pending
                                  </span>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                                {u.email !== user?.email && !u.roles.includes('admin') && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleToggleAdminRole(u)}
                                    disabled={roleLoading === u.id}
                                    className="text-xs h-7 gap-1"
                                  >
                                    {roleLoading === u.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <>
                                        <Shield className="w-3 h-3" />
                                        Admin
                                      </>
                                    )}
                                  </Button>
                                )}
                                {u.email !== user?.email && u.roles.includes('admin') && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggleAdminRole(u)}
                                    disabled={roleLoading === u.id}
                                    className="text-xs text-destructive hover:text-destructive h-7 px-2"
                                  >
                                    {roleLoading === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Revoke'}
                                  </Button>
                                )}
                                {u.id !== user?.id && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title="View user statistics"
                                    onClick={() => navigate(`/stats/${u.id}`, { state: { email: u.email, display_name: u.display_name } })}
                                    className="text-xs h-7 gap-1"
                                  >
                                    <BarChart3 className="w-3 h-3" />
                                    Stats
                                  </Button>
                                )}
                                {u.email !== user?.email && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setResetTargetUser(u);
                                        setNewPassword('');
                                        setResetDialogOpen(true);
                                      }}
                                      className="text-xs h-7 gap-1"
                                    >
                                      <KeyRound className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setDeleteTargetUser(u);
                                        setDeleteDialogOpen(true);
                                      }}
                                      className="text-xs text-destructive hover:text-destructive h-7"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-primary" />
                  <div>
                    <CardTitle>Listening Activity</CardTitle>
                    <CardDescription>See what users are listening to</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  {listeningHistory.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      No listening activity yet
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {listeningHistory.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 sm:gap-4 p-2 sm:p-3 rounded-lg bg-secondary/50"
                        >
                          <img
                            src={item.track_thumbnail}
                            alt={item.track_title}
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded object-cover flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.track_title}</p>
                            <p className="text-xs sm:text-sm text-muted-foreground truncate">
                              {item.track_channel}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs sm:text-sm font-medium text-primary truncate max-w-[100px] sm:max-w-none">{item.user_email}</p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">{formatTimeAgo(item.played_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Playlists Tab */}
          <TabsContent value="playlists">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <ListMusic className="w-5 h-5 text-primary" />
                  <div>
                    <CardTitle>User Playlists</CardTitle>
                    <CardDescription>Browse all user playlists</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  {playlists.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      No playlists created yet
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {playlists.map((playlist) => (
                        <div
                          key={playlist.id}
                          className="p-4 rounded-lg border border-border"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                            <div className="min-w-0">
                              <h3 className="font-semibold text-sm sm:text-base truncate">{playlist.name}</h3>
                              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                                by {playlist.user_email} • {playlist.playlist_items.length} tracks
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyPlaylistToAdmin(playlist)}
                                className="flex items-center gap-1.5 h-7 text-xs"
                              >
                                <Copy className="w-3 h-3" />
                                <span className="hidden sm:inline">Copy to Mine</span>
                                <span className="sm:hidden">Copy</span>
                              </Button>
                              <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">
                                {formatDate(playlist.created_at)}
                              </span>
                            </div>
                          </div>
                          {playlist.playlist_items.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto pb-2">
                              {playlist.playlist_items.slice(0, 5).map((item) => (
                                <img
                                  key={item.id}
                                  src={item.track_thumbnail}
                                  alt={item.track_title}
                                  title={item.track_title}
                                  className="w-10 h-10 rounded object-cover flex-shrink-0"
                                />
                              ))}
                              {playlist.playlist_items.length > 5 && (
                                <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center text-xs text-muted-foreground flex-shrink-0">
                                  +{playlist.playlist_items.length - 5}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Games Tab */}
          <TabsContent value="games">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Gamepad2 className="w-5 h-5 text-primary" />
                    <div>
                      <CardTitle>Game Sessions</CardTitle>
                      <CardDescription>
                        Monitor users playing games
                        {activeGamersCount > 0 && (
                          <span className="ml-2 text-green-500 font-medium">
                            ({activeGamersCount} playing now)
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <Button onClick={fetchAllData} variant="outline" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  {gameSessions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      No game sessions recorded yet
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {gameSessions.map((session) => (
                        <div
                          key={session.id}
                          className={`p-4 rounded-lg border ${
                            session.is_active 
                              ? 'border-green-500/50 bg-green-500/5' 
                              : 'border-border bg-secondary/50'
                          }`}
                        >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                session.is_active ? 'bg-green-500/20' : 'bg-primary/20'
                              }`}>
                                <Gamepad2 className={`w-4 h-4 sm:w-5 sm:h-5 ${
                                  session.is_active ? 'text-green-500' : 'text-primary'
                                }`} />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm flex items-center gap-2 flex-wrap">
                                  {session.game_name}
                                  {session.is_active && (
                                    <span className="px-1.5 py-0.5 text-[10px] bg-green-500 text-white rounded-full animate-pulse">
                                      LIVE
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs sm:text-sm text-muted-foreground truncate">{session.user_email}</p>
                              </div>
                            </div>
                            <div className="text-left sm:text-right flex sm:block items-center gap-3 pl-10 sm:pl-0">
                              <p className="font-bold text-primary text-sm">{session.score} pts</p>
                              <p className="text-xs text-muted-foreground">
                                💎 {session.gems_collected}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-muted-foreground">
                            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                              {session.track_playing && (
                                <span className="flex items-center gap-1">
                                  <Music className="w-3 h-3" />
                                  <span className="truncate max-w-[120px] sm:max-w-[150px]">{session.track_playing}</span>
                                  {session.track_source && (
                                    <span className="text-primary">({session.track_source})</span>
                                  )}
                                </span>
                              )}
                              <span>
                                ⏱️ {Math.floor(session.duration_seconds / 60)}m {session.duration_seconds % 60}s
                              </span>
                            </div>
                            <span className="pl-0 sm:pl-0">{formatTimeAgo(session.started_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api-keys">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Key className="w-5 h-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">YouTube API Keys</CardTitle>
                      <CardDescription>Monitor quota status of all configured API keys</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAddKeyDialogOpen(true)}
                    >
                      <Plus className="w-4 h-4" />
                      <span className="ml-1 hidden sm:inline">Add Key</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchYoutubeKeyStatus}
                      disabled={keysLoading}
                    >
                      {keysLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      <span className="ml-2 hidden sm:inline">Refresh</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {keysLoading && youtubeKeys.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Checking API keys...</span>
                  </div>
                ) : youtubeKeys.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Key className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p>No YouTube API keys configured</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Warning banner when all keys are disabled */}
                    {youtubeKeys.length > 0 && youtubeKeys.every(k => k.status === 'disabled') && (
                      <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-sm">All API keys are disabled</p>
                          <p className="text-xs opacity-80">Music search, trending, and personalized features will not work until at least one key is enabled.</p>
                        </div>
                      </div>
                    )}

                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                        <p className="text-2xl font-bold text-green-500">
                          {youtubeKeys.filter(k => k.status === 'active').length}
                        </p>
                        <p className="text-xs text-muted-foreground">Active</p>
                      </div>
                      <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-center">
                        <p className="text-2xl font-bold text-yellow-500">
                          {youtubeKeys.filter(k => k.status === 'quota_exceeded').length}
                        </p>
                        <p className="text-xs text-yellow-500 font-bold uppercase tracking-tight">Limit Finished</p>
                      </div>

                      <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                        <p className="text-2xl font-bold text-destructive">
                          {youtubeKeys.filter(k => k.status === 'error' || k.status === 'expired').length}
                        </p>
                        <p className="text-xs text-muted-foreground">Error/Expired</p>
                      </div>
                    </div>

                    {/* Key Cards */}
                    <div className="space-y-3">
                      {youtubeKeys.map((keyInfo, index) => {
                        const isActive = keyInfo.status === 'active';
                        const isQuota = keyInfo.status === 'quota_exceeded';
                        const isDisabled = keyInfo.status === 'disabled';
                        const isEnabled = keyInfo.enabled !== false;
                        const isStandby = isActive && !keyInfo.isCurrentlyUsed;

                        return (
                          <div
                            key={index}
                            className={`p-4 rounded-lg border ${
                              isDisabled
                                ? 'border-muted/30 bg-muted/5 opacity-60'
                                : isStandby
                                ? 'border-cyan-500/30 bg-cyan-500/5'
                                : isActive
                                ? 'border-green-500/30 bg-green-500/5'
                                : isQuota
                                ? 'border-yellow-500/30 bg-yellow-500/5'
                                : 'border-destructive/30 bg-destructive/5'
                            }`}
                          >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                {isDisabled ? (
                                  <Circle className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0" />
                                ) : isStandby ? (
                                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-500 flex-shrink-0" />
                                ) : isActive ? (
                                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                                ) : isQuota ? (
                                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500 flex-shrink-0" />
                                ) : (
                                  <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive flex-shrink-0" />
                                )}
                                <span className="font-mono font-semibold text-xs sm:text-sm truncate">{keyInfo.key}</span>
                                {keyInfo.isCurrentlyUsed && (
                                  <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-primary/20 text-primary font-semibold animate-pulse whitespace-nowrap">
                                    ● IN USE
                                  </span>
                                )}
                                {isStandby && (
                                  <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-medium whitespace-nowrap">
                                    Standby
                                  </span>
                                )}
                                {isQuota && (
                                  <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500 font-bold border border-yellow-500/30 whitespace-nowrap">
                                    ⚠️ QUOTA EXHAUSTED
                                  </span>
                                )}

                              </div>
                              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                                <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-medium whitespace-nowrap ${
                                  isDisabled
                                    ? 'bg-muted/20 text-muted-foreground'
                                    : isStandby
                                    ? 'bg-cyan-500/20 text-cyan-400'
                                    : isActive
                                    ? 'bg-green-500/20 text-green-500'
                                    : isQuota
                                    ? 'bg-yellow-500/20 text-yellow-500'
                                    : 'bg-destructive/20 text-destructive'
                                }`}>
                                  {isStandby ? 'Online' : isQuota ? 'Quota Finished' : keyInfo.message}

                                </span>
                                <Switch
                                  checked={isEnabled}
                                  onCheckedChange={(checked) => toggleYoutubeKey(keyInfo.key, checked)}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deletePrimaryKey(keyInfo.key)}
                                  className="text-destructive hover:text-destructive h-7 w-7 p-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                            {isQuota && (
                              <div className="flex flex-col gap-1 mt-2">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-3.5 h-3.5 text-yellow-500/80" />
                                  <p className="text-xs text-yellow-500/80">
                                    Quota resets in <span className="font-mono font-semibold text-yellow-400">{quotaResetCountdown}</span>
                                  </p>
                                </div>
                                <p className="text-[11px] text-muted-foreground pl-5">
                                  Pacific Time now: <span className="font-medium">{pacificCurrentTime}</span> · Resets at your local time: <span className="font-medium">{quotaResetLocalTime}</span>
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs text-muted-foreground">
                        💡 Each Google Cloud project gets <strong>10,000 units/day</strong>. A search costs 100 units.
                        Keys from the same project share quota. The failover system automatically rotates to the next working key.
                      </p>
                    </div>

                    {/* Backup API Keys Section */}
                    <div className="mt-6 pt-6 border-t border-dashed border-muted-foreground/20">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Shield className="w-5 h-5 text-primary" />
                          <div>
                            <h3 className="font-semibold text-sm">Backup API Keys</h3>
                            <p className="text-xs text-muted-foreground">
                              Only activate automatically when all primary keys are exhausted
                            </p>
                          </div>
                        </div>
                        <Dialog open={addBackupKeyDialogOpen} onOpenChange={setAddBackupKeyDialogOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1">
                              <Plus className="w-3 h-3" /> Add Backup
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Add Backup API Key</DialogTitle>
                              <DialogDescription>
                                This key will only be used when all primary keys are exhausted or disabled.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-3">
                              <div>
                                <label className="text-sm font-medium">Key Name</label>
                                <Input
                                  placeholder="e.g. BACKUP API"
                                  value={newBackupKeyName}
                                  onChange={(e) => setNewBackupKeyName(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium">API Key</label>
                                <Input
                                  placeholder="AIza..."
                                  value={newBackupKeyValue}
                                  onChange={(e) => setNewBackupKeyValue(e.target.value)}
                                  type="password"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button onClick={addBackupKey} disabled={addingBackupKey}>
                                {addingBackupKey ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Adding...</> : 'Add Backup Key'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>

                      {backupKeys.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
                          <Shield className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          <p className="text-sm">No backup keys configured</p>
                          <p className="text-xs opacity-70">Add backup keys as emergency fallback</p>
                        </div>
                      ) : (() => {
                        const allPrimaryDown = youtubeKeys.length > 0 && youtubeKeys.every(k => 
                          k.status === 'disabled' || k.status === 'quota_exceeded' || k.status === 'error' || k.status === 'expired'
                        );
                        return (
                        <div className="space-y-2">
                          {allPrimaryDown && (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-medium">
                              <AlertTriangle className="w-4 h-4" />
                              Backup keys are currently active — all primary keys are down
                            </div>
                          )}
                          {backupKeys.map((bk, index) => {
                            const isActive = bk.status === 'active';
                            const priorityLabel = index === 0 ? '1st Backup' : index === 1 ? '2nd Backup' : `${index + 1}th Backup`;
                            const isInUse = allPrimaryDown && isActive;
                            return (
                              <div
                                key={index}
                                className={`p-3 rounded-lg border flex items-center justify-between ${
                                  isInUse
                                    ? 'border-green-500/30 bg-green-500/5'
                                    : isActive
                                    ? 'border-primary/30 bg-primary/5'
                                    : 'border-muted/30 bg-muted/5'
                                }`}
                              >
                              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground font-mono font-bold">
                                    #{index + 1}
                                  </span>
                                  {isInUse ? (
                                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" />
                                  ) : (
                                    <Circle className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                                  )}
                                  <span className="font-mono font-semibold text-xs sm:text-sm truncate">{bk.key}</span>
                                  <span className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                                    isInUse 
                                      ? 'bg-green-500/20 text-green-500 animate-pulse'
                                      : isActive ? 'bg-primary/20 text-primary' : 'bg-muted/20 text-muted-foreground'
                                  }`}>
                                    {isInUse ? `● ${priorityLabel}` : `${priorityLabel}`}
                                  </span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteBackupKey(bk.key)}
                                  className="text-destructive hover:text-destructive h-7 w-7 p-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            );
                          })}
                          <p className="text-[11px] text-muted-foreground mt-2">
                            🛡️ Backup keys activate <strong>sequentially</strong> — #1 is tried first, then #2 only if #1 also fails. They never run simultaneously.
                          </p>
                        </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Maintenance Tab */}
          <TabsContent value="maintenance">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Wrench className="w-5 h-5 text-primary" />
                    <div>
                      <CardTitle>Maintenance Mode</CardTitle>
                      <CardDescription>
                        Enable maintenance mode to restrict access to selected users only
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${maintenance.enabled ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {maintenance.enabled ? 'ACTIVE' : 'Off'}
                    </span>
                    <Switch
                      checked={maintenance.enabled}
                      onCheckedChange={async (checked) => {
                        try {
                          await toggleMaintenance(checked);
                          toast.success(checked ? 'Maintenance mode enabled' : 'Maintenance mode disabled');
                        } catch {
                          toast.error('Failed to toggle maintenance mode');
                        }
                      }}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {maintenance.enabled && (
                  <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                    <p className="text-sm text-destructive font-medium mb-1">⚠️ Maintenance mode is active</p>
                    <p className="text-xs text-muted-foreground">
                      Only users listed below can access the app. Everyone else sees the maintenance page.
                      Admin dashboard (/admin) is always accessible.
                    </p>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold mb-3">Allowed Users</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    These users can access the app even during maintenance mode.
                  </p>

                  {/* Add email input */}
                  <div className="flex gap-2 mb-4">
                    <Input
                      placeholder="Enter email to whitelist..."
                      value={allowedEmailInput}
                      onChange={(e) => setAllowedEmailInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && allowedEmailInput.trim()) {
                          const email = allowedEmailInput.trim();
                          if (!maintenance.allowed_emails.includes(email)) {
                            updateAllowedEmails([...maintenance.allowed_emails, email]);
                            toast.success(`${email} added to whitelist`);
                          }
                          setAllowedEmailInput('');
                        }
                      }}
                    />
                    <Button
                      onClick={() => {
                        const email = allowedEmailInput.trim();
                        if (email && !maintenance.allowed_emails.includes(email)) {
                          updateAllowedEmails([...maintenance.allowed_emails, email]);
                          toast.success(`${email} added to whitelist`);
                        }
                        setAllowedEmailInput('');
                      }}
                      disabled={!allowedEmailInput.trim()}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                  </div>

                  {/* Quick add from existing users */}
                  {users.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-muted-foreground mb-2">Quick add from registered users:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {users
                          .filter(u => !maintenance.allowed_emails.includes(u.email))
                          .slice(0, 10)
                          .map(u => (
                            <button
                              key={u.id}
                              onClick={() => {
                                updateAllowedEmails([...maintenance.allowed_emails, u.email]);
                                toast.success(`${u.email} added to whitelist`);
                              }}
                              className="px-2 py-1 text-xs rounded-full bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
                            >
                              + {u.email}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Whitelisted emails */}
                  {maintenance.allowed_emails.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-4 text-center">
                      No users whitelisted yet. Add emails above.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {maintenance.allowed_emails.map((email) => (
                        <div
                          key={email}
                          className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                        >
                          <span className="text-sm font-medium">{email}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              updateAllowedEmails(maintenance.allowed_emails.filter(e => e !== email));
                              toast.success(`${email} removed from whitelist`);
                            }}
                          >
                            <X className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Auto-Maintenance - Main admin only */}
                {isAdminLoggedIn && (
                  <div className="pt-6 border-t border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Zap className="w-5 h-5 text-primary" />
                        <div>
                          <h3 className="font-semibold text-sm">Auto-Maintenance</h3>
                          <p className="text-xs text-muted-foreground">
                            Automatically enable maintenance mode when high error rates or traffic spikes are detected
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${autoMaintenanceEnabled ? 'text-primary' : 'text-muted-foreground'}`}>
                          {autoMaintenanceEnabled ? 'ON' : 'OFF'}
                        </span>
                        <Switch
                          checked={autoMaintenanceEnabled}
                          onCheckedChange={toggleAutoMaintenance}
                        />
                      </div>
                    </div>
                    {autoMaintenanceEnabled && (
                      <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <p className="text-xs text-muted-foreground">
                          ⚡ The system will automatically activate maintenance mode if it detects &gt;50 errors in 5 minutes or &gt;500 concurrent sessions in 1 minute. Only you can disable it manually.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Admin Chat Tab */}
          <TabsContent value="chat">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Admin Chat
                </CardTitle>
                <CardDescription>Private chat room for admins — send text, images, stickers & voice messages</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <AdminChat />
              </CardContent>
            </Card>
          </TabsContent>

          {/* App Settings Tab */}
          <TabsContent value="app-settings">
            <AdminAppSettings />
          </TabsContent>

          {/* APK Tab */}
          <TabsContent value="apk">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Download className="w-5 h-5 text-primary" />
                    <div>
                      <CardTitle>APK Manager</CardTitle>
                      <CardDescription>Upload APK files for users to download</CardDescription>
                    </div>
                  </div>
                  <div>
                    <input
                      ref={apkInputRef}
                      type="file"
                      accept=".apk"
                      className="hidden"
                      onChange={handleApkUpload}
                    />
                    <Button onClick={() => apkInputRef.current?.click()} disabled={apkUploading}>
                      {apkUploading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                      ) : (
                        <><Upload className="w-4 h-4 mr-2" /> Upload APK</>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {apkFiles.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Download className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No APK files uploaded yet</p>
                    <p className="text-xs mt-1">Upload an APK and users can download it from the app</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {apkFiles.map((apk, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-secondary/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Download className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{apk.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(apk.size / (1024 * 1024)).toFixed(1)} MB · {new Date(apk.uploaded_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => window.open(apk.url, '_blank')}>
                            <Download className="w-3.5 h-3.5 mr-1" /> Download
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteApkFile(idx)} className="text-destructive hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4 p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground">
                    💡 Uploaded APKs will be available for all users to download from the Settings page.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="health">
            <AdminHealthMonitor />
          </TabsContent>

          {/* Admin Activity Logs Tab - Main admin only */}
          {isAdminLoggedIn && (
            <TabsContent value="logs">
              <AdminActivityLogs />
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Password Reset Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Reset Password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">User</p>
              <p className="font-medium">{resetTargetUser?.email}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <Input
                type="text"
                placeholder="Enter new password (min 6 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={resetLoading || newPassword.length < 6}
            >
              {resetLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Password'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Delete User
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to permanently delete this user? This action cannot be undone.
            </p>
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="font-medium text-sm">{deleteTargetUser?.email}</p>
              <p className="text-xs text-muted-foreground mt-1">
                All their data (playlists, favorites, history) will be removed.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={deleteLoading}
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete User'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add API Key Dialog */}
      <Dialog open={addKeyDialogOpen} onOpenChange={setAddKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add YouTube API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Key Name (optional)</label>
              <Input
                placeholder="e.g. YOUTUBE_API_KEY_5"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Leave blank to auto-name</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">API Key</label>
              <Input
                placeholder="AIzaSy..."
                value={newKeyValue}
                onChange={(e) => setNewKeyValue(e.target.value)}
                type="password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddKeyDialogOpen(false)}>Cancel</Button>
            <Button onClick={addYoutubeKey} disabled={addingKey}>
              {addingKey ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Add Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showAdminTutorial && <AdminTutorial onComplete={completeAdminTutorial} />}
    </div>
  );
};

export default Admin;
