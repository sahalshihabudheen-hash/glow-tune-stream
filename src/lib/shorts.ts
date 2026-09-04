export interface ShortsFilterableTrack {
  id: string;
  title: string;
  channel?: string;
  duration?: number;
}

const SHORT_PATTERNS = [
  /#shorts?\b/i,
  /\bshorts?\b\s*[|\-–]/i,
  /[|\-–]\s*\bshorts?\b/i,
  /\byt\s*shorts?\b/i,
  /\bstatus\s*(video|song)?\b/i,
  /\bwhatsapp\s*status\b/i,
  /\b30\s*sec(ond)?s?\b/i,
  /\bringtone\b/i,
  /\bteaser\b/i,
  /\bsnippet\b/i,
  /\breels?\b/i,
  /\bedit\s*audio\b/i,
];

/** True when a track looks like a YouTube Short / status clip rather than a full song. */
export function isLikelyShort(track: ShortsFilterableTrack): boolean {
  if (typeof track.duration === 'number' && track.duration > 0 && track.duration < 75) return true;
  const title = track.title || '';
  return SHORT_PATTERNS.some(pattern => pattern.test(title));
}

/** Removes Shorts-style clips, keeping the original ordering of full songs. */
export function filterOutShorts<T extends ShortsFilterableTrack>(tracks: T[]): T[] {
  const full = tracks.filter(track => !isLikelyShort(track));
  return full.length > 0 ? full : tracks;
}
