import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Palette, Volume2, ListMusic, Trash2, Waves, Blend, User, Camera, KeyRound, Loader2, RotateCcw, Sliders, Shield, Sparkles, Smartphone, Home, Search, Users, Heart, Gamepad2, Settings as SettingsIcon, Menu, Download, Minus, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme, themes, ThemeName, ProgressBarStyle } from '@/contexts/ThemeContext';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import SettingsSoundwave from '@/components/SettingsSoundwave';
import SoundwaveVisualizer, { SoundwaveShape } from '@/components/SoundwaveVisualizer';
import StyledProgressBar from '@/components/StyledProgressBar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getAllOfflineTracks, clearAllOfflineTracks } from '@/lib/offlineStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAppSettings } from '@/hooks/useAppSettings';

const themePreview: Record<ThemeName, { label: string; color: string }> = {
  yellow: { label: 'Neon Yellow', color: 'hsl(50 100% 50%)' },
  blue: { label: 'Ocean Blue', color: 'hsl(210 100% 50%)' },
  green: { label: 'Forest Green', color: 'hsl(142 76% 45%)' },
  purple: { label: 'Royal Purple', color: 'hsl(280 100% 60%)' },
  red: { label: 'Fire Red', color: 'hsl(0 100% 50%)' },
  custom: { label: 'Custom', color: 'linear-gradient(135deg, #ff0080, #7928ca)' },
};

const soundwaveShapes: { value: SoundwaveShape; label: string; icon: string }[] = [
  { value: 'bars', label: 'Classic Bars', icon: '▎▌█▌▎' },
  { value: 'waves', label: 'Smooth Waves', icon: '∿∿∿' },
  { value: 'dots', label: 'Bouncing Dots', icon: '● ● ●' },
  { value: 'pulse', label: 'Pulse Ring', icon: '◎' },
  { value: 'spectrum', label: 'Spectrum', icon: '◂▸' },
];


const Settings = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { 
    currentTheme, 
    setTheme, 
    settings, 
    updateSettings,
    gradient,
    setGradient,
  } = useTheme();
  
  const [settingsTab, setSettingsTab] = useState<'profile' | 'theme' | 'player' | 'navigation' | 'system'>('profile');
  const [activeTab, setActiveTab] = useState('settings');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewPlaying, setPreviewPlaying] = useState(true);

  const [offlineTrackCount, setOfflineTrackCount] = useState(0);
  const [offlineTrackSize, setOfflineTrackSize] = useState(0);
  const { settings: appSettings } = useAppSettings();

  // Load offline storage info
  useEffect(() => {
    const fetchOfflineInfo = async () => {
      try {
        const tracks = await getAllOfflineTracks();
        setOfflineTrackCount(tracks.length);
        const totalSize = tracks.reduce((acc, curr) => acc + curr.size, 0);
        setOfflineTrackSize(totalSize);
      } catch (err) {
        console.error('Failed to query IndexedDB:', err);
      }
    };
    fetchOfflineInfo();
  }, [settingsTab]);

  // Metadata for bottom navigation buttons
  const navItemMetadata: Record<string, { label: string; icon: any }> = {
    home: { label: 'Home', icon: Home },
    search: { label: 'Search', icon: Search },
    artists: { label: 'Artists', icon: Users },
    playlists: { label: 'Playlists', icon: ListMusic },
    favorites: { label: 'Favorites', icon: Heart },
    offline: { label: 'Downloads', icon: Download },
    'ai-dj': { label: 'AI DJ', icon: Sparkles },
    games: { label: 'Games', icon: Gamepad2 },
    settings: { label: 'Settings', icon: SettingsIcon },
    admin: { label: 'Admin', icon: Shield },
  };

  const isMobile = useIsMobile();

  const categories = [
    { id: 'profile', label: '👤 Profile & Security', icon: User, description: 'Manage account, username, password and genres' },
    { id: 'theme', label: '🎨 Theme & Lights', icon: Palette, description: 'Configure custom colors, angles, and RGB modes' },
    { id: 'player', label: '🎵 Player Customizer', icon: Sliders, description: 'Tailor progress bars, soundwaves, and animations' },
    ...(isMobile ? [{ id: 'navigation', label: '📱 Bottom Nav Bar', icon: Smartphone, description: 'Reorder bottom navigation buttons for mobile' }] : []),
    { id: 'system', label: '💾 Cache & App', icon: RotateCcw, description: 'Clear player cache and download APKs' },
  ];

  useEffect(() => {
    if (!isMobile && settingsTab === 'navigation') {
      setSettingsTab('profile');
    }
  }, [isMobile, settingsTab]);

  const isNavItemAllowed = (itemId: string) => {
    if (itemId === 'admin') return isAdmin;
    if (itemId === 'home' || itemId === 'settings') return true;
    return !appSettings.hidden_tabs.includes(itemId);
  };

  const availableNavEntries = Object.entries(navItemMetadata).filter(([key]) => isNavItemAllowed(key));
  const currentNavItems = (settings.mobileNavItems || ['home', 'playlists', 'favorites', 'settings']).filter(isNavItemAllowed);

  const applyMobilePreset = (items: string[], message: string) => {
    const allowedItems = items.filter(isNavItemAllowed);
    updateSettings({ mobileNavItems: allowedItems.length ? allowedItems : ['home', 'settings'] });
    toast.success(message);
  };

  const handleMoveItem = (index: number, direction: 'left' | 'right') => {
    const newItems = [...currentNavItems];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < newItems.length) {
      const temp = newItems[index];
      newItems[index] = newItems[targetIndex];
      newItems[targetIndex] = temp;
      updateSettings({ mobileNavItems: newItems });
      toast.success('Navigation bar order updated successfully!');
    }
  };

  const handleReplaceItem = (indexToReplace: number, newItemId: string) => {
    const newItems = [...currentNavItems];
    const existingIndex = newItems.indexOf(newItemId);
    if (existingIndex !== -1) {
      // Swap positions if it already exists to prevent duplicate entries!
      const temp = newItems[indexToReplace];
      newItems[indexToReplace] = newItems[existingIndex];
      newItems[existingIndex] = temp;
    } else {
      newItems[indexToReplace] = newItemId;
    }
    updateSettings({ mobileNavItems: newItems });
    toast.success('Button slots updated successfully!');
  };
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [displayNameSaving, setDisplayNameSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [apkFiles, setApkFiles] = useState<{ name: string; url: string; size: number; uploaded_at: string }[]>([]);

  // Check admin status
  useEffect(() => {
    if (!user) return;
    const checkAdmin = async () => {
      const { data } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      setIsAdmin(!!data);
    };
    checkAdmin();
  }, [user]);

  // Load APK files
  useEffect(() => {
    const loadApks = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'apk_files')
        .maybeSingle();
      if (data?.value) {
        setApkFiles((data.value as any).files || []);
      }
    };
    loadApks();
  }, []);

  // Load avatar and display name
  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url, display_name')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      if (data?.display_name) setDisplayName(data.display_name);
    };
    loadProfile();
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    const validTypes = ['image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast.error('Only PNG and GIF formats are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB');
      return;
    }

    setAvatarLoading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const url = `${publicUrl}?t=${Date.now()}`;

      await supabase.from('profiles').upsert(
        { user_id: user.id, avatar_url: url, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

      setAvatarUrl(url);
      toast.success('Avatar updated!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload avatar');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated successfully!');
      setNewPassword('');
      setShowPasswordInput(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSaveUsername = async () => {
    if (!user || !displayName.trim()) {
      toast.error('Username cannot be empty');
      return;
    }
    setDisplayNameSaving(true);
    try {
      await supabase.from('profiles').upsert(
        { user_id: user.id, display_name: displayName.trim(), updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
      toast.success('Username saved!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save username');
    } finally {
      setDisplayNameSaving(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleClearPlaylist = () => {
    localStorage.removeItem('nyra-playlist');
    localStorage.removeItem('nyra-queue');
    toast.success('Playlist and queue cleared');
  };

  return (
    <div className="min-h-screen bg-background/80">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="ml-0 md:ml-64">
        <Navbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearch={() => navigate('/')}
        />

        <main className="pt-28 pb-32 px-4 md:px-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-6 transition-colors active:scale-95 touch-manipulation"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </button>

          <div className="flex items-center gap-4 mb-8 flex-wrap">
            <h1 className="text-3xl md:text-4xl font-bold neon-text">Settings</h1>
            <SettingsSoundwave className="h-8" />
          </div>

          {/* Beautiful Responsive Category Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-3 mb-8">
            {categories.map((tab) => {
              const Icon = tab.icon;
              const isActive = settingsTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSettingsTab(tab.id as any)}
                  className={cn(
                    "flex flex-col md:flex-row items-center md:items-start gap-2.5 p-3 rounded-xl border text-center md:text-left transition-all duration-300 cursor-pointer active:scale-95 touch-manipulation hover:bg-card/60",
                    isActive
                      ? "bg-primary/10 border-primary/40 text-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.15)]"
                      : "bg-card/30 border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className={cn("w-4 h-4 shrink-0 mt-0.5", isActive ? "text-primary animate-pulse" : "text-muted-foreground")} />
                  <div className="min-w-0">
                    <p className="text-xs md:text-sm font-semibold truncate leading-none md:leading-tight">{tab.label.split(' ').slice(1).join(' ')}</p>
                    <p className="hidden md:block text-[10px] text-muted-foreground truncate mt-0.5">{tab.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {settingsTab === 'profile' && (
            <div className="animate-fade-in space-y-6">
              {/* Account Section */}
              <section className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-6 h-6 text-primary" />
              <h2 className="text-xl md:text-2xl font-semibold text-foreground">Account</h2>
            </div>

            <div className="bg-card rounded-xl p-4 md:p-6 border border-border space-y-6">
              {/* Avatar Upload */}
              <div className="flex items-center gap-5">
                <div className="relative group">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-primary/50 overflow-hidden bg-muted flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-muted-foreground" />
                    )}
                    {avatarLoading && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center rounded-full">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg hover:scale-110 transition-transform"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".png,.gif"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm md:text-base">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">PNG or GIF, max 5MB</p>
                </div>
              </div>

              {/* Username */}
              <div className="border-t border-border pt-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground text-sm md:text-base">Username</p>
                    <p className="text-xs md:text-sm text-muted-foreground">Set a display name visible to others</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your username"
                    className="flex-1 px-4 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <Button
                    onClick={handleSaveUsername}
                    disabled={displayNameSaving}
                    className="active:scale-95 touch-manipulation"
                  >
                    {displayNameSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground text-sm md:text-base">Change Password</p>
                    <p className="text-xs md:text-sm text-muted-foreground">Update your account password</p>
                  </div>
                  {!showPasswordInput && (
                    <Button
                      variant="outline"
                      onClick={() => setShowPasswordInput(true)}
                      className="flex items-center gap-2 active:scale-95 touch-manipulation w-full sm:w-auto"
                    >
                      <KeyRound className="w-4 h-4" />
                      Change Password
                    </Button>
                  )}
                </div>
                {showPasswordInput && (
                  <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password (min 6 chars)"
                      className="flex-1 px-4 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleChangePassword}
                        disabled={passwordLoading}
                        className="active:scale-95 touch-manipulation"
                      >
                        {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => { setShowPasswordInput(false); setNewPassword(''); }}
                        className="active:scale-95 touch-manipulation"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Replay Tutorial */}
              <div className="border-t border-border pt-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground text-sm md:text-base">JARVIS Tutorial</p>
                    <p className="text-xs md:text-sm text-muted-foreground">Re-watch the guided tour of NYRA</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (!user) return;
                      await supabase.from('user_preferences').upsert(
                        { user_id: user.id, tutorial_complete: false },
                        { onConflict: 'user_id' }
                      );
                      toast.success('Tutorial will play on your next visit to Home');
                      navigate('/');
                    }}
                    className="flex items-center gap-2 active:scale-95 touch-manipulation w-full sm:w-auto"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Replay Tutorial
                  </Button>
                </div>
              </div>

              {/* Admin Tutorial - only for admins */}
              {isAdmin && (
                <div className="border-t border-border pt-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      <div>
                        <p className="font-medium text-foreground text-sm md:text-base">Admin Dashboard Tutorial</p>
                        <p className="text-xs md:text-sm text-muted-foreground">Replay the JARVIS guided tour of the Admin Dashboard</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!user) return;
                        localStorage.removeItem(`admin_tutorial_done_${user.id}`);
                        toast.success('Admin tutorial will play when you visit the Admin Dashboard');
                        navigate('/admin');
                      }}
                      className="flex items-center gap-2 active:scale-95 touch-manipulation w-full sm:w-auto"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Replay Admin Tutorial
                    </Button>
                  </div>
                </div>
              )}

              {/* Reset Genre Preferences */}
              <div className="border-t border-border pt-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground text-sm md:text-base">Genre Preferences</p>
                    <p className="text-xs md:text-sm text-muted-foreground">Reset your genre selections and re-pick your favorites</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (!user) return;
                      await supabase.from('user_preferences').upsert(
                        { user_id: user.id, genres: [], onboarding_complete: false },
                        { onConflict: 'user_id' }
                      );
                      toast.success('Genre preferences reset! Pick new genres on the home page.');
                      navigate('/');
                    }}
                    className="flex items-center gap-2 active:scale-95 touch-manipulation w-full sm:w-auto"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset Genres
                  </Button>
                </div>
              </div>
            </div>
          </section>
          </div>
          )}

          {settingsTab === 'theme' && (
            <div className="animate-fade-in space-y-8">
              {/* Theme Selection */}
              <section className="mb-10">
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <Palette className="w-6 h-6 text-primary" />
              <h2 className="text-xl md:text-2xl font-semibold text-foreground">Theme</h2>
              <SettingsSoundwave className="h-6 ml-4" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 md:gap-4">
              {(Object.keys(themes) as ThemeName[]).filter(t => t !== 'custom').map((themeName) => (
                <button
                  key={themeName}
                  onClick={() => setTheme(themeName)}
                  className={cn(
                    'relative p-3 md:p-4 rounded-xl border-2 transition-all overflow-hidden active:scale-95 touch-manipulation',
                    currentTheme === themeName
                      ? 'border-primary neon-glow scale-105'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  {themes[themeName].backgroundImage && (
                    <img
                      src={themes[themeName].backgroundImage}
                      alt={themePreview[themeName].label}
                      className="absolute inset-0 w-full h-full object-cover opacity-30"
                    />
                  )}
                  <div className="relative z-10">
                    <div
                      className="w-10 h-10 md:w-12 md:h-12 rounded-full mx-auto mb-2 md:mb-3 shadow-lg"
                      style={{ backgroundColor: themePreview[themeName].color }}
                    />
                    <p className="text-xs md:text-sm font-medium text-foreground text-center">
                      {themePreview[themeName].label}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Gradient Settings */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <Blend className="w-6 h-6 text-primary" />
              <h2 className="text-xl md:text-2xl font-semibold text-foreground">Gradient Effects</h2>
            </div>

            <div className="bg-card rounded-xl p-4 md:p-6 border border-border">
              {/* Enable Gradient */}
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex-1">
                  <p className="font-medium text-foreground text-sm md:text-base">Enable Gradient</p>
                  <p className="text-xs md:text-sm text-muted-foreground">Apply gradient to UI elements</p>
                </div>
                <Switch
                  checked={gradient.enabled}
                  onCheckedChange={(checked) => setGradient({ enabled: checked })}
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              {/* Gradient Preview */}
              <div 
                className="h-16 rounded-xl mb-6 border border-border transition-all"
                style={{
                  background: gradient.enabled 
                    ? `linear-gradient(${gradient.angle}deg, ${gradient.startColor}, ${gradient.endColor})`
                    : 'hsl(var(--muted))',
                }}
              />

              {/* Gradient Colors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Start Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={gradient.startColor}
                      onChange={(e) => setGradient({ startColor: e.target.value })}
                      className="w-12 h-12 rounded-lg cursor-pointer border-2 border-border"
                      disabled={!gradient.enabled}
                    />
                    <span className="text-xs font-mono text-foreground">{gradient.startColor.toUpperCase()}</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">End Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={gradient.endColor}
                      onChange={(e) => setGradient({ endColor: e.target.value })}
                      className="w-12 h-12 rounded-lg cursor-pointer border-2 border-border"
                      disabled={!gradient.enabled}
                    />
                    <span className="text-xs font-mono text-foreground">{gradient.endColor.toUpperCase()}</span>
                  </div>
                </div>
              </div>

              {/* Gradient Angle */}
              <div>
                <label className="text-sm text-muted-foreground mb-3 block">
                  Angle: {gradient.angle}°
                </label>
                <Slider
                  value={[gradient.angle]}
                  onValueChange={([value]) => setGradient({ angle: value })}
                  min={0}
                  max={360}
                  step={15}
                  disabled={!gradient.enabled}
                  className="w-full"
                />
              </div>
            </div>
          </section>

          {/* RGB Lighting Settings */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <Sparkles className="w-6 h-6 text-primary" />
              <h2 className="text-xl md:text-2xl font-semibold text-foreground">RGB Lighting</h2>
            </div>

            <div className="bg-card rounded-xl p-4 md:p-6 border border-border">
              {/* Enable RGB Mode */}
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex-1">
                  <p className="font-medium text-foreground text-sm md:text-base">Enable RGB Mode</p>
                  <p className="text-xs md:text-sm text-muted-foreground">Dynamic color shifting across the entire UI</p>
                </div>
                <Switch
                  checked={settings.rgbConfig.enabled}
                  onCheckedChange={(checked) => updateSettings({ 
                    rgbConfig: { ...settings.rgbConfig, enabled: checked } 
                  })}
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              {/* RGB Gradient Toggle */}
              <div className="flex items-center justify-between gap-4 mb-6 border-t border-border pt-6">
                <div className="flex-1">
                  <p className="font-medium text-foreground text-sm md:text-base">RGB Gradient</p>
                  <p className="text-xs md:text-sm text-muted-foreground">Use two shifting colors for a gradient effect</p>
                </div>
                <Switch
                  disabled={!settings.rgbConfig.enabled}
                  checked={settings.rgbConfig.isGradient}
                  onCheckedChange={(checked) => updateSettings({ 
                    rgbConfig: { ...settings.rgbConfig, isGradient: checked } 
                  })}
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              {/* RGB Speed */}
              <div className="border-t border-border pt-6">
                <label className="text-sm text-muted-foreground mb-3 block flex justify-between">
                  <span>Transition Speed</span>
                  <span className="text-primary font-medium">{settings.rgbConfig.speed.toFixed(1)}x</span>
                </label>
                <Slider
                  value={[settings.rgbConfig.speed]}
                  onValueChange={([value]) => updateSettings({ 
                    rgbConfig: { ...settings.rgbConfig, speed: value } 
                  })}
                  min={0.1}
                  max={5}
                  step={0.1}
                  disabled={!settings.rgbConfig.enabled}
                  className="w-full"
                />
                <div className="flex justify-between mt-2 text-[10px] text-muted-foreground uppercase tracking-widest">
                  <span>Slow</span>
                  <span>Fast</span>
                </div>
              </div>
            </div>
          </section>
          </div>
          )}

          {settingsTab === 'player' && (
            <div className="animate-fade-in space-y-8">
              {/* Progress Bar Style */}
              <section className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <Sliders className="w-6 h-6 text-primary" />
              <h2 className="text-xl md:text-2xl font-semibold text-foreground">Progress Bar Style</h2>
            </div>

            <div className="bg-card rounded-xl p-4 md:p-6 border border-border">
              {/* Preview */}
              <div className="flex items-center justify-center mb-6 p-4 bg-background/50 rounded-lg">
                <div className="w-full max-w-md">
                  <StyledProgressBar
                    progress={35}
                    duration={100}
                    onSeek={() => {}}
                  />
                </div>
              </div>

              {/* Style Options */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {([
                  { value: 'classic' as ProgressBarStyle, label: 'Classic', icon: '━━━●━' },
                  { value: 'wavy' as ProgressBarStyle, label: 'Wavy', icon: '∿∿●∿∿' },
                  { value: 'dots' as ProgressBarStyle, label: 'Dots', icon: '●●●○○' },
                  { value: 'thin' as ProgressBarStyle, label: 'Thin', icon: '──●──' },
                  { value: 'rounded' as ProgressBarStyle, label: 'Rounded', icon: '▬▬●▬▬' },
                ]).map((style) => (
                  <button
                    key={style.value}
                    onClick={() => updateSettings({ progressBarStyle: style.value })}
                    className={cn(
                      'p-3 md:p-4 rounded-xl border-2 transition-all active:scale-95 touch-manipulation flex flex-col items-center gap-2',
                      settings.progressBarStyle === style.value
                        ? 'border-primary bg-primary/10 neon-glow'
                        : 'border-border hover:border-primary/50 bg-background/50'
                    )}
                  >
                    <span className="text-lg md:text-xl text-primary font-mono">{style.icon}</span>
                    <span className="text-xs md:text-sm text-foreground">{style.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>


          <section className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <Waves className="w-6 h-6 text-primary" />
              <h2 className="text-xl md:text-2xl font-semibold text-foreground">Soundwave Style</h2>
            </div>

            <div className="bg-card rounded-xl p-4 md:p-6 border border-border">
              {/* Preview */}
              <div className="flex items-center justify-center mb-6 p-4 bg-background/50 rounded-lg">
                <div className="flex flex-col items-center gap-4">
                  <SoundwaveVisualizer 
                    isPlaying={previewPlaying} 
                    className="h-12 w-40"
                    shape={settings.soundwaveShape}
                  />
                  <button
                    onClick={() => setPreviewPlaying(!previewPlaying)}
                    className="text-sm text-primary hover:underline touch-manipulation"
                  >
                    {previewPlaying ? 'Pause Preview' : 'Play Preview'}
                  </button>
                </div>
              </div>

              {/* Shape Options */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {soundwaveShapes.map((shape) => (
                  <button
                    key={shape.value}
                    onClick={() => updateSettings({ soundwaveShape: shape.value })}
                    className={cn(
                      'p-3 md:p-4 rounded-xl border-2 transition-all active:scale-95 touch-manipulation flex flex-col items-center gap-2',
                      settings.soundwaveShape === shape.value
                        ? 'border-primary bg-primary/10 neon-glow'
                        : 'border-border hover:border-primary/50 bg-background/50'
                    )}
                  >
                    <span className="text-xl md:text-2xl text-primary font-mono">{shape.icon}</span>
                    <span className="text-xs md:text-sm text-foreground">{shape.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Playback Settings */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <Volume2 className="w-6 h-6 text-primary" />
              <h2 className="text-xl md:text-2xl font-semibold text-foreground">Playback</h2>
            </div>

            <div className="space-y-4 bg-card rounded-xl p-4 md:p-6 border border-border">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium text-foreground text-sm md:text-base">Soundwave Animation</p>
                  <p className="text-xs md:text-sm text-muted-foreground">Show animated soundwave visualizer</p>
                </div>
                <Switch
                  checked={settings.soundwaveEnabled}
                  onCheckedChange={(checked) => updateSettings({ soundwaveEnabled: checked })}
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-sm md:text-base">Auto-Play Next</p>
                    <p className="text-xs md:text-sm text-muted-foreground">Automatically play next track when current ends</p>
                  </div>
                  <Switch
                    checked={settings.autoPlayNext}
                    onCheckedChange={(checked) => updateSettings({ autoPlayNext: checked })}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-sm md:text-base">Mini Player Mode</p>
                    <p className="text-xs md:text-sm text-muted-foreground">Show compact player bar</p>
                  </div>
                  <Switch
                    checked={settings.miniPlayerMode}
                    onCheckedChange={(checked) => updateSettings({ miniPlayerMode: checked })}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-sm md:text-base">Auto-Mini Player</p>
                    <p className="text-xs md:text-sm text-muted-foreground">Automatically shrink player when music starts playing</p>
                  </div>
                  <Switch
                    checked={settings.autoMiniPlayer}
                    onCheckedChange={(checked) => updateSettings({ autoMiniPlayer: checked })}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-foreground text-sm md:text-base">Fullscreen Video Brightness</p>
                      <p className="text-xs md:text-sm text-muted-foreground">Adjust the muted background video behind the full-screen player</p>
                    </div>
                    <span className="text-sm font-bold text-primary tabular-nums min-w-12 text-right">
                      {settings.backgroundVideoBrightness ?? 30}%
                    </span>
                  </div>
                  <Slider
                    value={[settings.backgroundVideoBrightness ?? 30]}
                    onValueChange={([value]) => updateSettings({ backgroundVideoBrightness: value })}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-widest">
                    <span>Dim</span>
                    <span>Bright</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
          </div>
          )}

          {/* Mobile Bottom Navigation Bar customizer (NEW FEATURE) */}
          {settingsTab === 'navigation' && (
            <section className="mb-10 animate-fade-in">
              <div className="flex items-center gap-3 mb-6">
                <Smartphone className="w-6 h-6 text-primary" />
                <h2 className="text-xl md:text-2xl font-semibold text-foreground">Bottom Nav Bar (Mobile Customizer)</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Side: Mockup Preview of Phone Bottom Bar */}
                <div className="lg:col-span-5 flex flex-col items-center">
                  <div className="w-full max-w-[340px] bg-black/95 rounded-[2.5rem] border-[6px] border-[#222] p-4 pt-12 pb-6 shadow-[0_25px_60px_rgba(0,0,0,0.8)] relative overflow-hidden flex flex-col justify-between aspect-[9/16] min-h-[480px]">
                    {/* Speaker & Sensor */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-4 bg-[#222] rounded-full flex items-center justify-center gap-2">
                      <div className="w-8 h-1 bg-[#111] rounded-full" />
                      <div className="w-2 h-2 bg-[#111] rounded-full" />
                    </div>

                    {/* App Screen Content Mock */}
                    <div className="flex-1 flex flex-col justify-center items-center p-6 text-center">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-4 animate-pulse">
                        <Smartphone className="w-6 h-6 text-primary" />
                      </div>
                      <h4 className="text-sm font-bold text-foreground mb-2">Live Mobile Preview</h4>
                      <p className="text-xs text-muted-foreground">This is how your actual bottom navigation looks on mobile viewports. Customize and reorder the buttons below!</p>
                    </div>

                    {/* The Live Navigation Bar Inside Mock */}
                    <div className="mt-auto bg-[#0a0a0c] border-t border-white/5 rounded-2xl h-16 px-1 flex items-center justify-around relative">
                      {currentNavItems.map((itemId) => {
                        const item = navItemMetadata[itemId] || navItemMetadata.home;
                        const Icon = item.icon;
                        return (
                          <div
                            key={itemId}
                            className="flex flex-col items-center justify-center flex-1 h-full py-1 text-muted-foreground opacity-90"
                          >
                            <Icon className="w-4 h-4 mb-0.5 text-primary animate-pulse" />
                            <span className="text-[8px] truncate max-w-[50px] leading-none">{item.label}</span>
                          </div>
                        );
                      })}
                      
                      {/* More Button */}
                      <div className="flex flex-col items-center justify-center flex-1 h-full py-1 text-muted-foreground opacity-60">
                        <Menu className="w-4 h-4 mb-0.5" />
                        <span className="text-[8px] leading-none">More</span>
                      </div>
                    </div>

                    {/* Home Indicator line */}
                    <div className="w-32 h-1 bg-white/40 rounded-full mx-auto mt-4" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-4 text-center max-w-[280px]">
                    Changes are saved instantly and apply across all mobile layouts.
                  </p>
                </div>

                {/* Right Side: Reordering & Replacement Controls */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="bg-card rounded-xl p-4 md:p-6 border border-border">
                    <h3 className="text-base font-semibold text-foreground mb-2">Configure Slots</h3>
                    <p className="text-xs text-muted-foreground mb-6">
                      You can display exactly 4 buttons on your mobile bottom bar. Use the arrows to reorder, or click any available option to swap.
                    </p>

                    <div className="space-y-4">
                      {currentNavItems.map((itemId, idx) => {
                        const item = navItemMetadata[itemId] || navItemMetadata.home;
                        const Icon = item.icon;
                        return (
                          <div 
                            key={itemId} 
                            className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border hover:border-primary/20 transition-all gap-4"
                          >
                            {/* Slot Identifier & Content */}
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-xs font-bold text-primary bg-primary/10 w-6 h-6 rounded-lg flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0">
                                <Icon className="w-4 h-4 text-foreground" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">{item.label}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Slot {idx + 1}</p>
                              </div>
                            </div>

                            {/* Actions: Reorder & Select */}
                            <div className="flex items-center gap-2 shrink-0">
                              {/* Move Left / Up */}
                              <button
                                onClick={() => handleMoveItem(idx, 'left')}
                                disabled={idx === 0}
                                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:text-primary transition-all cursor-pointer active:scale-95 disabled:opacity-30 disabled:pointer-events-none bg-card"
                                title="Move Left"
                              >
                                <ArrowLeft className="w-4 h-4" />
                              </button>

                              {/* Move Right / Down */}
                              <button
                                onClick={() => handleMoveItem(idx, 'right')}
                                disabled={idx === currentNavItems.length - 1}
                                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:text-primary transition-all cursor-pointer active:scale-95 disabled:opacity-30 disabled:pointer-events-none bg-card"
                                title="Move Right"
                              >
                                <ArrowRight className="w-4 h-4" />
                              </button>

                              {/* Replace options dropdown */}
                              <select
                                value={itemId}
                                onChange={(e) => handleReplaceItem(idx, e.target.value)}
                                className="h-8 text-xs bg-background border border-border rounded-lg px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                              >
                                {Object.entries(navItemMetadata)
                                  .filter(([key]) => key !== 'admin' || isAdmin)
                                  .map(([key, meta]) => (
                                    <option key={key} value={key}>
                                      Replace with: {meta.label}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Preset Quick Actions */}
                  <div className="bg-card rounded-xl p-4 md:p-6 border border-border">
                    <h3 className="text-base font-semibold text-foreground mb-2">Quick Presets</h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Choose one of our hand-crafted button presets to instantly configure your layout:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          updateSettings({ mobileNavItems: ['home', 'playlists', 'favorites', 'settings'] });
                          toast.success('Default Layout applied!');
                        }}
                        className="text-xs py-2 active:scale-95 text-center flex flex-col items-center justify-center gap-1 h-auto"
                      >
                        <span className="font-bold text-primary text-[10px]">Default Classic</span>
                        <span className="text-[9px] text-muted-foreground">Home, Playlists, Favorites, Settings</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          updateSettings({ mobileNavItems: ['home', 'search', 'favorites', 'playlists'] });
                          toast.success('Discovery Layout applied!');
                        }}
                        className="text-xs py-2 active:scale-95 text-center flex flex-col items-center justify-center gap-1 h-auto"
                      >
                        <span className="font-bold text-primary text-[10px]">Active Listener</span>
                        <span className="text-[9px] text-muted-foreground">Home, Search, Favorites, Playlists</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          updateSettings({ mobileNavItems: ['home', 'favorites', 'games', 'settings'] });
                          toast.success('Fun & Play Layout applied!');
                        }}
                        className="text-xs py-2 active:scale-95 text-center flex flex-col items-center justify-center gap-1 h-auto"
                      >
                        <span className="font-bold text-primary text-[10px]">Entertaining Gamer</span>
                        <span className="text-[9px] text-muted-foreground">Home, Favorites, Games, Settings</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {settingsTab === 'system' && (
            <div className="animate-fade-in space-y-8">
              {/* Offline Music Storage Settings */}
              <section className="mb-10">
                <div className="flex items-center gap-3 mb-6">
                  <Download className="w-6 h-6 text-primary animate-pulse" />
                  <h2 className="text-xl md:text-2xl font-semibold text-foreground">Offline Storage & Downloads</h2>
                </div>

                <div className="bg-card rounded-2xl p-6 border border-border space-y-6">
                  {/* Download Preference Customizer */}
                  <div>
                    <h3 className="text-sm font-bold text-foreground mb-1">Default Download Action</h3>
                    <p className="text-xs text-muted-foreground mb-4">Choose what action to perform when clicking download on a song.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { id: 'ask', label: 'Ask Every Time', desc: 'Prompts to save inside app or direct device .mp3 download.' },
                        { id: 'device', label: 'Always Device', desc: 'Triggers direct browser download as an .mp3 audio file.' },
                        { id: 'app', label: 'Always App Cache', desc: 'Saves inside app database for completely offline player use.' }
                      ].map((opt) => {
                        const isSelected = (settings.downloadPreference || 'ask') === opt.id;
                        return (
                          <button
                            key={opt.id}
                            onClick={() => {
                              updateSettings({ downloadPreference: opt.id as any });
                              toast.success(`Download preference updated to: ${opt.label}`);
                            }}
                            className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                              isSelected 
                                ? 'bg-primary/10 border-primary/40' 
                                : 'bg-background border-border hover:border-muted-foreground/30'
                            }`}
                          >
                            <h4 className="text-xs font-bold text-foreground mb-1">{opt.label}</h4>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">{opt.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="h-px bg-border/80" />

                  {/* Cache and Storage Stats */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-foreground text-sm md:text-base">Manage Cached Music</p>
                      <p className="text-xs text-muted-foreground leading-relaxed max-w-lg mt-0.5">
                        These tracks are saved inside IndexedDB browser cache. You currently have <strong className="text-foreground">{offlineTrackCount} tracks</strong> taking up <strong className="text-foreground">{(offlineTrackSize / (1024 * 1024)).toFixed(1)} MB</strong> of offline storage.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="destructive"
                        onClick={async () => {
                          if (offlineTrackCount === 0) {
                            toast.info('No tracks to clear!');
                            return;
                          }
                          if (confirm('Are you sure you want to delete ALL offline cached tracks?')) {
                            await clearAllOfflineTracks();
                            setOfflineTrackCount(0);
                            setOfflineTrackSize(0);
                            toast.success('Offline cache cleared successfully!');
                          }
                        }}
                        className="flex items-center gap-2 active:scale-95 w-full sm:w-auto"
                      >
                        <Trash2 className="w-4 h-4" />
                        Clear Cached Music
                      </Button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Playlist Settings */}
              <section className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <ListMusic className="w-6 h-6 text-primary" />
              <h2 className="text-xl md:text-2xl font-semibold text-foreground">Playlist & Queue</h2>
            </div>

            <div className="bg-card rounded-xl p-4 md:p-6 border border-border">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-foreground text-sm md:text-base">Clear All Data</p>
                  <p className="text-xs md:text-sm text-muted-foreground">Remove all tracks from playlist and queue</p>
                </div>
                <Button
                  variant="destructive"
                  onClick={handleClearPlaylist}
                  className="flex items-center gap-2 active:scale-95 touch-manipulation w-full sm:w-auto"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All
                </Button>
              </div>
            </div>
          </section>

          {/* Backup & Repository Source Section */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
              <h2 className="text-xl md:text-2xl font-semibold text-foreground">Export & Backup</h2>
            </div>

            <div className="bg-card rounded-xl p-4 md:p-6 border border-border">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-foreground text-sm md:text-base">Download Complete Project ZIP</p>
                  <p className="text-xs md:text-sm text-muted-foreground">Get a fully compiled source archive of your exact, current codebase. You can import this into any code editor or push to GitHub.</p>
                </div>
                <Button
                  onClick={() => {
                    toast.info("Bundling repository source code...");
                    window.location.href = "/api/download-zip";
                  }}
                  className="flex items-center gap-2 active:scale-95 touch-manipulation w-full sm:w-auto bg-primary text-black hover:bg-primary/90 font-semibold"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Export ZIP Backup
                </Button>
              </div>
            </div>
          </section>

          {/* APK Download Section */}
          {apkFiles.length > 0 && (
            <section className="mb-10">
              <div className="bg-card rounded-xl p-6 md:p-8 border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Download App</h3>
                    <p className="text-xs text-muted-foreground">Get the Android app for the best experience</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {apkFiles.map((apk, idx) => (
                    <button
                      key={idx}
                      onClick={() => window.open(apk.url, '_blank')}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">📱</span>
                        <div className="text-left">
                          <p className="text-sm font-medium text-foreground">{apk.name}</p>
                          <p className="text-xs text-muted-foreground">{(apk.size / (1024 * 1024)).toFixed(1)} MB</p>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-primary">Download ↓</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Decorative Soundwave Section */}
          <section className="mb-10">
            <div className="bg-card rounded-xl p-6 md:p-8 border border-border flex flex-col items-center gap-4">
              <p className="text-base md:text-lg font-medium text-foreground">Your Music, Your Vibe</p>
              <div className="flex items-end gap-1 h-16">
                {[...Array(15)].map((_, index) => (
                  <div
                    key={index}
                    className="w-1.5 md:w-2 bg-primary rounded-full soundwave-bar"
                    style={{
                      height: `${20 + Math.random() * 40}px`,
                      animationDelay: `${index * 0.08}s`,
                    }}
                  />
                ))}
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">NYRA - Feel the Pulse</p>
            </div>
          </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Settings;