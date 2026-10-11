import { Home, Search, ListMusic, Heart, Settings, Menu, X, Users, Shield, Gamepad2, Sparkles, AlertTriangle, Wand2, Headphones, Play, Disc3, Download, MonitorSmartphone, BarChart3, Orbit, Instagram } from 'lucide-react';
import { useState, useEffect, useLayoutEffect } from 'react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const SIDEBAR_KEY = 'nyra-sidebar-collapsed';
// Pages keep their `md:ml-64` classes; index.css points them at this variable.
const SIDEBAR_W_EXPANDED = '16rem';
const SIDEBAR_W_COLLAPSED = '6rem';

// Mobile bottom bar geometry (px). The notch piece is cut around the floating bubble.
const BAR_PAD = 8;
const NOTCH_W = 74;
const BUBBLE = 48;
const BAR_TRANSITION_STYLE = { transitionDuration: '500ms', transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' } as const;
// Bar top edge dips around the bubble: flat, fillet, circular dip (r=29), fillet, flat.
const NOTCH_PATH = 'M0 0H0.07Q8.07 0 8.63 8A29 29 0 0 0 65.37 8Q65.93 0 73.93 0H74V64H0Z';

interface NavItemButtonProps {
  item: { id: string; label: string; icon: typeof Home };
  active: boolean;
  rail: boolean;
  onClick: () => void;
}

const NavItemButton = ({ item, active, rail, onClick }: NavItemButtonProps) => {
  const Icon = item.icon;
  const button = (
    <button
      onClick={onClick}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex items-center rounded-2xl transition-all duration-300 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
        rail ? 'h-11 w-11 mx-auto justify-center' : 'h-11 w-full gap-3 px-3.5',
        active
          ? 'bg-sidebar-foreground text-sidebar shadow-[0_8px_24px_-8px_hsl(var(--sidebar-foreground)/0.45)]'
          : 'text-sidebar-foreground/60 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground'
      )}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {!rail && <span className="text-sm font-medium truncate">{item.label}</span>}
    </button>
  );

  if (!rail) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={14}
        className="rounded-xl border-0 bg-sidebar-foreground px-3.5 py-2 text-sm font-semibold text-sidebar shadow-xl"
      >
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
};

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreExpanded, setMoreExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === '1'; } catch { return false; }
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { settings: userSettings } = useTheme();
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

  // Tell the rest of the layout how wide the desktop sidebar is (see index.css)
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W_EXPANDED);
    try { localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [collapsed]);

  const allMenuItems = [
    { id: 'home', label: 'Home', icon: Home, path: '/' },
    { id: 'search', label: 'Search', icon: Search, path: '/' },
    { id: 'artists', label: 'Artists', icon: Users, path: '/artists' },
    { id: 'playlists', label: 'Playlists', icon: ListMusic, path: '/playlists' },
    { id: 'favorites', label: 'Favorites', icon: Heart, path: '/favorites' },
    { id: 'offline', label: 'Downloads', icon: Download, path: '/offline' },
    { id: 'get-app', label: 'Get App', icon: MonitorSmartphone, path: '/get-app' },
    ...(userSettings.showInstagramPage ? [{ id: 'instagram', label: 'Reel Saver', icon: Instagram, path: '/instagram' }] : []),
    { id: 'stats', label: 'Statistics', icon: BarChart3, path: '/stats' },
    { id: 'ai-dj', label: 'AI DJ', icon: Sparkles, path: '/ai-dj' },
    ...(userSettings.musicUniverse ? [{ id: 'universe', label: 'Music Universe', icon: Orbit, path: '/universe' }] : []),
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
    if ((item.path === '/creator' || item.id === 'creator') && (location.pathname === '/creator' || location.pathname === '/sahal-shihabudheen')) return true;
    if (item.path === '/settings' && location.pathname === '/settings') return true;
    if (item.path === '/favorites' && location.pathname === '/favorites') return true;
    if (item.path === '/offline' && location.pathname === '/offline') return true;
    if (item.path === '/get-app' && location.pathname === '/get-app') return true;
    if (item.path === '/instagram' && ['/instagram', '/insta', '/reels'].includes(location.pathname)) return true;
    if (item.path === '/games' && location.pathname === '/games') return true;
    if (item.path === '/stats' && (location.pathname === '/stats' || location.pathname === '/statistics')) return true;
    if (item.path === '/ai-dj' && location.pathname === '/ai-dj') return true;
    if (item.path === '/universe' && location.pathname === '/universe') return true;
    if (item.id === 'playlists' && location.pathname.startsWith('/playlist')) return true;
    if (item.id === 'artists' && (location.pathname === '/artists' || location.pathname.startsWith('/artist'))) return true;
    if (item.path === '/' && location.pathname === '/' && item.id === activeTab) return true;
    return false;
  };

  // Other songs to display in the expanded bottom panel
  const recommendedSongs = famousSongs
    .filter(track => !currentTrack || track.id !== currentTrack.id)
    .slice(0, 4);

  // ---- Mobile bottom bar: bubble + notch follow the active tab ----
  const barItems = (userSettings.mobileNavItems || ['home', 'playlists', 'favorites', 'settings'])
    .map((id) => menuItems.find((m) => m.id === id))
    .filter((m): m is typeof menuItems[0] => !!m);
  const barCount = barItems.length + 1; // + "More"
  const activeIdx = moreExpanded ? barItems.length : barItems.findIndex((i) => isItemActive(i));
  const hasActive = activeIdx >= 0;
  const BubbleIcon = moreExpanded ? X : barItems[activeIdx]?.icon;
  const bubbleKey = moreExpanded ? 'more' : barItems[activeIdx]?.id;
  const centerAt = (i: number) =>
    `calc(${BAR_PAD}px + ${((i + 0.5) / barCount).toFixed(5)} * (100% - ${BAR_PAD * 2}px))`;
  const notchLeft = hasActive ? `max(0px, calc(${centerAt(activeIdx)} - ${NOTCH_W / 2}px))` : '100%';
  const onBubbleClick = () => {
    if (moreExpanded) setMoreExpanded(false);
    else if (barItems[activeIdx]) handleNavClick(barItems[activeIdx]);
  };

  // ---- Desktop: rail = icons only; the mobile drawer is always expanded ----
  const rail = collapsed && !mobileOpen;

  return (
    <TooltipProvider delayDuration={0}>
      {/* Mobile bottom navigation: curved bar with a floating bubble on the active tab */}
      <nav className={cn("md:hidden fixed bottom-0 left-0 right-0 h-16", moreExpanded ? "z-[155]" : "z-[140]")} aria-label="Main navigation">
        {/* Bar background with a notch that slides under the bubble */}
        <div className="absolute inset-0" style={{ filter: 'drop-shadow(0 -8px 16px rgba(0,0,0,0.35))' }}>
          <div className="flex h-full overflow-hidden rounded-t-[26px]">
            <div
              className="h-full shrink-0 bg-sidebar transition-[width]"
              style={{ width: notchLeft, ...BAR_TRANSITION_STYLE }}
            />
            <svg
              width={NOTCH_W}
              height="64"
              viewBox={`0 0 ${NOTCH_W} 64`}
              className="shrink-0"
              aria-hidden="true"
            >
              <path d={NOTCH_PATH} style={{ fill: 'hsl(var(--sidebar-background))' }} />
            </svg>
            <div className="h-full flex-1 bg-sidebar" />
          </div>
        </div>

        {/* Floating bubble holding the active icon */}
        <button
          onClick={onBubbleClick}
          tabIndex={-1}
          aria-hidden={!hasActive}
          className={cn(
            'absolute flex items-center justify-center rounded-full bg-sidebar text-primary transition-[left,transform,opacity]',
            'shadow-[0_0_20px_hsl(var(--primary)/0.35)] active:scale-95 touch-manipulation',
            hasActive ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'
          )}
          style={{
            ...BAR_TRANSITION_STYLE,
            width: BUBBLE,
            height: BUBBLE,
            top: -(BUBBLE / 2 - 2),
            left: hasActive ? `calc(${centerAt(activeIdx)} - ${BUBBLE / 2}px)` : '50%',
          }}
        >
          {BubbleIcon && (
            <BubbleIcon key={bubbleKey} className="w-[22px] h-[22px] animate-[nav-bubble-pop_0.35s_ease-out]" />
          )}
        </button>

        {/* Tabs */}
        <div className="relative z-10 flex h-full items-stretch pb-safe" style={{ paddingLeft: BAR_PAD, paddingRight: BAR_PAD }}>
          {barItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = idx === activeIdx;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full py-2 transition-colors duration-300 active:scale-95 touch-manipulation',
                  isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className={cn('w-5 h-5 mb-1 transition-all duration-300', isActive && 'opacity-0 scale-50')} />
                <span className="text-[9px] tracking-tight leading-none">{item.label}</span>
              </button>
            );
          })}

          {/* More Button to Toggle Bottom Sheet */}
          <button
            onClick={() => setMoreExpanded(!moreExpanded)}
            aria-label="More"
            aria-expanded={moreExpanded}
            className={cn(
              'flex flex-col items-center justify-center flex-1 h-full py-2 transition-colors duration-300 active:scale-95 touch-manipulation',
              moreExpanded ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Menu className={cn('w-5 h-5 mb-1 transition-all duration-300', moreExpanded && 'opacity-0 scale-50')} />
            <span className="text-[9px] tracking-tight leading-none">More</span>
          </button>
        </div>
      </nav>

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
              className="md:hidden fixed bottom-16 left-0 right-0 bg-sidebar/95 backdrop-blur-2xl border-t border-sidebar-foreground/10 rounded-t-[2.5rem] z-[150] shadow-[0_-15px_35px_rgba(0,0,0,0.6)] overflow-y-auto max-h-[75vh] scrollbar-none pb-8"
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
                            ? "bg-sidebar-foreground border-transparent text-sidebar font-bold shadow-md" 
                            : "bg-white/[0.02] border-white/5 text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center mb-1.5",
                          isActive ? "bg-sidebar/10" : "bg-white/[0.04]"
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

      {/* Desktop Sidebar: floating rounded panel that collapses to an icon rail */}
      <aside
        className={cn(
          'fixed left-3 top-3 bottom-3 z-[120] flex-col rounded-[1.75rem] border border-sidebar-foreground/[0.06] bg-sidebar',
          'shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] transition-[width,transform] duration-300 ease-out',
          rail ? 'w-[4.5rem]' : 'w-[14.5rem]',
          mobileOpen ? 'flex translate-x-0' : '-translate-x-[120%] hidden md:flex md:translate-x-0'
        )}
      >
        {/* Logo + collapse toggle (X closes the mobile drawer) */}
        <div className={cn('flex items-center', rail ? 'justify-center px-2 pt-4 pb-2' : 'justify-between gap-2 px-4 pt-5 pb-3')}>
          {!rail && (
            <div className="flex items-center gap-3 min-w-0">
              <img src={appSettings.app_logo_url || nyraLogo} alt={`${appSettings.app_name} Logo`} className="w-10 h-10 rounded-xl object-cover shrink-0" />
              <div className="min-w-0">
                <span className="block text-xl font-bold text-primary theme-gradient-text truncate">
                  {appSettings.app_name}
                </span>
                <p className="text-[10px] text-muted-foreground tracking-widest truncate">{appSettings.app_tagline}</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden md:flex w-10 h-10 shrink-0 rounded-xl items-center justify-center text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Menu className="w-5 h-5" />
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden w-8 h-8 shrink-0 rounded-full bg-secondary flex items-center justify-center text-foreground hover:bg-secondary/80 focus:outline-none transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ul className="space-y-1.5">
            {menuItems.map((item) => (
              <li key={item.id}>
                <NavItemButton item={item} active={isItemActive(item)} rail={rail} onClick={() => handleNavClick(item)} />
              </li>
            ))}
          </ul>
        </nav>

        {/* Maintenance Notice */}
        {maintenance.enabled && (
          rail ? (
            <div className="mb-3 flex justify-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-11 h-11 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-500">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  sideOffset={14}
                  className="rounded-xl border-0 bg-sidebar-foreground px-3.5 py-2 text-sm font-semibold text-sidebar shadow-xl"
                >
                  Maintenance Mode
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <div className="mx-3 mb-3 p-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/30">
              <div className="flex items-center gap-2 text-yellow-500">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="text-xs font-semibold">Maintenance Mode</span>
              </div>
              <p className="text-[10px] text-yellow-500/70 mt-1">Site is currently under maintenance for other users.</p>
            </div>
          )
        )}

        {/* Bottom card */}
        <div className="p-3">
          {rail ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate('/creator')}
                  aria-label="Crafted by Sahal Shihabudheen"
                  className="mx-auto flex w-11 h-11 items-center justify-center rounded-2xl bg-sidebar-foreground/[0.06] text-primary font-bold hover:bg-sidebar-foreground/10 transition-colors"
                >
                  S
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                sideOffset={14}
                className="rounded-xl border-0 bg-sidebar-foreground px-3.5 py-2 text-sm font-semibold text-sidebar shadow-xl"
              >
                Crafted by Sahal Shihabudheen
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl bg-sidebar-foreground/[0.06] p-3">
              <div className="w-9 h-9 shrink-0 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center">S</div>
              <div className="min-w-0 text-xs text-muted-foreground">
                <p className="truncate">{appSettings.footer_text}</p>
                <p className="mt-0.5 leading-snug">
                  Crafted by{' '}
                  <a
                    href="/creator"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/creator');
                    }}
                    className="text-primary hover:underline font-semibold"
                    title="Sahal Shihabudheen - Founder of NYRA"
                  >
                    Sahal Shihabudheen
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
};

export default Sidebar;
