import { Home, Search, ListMusic, Heart, Settings, Menu, X, Users, Shield, Gamepad2, Sparkles, AlertTriangle, Wand2, Headphones, Play, Disc3, Download, MonitorSmartphone, BarChart3 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import nyraLogo from '@/assets/nyra-logo.png';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useMaintenanceMode } from '@/hooks/useMaintenanceMode';
import { useAppSettings } from '@/hooks/useAppSettings';
import { supabase } from '@/integrations/supabase/client';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { famousSongs } from '@/data/famousSongs';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreExpanded, setMoreExpanded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { gradient, settings: userSettings } = useTheme();
  const { user } = useAuth();
  const { maintenance } = useMaintenanceMode();
  const { settings: appSettings } = useAppSettings();
  const { handlePlayTrack, currentTrack } = useMusicPlayer();

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) { setIsAdmin(false); return; }
      const { data } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      setIsAdmin(!!data);
    };
    checkAdmin();
  }, [user]);

  const allMenuItems = [
    { id: 'home', label: 'Home', icon: Home, path: '/' },
    { id: 'search', label: 'Search', icon: Search, path: '/' },
    { id: 'artists', label: 'Artists', icon: Users, path: '/artists' },
    { id: 'playlists', label: 'Playlists', icon: ListMusic, path: '/playlists' },
    { id: 'favorites', label: 'Favorites', icon: Heart, path: '/favorites' },
    { id: 'offline', label: 'Downloads', icon: Download, path: '/offline' },
    { id: 'get-app', label: 'Get App', icon: MonitorSmartphone, path: '/get-app' },
    { id: 'stats', label: 'Statistics', icon: BarChart3, path: '/stats' },
    { id: 'ai-dj', label: 'AI DJ', icon: Sparkles, path: '/ai-dj' },
    { id: 'games', label: 'Games', icon: Gamepad2, path: '/games' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin', icon: Shield, path: '/admin' }] : []),
  ];

  // Filter out hidden tabs (never hide home, settings, admin)
  const protectedTabs = ['home', 'settings', 'admin'];
  const menuItems = allMenuItems.filter(
    item => protectedTabs.includes(item.id) || !appSettings.hidden_tabs.includes(item.id)
  );

  const handleNavClick = (item: typeof menuItems[0]) => {
    onTabChange(item.id);
    navigate(item.path);
    setMobileOpen(false);
    setMoreExpanded(false);

    // If Search clicked, focus the search input after navigation
    if (item.id === 'search') {
      setTimeout(() => {
        const input = document.querySelector('header input') as HTMLInputElement;
        if (input) input.focus();
      }, 100);
    }
  };

  const isItemActive = (item: typeof menuItems[0]) => {
    if (item.path === '/admin' && location.pathname === '/admin') return true;
    if (item.path === '/settings' && location.pathname === '/settings') return true;
    if (item.path === '/offline' && location.pathname === '/offline') return true;
    if (item.path === '/get-app' && location.pathname === '/get-app') return true;
    if (item.path === '/games' && location.pathname === '/games') return true;
    if (item.path === '/stats' && (location.pathname === '/stats' || location.pathname === '/statistics')) return true;
    if (item.path === '/ai-dj' && location.pathname === '/ai-dj') return true;
    if (item.id === 'playlists' && location.pathname.startsWith('/playlist')) return true;
    if (item.id === 'artists' && (location.pathname === '/artists' || location.pathname.startsWith('/artist'))) return true;
    if (item.path === '/' && location.pathname === '/' && item.id === activeTab) return true;
    return false;
  };

  // Other songs to display in the expanded bottom panel
  const recommendedSongs = famousSongs
    .filter(track => !currentTrack || track.id !== currentTrack.id)
    .slice(0, 4);

  return (
    <>
      {/* Sleek Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-sidebar/95 backdrop-blur-xl border-t border-border z-[140] px-2 flex items-center justify-around pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        {(userSettings.mobileNavItems || ['home', 'playlists', 'favorites', 'settings']).map((itemId) => {
          const item = menuItems.find(m => m.id === itemId);
          if (!item) return null;
          const Icon = item.icon;
          const isActive = isItemActive(item) && !moreExpanded;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full py-2 transition-all duration-300 active:scale-95 touch-manipulation",
                isActive ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5 mb-1 transition-all duration-300", isActive && "scale-110")} />
              <span className="text-[9px] tracking-tight leading-none">{item.label}</span>
            </button>
          );
        })}
        
        {/* More Button to Toggle Bottom Sheet */}
        <button
          onClick={() => setMoreExpanded(!moreExpanded)}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full py-2 transition-all duration-300 active:scale-95 touch-manipulation",
            moreExpanded ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {moreExpanded ? (
            <X className="w-5 h-5 mb-1 text-primary scale-110 animate-spin-once" />
          ) : (
            <Menu className="w-5 h-5 mb-1 transition-all duration-300 hover:scale-110" />
          )}
          <span className="text-[9px] tracking-tight leading-none">More</span>
        </button>
      </div>

      {/* Mobile Expanding Bottom Sheet panel */}
      <AnimatePresence>
        {moreExpanded && (
          <>
            {/* Dark Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMoreExpanded(false)}
              className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[145]"
            />

            {/* Slide up sheet panel container */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="md:hidden fixed bottom-16 left-0 right-0 bg-[#0c0c0e]/95 backdrop-blur-2xl border-t border-white/10 rounded-t-[2.5rem] z-[150] shadow-[0_-15px_35px_rgba(0,0,0,0.6)] overflow-y-auto max-h-[75vh] scrollbar-none pb-8"
            >
              {/* Drag Indicator handle */}
              <div 
                onClick={() => setMoreExpanded(false)}
                className="w-12 h-1 rounded-full bg-muted-foreground/30 mx-auto my-3.5 cursor-pointer active:bg-muted-foreground/60 transition-colors"
              />

              {/* Title / Logo Header inside drawer */}
              <div className="px-6 py-2 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold tracking-tight uppercase text-primary">Discover & Play</h3>
                  <p className="text-[9px] text-muted-foreground">Quick menu & premium selections</p>
                </div>
                <button
                  onClick={() => setMoreExpanded(false)}
                  className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-95"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Grid of Other All Buttons (excluding ones already in the bottom bar) */}
              <div className="px-5 py-4">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1">Channels & Controls</p>
                <div className="grid grid-cols-4 gap-2">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = isItemActive(item);
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item)}
                        className={cn(
                          "flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all duration-300 active:scale-95 touch-manipulation cursor-pointer",
                          isActive 
                            ? "bg-primary/10 border-primary/30 text-primary font-bold shadow-md" 
                            : "bg-white/[0.02] border-white/5 text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center mb-1.5",
                          isActive ? "bg-primary/20" : "bg-white/[0.04]"
                        )}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] text-center font-medium leading-tight truncate w-full">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: "Other Music Also There" (List of hot tracks for instant play) */}
              <div className="px-5 py-3 border-t border-white/5">
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Other Hot Music</p>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-primary/20 text-primary uppercase font-bold tracking-wider">Tap to Play</span>
                </div>
                
                <div className="space-y-2">
                  {recommendedSongs.map((track) => (
                    <div
                      key={track.id}
                      onClick={() => {
                        handlePlayTrack(track);
                        setMoreExpanded(false);
                      }}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-xl transition-all duration-300 active:scale-[0.98] border border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.04] cursor-pointer",
                        currentTrack?.id === track.id ? "border-primary/20 bg-primary/5" : ""
                      )}
                    >
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/5">
                        <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
                        {currentTrack?.id === track.id && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Disc3 className="w-4 h-4 text-primary animate-spin" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-xs font-semibold truncate leading-snug",
                          currentTrack?.id === track.id ? "text-primary" : "text-foreground"
                        )}>
                          {track.title}
                        </p>
                        <p className="text-[9px] text-muted-foreground/80 truncate mt-0.5">{track.channel}</p>
                      </div>

                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground shrink-0 transition-colors">
                        <Play className="w-3 h-3 ml-0.5" fill="currentColor" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Mobile Overlay for standard sidebar drawer (if opened differently) */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-[110]"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop Sidebar (hidden on mobile, behaves as standard sidebar) */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-border flex-col z-[120] transition-transform duration-300',
          mobileOpen ? 'translate-x-0 flex' : '-translate-x-full md:translate-x-0 md:flex hidden md:block'
        )}
      >
        {/* Logo and Mobile Close Button */}
        <div className="p-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={appSettings.app_logo_url || nyraLogo} alt={`${appSettings.app_name} Logo`} className="w-10 h-10 rounded-xl object-cover" />
            <div>
              <span className="text-2xl font-bold text-primary theme-gradient-text">
                {appSettings.app_name}
              </span>
              <p className="text-[10px] text-muted-foreground tracking-widest">{appSettings.app_tagline}</p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-foreground hover:bg-secondary/80 focus:outline-none transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto min-h-0">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = isItemActive(item);
              
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavClick(item)}
                    className={cn(
                      'w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 cursor-pointer',
                      isActive
                        ? 'bg-primary text-primary-foreground neon-glow'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    )}
                    style={
                      isActive
                        ? gradient.enabled
                          ? { background: 'var(--theme-gradient)' }
                          : { backgroundColor: 'hsl(var(--primary))' }
                        : undefined
                    }
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Maintenance Notice */}
        {maintenance.enabled && (
          <div className="mx-4 mb-3 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
            <div className="flex items-center gap-2 text-yellow-500">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="text-xs font-semibold">Maintenance Mode</span>
            </div>
            <p className="text-[10px] text-yellow-500/70 mt-1">Site is currently under maintenance for other users.</p>
          </div>
        )}

        {/* Bottom Section */}
        <div className="p-4 border-t border-border">
          <div className="text-xs text-muted-foreground text-center">
            <p>{appSettings.footer_text}</p>
            <p className="mt-1">{appSettings.footer_powered_by}</p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
