import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const DAY = 86400000;
const PAGE = 1000;
/** Hard cap on rows pulled per table so one request can never run away. */
const MAX_HISTORY_ROWS = 60000;

const GENRE_KEYWORDS: Record<string, string[]> = {
  Lofi: ["lofi", "lo-fi", "chill beats", "study"],
  "Hip Hop": ["rap", "hip hop", "hiphop", "trap", "drill"],
  EDM: ["edm", "remix", "drop", "festival", "house", "techno", "dubstep", "bass"],
  Rock: ["rock", "metal", "band", "guitar", "punk"],
  Pop: ["pop", "official video", "official music video"],
  Classical: ["classical", "piano", "orchestra", "symphony", "violin"],
  Jazz: ["jazz", "blues", "saxophone", "soul"],
  Devotional: ["bhajan", "devotional", "mantra", "gospel"],
  Bollywood: ["bollywood", "hindi", "filmy"],
  Instrumental: ["instrumental", "cover", "karaoke", "bgm", "theme"],
};

function guessGenre(title: string, channel: string): string {
  const text = `${title} ${channel}`.toLowerCase();
  for (const [genre, words] of Object.entries(GENRE_KEYWORDS)) {
    if (words.some((w) => text.includes(w))) return genre;
  }
  return "Other";
}

const cleanChannel = (c: string) => (c || "Unknown").replace(/\s*-\s*topic$/i, "").trim() || "Unknown";
// Day keys are computed on a timezone-shifted clock so "today" matches the admin's day.
let TZ_SHIFT = 0;
const dayKey = (ms: number) => new Date(ms + TZ_SHIFT).toISOString().slice(0, 10);
const topN = <T extends { count: number }>(arr: T[], n: number) =>
  arr.sort((a, b) => b.count - a.count).slice(0, n);

// deno-lint-ignore no-explicit-any
async function fetchAll(build: (from: number, to: number) => any, cap: number) {
  // deno-lint-ignore no-explicit-any
  const rows: any[] = [];
  for (let from = 0; from < cap; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No authorization header" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Access denied. Admin only." }, 403);

    let days = 30;
    TZ_SHIFT = 0;
    try {
      const body = await req.json();
      const d = Number(body?.days);
      if ([7, 30, 90].includes(d)) days = d;
      const tz = Number(body?.tzOffset);
      if (Number.isFinite(tz)) TZ_SHIFT = Math.max(-840, Math.min(840, tz)) * 60000;
    } catch {
      /* no body -> default range */
    }

    const now = Date.now();
    const since = new Date(now - days * DAY).toISOString();

    // ---- Users (all pages) ----
    // deno-lint-ignore no-explicit-any
    const authUsers: any[] = [];
    for (let page = 1; page < 200; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw error;
      const batch = data?.users || [];
      authUsers.push(...batch);
      if (batch.length < 100) break;
    }

    // ---- Listening history for the selected window (paginated) ----
    const history = await fetchAll(
      (from, to) =>
        admin
          .from("listening_history")
          .select("user_id, track_id, track_title, track_channel, track_thumbnail, played_at")
          .gte("played_at", since)
          .order("played_at", { ascending: false })
          .range(from, to),
      MAX_HISTORY_ROWS,
    );

    const [{ count: totalPlaysAllTime }, { count: totalFavorites }, { count: totalPlaylists }, { count: totalPlaylistItems }] =
      await Promise.all([
        admin.from("listening_history").select("*", { count: "exact", head: true }),
        admin.from("favorites").select("*", { count: "exact", head: true }),
        admin.from("playlists").select("*", { count: "exact", head: true }),
        admin.from("playlist_items").select("*", { count: "exact", head: true }),
      ]);

    const [locations, profiles, games] = await Promise.all([
      fetchAll((f, t) => admin.from("user_locations").select("user_id, country, device_type, is_vpn, last_updated").range(f, t), 20000),
      fetchAll((f, t) => admin.from("profiles").select("user_id, display_name, avatar_url").range(f, t), 20000),
      fetchAll(
        (f, t) =>
          admin
            .from("game_sessions")
            .select("user_id, game_name, started_at, duration_seconds, is_active, score")
            .gte("started_at", since)
            .order("started_at", { ascending: false })
            .range(f, t),
        20000,
      ),
    ]);

    // ---- Account-level numbers ----
    const profileMap = new Map<string, { display_name: string | null; avatar_url: string | null }>();
    profiles.forEach((p) => profileMap.set(p.user_id, p));
    const emailMap = new Map<string, string>();
    authUsers.forEach((u) => emailMap.set(u.id, u.email || ""));

    const lastSeen = (u: { last_sign_in_at?: string | null }) =>
      u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0;

    const signupsByDay = new Map<string, number>();
    authUsers.forEach((u) => {
      const t = new Date(u.created_at).getTime();
      if (now - t <= days * DAY) signupsByDay.set(dayKey(t), (signupsByDay.get(dayKey(t)) || 0) + 1);
    });

    // ---- History aggregation ----
    const playsByDay = new Map<string, number>();
    const activeByDay = new Map<string, Set<string>>();
    const hourly = Array.from({ length: 7 }, () => new Array(24).fill(0)) as number[][];
    const tracks = new Map<string, { id: string; title: string; channel: string; thumbnail: string; count: number; listeners: Set<string> }>();
    const artists = new Map<string, { name: string; count: number; listeners: Set<string> }>();
    const genres = new Map<string, number>();
    const perUser = new Map<string, { plays: number; tracks: Set<string>; last: number }>();
    const lastActive = new Map<string, number>();

    for (const r of history) {
      const t = new Date(r.played_at).getTime();
      const key = dayKey(t);
      playsByDay.set(key, (playsByDay.get(key) || 0) + 1);
      if (!activeByDay.has(key)) activeByDay.set(key, new Set());
      activeByDay.get(key)!.add(r.user_id);

      const d = new Date(t + TZ_SHIFT);
      hourly[d.getUTCDay()][d.getUTCHours()] += 1;

      const tr = tracks.get(r.track_id) || {
        id: r.track_id,
        title: r.track_title,
        channel: cleanChannel(r.track_channel),
        thumbnail: r.track_thumbnail,
        count: 0,
        listeners: new Set<string>(),
      };
      tr.count += 1;
      tr.listeners.add(r.user_id);
      tracks.set(r.track_id, tr);

      const ch = cleanChannel(r.track_channel);
      const ar = artists.get(ch) || { name: ch, count: 0, listeners: new Set<string>() };
      ar.count += 1;
      ar.listeners.add(r.user_id);
      artists.set(ch, ar);

      const g = guessGenre(r.track_title || "", r.track_channel || "");
      genres.set(g, (genres.get(g) || 0) + 1);

      const pu = perUser.get(r.user_id) || { plays: 0, tracks: new Set<string>(), last: 0 };
      pu.plays += 1;
      pu.tracks.add(r.track_id);
      pu.last = Math.max(pu.last, t);
      perUser.set(r.user_id, pu);
      lastActive.set(r.user_id, Math.max(lastActive.get(r.user_id) || 0, t));
    }

    // Window activity: a user is "active" if they played something OR signed in.
    const activeSince = (ms: number) => {
      const ids = new Set<string>();
      lastActive.forEach((t, id) => { if (now - t <= ms) ids.add(id); });
      authUsers.forEach((u) => { if (now - lastSeen(u) <= ms) ids.add(u.id); });
      return ids.size;
    };
    const dau = activeSince(DAY);
    const wau = activeSince(7 * DAY);
    const mau = activeSince(30 * DAY);
    const activeNow = (() => {
      const ids = new Set<string>();
      lastActive.forEach((t, id) => { if (now - t <= 15 * 60000) ids.add(id); });
      return ids.size;
    })();

    // Series (oldest -> newest), zero-filled so the charts have no gaps.
    const series = Array.from({ length: days }, (_, i) => {
      const key = dayKey(now - (days - 1 - i) * DAY);
      return {
        date: key,
        plays: playsByDay.get(key) || 0,
        activeUsers: activeByDay.get(key)?.size || 0,
        signups: signupsByDay.get(key) || 0,
      };
    });

    // ---- Geography & devices ----
    const countries = new Map<string, number>();
    const devices = new Map<string, number>();
    let vpnUsers = 0;
    locations.forEach((l) => {
      const c = l.country || "Unknown";
      countries.set(c, (countries.get(c) || 0) + 1);
      const dv = (l.device_type || "unknown").toLowerCase();
      devices.set(dv, (devices.get(dv) || 0) + 1);
      if (l.is_vpn) vpnUsers += 1;
    });

    // ---- Games ----
    const gameMap = new Map<string, { name: string; sessions: number; seconds: number; players: Set<string> }>();
    let activeGames = 0;
    games.forEach((g) => {
      const e = gameMap.get(g.game_name) || { name: g.game_name, sessions: 0, seconds: 0, players: new Set<string>() };
      e.sessions += 1;
      e.seconds += g.duration_seconds || 0;
      e.players.add(g.user_id);
      gameMap.set(g.game_name, e);
      if (g.is_active) activeGames += 1;
    });

    // ---- Leaderboard ----
    const listeners = [...perUser.entries()]
      .map(([id, v]) => ({
        id,
        name: profileMap.get(id)?.display_name || (emailMap.get(id) || "Unknown").split("@")[0] || "Unknown",
        avatar_url: profileMap.get(id)?.avatar_url || null,
        count: v.plays,
        uniqueTracks: v.tracks.size,
        lastPlayed: new Date(v.last).toISOString(),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const listenersTotal = perUser.size;

    return json({
      generatedAt: new Date(now).toISOString(),
      days,
      truncated: history.length >= MAX_HISTORY_ROWS,
      totals: {
        users: authUsers.length,
        confirmedUsers: authUsers.filter((u) => !!u.email_confirmed_at).length,
        newUsers: authUsers.filter((u) => now - new Date(u.created_at).getTime() <= days * DAY).length,
        playsInRange: history.length,
        playsAllTime: totalPlaysAllTime || 0,
        favorites: totalFavorites || 0,
        playlists: totalPlaylists || 0,
        playlistItems: totalPlaylistItems || 0,
        listenersInRange: listenersTotal,
        avgPlaysPerListener: listenersTotal ? Math.round((history.length / listenersTotal) * 10) / 10 : 0,
        uniqueTracksInRange: tracks.size,
        uniqueArtistsInRange: artists.size,
        gameSessions: games.length,
        activeGameSessions: activeGames,
      },
      activity: { activeNow, dau, wau, mau, stickiness: mau ? Math.round((dau / mau) * 100) : 0 },
      series,
      heatmap: hourly,
      topTracks: topN(
        [...tracks.values()].map((t) => ({ id: t.id, title: t.title, channel: t.channel, thumbnail: t.thumbnail, count: t.count, listeners: t.listeners.size })),
        10,
      ),
      topArtists: topN([...artists.values()].map((a) => ({ name: a.name, count: a.count, listeners: a.listeners.size })), 10),
      genres: topN([...genres.entries()].map(([name, count]) => ({ name, count })), 10),
      topListeners: listeners,
      countries: topN([...countries.entries()].map(([name, count]) => ({ name, count })), 10),
      devices: topN([...devices.entries()].map(([name, count]) => ({ name, count })), 6),
      vpnUsers,
      locatedUsers: locations.length,
      games: topN(
        [...gameMap.values()].map((g) => ({ name: g.name, count: g.sessions, minutes: Math.round(g.seconds / 60), players: g.players.size })),
        8,
      ),
    });
  } catch (error: unknown) {
    console.error("admin-get-usage-stats error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
