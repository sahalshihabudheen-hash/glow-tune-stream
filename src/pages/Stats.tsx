import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { BarChart3, Clock, Music2, Users, Heart, Flame, Play, ArrowLeft } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useFavorites } from '@/hooks/useFavorites';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { useListeningStats, formatDuration } from '@/hooks/useListeningStats';

const PIE_COLORS = [
  'hsl(210 100% 55%)', 'hsl(190 95% 50%)', 'hsl(260 85% 62%)', 'hsl(330 85% 60%)',
  'hsl(35 95% 55%)', 'hsl(150 70% 45%)', 'hsl(0 80% 60%)', 'hsl(280 60% 55%)',
];

const chartTooltip = {
  contentStyle: {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '0.75rem',
    fontSize: '12px',
  },
};

const StatCard = ({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) => (
  <div className="rounded-2xl border border-white/10 bg-card/40 backdrop-blur-xl p-4 md:p-5">
    <div className="flex items-center gap-2 text-muted-foreground mb-2">
      <Icon className="w-4 h-4 text-primary" />
      <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{label}</span>
    </div>
    <p className="text-2xl md:text-3xl font-black tracking-tighter">{value}</p>
    {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
  </div>
);

const Panel = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-white/10 bg-card/40 backdrop-blur-xl p-4 md:p-6">
    <div className="mb-4">
      <h2 className="text-base md:text-lg font-bold tracking-tight">{title}</h2>
      {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
    </div>
    {children}
  </section>
);

const Stats = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { userId } = useParams<{ userId?: string }>();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('stats');
  const { handlePlayTrack } = useMusicPlayer();
  const { favoriteTracks } = useFavorites();
  const s = useListeningStats(userId);

  const viewingUser = location.state as { email?: string; display_name?: string } | null;
  const isViewingOtherUser = !!userId && userId !== user?.id;
  const pageTitle = isViewingOtherUser
    ? `${viewingUser?.display_name || viewingUser?.email || 'User'}'s Statistics`
    : 'Your Music Statistics';
  const pageSubtitle = isViewingOtherUser
    ? 'Admin view of user listening data'
    : 'Updated automatically as you listen';

  const handleSearch = () => {
    if (searchQuery.trim()) navigate(`/?search=${encodeURIComponent(searchQuery)}`);
  };

  const play = (t: { id: string; title: string; thumbnail: string; channel: string }) =>
    handlePlayTrack(t);

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="ml-0 md:ml-64">
          <Navbar searchQuery={searchQuery} onSearchChange={setSearchQuery} onSearch={handleSearch} />
          <main className="pt-28 pb-32 px-4 md:px-8 flex flex-col items-center text-center py-20">
            <div className="p-4 rounded-full bg-primary/10 mb-4"><BarChart3 className="h-12 w-12 text-primary" /></div>
            <h1 className="text-xl font-semibold mb-2">Login to see your statistics</h1>
            <p className="text-muted-foreground mb-6 max-w-md">Your listening stats are built from your own play history.</p>
            <Link to="/auth"><Button>Login</Button></Link>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="ml-0 md:ml-64">
        <Navbar searchQuery={searchQuery} onSearchChange={setSearchQuery} onSearch={handleSearch} />

        <main className="pt-28 pb-48 px-4 md:px-8 space-y-6">
          <header className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><BarChart3 className="h-6 w-6 text-primary" /></div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold truncate">{pageTitle}</h1>
              <p className="text-sm text-muted-foreground">{pageSubtitle}</p>
            </div>
            {isViewingOtherUser && (
              <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
          </header>

          {s.loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
            </div>
          ) : s.totalPlays === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-card/40 p-10 text-center">
              <Music2 className="w-10 h-10 text-primary mx-auto mb-3" />
              <p className="font-semibold mb-1">No listening data yet</p>
              <p className="text-sm text-muted-foreground">Play a few songs and your statistics will appear here.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <StatCard icon={Clock} label="Listening time" value={formatDuration(s.totalSeconds)} sub="Estimated from play count" />
                <StatCard icon={Play} label="Total plays" value={String(s.totalPlays)} sub={`${s.uniqueTracks} unique songs`} />
                <StatCard icon={Users} label="Artists" value={String(s.uniqueArtists)} sub="Distinct channels" />
                <StatCard icon={Heart} label="Favorites" value={String(s.favoritesCount)} sub="Saved songs" />
                <StatCard icon={Flame} label="This week" value={`${s.weekPlays} plays`} sub={formatDuration(s.weekSeconds)} />
                <StatCard icon={Flame} label="This month" value={`${s.monthPlays} plays`} sub={formatDuration(s.monthSeconds)} />
                <StatCard icon={Music2} label="Top song" value={s.topTracks[0]?.plays ? `${s.topTracks[0].plays}x` : '—'} sub={s.topTracks[0]?.title} />
                <StatCard icon={Users} label="Top artist" value={s.topArtists[0]?.plays ? `${s.topArtists[0].plays}x` : '—'} sub={s.topArtists[0]?.name} />
              </div>

              <Panel title="Listening activity" subtitle="Plays per day, last 30 days">
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={s.activity}>
                      <defs>
                        <linearGradient id="statsArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={4} />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} width={28} />
                      <Tooltip {...chartTooltip} />
                      <Area type="monotone" dataKey="plays" stroke="hsl(var(--primary))" fill="url(#statsArea)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <div className="grid md:grid-cols-2 gap-6">
                <Panel title="Activity by day" subtitle="Which weekdays you listen most">
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={s.byWeekday}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} width={28} />
                        <Tooltip {...chartTooltip} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.15 }} />
                        <Bar dataKey="plays" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>

                <Panel title="Activity by hour" subtitle="Your listening clock (local time)">
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={s.byHour}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={2} />
                        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} width={28} />
                        <Tooltip {...chartTooltip} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.15 }} />
                        <Bar dataKey="plays" fill="hsl(190 95% 50%)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <Panel title="Most played songs" subtitle="Top 10 by play count">
                  <div className="space-y-2">
                    {s.topTracks.slice(0, 10).map((t, i) => (
                      <button
                        key={t.id}
                        onClick={() => play(t)}
                        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors text-left"
                      >
                        <span className="w-5 text-xs font-bold text-muted-foreground">{i + 1}</span>
                        <img src={t.thumbnail} alt={t.title} loading="lazy" className="w-11 h-11 rounded-lg object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{t.title}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{t.channel}</p>
                        </div>
                        <span className="text-xs font-bold text-primary shrink-0">{t.plays}x</span>
                      </button>
                    ))}
                  </div>
                </Panel>

                <Panel title="Most played artists" subtitle="Top 10 channels">
                  <div className="h-[380px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={s.topArtists.slice(0, 10)} layout="vertical" margin={{ left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip {...chartTooltip} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.15 }} />
                        <Bar dataKey="plays" fill="hsl(260 85% 62%)" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <Panel title="Most played genres" subtitle="Detected from song and channel names">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={s.topGenres.slice(0, 8)}
                          dataKey="plays"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={85}
                          paddingAngle={3}
                        >
                          {s.topGenres.slice(0, 8).map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Tooltip {...chartTooltip} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>

                <Panel title="Recently played" subtitle="Your last 20 plays">
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {s.recent.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => play({ id: r.track_id, title: r.track_title, thumbnail: r.track_thumbnail, channel: r.track_channel })}
                        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors text-left"
                      >
                        <img src={r.track_thumbnail} alt={r.track_title} loading="lazy" className="w-10 h-10 rounded-lg object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{r.track_title}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{r.track_channel}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(r.played_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </button>
                    ))}
                  </div>
                </Panel>
              </div>

              <Panel title="Favorite songs" subtitle={`${favoriteTracks.length} saved`}>
                {favoriteTracks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No favorites yet.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {favoriteTracks.slice(0, 12).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => play(t)}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors text-left"
                      >
                        <img src={t.thumbnail} alt={t.title} loading="lazy" className="w-10 h-10 rounded-lg object-cover" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{t.title}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{t.channel}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </Panel>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Stats;
