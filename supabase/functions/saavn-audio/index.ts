// Free full-song audio resolver.
// YouTube now blocks every free server-side audio path (Invidious, Piped,
// Cobalt, yt-dlp from datacenter IPs). JioSaavn's public catalogue serves full
// 320kbps AAC files from a CORS-open CDN, so we match the YouTube track by
// title/artist/duration and return a direct CDN URL the browser can fetch.
import CryptoJS from 'npm:crypto-js@4.2.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const decodeEntities = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

const VARIANT_WORDS = ['remix', 'cover', 'piano', 'instrumental', 'lofi', 'lo-fi', 'slowed', 'reverb', 'karaoke', 'acoustic', 'sped', 'mashup', 'unplugged', 'live', 'version', 'edit', 'afro', 'bestacito'];

function cleanYouTubeTitle(raw: string) {
  return decodeEntities(raw)
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\((?:[^)]*\b(?:official|video|audio|lyrics?|lyric|visuali[sz]er|hd|4k|mv|m\/v)\b[^)]*)\)/gi, ' ')
    .replace(/\b(official\s+(music\s+)?video|official\s+audio|lyrics?\s+video|full\s+song|hd|4k)\b/gi, ' ')
    .replace(/\|.*$/, ' ')
    .replace(/#\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanChannel(raw: string) {
  return decodeEntities(raw || '')
    .replace(/\s*-\s*topic$/i, '')
    .replace(/vevo$/i, '')
    .replace(/\b(official|music|records|channel)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const tokens = (s: string) =>
  decodeEntities(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(feat|ft|featuring|with|the|and|x)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);

function overlap(a: string[], b: string[]) {
  if (!a.length || !b.length) return 0;
  const sb = new Set(b);
  const hit = a.filter((t) => sb.has(t)).length;
  return hit / a.length;
}

function decryptUrl(encrypted: string) {
  const out = CryptoJS.DES.decrypt(
    { ciphertext: CryptoJS.enc.Base64.parse(encrypted) } as any,
    CryptoJS.enc.Utf8.parse('38346591'),
    { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 },
  );
  return out.toString(CryptoJS.enc.Utf8);
}

async function search(query: string) {
  const params = new URLSearchParams({
    __call: 'search.getResults', q: query, _format: 'json', _marker: '0',
    api_version: '4', ctx: 'web6dot0', n: '20', p: '1',
  });
  const res = await fetch(`https://www.jiosaavn.com/api.php?${params}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  return Array.isArray(data?.results) ? data.results : [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const rawTitle = (url.searchParams.get('title') || '').slice(0, 300);
    const rawArtist = (url.searchParams.get('artist') || '').slice(0, 200);
    const duration = Number(url.searchParams.get('duration') || 0) || 0;
    if (rawTitle.trim().length < 2) return json({ error: 'title required' }, 400);

    const cleaned = cleanYouTubeTitle(rawTitle);
    let artist = cleanChannel(rawArtist);
    let song = cleaned;
    const dash = cleaned.split(/\s+[-–—]\s+/);
    if (dash.length >= 2) {
      artist = `${dash[0]} ${artist}`.trim();
      song = dash.slice(1).join(' ');
    }
    song = song.replace(/\((?:feat|ft)\.?[^)]*\)/gi, ' ').replace(/\b(?:feat|ft)\.?\s.*$/i, ' ').trim() || cleaned;

    const songTokens = tokens(song);
    const artistTokens = tokens(artist);
    const ytLower = rawTitle.toLowerCase();
    const allowedVariants = VARIANT_WORDS.filter((w) => ytLower.includes(w));

    const queries = Array.from(new Set([
      `${song} ${dash.length >= 2 ? dash[0] : artist}`.trim(),
      song,
      cleaned,
    ])).filter((q) => q.length > 1);

    let best: { score: number; item: any } | null = null;
    for (const q of queries) {
      const results = await search(q);
      for (const item of results) {
        if (item?.type !== 'song' || !item?.more_info?.encrypted_media_url) continue;
        const title = decodeEntities(item.title || '');
        const titleTokens = tokens(title);
        const resultArtists = tokens(`${item.more_info?.music || ''} ${item.subtitle || ''} ${JSON.stringify(item.more_info?.artistMap?.primary_artists?.map((a: any) => a.name) || [])}`);

        const songScore = (overlap(songTokens, titleTokens) * 0.7) + (overlap(titleTokens, songTokens) * 0.3);
        const artistScore = artistTokens.length ? overlap(artistTokens, resultArtists) : 0.5;
        let score = songScore * 0.65 + artistScore * 0.25;

        const len = Number(item.more_info?.duration || 0);
        if (duration > 0 && len > 0) {
          const diff = Math.abs(len - duration);
          score += diff <= 8 ? 0.1 : diff <= 25 ? 0.05 : diff > 60 ? -0.1 : 0;
        } else {
          score += 0.04;
        }

        const lowerTitle = title.toLowerCase();
        for (const w of VARIANT_WORDS) {
          if (lowerTitle.includes(w) && !allowedVariants.includes(w)) score -= 0.25;
        }
        if (!best || score > best.score) best = { score, item };
      }
      if (best && best.score >= 0.75) break;
    }

    if (!best || best.score < 0.45) {
      return json({ error: 'No confident match found', bestScore: best?.score ?? 0 }, 404);
    }

    const info = best.item.more_info;
    const base = decryptUrl(info.encrypted_media_url);
    if (!/^https:\/\//.test(base)) return json({ error: 'Could not decode audio URL' }, 502);
    const quality = info['320kbps'] === 'true' ? '_320.' : '_160.';
    const candidates = [base.replace(/_96\./, quality), base.replace(/_96\./, '_160.'), base];

    return json({
      success: true,
      audioUrl: candidates[0],
      fallbackUrls: candidates.slice(1),
      mimeType: 'audio/mp4',
      matchedTitle: decodeEntities(best.item.title || ''),
      matchedArtist: decodeEntities(info.music || best.item.subtitle || ''),
      score: Number(best.score.toFixed(2)),
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
