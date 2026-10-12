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

/**
 * Pulls the actual song name out of a YouTube title:
 *   'Minnalvala (From "Narivetta") | Jakes Bejoy' -> 'minnalvala'
 *   'KALYANI - Official Video'                     -> 'kalyani'
 */
export const extractSongName = (title: string): string => {
  const base = (title || '')
    .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, ' ') // (From "..."), [Official Video]
    .split(/\s[-–—|:]\s|\s\|\s|\s+from\s+/i)[0];
  return normalize(base).replace(NOISE_WORDS, ' ').replace(/\s+/g, ' ').trim();
};

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
  /\b(cover|karaoke|reaction|reacts?|slowed|reverb|sped\s*up|nightcore|tutorial|lesson|status|shorts?|reels?|ringtone|bgm|8d|mashup|dj)\b/i;
const OFFICIAL_CHANNEL =
  /(vevo|topic|official|records|music|audios?|saregama|t-series|sony|zee|think|satyam|muzik|manorama|lahari|aditya|tips|speed|label|studios?|entertainment)/i;

/** How well a single track matches the typed query. 0 means "not a match". */
export const scoreTrack = (track: RankableTrack, query: string): number => {
  const q = normalize(query);
  const qc = compact(query);
  if (!qc) return 0;

  const name = extractSongName(track.title);
  const nameC = name.replace(/\s/g, '');
  const fullC = compact(track.title);
  const qTokens = q.split(' ').filter(Boolean);
  const haystackTokens = normalize(`${track.title} ${track.channel}`).split(' ').filter(Boolean);

  let score = 0;

  if (nameC && nameC === qc) {
    score = 100; // the exact song
  } else if (nameC.length >= 4 && qc.length >= 4 && (nameC.startsWith(qc) || qc.startsWith(nameC))) {
    score = 85; // "minnalvala" vs "minnalvala reprise"
  } else if (nameC.length >= 4 && qc.length >= 4 && similarity(nameC, qc) >= 0.78) {
    score = 70 + similarity(nameC, qc) * 10; // typo / spacing: "minalvala", "minnal vala"
  } else if (qc.length >= 4 && fullC.includes(qc)) {
    score = 60; // typed text appears somewhere in the title
  } else if (qTokens.length > 0 && qTokens.every((t) => tokenMatches(t, haystackTokens))) {
    score = 52; // every typed word is in the title or channel (song + artist searches)
  } else {
    return 0;
  }

  // Quality signals.
  if (OFFICIAL_CHANNEL.test(track.channel || '')) score += 5;
  if (/\(\s*from\s+["“'‘]/i.test(track.title)) score += 4; // film-tagged release
  if (track.viewCount && track.viewCount > 0) score += Math.min(10, Math.log10(track.viewCount) * 1.2);

  // Covers, reels and remixes sink, unless the person asked for exactly that.
  if (JUNK.test(track.title) && !JUNK.test(query)) score -= 20;

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

  const others = scored
    .filter((x) => x.s < MATCH_THRESHOLD)
    .sort((a, b) => {
      const ja = JUNK.test(a.t.title) ? 1 : 0;
      const jb = JUNK.test(b.t.title) ? 1 : 0;
      return ja - jb || popularity(b.t, b.i) - popularity(a.t, a.i);
    })
    .map((x) => x.t);

  return { top: matches[0] ?? null, matches, others };
}

/** Merges extra "related" tracks into `others`, skipping anything already shown. */
export function mergeRelated<T extends RankableTrack>(ranked: RankedResults<T>, related: T[], query: string): RankedResults<T> {
  const shown = new Set([...ranked.matches, ...ranked.others].map((t) => t.id));
  const fresh = related.filter((t) => t && t.id && !shown.has(t.id));
  // Related results that happen to match the query belong with the matches; the rest are "more songs".
  const extra = rankResults(fresh, query);
  const matches = [...ranked.matches, ...extra.matches];
  return { top: ranked.top ?? matches[0] ?? null, matches, others: [...ranked.others, ...extra.others] };
}

/** Which "related popular songs" query to run after a search. */
export function relatedQueryFor(top: RankableTrack | null, state?: string | null): string | null {
  const stateLanguage: Record<string, string> = {
    kerala: 'Malayalam',
    'tamil nadu': 'Tamil',
    karnataka: 'Kannada',
    telangana: 'Telugu',
    'andhra pradesh': 'Telugu',
    punjab: 'Punjabi',
  };
  const lang = stateLanguage[normalize(state || '')];
  if (top?.channel) return `${top.channel} popular songs`;
  if (lang) return `popular ${lang} songs`;
  return null;
}
