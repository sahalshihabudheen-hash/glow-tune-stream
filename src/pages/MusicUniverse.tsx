import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Orbit, Search, Play, Plus, Minus, Locate, X, Loader2, Sparkles, Users, Disc3, Waves, Dices, Crosshair, HelpCircle, Star, Flame, Clock } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import MusicPlayer from '@/components/MusicPlayer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { supabase } from '@/integrations/supabase/client';
import { guessGenre } from '@/hooks/useListeningStats';
import { famousSongs } from '@/data/famousSongs';
import { cn } from '@/lib/utils';
import SEO from '@/components/SEO';

interface UniNode {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  genre: string;
  plays: number;
  x: number;
  y: number;
  r: number;
  /** false = song the user has never played (an "undiscovered" satellite) */
  known: boolean;
  /** index of the node it orbits (satellites only) */
  parent?: number;
  orbitR?: number;
  phase?: number;
  speed?: number;
}

interface UniEdge {
  a: number;
  b: number;
  kind: 'artist' | 'genre' | 'session';
}

type Galaxy = 'mine' | 'discovery' | 'blend';

/** An artist's cluster of songs, painted as a nebula. */
interface UniCluster {
  name: string;
  x: number;
  y: number;
  radius: number;
  hue: number;
  count: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const cleanChannel = (c: string) => (c || 'Unknown').replace(/\s*-\s*topic$/i, '').trim();

const GENRE_HUES: Record<string, number> = {
  Pop: 320, 'Hip-Hop': 20, Rock: 0, Electronic: 190, 'R&B': 280,
  Classical: 45, Jazz: 35, Country: 90, Metal: 260, Indie: 150,
};
const hueFor = (genre: string) => {
  if (GENRE_HUES[genre] !== undefined) return GENRE_HUES[genre];
  let h = 0;
  for (let i = 0; i < genre.length; i++) h = (h * 31 + genre.charCodeAt(i)) % 360;
  return h;
};

/** Small image cache so covers can be painted onto the canvas nodes. */
const imgCache = new Map<string, HTMLImageElement | null>();
const getImg = (src: string): HTMLImageElement | null => {
  if (!src) return null;
  const hit = imgCache.get(src);
  if (hit !== undefined) return hit;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => imgCache.set(src, img);
  img.onerror = () => imgCache.set(src, null);
  img.src = src;
  imgCache.set(src, img);
  return img;
};

const MusicUniverse = () => {
  const navigate = useNavigate();
  const { settings } = useTheme();
  const { user } = useAuth();
  const player = useMusicPlayer();
  const {
    currentTrack, isPlaying, handlePlayTrack, handlePlayPause, handleNext, handlePrevious,
    handleAddToPlaylist, isInPlaylist, playlist, queue,
  } = player;

  const [activeTab, setActiveTab] = useState('universe');
  const [navSearch, setNavSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<{ track_id: string; track_title: string; track_channel: string; track_thumbnail: string; played_at: string }[]>([]);
  const [pool, setPool] = useState<{ id: string; title: string; channel: string; thumbnail: string }[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<UniNode | null>(null);
  const [galaxy, setGalaxy] = useState<Galaxy>('mine');
  const [showGuide, setShowGuide] = useState(() => {
    try { return localStorage.getItem('nyra-universe-guide-seen') !== '1'; } catch { return true; }
  });
  const closeGuide = () => {
    setShowGuide(false);
    try { localStorage.setItem('nyra-universe-guide-seen', '1'); } catch { /* storage unavailable */ }
  };
  const [filters, setFilters] = useState({ artist: true, genre: true, vibe: true, undiscovered: true, covers: true });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef({ x: 0, y: 0, z: 1 });
  const dragRef = useRef<{ active: boolean; sx: number; sy: number; ox: number; oy: number; moved: boolean }>({
    active: false, sx: 0, sy: 0, ox: 0, oy: 0, moved: false,
  });
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; z: number } | null>(null);
  const tRef = useRef(0);
  const posRef = useRef<{ x: number; y: number }[]>([]);
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; r: number; hue: number; depth: number }[]>([]);
  const shootingRef = useRef<{ x: number; y: number; vx: number; vy: number; life: number } | null>(null);

  /* ---------------- Data ---------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (!user) { setRows([]); setLoading(false); return; }
      const { data } = await supabase
        .from('listening_history')
        .select('track_id, track_title, track_channel, track_thumbnail, played_at')
        .eq('user_id', user.id)
        .order('played_at', { ascending: false })
        .limit(1500);
      if (cancelled) return;
      setRows((data as typeof rows) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Discovery pool: trending songs (if available) blended with the built-in catalogue.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const base = famousSongs.map((s) => ({ id: s.id, title: s.title, channel: s.channel, thumbnail: s.thumbnail }));
      try {
        const { data } = await supabase.functions.invoke('get-trending', { body: { limit: 40 } });
        const list = (data?.tracks || data?.videos || data?.items || []) as any[];
        const mapped = list
          .map((t) => ({
            id: t.id?.videoId || t.id || t.videoId,
            title: t.title || t.snippet?.title || '',
            channel: t.channel || t.channelTitle || t.snippet?.channelTitle || '',
            thumbnail: t.thumbnail || t.snippet?.thumbnails?.medium?.url || '',
          }))
          .filter((t) => t.id && t.title);
        if (!cancelled) setPool([...mapped, ...base]);
        return;
      } catch {
        /* fall through to catalogue only */
      }
      if (!cancelled) setPool(base);
    })();
    return () => { cancelled = true; };
  }, []);

  /* ---------------- Graph build ---------------- */
  const { nodes, edges, nebulae } = useMemo(() => {
    const map = new Map<string, UniNode>();
    const order: string[] = [];
    rows.forEach((r) => {
      if (!r.track_id) return;
      order.push(r.track_id);
      const existing = map.get(r.track_id);
      if (existing) { existing.plays += 1; return; }
      map.set(r.track_id, {
        id: r.track_id,
        title: r.track_title || 'Unknown track',
        channel: cleanChannel(r.track_channel),
        thumbnail: r.track_thumbnail || '',
        genre: guessGenre(r.track_title || '', r.track_channel || ''),
        plays: 1,
        x: 0, y: 0, r: 0,
        known: true,
      });
    });

    const list = [...map.values()];

    // Cluster by artist, artists arranged in a spiral, songs orbit their artist.
    const byArtist = new Map<string, UniNode[]>();
    list.forEach((n) => {
      const arr = byArtist.get(n.channel) || [];
      arr.push(n);
      byArtist.set(n.channel, arr);
    });
    const clusters = [...byArtist.entries()].sort((a, b) => b[1].length - a[1].length);
    const golden = Math.PI * (3 - Math.sqrt(5));
    const nebulae: UniCluster[] = [];
    clusters.forEach(([artistName, members], ci) => {
      const cr = 240 * Math.sqrt(ci + 0.6);
      const ca = ci * golden;
      const cx = Math.cos(ca) * cr;
      const cy = Math.sin(ca) * cr;
      const orbit = 34 + members.length * 9;
      const genreCount = new Map<string, number>();
      members.forEach((m) => genreCount.set(m.genre, (genreCount.get(m.genre) || 0) + m.plays));
      const dominant = [...genreCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Other';
      nebulae.push({
        name: artistName,
        x: cx,
        y: cy,
        radius: (members.length === 1 ? 0 : orbit) + 70,
        hue: hueFor(dominant),
        count: members.length,
      });
      members.forEach((n, i) => {
        const a = (i / Math.max(1, members.length)) * Math.PI * 2 + ci;
        const rad = members.length === 1 ? 0 : orbit;
        n.x = cx + Math.cos(a) * rad;
        n.y = cy + Math.sin(a) * rad;
        n.r = 9 + Math.min(16, Math.sqrt(n.plays) * 5);
      });
    });

    const index = new Map(list.map((n, i) => [n.id, i]));
    const seen = new Set<string>();
    const es: UniEdge[] = [];
    const push = (a: number, b: number, kind: UniEdge['kind']) => {
      if (a === b) return;
      const key = `${Math.min(a, b)}-${Math.max(a, b)}-${kind}`;
      if (seen.has(key)) return;
      seen.add(key);
      es.push({ a, b, kind });
    };

    // Same artist
    byArtist.forEach((members) => {
      for (let i = 0; i < members.length - 1; i++) {
        push(index.get(members[i].id)!, index.get(members[i + 1].id)!, 'artist');
      }
      if (members.length > 2) push(index.get(members[0].id)!, index.get(members[members.length - 1].id)!, 'artist');
    });

    // Same genre (chain the cluster representatives to keep it readable)
    const byGenre = new Map<string, number[]>();
    list.forEach((n, i) => {
      const arr = byGenre.get(n.genre) || [];
      arr.push(i);
      byGenre.set(n.genre, arr);
    });
    byGenre.forEach((idxs) => {
      for (let i = 0; i < idxs.length - 1 && i < 60; i++) push(idxs[i], idxs[i + 1], 'genre');
    });

    // Frequently played together / similar listening patterns: consecutive plays
    const pairCount = new Map<string, number>();
    for (let i = 0; i < order.length - 1; i++) {
      const a = index.get(order[i]);
      const b = index.get(order[i + 1]);
      if (a === undefined || b === undefined || a === b) continue;
      const key = `${Math.min(a, b)}|${Math.max(a, b)}`;
      pairCount.set(key, (pairCount.get(key) || 0) + 1);
    }
    pairCount.forEach((count, key) => {
      if (count < 2) return;
      const [a, b] = key.split('|').map(Number);
      push(a, b, 'session');
    });

    /* ---- Undiscovered satellites: songs the user never played, orbiting related nodes ---- */
    const known = new Set(list.map((n) => n.id));
    const satellites: UniNode[] = [];
    const fresh = pool.filter((p) => p.id && !known.has(p.id));

    if (list.length) {
      const byArtistKey = new Map<string, number>();
      list.forEach((n, i) => { if (!byArtistKey.has(n.channel.toLowerCase())) byArtistKey.set(n.channel.toLowerCase(), i); });
      const byGenreKey = new Map<string, number[]>();
      list.forEach((n, i) => {
        const arr = byGenreKey.get(n.genre) || [];
        arr.push(i);
        byGenreKey.set(n.genre, arr);
      });
      const counts = new Map<number, number>();
      fresh.forEach((p, i) => {
        const ch = cleanChannel(p.channel);
        const genre = guessGenre(p.title, p.channel);
        let parent = byArtistKey.get(ch.toLowerCase());
        if (parent === undefined) {
          const g = byGenreKey.get(genre);
          parent = g ? g[i % g.length] : i % list.length;
        }
        const c = (counts.get(parent) || 0);
        if (c >= 4) return; // keep clusters readable
        counts.set(parent, c + 1);
        satellites.push({
          id: p.id,
          title: p.title,
          channel: ch,
          thumbnail: p.thumbnail,
          genre,
          plays: 0,
          x: 0, y: 0,
          r: 6,
          known: false,
          parent,
          orbitR: 58 + c * 22,
          phase: (c / 4) * Math.PI * 2 + i,
          speed: 0.18 + ((i % 5) * 0.05),
        });
      });
    } else {
      // No history yet: lay the discovery pool out as its own galaxy.
      fresh.slice(0, 60).forEach((p, i) => {
        const a = i * golden;
        const rad = 90 * Math.sqrt(i + 1);
        satellites.push({
          id: p.id,
          title: p.title,
          channel: cleanChannel(p.channel),
          thumbnail: p.thumbnail,
          genre: guessGenre(p.title, p.channel),
          plays: 0,
          x: Math.cos(a) * rad,
          y: Math.sin(a) * rad,
          r: 7,
          known: false,
        });
      });
    }

    return { nodes: [...list, ...satellites], edges: es, nebulae };
  }, [rows, pool]);

  const visible = useMemo(() => {
    const set = new Set<number>();
    nodes.forEach((n, i) => {
      if (n.known && galaxy !== 'discovery') set.add(i);
      if (!n.known && (galaxy === 'discovery' || (galaxy === 'blend' && filters.undiscovered) || (galaxy === 'mine' && filters.undiscovered))) set.add(i);
    });
    return set;
  }, [nodes, galaxy, filters.undiscovered]);

  const activeEdges = useMemo(
    () => edges.filter((e) =>
      galaxy !== 'discovery' &&
      ((e.kind === 'artist' && filters.artist) || (e.kind === 'genre' && filters.genre) || (e.kind === 'session' && filters.vibe))),
    [edges, filters, galaxy],
  );

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const set = new Set<number>();
    nodes.forEach((n, i) => {
      if (!visible.has(i)) return;
      if (n.title.toLowerCase().includes(q) || n.channel.toLowerCase().includes(q) || n.genre.toLowerCase().includes(q)) set.add(i);
    });
    return set;
  }, [search, nodes, visible]);

  const identity = useMemo(() => {
    const known = nodes.filter((n) => n.known);
    const undiscovered = nodes.length - known.length;
    const byGenre = new Map<string, number>();
    known.forEach((n) => byGenre.set(n.genre, (byGenre.get(n.genre) || 0) + n.plays));
    const topGenre = [...byGenre.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const name = !known.length
      ? 'Your universe is waiting'
      : topGenre && topGenre !== 'Other'
      ? `The ${topGenre} Nebula`
      : 'Your Universe';
    return { name, stars: known.length, constellations: nebulae.length, undiscovered };
  }, [nodes, nebulae]);

  const nodePos = useCallback((n: UniNode, t: number) => {
    if (n.parent !== undefined && nodes[n.parent]) {
      const p = nodes[n.parent];
      const a = (n.phase || 0) + t * (n.speed || 0.2);
      return { x: p.x + Math.cos(a) * (n.orbitR || 60), y: p.y + Math.sin(a) * (n.orbitR || 60) };
    }
    return { x: n.x, y: n.y };
  }, [nodes]);

  const focusPoint = useCallback((x: number, y: number, zoom: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const z = clamp(zoom, 0.2, 6);
    viewRef.current = { z, x: el.clientWidth / 2 - x * z, y: el.clientHeight / 2 - y * z };
  }, []);

  const focusNode = useCallback((n: UniNode) => {
    const el = wrapRef.current;
    if (!el) return;
    const z = clamp(1.8, 0.2, 6);
    const p = nodePos(n, tRef.current);
    viewRef.current = {
      z,
      x: el.clientWidth / 2 - p.x * z,
      y: el.clientHeight / 2 - p.y * z,
    };
  }, [nodePos]);

  // Fit graph on first load
  const fittedRef = useRef(false);
  useEffect(() => {
    if (fittedRef.current || !nodes.length || !wrapRef.current) return;
    const el = wrapRef.current;
    const xs = nodes.map((n) => n.x); const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = Math.max(1, maxX - minX + 200), h = Math.max(1, maxY - minY + 200);
    const z = clamp(Math.min(el.clientWidth / w, el.clientHeight / h), 0.15, 1.4);
    viewRef.current = {
      z,
      x: el.clientWidth / 2 - ((minX + maxX) / 2) * z,
      y: el.clientHeight / 2 - ((minY + maxY) / 2) * z,
    };
    fittedRef.current = true;
  }, [nodes]);

  /* ---------------- Render loop ---------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = wrap.clientWidth * dpr;
      canvas.height = wrap.clientHeight * dpr;
      canvas.style.width = `${wrap.clientWidth}px`;
      canvas.style.height = `${wrap.clientHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // (re)seed particles for the new size
      const count = wrap.clientWidth < 768 ? 40 : 90;
      particlesRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * wrap.clientWidth,
        y: Math.random() * wrap.clientHeight,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: 0.6 + Math.random() * 1.8,
        hue: 190 + Math.random() * 140,
        depth: 0.2 + Math.random() * 0.8,
      }));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const draw = () => {
      tRef.current += 0.016;
      const t = tRef.current;
      const { x: ox, y: oy, z } = viewRef.current;
      const W = wrap.clientWidth, H = wrap.clientHeight;
      ctx.clearRect(0, 0, W, H);

      // Music energy from the global beat variables (set by Dynamic Music UI)
      const energy = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--beat-energy')) || 0;
      const beat = isPlaying ? Math.max(energy, (Math.sin(t * 3) * 0.5 + 0.5) * 0.35) : 0;

      // --- music-reactive star particles ---
      particlesRef.current.forEach((p) => {
        p.x += p.vx * (1 + beat * 5);
        p.y += p.vy * (1 + beat * 5);
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        // Parallax: nearer stars drift further when the view is panned.
        const px = ((p.x + ox * p.depth * 0.15) % W + W) % W;
        const py = ((p.y + oy * p.depth * 0.15) % H + H) % H;
        ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, ${(0.1 + p.depth * 0.15) + beat * 0.45})`;
        ctx.beginPath();
        ctx.arc(px, py, p.r * (0.6 + p.depth * 0.6) * (1 + beat * 1.2), 0, Math.PI * 2);
        ctx.fill();
      });

      // --- an occasional shooting star ---
      if (!shootingRef.current && Math.random() < 0.0025) {
        shootingRef.current = { x: Math.random() * W * 0.7, y: Math.random() * H * 0.4, vx: 7 + Math.random() * 4, vy: 3 + Math.random() * 2, life: 1 };
      }
      const shot = shootingRef.current;
      if (shot) {
        shot.x += shot.vx; shot.y += shot.vy; shot.life -= 0.02;
        const tail = ctx.createLinearGradient(shot.x, shot.y, shot.x - shot.vx * 9, shot.y - shot.vy * 9);
        tail.addColorStop(0, `rgba(255,255,255,${0.8 * shot.life})`);
        tail.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = tail;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(shot.x, shot.y);
        ctx.lineTo(shot.x - shot.vx * 9, shot.y - shot.vy * 9);
        ctx.stroke();
        if (shot.life <= 0 || shot.x > W + 40 || shot.y > H + 40) shootingRef.current = null;
      }

      const positions: { x: number; y: number }[] = new Array(nodes.length);
      nodes.forEach((n, i) => {
        const base = nodePos(n, t);
        positions[i] = {
          x: base.x * z + ox + Math.sin(t * 0.6 + base.x * 0.01) * 2 * z,
          y: base.y * z + oy + Math.cos(t * 0.5 + base.y * 0.01) * 2 * z,
        };
      });
      posRef.current = positions;

      // nebula halos: one soft cloud per artist cluster, named when zoomed out
      if (galaxy !== 'discovery') {
        nebulae.forEach((c) => {
          const cx = c.x * z + ox;
          const cy = c.y * z + oy;
          const rad = c.radius * z * (1 + beat * 0.06);
          if (cx < -rad || cy < -rad || cx > W + rad || cy > H + rad) return;
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
          g.addColorStop(0, `hsla(${c.hue}, 85%, 55%, ${0.16 + beat * 0.08})`);
          g.addColorStop(0.55, `hsla(${(c.hue + 30) % 360}, 80%, 50%, 0.07)`);
          g.addColorStop(1, `hsla(${c.hue}, 80%, 50%, 0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(cx, cy, rad, 0, Math.PI * 2);
          ctx.fill();
          if (z < 1.25 && (c.count > 1 || z > 0.5) && rad > 26) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = `600 ${clamp(11 * z + 3, 10, 14)}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(c.name.length > 22 ? `${c.name.slice(0, 20)}…` : c.name, cx, cy - rad * 0.62);
          }
        });
      }

      // edges
      activeEdges.forEach((e) => {
        if (!visible.has(e.a) || !visible.has(e.b)) return;
        const A = positions[e.a]; const B = positions[e.b];
        if ((A.x < -200 && B.x < -200) || (A.x > W + 200 && B.x > W + 200)) return;
        if ((A.y < -200 && B.y < -200) || (A.y > H + 200 && B.y > H + 200)) return;
        const hue = hueFor(nodes[e.a].genre);
        ctx.strokeStyle =
          e.kind === 'session'
            ? `hsla(${hue}, 90%, 65%, ${0.28 + beat * 0.3})`
            : e.kind === 'artist'
            ? `hsla(${hue}, 80%, 60%, ${0.18 + beat * 0.2})`
            : `hsla(${hue}, 60%, 55%, ${0.07 + beat * 0.12})`;
        ctx.lineWidth = e.kind === 'session' ? 1.4 : 0.8;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();
      });

      // orbit rings for undiscovered satellites
      if (filters.undiscovered && z > 0.45) {
        const drawn = new Set<number>();
        nodes.forEach((n, i) => {
          if (n.known || n.parent === undefined || !visible.has(i)) return;
          const key = n.parent * 1000 + Math.round((n.orbitR || 0) / 10);
          if (drawn.has(key)) return;
          drawn.add(key);
          const P = positions[n.parent];
          ctx.strokeStyle = `hsla(200, 80%, 70%, ${0.06 + beat * 0.08})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(P.x, P.y, (n.orbitR || 60) * z, 0, Math.PI * 2);
          ctx.stroke();
        });
      }

      // nodes
      nodes.forEach((n, i) => {
        if (!visible.has(i)) return;
        const p = positions[i];
        const r = Math.max(2, n.r * z * (n.known ? 1 : 0.85));
        if (p.x < -80 || p.y < -80 || p.x > W + 80 || p.y > H + 80) return;
        const dim = matches ? !matches.has(i) : false;
        const isCurrent = currentTrack?.id === n.id;
        const hue = hueFor(n.genre);
        const pulse = isCurrent ? 1 + Math.sin(t * 3) * 0.12 + beat * 0.25 : 1 + beat * 0.08;

        if (isCurrent && isPlaying) {
          for (let k = 0; k < 2; k++) {
            const phase = ((t * 0.6 + k * 0.5) % 1);
            ctx.strokeStyle = `hsla(${hue}, 95%, 75%, ${(1 - phase) * 0.55})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r * 1.5 + phase * r * 6, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3 * pulse);
        grad.addColorStop(0, `hsla(${hue}, 95%, 65%, ${dim ? 0.12 : n.known ? 0.55 : 0.35})`);
        grad.addColorStop(1, `hsla(${hue}, 95%, 55%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 3 * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Cover art inside the node once zoomed in
        const coverR = r * pulse * 1.9;
        const showCover = filters.covers && z > 0.9 && coverR > 9 && !dim;
        const img = showCover ? getImg(n.thumbnail) : null;
        if (img && img.complete && img.naturalWidth) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(p.x, p.y, coverR, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          const side = coverR * 2;
          ctx.globalAlpha = n.known ? 1 : 0.85;
          ctx.drawImage(img, p.x - side / 2, p.y - side / 2, side, side);
          ctx.restore();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = `hsla(${hue}, 95%, ${isCurrent ? 80 : 65}%, ${n.known ? 0.9 : 0.6})`;
          ctx.lineWidth = isCurrent ? 3 : 1.5;
          if (!n.known) ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(p.x, p.y, coverR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.fillStyle = `hsla(${hue}, 95%, ${isCurrent ? 75 : 62}%, ${dim ? 0.2 : n.known ? 1 : 0.6})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * pulse, 0, Math.PI * 2);
          ctx.fill();
          if (!n.known) {
            ctx.strokeStyle = `hsla(${hue}, 95%, 75%, 0.7)`;
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.arc(p.x, p.y, r * pulse + 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }

        if (selected?.id === n.id) {
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, (img ? coverR : r) + 8, 0, Math.PI * 2);
          ctx.stroke();
        }

        // labels only when zoomed in enough
        if (!dim && ((z > 1.1 && (n.plays > 1 || !n.known || z > 1.5)) || isCurrent || selected?.id === n.id)) {
          ctx.fillStyle = n.known ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.55)';
          ctx.font = `${Math.min(13, 11 * z)}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          const label = n.title.length > 26 ? `${n.title.slice(0, 24)}…` : n.title;
          ctx.fillText(label, p.x, p.y + (img ? coverR : r) + 14);
        }
      });

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [nodes, nebulae, galaxy, activeEdges, visible, matches, selected, currentTrack?.id, isPlaying, filters.covers, filters.undiscovered, nodePos]);

  /* ---------------- Interaction ---------------- */
  const zoomAt = useCallback((px: number, py: number, nextZ: number) => {
    const v = viewRef.current;
    const z = clamp(nextZ, 0.12, 6);
    const k = z / v.z;
    viewRef.current = { z, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, viewRef.current.z * Math.exp(-dy * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const hitTest = (cx: number, cy: number) => {
    const { z } = viewRef.current;
    let best: UniNode | null = null;
    let bestD = Infinity;
    posRef.current.forEach((p, i) => {
      if (!p || !visible.has(i)) return;
      const n = nodes[i];
      const d = Math.hypot(p.x - cx, p.y - cy);
      const r = Math.max(12, n.r * z * 1.9 + 6);
      if (d < r && d < bestD) { best = n; bestD = d; }
    });
    return best;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [p1, p2] = [...pointersRef.current.values()];
      pinchRef.current = { dist: Math.hypot(p1.x - p2.x, p1.y - p2.y), z: viewRef.current.z };
      return;
    }
    dragRef.current = {
      active: true, sx: e.clientX, sy: e.clientY,
      ox: viewRef.current.x, oy: viewRef.current.y, moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [p1, p2] = [...pointersRef.current.values()];
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const rect = wrapRef.current!.getBoundingClientRect();
      zoomAt((p1.x + p2.x) / 2 - rect.left, (p1.y + p2.y) / 2 - rect.top, pinchRef.current.z * (dist / pinchRef.current.dist));
      return;
    }
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
    viewRef.current = { ...viewRef.current, x: dragRef.current.ox + dx, y: dragRef.current.oy + dy };
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (dragRef.current.active && !dragRef.current.moved) {
      const rect = wrapRef.current!.getBoundingClientRect();
      const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      setSelected(hit);
    }
    dragRef.current.active = false;
  };

  const playNode = (n: UniNode) => {
    const queueList = nodes.filter((_, i) => visible.has(i));
    handlePlayTrack(
      { id: n.id, title: n.title, thumbnail: n.thumbnail, channel: n.channel },
      queueList.map((x) => ({ id: x.id, title: x.title, thumbnail: x.thumbnail, channel: x.channel }))
    );
  };

  const surprise = () => {
    const pickable = nodes.filter((n, i) => !n.known && visible.has(i));
    if (!pickable.length) return;
    const n = pickable[Math.floor(Math.random() * pickable.length)];
    setSelected(n);
    focusNode(n);
  };

  const findPlaying = () => {
    const n = nodes.find((x) => x.known && x.id === currentTrack?.id);
    if (!n) return;
    setSelected(n);
    focusNode(n);
  };

  const canFindPlaying = !!currentTrack && nodes.some((x) => x.known && x.id === currentTrack.id);
  const canSurprise = nodes.some((n, i) => !n.known && visible.has(i));

  const landmarks = useMemo(() => {
    const known = nodes.filter((n) => n.known);
    if (!known.length) return [];
    const brightest = known.reduce((b, n) => (n.plays > b.plays ? n : b), known[0]);
    const newest = rows[0] ? known.find((n) => n.id === rows[0].track_id) : undefined;
    const list: { key: string; label: string; hint: string; icon: typeof Star; go: () => void }[] = [
      {
        key: 'star', label: 'Most played', hint: `${brightest.title} · ${brightest.plays}×`, icon: Star,
        go: () => { setSelected(brightest); focusNode(brightest); },
      },
    ];
    if (nebulae[0]) {
      list.push({
        key: 'cluster', label: 'Biggest cluster', hint: `${nebulae[0].name} · ${nebulae[0].count} songs`, icon: Flame,
        go: () => { setSelected(null); focusPoint(nebulae[0].x, nebulae[0].y, 1.1); },
      });
    }
    if (newest) {
      list.push({
        key: 'new', label: 'Latest play', hint: newest.title, icon: Clock,
        go: () => { setSelected(newest); focusNode(newest); },
      });
    }
    return list;
  }, [nodes, nebulae, rows, focusNode, focusPoint]);

  const selectedWhy = useMemo(() => {
    if (!selected) return '';
    if (selected.known) {
      const sameArtist = nodes.filter((n) => n.known && n.channel === selected.channel).length - 1;
      return sameArtist > 0
        ? `You've also played ${sameArtist} other ${sameArtist === 1 ? 'song' : 'songs'} by ${selected.channel}.`
        : `The only ${selected.channel} song you've played.`;
    }
    const parent = selected.parent !== undefined ? nodes[selected.parent] : undefined;
    return parent
      ? `Suggested because you play ${parent.channel === selected.channel ? parent.channel : `${parent.channel} (${selected.genre})`}.`
      : "From the discovery pool. You haven't played it yet.";
  }, [selected, nodes]);

  const genreLegend = useMemo(() => {
    const counts = new Map<string, number>();
    nodes.forEach((n, i) => { if (visible.has(i)) counts.set(n.genre, (counts.get(n.genre) || 0) + 1); });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [nodes, visible]);

  const galaxies: { id: Galaxy; label: string; desc: string }[] = [
    { id: 'mine', label: 'My music', desc: 'Songs you have played, plus a few new ones nearby.' },
    { id: 'discovery', label: 'Discover', desc: 'Only songs you have not played yet.' },
    { id: 'blend', label: 'Both', desc: 'Everything together.' },
  ];

  const filterChips: { key: keyof typeof filters; label: string; hint: string; icon: typeof Users }[] = [
    { key: 'artist', label: 'Same artist', hint: 'Lines between songs by the same artist', icon: Users },
    { key: 'genre', label: 'Same genre', hint: 'Faint lines between songs of the same genre', icon: Disc3 },
    { key: 'vibe', label: 'Played together', hint: 'Bright lines between songs you play back to back', icon: Waves },
    { key: 'undiscovered', label: 'Songs to try', hint: 'Dashed dots: songs you have not played yet', icon: Sparkles },
    { key: 'covers', label: 'Cover art', hint: 'Show album art inside the dots when zoomed in', icon: Orbit },
  ];

  const disabled = !settings.musicUniverse;

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="3D Music Universe & Audio Galaxy" 
        canonicalPath="/universe"
        description="Explore an interactive 3D constellation of songs, artists, and music genres with real-time audio visualizers on NYRA."
      />
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="ml-0 md:ml-64">
        <Navbar searchQuery={navSearch} onSearchChange={setNavSearch} onSearch={() => navSearch.trim() && navigate(`/?search=${encodeURIComponent(navSearch)}`)} />

        <main className="pt-24 md:pt-28 pb-40 px-4 md:px-8">
          <header className="mb-5">
            <h1 className="flex items-center gap-3 text-3xl font-black leading-tight tracking-tighter md:text-5xl">
              <Orbit className="h-7 w-7 shrink-0 text-primary md:h-9 md:w-9" style={{ transform: 'scale(var(--beat-scale, 1))' }} />
              <span className="min-w-0">{identity.name}</span>
            </h1>
            {!loading && identity.stars > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                {identity.stars.toLocaleString()} {identity.stars === 1 ? 'star' : 'stars'} across {identity.constellations.toLocaleString()} {identity.constellations === 1 ? 'artist cluster' : 'artist clusters'}
                {identity.undiscovered > 0 ? `, with ${identity.undiscovered.toLocaleString()} unexplored songs orbiting nearby.` : '.'}
              </p>
            )}
          </header>

          {!disabled && showGuide && (
            <section className="mb-5 rounded-2xl border border-primary/30 bg-primary/5 p-4 md:p-5" aria-label="How to read your universe">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h2 className="text-base font-bold md:text-lg">How to read your universe</h2>
                <button onClick={closeGuide} className="text-muted-foreground hover:text-foreground" aria-label="Close guide">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ul className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                <li className="flex gap-3">
                  <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.8)]" />
                  <span><b>Each glowing dot is a song you've played.</b> The more you play it, the bigger it gets.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full bg-primary/25 blur-[2px]" />
                  <span><b>Soft clouds are artists.</b> Songs by the same artist sit in one cloud. Colour shows the genre.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border border-dashed border-primary" />
                  <span><b>Dashed dots are songs you haven't played.</b> They orbit artists you already like. Tap one to try it.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 h-px w-4 shrink-0 bg-primary" />
                  <span><b>Lines connect related songs:</b> same artist, same genre, or songs you play back to back.</span>
                </li>
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">Drag to move around. Scroll or pinch to zoom. Tap any dot for details.</p>
              <Button size="sm" className="mt-3" onClick={closeGuide}>Got it</Button>
            </section>
          )}

          {disabled ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <p className="text-muted-foreground mb-4">Music Universe is turned off.</p>
              <Button onClick={() => navigate('/settings')}>Enable in Settings → Music Experience</Button>
            </div>
          ) : (
            <>
              {/* Galaxy switcher */}
              <div className="mb-3 inline-flex max-w-full overflow-x-auto rounded-full border border-border bg-card/70 p-1 no-scrollbar" role="tablist" aria-label="Universe view">
                {galaxies.map((g) => (
                  <button
                    key={g.id}
                    role="tab"
                    aria-selected={galaxy === g.id}
                    onClick={() => { setGalaxy(g.id); setSelected(null); fittedRef.current = false; }}
                    className={cn(
                      'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                      galaxy === g.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              <span className="mb-3 ml-3 hidden align-middle text-xs text-muted-foreground sm:inline">
                {galaxies.find((g) => g.id === galaxy)?.desc}
              </span>
              {!showGuide && (
                <button
                  onClick={() => setShowGuide(true)}
                  className="mb-3 ml-3 inline-flex items-center gap-1 align-middle text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <HelpCircle className="h-3.5 w-3.5" /> How to read this
                </button>
              )}

              {!!landmarks.length && (
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar" aria-label="Jump to">
                  {landmarks.map(({ key, label, hint, icon: Icon, go }) => (
                    <button
                      key={key}
                      onClick={go}
                      className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 text-left transition-colors hover:border-primary/60"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold">{label}</span>
                        <span className="block max-w-[180px] truncate text-[11px] text-muted-foreground">{hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Filters */}
              <div className="flex flex-wrap gap-2 mb-4">
                {filterChips.map(({ key, label, hint, icon: Icon }) => (
                  <button
                    key={key}
                    title={hint}
                    aria-pressed={filters[key]}
                    onClick={() => setFilters((f) => ({ ...f, [key]: !f[key] }))}
                    className={cn(
                      'flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border transition-colors',
                      filters[key]
                        ? 'border-primary/60 bg-primary/10 text-foreground'
                        : 'border-border bg-card text-muted-foreground opacity-60',
                    )}
                  >
                    <Icon className="w-3 h-3" /> {label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search songs, artists or genres in your universe…"
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" className="gap-1.5" onClick={surprise} disabled={!canSurprise} title="Jump to a song you haven't played yet">
                    <Dices className="w-4 h-4" /> <span className="hidden sm:inline">Surprise me</span>
                  </Button>
                  <Button variant="secondary" className="gap-1.5" onClick={findPlaying} disabled={!canFindPlaying} title="Jump to the song that's playing">
                    <Crosshair className="w-4 h-4" /> <span className="hidden sm:inline">Find playing</span>
                  </Button>
                  <Button variant="secondary" size="icon" aria-label="Zoom in" onClick={() => zoomAt((wrapRef.current?.clientWidth || 0) / 2, (wrapRef.current?.clientHeight || 0) / 2, viewRef.current.z * 1.3)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button variant="secondary" size="icon" aria-label="Zoom out" onClick={() => zoomAt((wrapRef.current?.clientWidth || 0) / 2, (wrapRef.current?.clientHeight || 0) / 2, viewRef.current.z / 1.3)}>
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Button variant="secondary" size="icon" aria-label="Fit everything" onClick={() => { fittedRef.current = false; setSelected(null); setSearch(''); }}>
                    <Locate className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div
                className="relative rounded-3xl border border-border overflow-hidden"
                style={{
                  boxShadow: '0 0 var(--beat-glow-px, 0px) hsl(var(--primary) / 0.35)',
                  background: 'radial-gradient(120% 90% at 50% 40%, hsl(var(--primary) / 0.10), hsl(var(--background)) 62%), hsl(var(--background))',
                }}
              >
                <div
                  ref={wrapRef}
                  className="relative h-[60vh] md:h-[68vh] touch-none cursor-grab active:cursor-grabbing"
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                >
                  <canvas ref={canvasRef} className="block w-full h-full" />

                  {loading && (
                    <div className="absolute inset-0 grid place-items-center text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  )}
                  {!loading && !visible.size && (
                    <div className="absolute inset-0 grid place-items-center text-center px-6">
                      <p className="text-muted-foreground text-sm">
                        {user ? 'Play a few songs and your universe will start forming.' : 'Sign in and listen to some music to build your universe.'}
                      </p>
                    </div>
                  )}

                  <p className="pointer-events-none absolute left-3 top-3 hidden text-[11px] text-muted-foreground/80 sm:block">
                    Drag to move · scroll to zoom · tap a dot
                  </p>

                  {/* Legend */}
                  {!!genreLegend.length && (
                    <div className="absolute left-3 bottom-3 flex flex-wrap gap-2 max-w-[70%]">
                      {genreLegend.map(([g, c]) => (
                        <span key={g} className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-background/70 backdrop-blur border border-border">
                          <span className="w-2 h-2 rounded-full" style={{ background: `hsl(${hueFor(g)}, 90%, 60%)` }} />
                          {g} · {c}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Node info */}
                  {selected && (
                    <div className="absolute right-3 top-3 w-[min(320px,80%)] rounded-xl border border-border bg-background/85 backdrop-blur-xl p-3 animate-scale-in">
                      <div className="flex gap-3">
                        {selected.thumbnail && (
                          <img src={selected.thumbnail} alt={selected.title} className="w-16 h-16 rounded-lg object-cover" loading="lazy" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate">{selected.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{selected.channel}</p>
                          <p className="text-[11px] text-primary mt-1">
                            {selected.genre} · {selected.known ? `${selected.plays} play${selected.plays === 1 ? '' : 's'}` : 'not played yet'}
                          </p>
                          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{selectedWhy}</p>
                        </div>
                        <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" className="flex-1 gap-2" onClick={() => playNode(selected)}>
                          <Play className="w-3.5 h-3.5" /> Play
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => focusNode(selected)}>Focus</Button>
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/song/${selected.id}`)}>Details</Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {matches && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {[...matches].slice(0, 12).map((i) => (
                    <button
                      key={nodes[i].id}
                      onClick={() => { setSelected(nodes[i]); focusNode(nodes[i]); }}
                      className={cn('text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:border-primary/60 transition-colors')}
                    >
                      {nodes[i].title.slice(0, 32)}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </main>

        <MusicPlayer
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onAddToPlaylist={handleAddToPlaylist}
          isInPlaylist={currentTrack ? isInPlaylist(currentTrack.id) : false}
          playlist={playlist}
          queue={queue}
        />
      </div>
    </div>
  );
};

export default MusicUniverse;
