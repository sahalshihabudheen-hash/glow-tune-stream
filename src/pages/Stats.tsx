import { useId, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, BarChart3, Flame, Music2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useFavorites } from '@/hooks/useFavorites';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { useListeningStats, formatDuration, localDayKey } from '@/hooks/useListeningStats';
import { cn } from '@/lib/utils';

const GENRE_COLORS = [
  'hsl(210 100% 60%)', 'hsl(190 95% 50%)', 'hsl(260 85% 66%)', 'hsl(330 85% 62%)',
  'hsl(35 95% 55%)', 'hsl(150 70% 45%)', 'hsl(0 80% 62%)', 'hsl(280 60% 60%)',
];

const WEEKDAY_ROWS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`;

/* ------------------------------------------------------------------ */
/* The record: a vinyl whose label is your top song, ringed by a       */
/* 24-hour listening clock.                                            */
/* ------------------------------------------------------------------ */

const ListeningRecord = ({
  byHour, cover, peakHour,
}: { byHour: { hour: number; plays: number }[]; cover?: string; peakHour: number | null }) => {
  const uid = useId().replace(/:/g, '');
  const max = Math.max(1, ...byHour.map((h) => h.plays));
  const C = 160;
  const inner = 104;

  return (
    <figure className="relative mx-auto w-full max-w-[340px]">
      <style>{`
        @keyframes nyraRecordSpin { to { transform: rotate(360deg); } }
        .nyra-record-disc { transform-origin: ${C}px ${C}px; animation: nyraRecordSpin 28s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .nyra-record-disc { animation: none; } }
      `}</style>
      <svg viewBox="-16 -16 352 352" role="img" aria-label="Your listening clock: plays by hour of day" className="w-full overflow-visible">
        <defs>
          <clipPath id={`${uid}-label`}><circle cx={C} cy={C} r="34" /></clipPath>
          <radialGradient id={`${uid}-vinyl`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--background))" />
            <stop offset="70%" stopColor="hsl(var(--card))" />
            <stop offset="100%" stopColor="hsl(var(--background))" />
          </radialGradient>
        </defs>

        {/* 24 hour bars — fixed, so 12am is always at the top */}
        {byHour.map(({ hour, plays }) => {
          const angle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
          const len = 6 + (plays / max) * 44;
          const x1 = C + Math.cos(angle) * inner;
          const y1 = C + Math.sin(angle) * inner;
          const x2 = C + Math.cos(angle) * (inner + len);
          const y2 = C + Math.sin(angle) * (inner + len);
          const isPeak = hour === peakHour;
          return (
            <line
              key={hour}
              x1={x1} y1={y1} x2={x2} y2={y2}
              strokeLinecap="round"
              strokeWidth={isPeak ? 6 : 4.5}
              stroke="hsl(var(--primary))"
              opacity={plays === 0 ? 0.18 : isPeak ? 1 : 0.35 + (plays / max) * 0.5}
              style={isPeak ? { filter: 'drop-shadow(0 0 6px hsl(var(--primary) / .8))' } : undefined}
            >
              <title>{`${hourLabel(hour)} — ${plays} ${plays === 1 ? 'play' : 'plays'}`}</title>
            </line>
          );
        })}

        {/* Hour markers */}
        {[0, 6, 12, 18].map((h) => {
          const angle = (h / 24) * Math.PI * 2 - Math.PI / 2;
          return (
            <text
              key={h}
              x={C + Math.cos(angle) * (inner + 62)}
              y={C + Math.sin(angle) * (inner + 62) + 3}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 9, fontWeight: 700 }}
            >
              {hourLabel(h)}
            </text>
          );
        })}

        {/* Spinning disc */}
        <g className="nyra-record-disc">
          <circle cx={C} cy={C} r="98" fill={`url(#${uid}-vinyl)`} stroke="hsl(var(--border))" strokeWidth="1.5" />
          {[88, 80, 72, 64, 56, 48].map((r) => (
            <circle key={r} cx={C} cy={C} r={r} fill="none" stroke="hsl(var(--foreground))" opacity="0.07" strokeWidth="1" />
          ))}
          <path d={`M ${C - 70} ${C - 40} A 80 80 0 0 1 ${C + 10} ${C - 80}`} fill="none" stroke="hsl(var(--foreground))" opacity="0.12" strokeWidth="2" strokeLinecap="round" />
          <circle cx={C} cy={C} r="38" fill="hsl(var(--primary))" opacity="0.9" />
          {cover ? (
            <image href={cover} x={C - 34} y={C - 34} width="68" height="68" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${uid}-label)`} />
          ) : (
            <circle cx={C} cy={C} r="34" fill="hsl(var(--card))" />
          )}
          <circle cx={C} cy={C} r="4" fill="hsl(var(--background))" />
        </g>
      </svg>
      <figcaption className="sr-only">
        {peakHour === null ? 'No listening yet.' : `You listen most around ${hourLabel(peakHour)}.`}
      </figcaption>
    </figure>
  );
};

/* ------------------------------------------------------------------ */
/* 12-week calendar                                                    */
/* ------------------------------------------------------------------ */

const Calendar = ({ days }: { days: { date: string; weekday: number; plays: number }[] }) => {
  const max = Math.max(1, ...days.map((d) => d.plays));
  const todayKey = localDayKey(new Date());
  // Build columns of weeks (Sun..Sat); pad the first column so weekdays line up.
  const cols: ({ date: string; weekday: number; plays: number } | null)[][] = [];
  let col: ({ date: string; weekday: number; plays: number } | null)[] = Array(days[0]?.weekday || 0).fill(null);
  days.forEach((d) => {
    col.push(d);
    if (d.weekday === 6) { cols.push(col); col = []; }
  });
  if (col.length) cols.push(col);

  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar" role="img" aria-label="Plays per day over the last 12 weeks">
      <div className="flex flex-col gap-[3px] pr-1 text-[10px] text-muted-foreground">
        {WEEKDAY_ROWS.map((d, i) => (
          <span key={i} className="flex h-[22px] items-center">{d}</span>
        ))}
      </div>
      <div className="flex gap-[3px]">
        {cols.map((c, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }).map((_, r) => {
              const d = c[r];
              if (!d) return <span key={r} className="h-[22px] w-[22px]" />;
              const t = d.plays / max;
              return (
                <span
                  key={r}
                  title={`${d.date} — ${d.plays} ${d.plays === 1 ? 'play' : 'plays'}`}
                  className={cn('h-[22px] w-[22px] rounded-[4px]', d.date === todayKey && 'ring-1 ring-foreground/60')}
                  style={{ background: d.plays === 0 ? 'hsl(var(--muted) / .55)' : `hsl(var(--primary) / ${0.25 + t * 0.75})` }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

const Section = ({ title, note, children, className }: { title: string; note?: string; children: React.ReactNode; className?: string }) => (
  <section className={cn('border-t border-border/70 pt-6', className)}>
    <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
    {children}
  </section>
);

const Figure = ({ value, label }: { value: string; label: string }) => (
  <div className="min-w-0">
    <p className="truncate text-2xl font-black tracking-tight tabular-nums md:text-3xl">{value}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
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
  const subject = isViewingOtherUser ? viewingUser?.display_name || viewingUser?.email || 'This listener' : 'You';

  const handleSearch = () => {
    if (searchQuery.trim()) navigate(`/?search=${encodeURIComponent(searchQuery)}`);
  };

  const play = (t: { id: string; title: string; thumbnail: string; channel: string }) => handlePlayTrack(t);

  const genreTotal = useMemo(() => s.topGenres.reduce((a, g) => a + g.plays, 0) || 1, [s.topGenres]);
  const weekdayMax = Math.max(1, ...s.byWeekday.map((d) => d.plays));
  const artistMax = Math.max(1, s.topArtists[0]?.plays || 1);
  const topWeekday = s.byWeekday.reduce((b, d) => (d.plays > b.plays ? d : b), s.byWeekday[0]);

  const todayKey = localDayKey(new Date());
  const todayRows = s.recent.filter((r) => localDayKey(new Date(r.played_at)) === todayKey);

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="ml-0 md:ml-64">
          <Navbar searchQuery={searchQuery} onSearchChange={setSearchQuery} onSearch={handleSearch} />
          <main className="flex flex-col items-center px-4 py-20 pt-28 pb-32 text-center md:px-8">
            <div className="mb-4 rounded-full bg-primary/10 p-4"><BarChart3 className="h-12 w-12 text-primary" /></div>
            <h1 className="mb-2 text-xl font-semibold">Sign in to see your sound identity</h1>
            <p className="mb-6 max-w-md text-muted-foreground">Your statistics are built from your own play history.</p>
            <Link to="/auth"><Button>Sign in</Button></Link>
          </main>
        </div>
      </div>
    );
  }

  const top = s.topTracks[0];
  const podium = s.topTracks.slice(0, 3);
  const rest = s.topTracks.slice(3, 10);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="ml-0 md:ml-64">
        <Navbar searchQuery={searchQuery} onSearchChange={setSearchQuery} onSearch={handleSearch} />

        <main className="space-y-10 px-4 pb-48 pt-28 md:px-8">
          {isViewingOtherUser && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/50 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">Admin view of {subject}'s listening</span>
              <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            </div>
          )}

          {s.loading ? (
            <div className="grid gap-6 md:grid-cols-[1fr_340px]">
              <Skeleton className="h-64 rounded-3xl" />
              <Skeleton className="mx-auto h-72 w-72 rounded-full" />
            </div>
          ) : s.totalPlays === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-12 text-center">
              <Music2 className="mx-auto mb-3 h-10 w-10 text-primary" />
              <p className="mb-1 text-lg font-semibold">Nothing on the record yet</p>
              <p className="text-sm text-muted-foreground">Play a few songs and your sound identity will appear here.</p>
            </div>
          ) : (
            <>
              {/* Hero: persona + the record */}
              <header className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_340px]">
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">
                    {isViewingOtherUser ? `${subject} is` : 'You are'}
                  </p>
                  <h1 className="text-5xl font-black leading-[0.95] tracking-tighter sm:text-6xl lg:text-7xl">
                    {s.persona.name}
                  </h1>
                  <p className="mt-4 max-w-md text-base text-muted-foreground">{s.persona.line}</p>

                  <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-border/70 pt-5 sm:grid-cols-4">
                    <Figure value={formatDuration(s.totalSeconds)} label="listened, estimated" />
                    <Figure value={s.totalPlays.toLocaleString()} label={`plays, ${s.uniqueTracks.toLocaleString()} different songs`} />
                    <Figure value={s.uniqueArtists.toLocaleString()} label="artists" />
                    <Figure value={s.favoritesCount.toLocaleString()} label="favourites" />
                  </dl>
                </div>

                <div>
                  <ListeningRecord byHour={s.byHour} cover={top?.thumbnail} peakHour={s.peakHour} />
                  <p className="mt-6 text-center text-xs text-muted-foreground">
                    {s.peakHour === null ? '' : `Your hour: ${hourLabel(s.peakHour)}. `}
                    {top ? `On the label: ${top.title.length > 36 ? `${top.title.slice(0, 34)}…` : top.title}` : ''}
                  </p>
                </div>
              </header>

              {/* Streak + calendar */}
              <Section title="Showing up" note="Plays per day, last 12 weeks">
                <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="grid grid-cols-3 gap-4 lg:grid-cols-1">
                    <div className="flex items-center gap-3">
                      <Flame className={cn('h-8 w-8 shrink-0', s.currentStreak > 0 ? 'text-primary' : 'text-muted-foreground/50')} />
                      <Figure value={`${s.currentStreak} ${s.currentStreak === 1 ? 'day' : 'days'}`} label="current streak" />
                    </div>
                    <Figure value={`${s.longestStreak} ${s.longestStreak === 1 ? 'day' : 'days'}`} label="longest streak" />
                    <Figure value={String(s.activeDays)} label="days with music" />
                  </div>
                  <Calendar days={s.calendar} />
                </div>
              </Section>

              {/* Today */}
              <Section title="Today" note={new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}>
                <div className="grid grid-cols-3 gap-4 sm:max-w-md">
                  <Figure value={`${Math.round(s.todaySeconds / 60)}m`} label="listened" />
                  <Figure value={String(s.todayPlays)} label="plays" />
                  <Figure value={String(s.todayUnique)} label="different songs" />
                </div>
                {todayRows.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">Nothing played yet today.</p>
                ) : (
                  <ul className="mt-4 max-h-56 divide-y divide-border/60 overflow-y-auto">
                    {todayRows.slice(0, 15).map((r) => (
                      <li key={r.id}>
                        <button
                          onClick={() => handlePlayTrack({ id: r.track_id, title: r.track_title, thumbnail: r.track_thumbnail, channel: r.track_channel })}
                          className="flex w-full items-center gap-3 py-2 text-left transition-colors hover:bg-foreground/5"
                        >
                          <img src={r.track_thumbnail} alt="" loading="lazy" className="h-9 w-9 rounded-md object-cover" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{r.track_title}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">{r.track_channel}</span>
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {new Date(r.played_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* Top songs */}
              <Section title="On repeat" note="Your most played songs">
                <div className="grid items-end gap-4 sm:grid-cols-3">
                  {podium.map((t, i) => (
                    <button
                      key={t.id}
                      onClick={() => play(t)}
                      className={cn('group text-left', i === 0 && 'sm:order-2', i === 1 && 'sm:order-1', i === 2 && 'sm:order-3')}
                    >
                      <div className="relative overflow-hidden rounded-2xl">
                        <img
                          src={t.thumbnail}
                          alt=""
                          loading="lazy"
                          className={cn('w-full object-cover transition-transform duration-500 group-hover:scale-105', i === 0 ? 'aspect-square' : 'aspect-[5/4]')}
                        />
                        <span className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-xs font-black backdrop-blur">
                          {i === 0 ? 'Most played' : `#${i + 1}`}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-sm font-semibold">{t.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.channel} · {t.plays}×</p>
                    </button>
                  ))}
                </div>
                {rest.length > 0 && (
                  <ol start={4} className="mt-5 divide-y divide-border/60">
                    {rest.map((t, i) => (
                      <li key={t.id}>
                        <button onClick={() => play(t)} className="flex w-full items-center gap-3 py-2 text-left transition-colors hover:bg-foreground/5">
                          <span className="w-5 text-xs font-bold tabular-nums text-muted-foreground">{i + 4}</span>
                          <img src={t.thumbnail} alt="" loading="lazy" className="h-10 w-10 rounded-md object-cover" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{t.title}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">{t.channel}</span>
                          </span>
                          <span className="shrink-0 text-xs font-bold tabular-nums text-primary">{t.plays}×</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </Section>

              {/* Genres + artists */}
              <div className="grid gap-10 lg:grid-cols-2">
                <Section title="Your genres" note="Guessed from song and channel names">
                  <div className="flex h-5 overflow-hidden rounded-full bg-muted" role="img" aria-label="Genre share of plays">
                    {s.topGenres.slice(0, 8).map((g, i) => (
                      <span
                        key={g.name}
                        title={`${g.name}: ${Math.round((g.plays / genreTotal) * 100)}%`}
                        style={{ width: `${(g.plays / genreTotal) * 100}%`, background: GENRE_COLORS[i % GENRE_COLORS.length] }}
                      />
                    ))}
                  </div>
                  <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2">
                    {s.topGenres.slice(0, 8).map((g, i) => (
                      <li key={g.name} className="flex items-center gap-2 text-sm">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: GENRE_COLORS[i % GENRE_COLORS.length] }} />
                        <span className="min-w-0 flex-1 truncate">{g.name}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">{Math.round((g.plays / genreTotal) * 100)}%</span>
                      </li>
                    ))}
                  </ul>
                </Section>

                <Section title="Your artists" note="Top 8 channels">
                  <ul className="space-y-3">
                    {s.topArtists.slice(0, 8).map((a) => (
                      <li key={a.name}>
                        <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate font-medium">{a.name}</span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{a.plays}×</span>
                        </div>
                        <div className="h-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (a.plays / artistMax) * 100)}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </Section>
              </div>

              {/* Rhythm */}
              <Section
                title="Your week"
                note={topWeekday.plays > 0 ? `${topWeekday.day} is your biggest day` : undefined}
              >
                <div className="flex h-32 items-end gap-2 sm:max-w-xl">
                  {s.byWeekday.map((d) => (
                    <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
                      <div className="flex h-24 w-full items-end">
                        <div
                          title={`${d.plays} plays`}
                          className={cn('w-full rounded-t-md', d.day === topWeekday.day ? 'bg-primary' : 'bg-primary/30')}
                          style={{ height: `${Math.max(4, (d.plays / weekdayMax) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground">{d.day}</span>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Recent + favourites */}
              <div className="grid gap-10 lg:grid-cols-2">
                <Section title="Recently played" note="Last 20 plays">
                  <ul className="max-h-72 divide-y divide-border/60 overflow-y-auto pr-1">
                    {s.recent.map((r) => (
                      <li key={r.id}>
                        <button
                          onClick={() => play({ id: r.track_id, title: r.track_title, thumbnail: r.track_thumbnail, channel: r.track_channel })}
                          className="flex w-full items-center gap-3 py-2 text-left transition-colors hover:bg-foreground/5"
                        >
                          <img src={r.track_thumbnail} alt="" loading="lazy" className="h-10 w-10 rounded-md object-cover" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{r.track_title}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">{r.track_channel}</span>
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {new Date(r.played_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </Section>

                {!isViewingOtherUser && (
                  <Section title="Favourites" note={`${favoriteTracks.length} saved`}>
                    {favoriteTracks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Tap the heart on a song to save it here.</p>
                    ) : (
                      <ul className="grid gap-x-4 sm:grid-cols-2">
                        {favoriteTracks.slice(0, 12).map((t) => (
                          <li key={t.id}>
                            <button onClick={() => play(t)} className="flex w-full items-center gap-3 py-2 text-left transition-colors hover:bg-foreground/5">
                              <img src={t.thumbnail} alt="" loading="lazy" className="h-10 w-10 rounded-md object-cover" />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">{t.title}</span>
                                <span className="block truncate text-[11px] text-muted-foreground">{t.channel}</span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Stats;
