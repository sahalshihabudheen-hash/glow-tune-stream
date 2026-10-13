import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, ArrowLeft, Clock, Disc3, Gamepad2, Globe2, Heart, ListMusic, Loader2, Play,
  RefreshCw, ShieldAlert, Smartphone, UserPlus, Users, Zap,
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useAdminUsageStats, type UsageRange, type UsageStats } from '@/hooks/useAdminUsageStats';
import { cn } from '@/lib/utils';

const RANGES: UsageRange[] = [7, 30, 90];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const tooltipStyle = {
  contentStyle: {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '0.75rem',
    fontSize: '12px',
  },
};

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString();

const timeAgo = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

const Panel = ({
  title, subtitle, action, className, children,
}: { title: string; subtitle?: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) => (
  <section className={cn('relative overflow-hidden rounded-2xl border border-border bg-card/60 p-4 md:p-5', className)}>
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-foreground/90">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

/** Tiny inline trend line used inside KPI tiles. */
const Spark = ({ values, className }: { values: number[]; className?: string }) => {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const w = 100;
  const h = 28;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * (h - 3) - 1.5}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn('h-7 w-full', className)} aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

const Kpi = ({
  icon: Icon, label, value, sub, spark, tone = 'primary',
}: {
  icon: typeof Users; label: string; value: string; sub?: string; spark?: number[];
  tone?: 'primary' | 'cyan' | 'pink' | 'green';
}) => {
  const toneClass = {
    primary: 'text-primary',
    cyan: 'text-cyan-400',
    pink: 'text-pink-400',
    green: 'text-emerald-400',
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <Icon className={cn('h-4 w-4', toneClass)} />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{label}</span>
      </div>
      <p className="text-2xl font-black tracking-tight md:text-3xl">{value}</p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</p>}
      {spark && <Spark values={spark} className={cn('mt-2', toneClass)} />}
    </div>
  );
};

/** Circular gauge for stickiness (DAU / MAU). */
const Ring = ({ pct, label }: { pct: number; label: string }) => {
  const r = 34;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <div className="relative grid h-24 w-24 shrink-0 place-items-center">
      <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="7" />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth="7"
          strokeLinecap="round" strokeDasharray={`${dash} ${c}`}
          style={{ transition: 'stroke-dasharray .8s ease', filter: 'drop-shadow(0 0 6px hsl(var(--primary) / .6))' }}
        />
      </svg>
      <div className="text-center">
        <p className="text-xl font-black leading-none">{pct}%</p>
        <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      </div>
    </div>
  );
};

/** Horizontal ranked bars with an optional right-hand value. */
const RankBars = ({
  rows, hue = 'hsl(var(--primary))', empty = 'No data in this range.',
}: { rows: { name: string; count: number; extra?: string }[]; hue?: string; empty?: string }) => {
  const max = Math.max(...rows.map((r) => r.count), 1);
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={`${r.name}-${i}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate font-medium">{r.name}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {r.count.toLocaleString()}{r.extra ? ` · ${r.extra}` : ''}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.max(3, (r.count / max) * 100)}%`, background: hue }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

/** Weekday x hour heat grid — shows when the whole user base is listening. */
const Heatmap = ({ grid }: { grid: number[][] }) => {
  const max = Math.max(1, ...grid.flat());
  const hours = Array.from({ length: 24 }, (_, h) => h);
  return (
    <div className="overflow-x-auto no-scrollbar">
      <div className="min-w-[520px]">
        <div className="mb-1 ml-9 grid grid-cols-24 gap-[3px] text-[9px] text-muted-foreground" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
          {hours.map((h) => (
            <span key={h} className="text-center">{h % 3 === 0 ? h : ''}</span>
          ))}
        </div>
        {grid.map((row, d) => (
          <div key={d} className="mb-[3px] flex items-center gap-1.5">
            <span className="w-7 text-[10px] font-bold text-muted-foreground">{WEEKDAYS[d]}</span>
            <div className="grid flex-1 gap-[3px]" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
              {row.map((v, h) => (
                <div
                  key={h}
                  title={`${WEEKDAYS[d]} ${String(h).padStart(2, '0')}:00 — ${v} plays`}
                  className="aspect-square rounded-[3px]"
                  style={{
                    background: v === 0 ? 'hsl(var(--muted) / .5)' : `hsl(var(--primary) / ${0.15 + (v / max) * 0.85})`,
                    boxShadow: v / max > 0.8 ? '0 0 8px hsl(var(--primary) / .55)' : undefined,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
          Quiet
          <div className="flex gap-[3px]">
            {[0.15, 0.35, 0.6, 0.85, 1].map((o) => (
              <span key={o} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: `hsl(var(--primary) / ${o})` }} />
            ))}
          </div>
          Busy
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const AdminStats = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [range, setRange] = useState<UsageRange>(30);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setIsAdmin(false); return; }
      const { data } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (!cancelled) setIsAdmin(!!data);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const { data, loading, error, refresh } = useAdminUsageStats(range, isAdmin === true);

  const peak = useMemo(() => {
    if (!data) return null;
    let best = { d: 0, h: 0, v: 0 };
    data.heatmap.forEach((row, d) => row.forEach((v, h) => { if (v > best.v) best = { d, h, v }; }));
    if (best.v === 0) return null;
    const h12 = best.h % 12 === 0 ? 12 : best.h % 12;
    return `${WEEKDAYS[best.d]} ${h12}${best.h < 12 ? 'am' : 'pm'}`;
  }, [data]);

  const chartSeries = useMemo(
    () => (data ? data.series.map((p) => ({ ...p, label: p.date.slice(5) })) : []),
    [data],
  );

  if (authLoading || isAdmin === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="mb-1 text-lg font-bold">Admins only</h1>
          <p className="mb-5 text-sm text-muted-foreground">
            {user ? 'Your account does not have admin access.' : 'Sign in with an admin account to view app usage.'}
          </p>
          <Button onClick={() => navigate(user ? '/' : '/auth')}>{user ? 'Back to app' : 'Sign in'}</Button>
        </div>
      </div>
    );
  }

  const t = data?.totals;
  const a = data?.activity;
  const playsSpark = data?.series.map((p) => p.plays) || [];
  const activeSpark = data?.series.map((p) => p.activeUsers) || [];
  const signupSpark = data?.series.map((p) => p.signups) || [];
  const deviceTotal = (data?.devices || []).reduce((s, d) => s + d.count, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center gap-3 px-3 py-3 sm:px-4">
          <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Admin</span>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 truncate text-base font-black tracking-tight sm:text-lg">
              <Activity className="h-5 w-5 shrink-0 text-primary" />
              Usage Command Center
            </h1>
            <p className="truncate text-[10px] text-muted-foreground sm:text-xs">
              Everyone's activity across the app{data ? ` · updated ${timeAgo(data.generatedAt)}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-card p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors sm:px-3',
                  range === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {r}d
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={refresh} disabled={loading} title="Refresh">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </header>

      <main className="container mx-auto space-y-4 px-3 py-4 sm:space-y-6 sm:px-4 sm:py-8">
        {error && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <p className="font-semibold">Couldn't load usage stats</p>
            <p className="mt-1 text-muted-foreground">{error}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              If this is the first time, make sure the <code className="rounded bg-muted px-1">admin-get-usage-stats</code> backend function has been deployed.
            </p>
          </div>
        )}

        {!data && loading && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        )}

        {data && t && a && (
          <>
            {data.truncated && (
              <p className="rounded-xl border border-border bg-card/60 px-3 py-2 text-[11px] text-muted-foreground">
                Very high traffic: play-based numbers are computed from the most recent 60,000 plays in this range.
              </p>
            )}

            {/* Pulse */}
            <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/60 to-card/40 p-5 md:p-6">
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
              <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-primary">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                    </span>
                    Live pulse
                  </p>
                  <p className="text-5xl font-black tracking-tighter md:text-6xl">
                    {a.activeNow}
                    <span className="ml-2 text-base font-semibold tracking-normal text-muted-foreground">listening now</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">People who played a song in the last 15 minutes.</p>
                </div>

                <div className="flex items-center gap-5">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    {[
                      { k: 'Today', v: a.dau },
                      { k: '7 days', v: a.wau },
                      { k: '30 days', v: a.mau },
                    ].map((x) => (
                      <div key={x.k}>
                        <p className="text-2xl font-black md:text-3xl">{fmt(x.v)}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{x.k}</p>
                      </div>
                    ))}
                  </div>
                  <Ring pct={a.stickiness} label="Sticky" />
                </div>
              </div>
              <p className="relative mt-4 text-[11px] text-muted-foreground">
                Active users by window. “Sticky” is today's active users as a share of the last 30 days — higher means people come back often.
              </p>
            </section>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi icon={Users} label="Total users" value={fmt(t.users)} sub={`${fmt(t.confirmedUsers)} confirmed`} />
              <Kpi icon={UserPlus} label={`New · ${range}d`} value={fmt(t.newUsers)} sub="Fresh sign-ups" spark={signupSpark} tone="green" />
              <Kpi icon={Play} label={`Plays · ${range}d`} value={fmt(t.playsInRange)} sub={`${fmt(t.playsAllTime)} all time`} spark={playsSpark} />
              <Kpi icon={Zap} label="Active listeners" value={fmt(t.listenersInRange)} sub={`${t.avgPlaysPerListener} plays each`} spark={activeSpark} tone="cyan" />
              <Kpi icon={Disc3} label="Songs heard" value={fmt(t.uniqueTracksInRange)} sub={`${fmt(t.uniqueArtistsInRange)} artists`} tone="pink" />
              <Kpi icon={Heart} label="Favorites" value={fmt(t.favorites)} sub="Saved across all users" tone="pink" />
              <Kpi icon={ListMusic} label="Playlists" value={fmt(t.playlists)} sub={`${fmt(t.playlistItems)} songs inside`} tone="cyan" />
              <Kpi icon={Gamepad2} label={`Games · ${range}d`} value={fmt(t.gameSessions)} sub={`${t.activeGameSessions} playing now`} tone="green" />
            </div>

            {/* Trend */}
            <Panel title="Plays & active users" subtitle={`Daily, last ${range} days (your local time)`}>
              <div className="h-60 md:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartSeries}>
                    <defs>
                      <linearGradient id="usagePlays" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="usageActive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(190 95% 50%)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(190 95% 50%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={range === 7 ? 0 : range === 30 ? 4 : 11} />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} width={32} />
                    <Tooltip {...tooltipStyle} />
                    <Area type="monotone" name="Plays" dataKey="plays" stroke="hsl(var(--primary))" fill="url(#usagePlays)" strokeWidth={2} />
                    <Area type="monotone" name="Active users" dataKey="activeUsers" stroke="hsl(190 95% 50%)" fill="url(#usageActive)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
              <Panel
                className="lg:col-span-3"
                title="When everyone listens"
                subtitle="Plays by weekday and hour (your local time)"
                action={peak ? (
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
                    <Clock className="h-3 w-3" /> Peak {peak}
                  </span>
                ) : undefined}
              >
                <Heatmap grid={data.heatmap} />
              </Panel>

              <Panel className="lg:col-span-2" title="New sign-ups" subtitle={`Accounts created per day, last ${range} days`}>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={range === 7 ? 0 : range === 30 ? 6 : 14} />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} width={28} />
                      <Tooltip {...tooltipStyle} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }} />
                      <Bar name="Sign-ups" dataKey="signups" fill="hsl(150 70% 45%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </div>

            {/* Content */}
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
              <Panel title="Top songs" subtitle="Most played across all users">
                <div className="space-y-1">
                  {data.topTracks.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No plays in this range.</p>}
                  {data.topTracks.map((tr, i) => (
                    <div key={tr.id} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted/40">
                      <span className="w-5 text-xs font-black text-muted-foreground">{i + 1}</span>
                      <img src={tr.thumbnail} alt="" loading="lazy" className="h-10 w-10 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{tr.title}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{tr.channel}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-bold text-primary">{tr.count}×</p>
                        <p className="text-[10px] text-muted-foreground">{tr.listeners} {tr.listeners === 1 ? 'listener' : 'listeners'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <div className="space-y-4 sm:space-y-6">
                <Panel title="Top artists" subtitle="By plays">
                  <RankBars rows={data.topArtists.slice(0, 7).map((x) => ({ name: x.name, count: x.count, extra: `${x.listeners} fans` }))} hue="hsl(260 85% 62%)" />
                </Panel>
                <Panel title="Genres" subtitle="Detected from song and channel names">
                  <RankBars rows={data.genres.slice(0, 6)} hue="hsl(330 85% 60%)" />
                </Panel>
              </div>
            </div>

            {/* People */}
            <Panel title="Power listeners" subtitle="Most active users in this range">
              {data.topListeners.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No listening activity yet.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {data.topListeners.map((l, i) => (
                    <button
                      key={l.id}
                      onClick={() => navigate(`/stats/${l.id}`, { state: { display_name: l.name } })}
                      className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-2.5 text-left transition-colors hover:border-primary/50"
                    >
                      <span className={cn('w-5 text-center text-xs font-black', i < 3 ? 'text-primary' : 'text-muted-foreground')}>{i + 1}</span>
                      {l.avatar_url ? (
                        <img src={l.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" loading="lazy" />
                      ) : (
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-xs font-black text-primary">
                          {l.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{l.name}</p>
                        <p className="text-[10px] text-muted-foreground">{l.uniqueTracks} songs · last {timeAgo(l.lastPlayed)}</p>
                      </div>
                      <span className="shrink-0 text-sm font-black tabular-nums">{l.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </Panel>

            {/* Reach */}
            <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
              <Panel title="Countries" subtitle={`${data.locatedUsers} users located`} action={<Globe2 className="h-4 w-4 text-muted-foreground" />}>
                <RankBars rows={data.countries.slice(0, 7)} hue="hsl(190 95% 50%)" empty="No location data yet." />
              </Panel>

              <Panel title="Devices" subtitle="Where people open the app" action={<Smartphone className="h-4 w-4 text-muted-foreground" />}>
                <RankBars
                  rows={data.devices.map((d) => ({
                    name: d.name.charAt(0).toUpperCase() + d.name.slice(1),
                    count: d.count,
                    extra: deviceTotal ? `${Math.round((d.count / deviceTotal) * 100)}%` : undefined,
                  }))}
                  hue="hsl(35 95% 55%)"
                  empty="No device data yet."
                />
                {data.locatedUsers > 0 && (
                  <p className="mt-4 text-[11px] text-muted-foreground">
                    {data.vpnUsers} of {data.locatedUsers} located users appear to be on a VPN.
                  </p>
                )}
              </Panel>

              <Panel title="Games" subtitle={`Sessions in the last ${range} days`} action={<Gamepad2 className="h-4 w-4 text-muted-foreground" />}>
                <RankBars
                  rows={data.games.map((g) => ({ name: g.name, count: g.count, extra: `${g.players} players · ${g.minutes}m` }))}
                  hue="hsl(150 70% 45%)"
                  empty="No game sessions in this range."
                />
              </Panel>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default AdminStats;
