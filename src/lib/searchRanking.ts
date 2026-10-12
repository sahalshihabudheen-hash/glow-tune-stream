/**
 * Spotify-style search ranking.
 *
 * YouTube returns results in its own relevance order, so a search for "minnalvala" can put a
 * reel, a cover or a lyric video above the actual song. This module re-orders results so that:
 *   1. the best match for what the person typed comes first ("Top result"),
 *   2. other versions / close matches follow,
 *   3. everything else (related, popular songs) goes after.
 *
 * It is pure and has no network access, so it is easy to test and cheap to run.
 */

export interface RankableTrack {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
  /** Optional. Filled in by the youtube-search function when available. */
  viewCount?: number;
}

export interface RankedResults<T extends RankableTrack = RankableTrack> {
  /** Best match for the query, or null when nothing matches well. */
  top: T | null;
  /** Everything that matches the query (includes `top` as the first item). */
  matches: T[];
  /** Related / popular songs that do not match the query itself. */
  others: T[];
}

/** Minimum score for a result to count as "the song you searched for". */
export const MATCH_THRESHOLD = 50;

const NOISE_WORDS =
  /\b(official|video|videos|lyric|lyrics|lyrical|audio|full|song|songs|hd|4k|1080p|music|mv|visualizer|new|latest)\b/g;

/** Lowercase, strip accents and punctuation, collapse whitespace. Keeps any script (Malayalam, Hindi, ...). */
export const normalize = (s: string): string =>
  (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const compact = (s: string): string => normalize(s).replace(/\s/g, '');

const cleanName = (part: string): string =>
  normalize(part).replace(NOISE_WORDS, ' ').replace(/\s+/g, ' ').trim();

/**
 * Candidate song names found in a YouTube title. Titles come in many shapes:
 *   'Minnalvala (From "Narivetta") | Jakes Bejoy'          -> ['minnalvala']
 *   'Narivetta - Minnalvala Video Song | Tovino Thomas'    -> ['narivetta', 'minnalvala']
 */
export const extractSongNames = (title: string): string[] => {
  const base = (title || '').replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, ' ');
  const parts = base.split(/\s[-\u2013\u2014|:]\s|\s\|\s|\s+from\s+/i).slice(0, 3);
  const names = parts.map(cleanName).filter(Boolean);
  return Array.from(new Set(names));
};

/** First candidate name; used for chip labels and de-duplication. */
export const extractSongName = (title: string): string => extractSongNames(title)[0] || '';

/** Levenshtein distance with an early exit once it is certain to exceed `max`. */
const editDistance = (a: string, b: string, max = 3): number => {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
};

/** 0..1 similarity between two compact strings. */
const similarity = (a: string, b: string): number => {
  if (!a || !b) return 0;
  const max = Math.max(a.length, b.length);
  const d = editDistance(a, b, Math.ceil(max * 0.35));
  return Math.max(0, 1 - d / max);
};

/** True when `token` appears in `haystackTokens`, allowing small typos on longer words. */
const tokenMatches = (token: string, haystackTokens: string[]): boolean => {
  const allowed = token.length >= 8 ? 2 : token.length >= 5 ? 1 : 0;
  return haystackTokens.some((h) => h === token || (allowed > 0 && editDistance(token, h, allowed) <= allowed));
};

const JUNK =
  /\b(cover|karaoke|reaction|reacts?|slowed|reverb|sped\s*up|nightcore|lofi|lo-fi|bass\s*boosted|remix|mashup|tutorial|lesson|status|shorts?|reels?|ringtone|bgm|8d|dj|dance|choreography|instrumental|piano|guitar|flute|violin|unplugged)\b/i;
const COMPILATION =
  /\b(jukebox|non[\s-]?stop|best\s+of|top\s*\d+|\d+\s+songs|all\s+songs|hits\s+collection|collection|playlist|songs\s+of|mashup)\b/i;
const OFFICIAL_CHANNEL =
  /(vevo|topic|official|records|audios?|saregama|t-series|sony|zee|think|satyam|muzik|manorama|lahari|aditya|tips|speed|label|studios?)/i;


/** How well the typed text matches one candidate song name. 0 = no match. */
const nameScore = (nameC: string, qc: string): number => {
  if (!nameC) return 0;
  if (nameC === qc) return 100;
  if (nameC.length >= 4 && qc.length >= 4) {
    if (nameC.startsWith(qc) || qc.startsWith(nameC)) return 85;
    const sim = similarity(nameC, qc);
    if (sim >= 0.78) return 70 + sim * 10; // typo / spacing: "minalvala", "minnal vala"
  }
  return 0;
};

/** The part of the title that matched the typed query, e.g. 'Minnalvala' for 'Narivetta - Minnalvala Video Song'. */
export const matchedSongName = (track: RankableTrack, query: string): string => {
  const qc = compact(query);
  let best = '';
  let bestScore = -1;
  for (const name of extractSongNames(track.title)) {
    const sc = nameScore(name.replace(/\s/g, ''), qc);
    if (sc > bestScore) {
      best = name;
      bestScore = sc;
    }
  }
  return best.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
};

/** How well a single track matches the typed query. 0 means "not a match". */
export const scoreTrack = (track: RankableTrack, query: string): number => {
  const q = normalize(query);
  const qc = compact(query);
  if (!qc) return 0;

  const fullC = compact(track.title);
  const qTokens = q.split(' ').filter(Boolean);
  const haystackTokens = normalize(`${track.title} ${track.channel}`).split(' ').filter(Boolean);

  // Try every candidate name; the film name in "Film - Song" titles must not hide the real song name.
  const candidates = extractSongNames(track.title).map((n) => n.replace(/\s/g, ''));
  let score = Math.max(0, ...candidates.map((c, i) => nameScore(c, qc) - (i > 0 ? 3 : 0)));

  if (score === 0 && qc.length >= 4 && fullC.includes(qc)) score = 60;
  if (score === 0 && qTokens.length > 0 && qTokens.every((t) => tokenMatches(t, haystackTokens))) score = 52;
  if (score === 0) return 0;

  // Quality signals: the official upload of the song should beat every other upload of it.
  if (OFFICIAL_CHANNEL.test(track.channel || '')) score += 8;
  if (/\b(video\s*song|official)\b/i.test(track.title)) score += 4;
  if (/\(\s*from\s+["\u201c'\u2018]/i.test(track.title)) score += 4; // film-tagged release
  if (/\blyric(al|s)?\b/i.test(track.title)) score -= 6; // lyric videos rank below the official video
  if (track.viewCount && track.viewCount > 0) score += Math.min(20, Math.log10(track.viewCount) * 2.5);

  // Remixes, covers, reels and slowed versions never lead, unless the person asked for exactly that.
  // They still count as matches (they ARE that song), they just sit at the end of the matches.
  if (JUNK.test(track.title) && !JUNK.test(query)) score = Math.max(MATCH_THRESHOLD, score - 45);

  return score;
};

/** Popularity-ish value used to order the "others" section. */
const popularity = (t: RankableTrack, originalIndex: number): number =>
  (t.viewCount && t.viewCount > 0 ? Math.log10(t.viewCount) * 10 : 0) - originalIndex * 0.5;

/** Splits results into top result / matches / others, best first. */
export function rankResults<T extends RankableTrack>(results: T[], query: string): RankedResults<T> {
  const seen = new Set<string>();
  const unique = results.filter((t) => t && t.id && !seen.has(t.id) && seen.add(t.id));

  const scored = unique.map((t, i) => ({ t, i, s: scoreTrack(t, query) }));

  const matches = scored
    .filter((x) => x.s >= MATCH_THRESHOLD)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.t);

  // Everything that is not the searched song: one upload per song, no remixes/compilations, most popular first.
  const others = cleanPopular(scored.filter((x) => x.s < MATCH_THRESHOLD).map((x) => x.t), new Set(), 30);

  return { top: matches[0] ?? null, matches, others };
}

/** Keeps one upload per song, drops compilations and remixes, most-viewed first. */
export function cleanPopular<T extends RankableTrack>(tracks: T[], exclude: Set<string>, limit = 15): T[] {
  const seenSongs = new Set<string>();
  return tracks
    .filter((t) => t && t.id && !exclude.has(t.id) && !JUNK.test(t.title) && !COMPILATION.test(t.title))
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (b.t.viewCount || 0) - (a.t.viewCount || 0) || a.i - b.i)
    .map((x) => x.t)
    .filter((t) => {
      const key = compact(extractSongName(t.title)) || t.id;
      if (seenSongs.has(key)) return false;
      seenSongs.add(key);
      return true;
    })
    .slice(0, limit);
}

/** Adds the "popular songs" that follow the searched song. */
export function mergeRelated<T extends RankableTrack>(ranked: RankedResults<T>, related: T[]): RankedResults<T> {
  const shown = new Set([...ranked.matches, ...ranked.others].map((t) => t.id));
  const popular = cleanPopular(related, shown);
  return { ...ranked, others: [...ranked.others, ...popular] };
}

const LANGUAGE_WORDS: [RegExp, string][] = [
  [/malayalam/i, 'Malayalam'],
  [/tamil/i, 'Tamil'],
  [/telugu/i, 'Telugu'],
  [/kannada/i, 'Kannada'],
  [/punjabi/i, 'Punjabi'],
  [/hindi|bollywood/i, 'Hindi'],
];
const LANGUAGE_SCRIPTS: [RegExp, string][] = [
  [/[\u0D00-\u0D7F]/, 'Malayalam'],
  [/[\u0B80-\u0BFF]/, 'Tamil'],
  [/[\u0C00-\u0C7F]/, 'Telugu'],
  [/[\u0C80-\u0CFF]/, 'Kannada'],
  [/[\u0A00-\u0A7F]/, 'Punjabi'],
  [/[\u0900-\u097F]/, 'Hindi'],
];
const STATE_LANGUAGE: Record<string, string> = {
  kerala: 'Malayalam',
  'tamil nadu': 'Tamil',
  karnataka: 'Kannada',
  telangana: 'Telugu',
  'andhra pradesh': 'Telugu',
  punjab: 'Punjabi',
};

/** The language of the searched song: from its title/channel, else from the person's state. */
export function detectLanguage(top: RankableTrack | null, state?: string | null): string | null {
  const text = `${top?.title || ''} ${top?.channel || ''}`;
  for (const [re, lang] of LANGUAGE_WORDS) if (re.test(text)) return lang;
  for (const [re, lang] of LANGUAGE_SCRIPTS) if (re.test(text)) return lang;
  return STATE_LANGUAGE[normalize(state || '')] ?? null;
}

/** Search used to find the popular songs shown after the searched song. */
export function relatedQueryFor(top: RankableTrack | null, state?: string | null): string {
  const lang = detectLanguage(top, state);
  if (lang) return `${lang} hit songs official video song`;
  // Language unknown: a label channel's hits are a decent stand-in; otherwise plain trending songs.
  if (top?.channel && OFFICIAL_CHANNEL.test(top.channel)) return `${top.channel} hit songs official video song`;
  return 'trending hit songs official video song';
}
