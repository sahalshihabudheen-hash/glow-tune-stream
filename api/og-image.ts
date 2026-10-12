import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

/**
 * Branded share card (1200x630) used as the Discord / social preview image.
 * Query: type, title, artist, thumbnail, color, tracks, creator
 */

const decodeEntities = (s: string): string =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const PRESET_COLORS = ['#ffd300', '#00f0ff', '#3b82f6', '#a855f7', '#ec4899', '#ef4444', '#10b981'];

const pickColor = (hint: string, seed: string): string => {
  const clean = hint.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(clean)) return `#${clean}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return PRESET_COLORS[Math.abs(hash) % PRESET_COLORS.length];
};

/** Pseudo-random but stable bar heights, so the same song always gets the same "waveform". */
const barHeights = (seed: string, count: number): number[] => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const r = ((h >>> 0) % 1000) / 1000;
    const envelope = 0.45 + 0.55 * Math.sin((i / (count - 1)) * Math.PI); // taller in the middle
    out.push(Math.round(18 + r * 74 * envelope));
  }
  return out;
};

/** YouTube's hqdefault has black bars; hq720 is clean 16:9 when it exists. */
const bestThumbnail = async (thumb: string): Promise<string> => {
  const m = thumb.match(/^https:\/\/i\.ytimg\.com\/vi\/([\w-]{11})\//);
  if (!m) return thumb;
  const hq720 = `https://i.ytimg.com/vi/${m[1]}/hq720.jpg`;
  try {
    const res = await fetch(hq720, { method: 'HEAD' });
    if (res.ok) return hq720;
  } catch {
    /* fall through */
  }
  return `https://i.ytimg.com/vi/${m[1]}/mqdefault.jpg`;
};

const loadFont = async (origin: string, file: string): Promise<ArrayBuffer | null> => {
  try {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const buf = await readFile(join(process.cwd(), 'public', 'fonts', file));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch {
    /* not bundled: fall back to the deployed site */
  }
  try {
    const res = await fetch(`${origin}/fonts/${file}`);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
};

type Node = { type: string; props: Record<string, unknown> };
const el = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style: { display: 'flex', ...style }, children, ...extra },
});

async function handler(req: Request) {
  const url = new URL(req.url);
  const q = (k: string) => url.searchParams.get(k) || '';

  const rawType = q('type').toLowerCase();
  const type = ['playlist', 'artist', 'album'].includes(rawType) ? rawType : 'song';
  const title = decodeEntities(q('title') || 'Great Music').slice(0, 120);
  const artist = decodeEntities(q('artist') || q('channel') || q('creator') || 'NYRA').slice(0, 80);
  const tracks = q('tracks');
  const id = q('id') || q('videoId');
  const bare = q('bare') === '1'; // no waveform bars: the video builder animates them instead
  const color = pickColor(q('color'), title + artist);
  const rawThumb = q('thumbnail') || q('artwork') || (id && type === 'song' ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '');

  const [art, bold, medium] = await Promise.all([
    rawThumb ? bestThumbnail(rawThumb) : Promise.resolve(''),
    loadFont(url.origin, 'Inter-800.woff'),
    loadFont(url.origin, 'Inter-500.woff'),
  ]);

  const subtitle =
    type === 'playlist' ? `${tracks ? `${tracks} tracks · ` : ''}Playlist` : type === 'album' ? `${artist} · Album` : type === 'artist' ? 'Artist' : artist;
  const cta = type === 'playlist' ? 'Open playlist' : type === 'artist' ? 'View artist' : type === 'album' ? 'Open album' : 'Play on NYRA';

  const titleSize = title.length <= 16 ? 84 : title.length <= 28 ? 68 : title.length <= 44 ? 56 : 46;
  const bars = barHeights(title + artist, 34);

  const artBox = el(
    'div',
    {
      width: 440,
      height: 440,
      flexShrink: 0,
      borderRadius: 40,
      overflow: 'hidden',
      background: '#12131c',
      border: `3px solid ${color}88`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    art
      ? { type: 'img', props: { src: art, width: 440, height: 440, style: { width: 440, height: 440, objectFit: 'cover' } } }
      : el('div', { fontSize: 220, color, fontWeight: 800 }, 'N'),
  );

  const playButton = el(
    'div',
    { width: 72, height: 72, borderRadius: 36, background: color, alignItems: 'center', justifyContent: 'center' },
    el('div', { width: 0, height: 0, marginLeft: 8, borderLeft: '26px solid #07080d', borderTop: '16px solid transparent', borderBottom: '16px solid transparent' }, null),
  );

  const tree = el(
    'div',
    { width: 1200, height: 630, position: 'relative', overflow: 'hidden', background: '#07080d', fontFamily: bold ? 'Inter' : 'sans-serif' },
    [
      // Blurred-look backdrop: the artwork, dimmed under a gradient
      art
        ? { type: 'img', props: { src: art, width: 1200, height: 630, style: { position: 'absolute', top: 0, left: 0, width: 1200, height: 630, objectFit: 'cover', opacity: 0.34 } } }
        : el('div', {}, null),
      el('div', { position: 'absolute', top: 0, left: 0, width: 1200, height: 630, backgroundImage: 'linear-gradient(105deg, rgba(7,8,13,0.97) 28%, rgba(7,8,13,0.62) 100%)' }, null),
      el('div', { position: 'absolute', top: -160, left: -160, width: 760, height: 760, backgroundImage: `radial-gradient(circle, ${color}55 0%, rgba(0,0,0,0) 68%)` }, null),
      el('div', { position: 'absolute', top: 0, left: 0, width: 1200, height: 8, backgroundImage: `linear-gradient(90deg, ${color}, rgba(0,0,0,0))` }, null),

      el('div', { position: 'relative', width: 1200, height: 630, padding: '0 72px', alignItems: 'center' }, [
        artBox,
        el('div', { flexDirection: 'column', marginLeft: 64, flex: 1, minWidth: 0 }, [
          el('div', { alignItems: 'center', color, fontSize: 24, fontWeight: 800, letterSpacing: 6 }, [
            el('div', { width: 14, height: 14, borderRadius: 7, background: color, marginRight: 16 }, null),
            'NYRA  •  FEEL THE PULSE',
          ]),
          el('div', { marginTop: 26, color: '#ffffff', fontSize: titleSize, fontWeight: 800, lineHeight: 1.06, lineClamp: 2 }, title),
          el('div', { marginTop: 18, color: '#a9aec6', fontSize: 32, fontWeight: 500, lineClamp: 1 }, subtitle),
          el(
            'div',
            { marginTop: 38, alignItems: 'flex-end', height: 96 },
            (bare ? [] : bars).map((h, i) => el('div', { width: 9, height: h, marginRight: 7, borderRadius: 5, background: color, opacity: i % 3 === 0 ? 1 : i % 3 === 1 ? 0.7 : 0.45 }, null)),
          ),
          el('div', { marginTop: 36, alignItems: 'center' }, [
            playButton,
            el('div', { marginLeft: 22, color: '#ffffff', fontSize: 34, fontWeight: 800 }, cta),
          ]),
        ]),
      ]),

      // Footer: invite people to the app (sits in the free strip under the artwork)
      el(
        'div',
        { position: 'absolute', left: 72, bottom: 24, width: 1056, alignItems: 'center', color: '#8d93ad', fontSize: 25, fontWeight: 500 },
        `Listen to more music  •  visit NYRA  •  ${url.host}`,
      ),
    ],
  );

  const fonts = [
    ...(bold ? [{ name: 'Inter', data: bold, weight: 800 as const, style: 'normal' as const }] : []),
    ...(medium ? [{ name: 'Inter', data: medium, weight: 500 as const, style: 'normal' as const }] : []),
  ];

  try {
    if (!fonts.length) throw new Error('fonts unavailable');
    const svg = await satori(tree as never, { width: 1200, height: 630, fonts: fonts as never });
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
    return new Response(new Uint8Array(png), {
      headers: {
        'content-type': 'image/png',
        'cache-control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      },
    });
  } catch {
    // Never leave the embed without a picture: fall back to the plain artwork.
    return Response.redirect(rawThumb || `${url.origin}/headphones.png`, 302);
  }
}

// Node.js runtime web handler (the Edge runtime rejects these modules at deploy time).
export default { fetch: handler };
