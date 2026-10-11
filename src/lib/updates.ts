/**
 * "What's new" releases.
 *
 * Stored in the existing `app_settings` table (key = 'app_updates') as
 * `{ releases: UpdateRelease[] }`, so no database migration is needed. Admins
 * can already write to that table and everyone can already read it.
 */

export type UpdateSectionType = 'added' | 'changed' | 'improved' | 'fixed' | 'removed';

export interface UpdateItem {
  title: string; // short bold lead-in, optional ("Global Spotify Canvas")
  text: string; // the explanation
}

export interface UpdateSection {
  type: UpdateSectionType;
  items: UpdateItem[];
}

export interface UpdateRelease {
  id: string;
  /** Users who already saw this value won't see the popup again. A new value re-announces. */
  notifyId: string;
  version: string;
  date: string; // yyyy-mm-dd
  published: boolean;
  sections: UpdateSection[];
}

export const UPDATES_KEY = 'app_updates';
export const UPDATES_EVENT = 'app_updates_updated';

export const SECTION_ORDER: UpdateSectionType[] = ['added', 'changed', 'improved', 'fixed', 'removed'];

/** Tailwind classes are written out in full so they survive purging. */
export const SECTION_META: Record<UpdateSectionType, { label: string; emoji: string; heading: string; dot: string }> = {
  added: { label: 'Added', emoji: '✨', heading: 'text-lime-400', dot: 'bg-lime-400' },
  changed: { label: 'Changed', emoji: '🔄', heading: 'text-sky-400', dot: 'bg-sky-400' },
  improved: { label: 'Improved', emoji: '⚡', heading: 'text-fuchsia-400', dot: 'bg-fuchsia-400' },
  fixed: { label: 'Fixed', emoji: '🛠️', heading: 'text-amber-400', dot: 'bg-amber-400' },
  removed: { label: 'Removed', emoji: '🗑️', heading: 'text-rose-400', dot: 'bg-rose-400' },
};

export const MAX_RELEASES = 50;
export const MAX_VERSION_LENGTH = 24;
export const MAX_ITEMS_PER_SECTION = 30;
export const MAX_ITEM_TITLE = 80;
export const MAX_ITEM_TEXT = 500;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const todayISO = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

const isType = (v: unknown): v is UpdateSectionType =>
  typeof v === 'string' && (SECTION_ORDER as string[]).includes(v);

/**
 * Turns anything read from the database into a safe release.
 * `keepEmpty` is for the editor, which needs half-typed blank rows to stay put.
 */
export function sanitizeRelease(raw: unknown, keepEmpty = false): UpdateRelease | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const id = str(r.id, 64) || newId();
  const sections: UpdateSection[] = [];
  const seen = new Set<UpdateSectionType>();

  if (Array.isArray(r.sections)) {
    for (const s of r.sections) {
      if (!s || typeof s !== 'object') continue;
      const sec = s as Record<string, unknown>;
      if (!isType(sec.type) || seen.has(sec.type)) continue;
      const items: UpdateItem[] = [];
      if (Array.isArray(sec.items)) {
        for (const it of sec.items.slice(0, MAX_ITEMS_PER_SECTION)) {
          if (!it || typeof it !== 'object') continue;
          const item = it as Record<string, unknown>;
          const title = str(item.title, MAX_ITEM_TITLE);
          const text = str(item.text, MAX_ITEM_TEXT);
          if (!keepEmpty && !title.trim() && !text.trim()) continue;
          items.push({ title, text });
        }
      }
      if (!keepEmpty && items.length === 0) continue;
      seen.add(sec.type);
      sections.push({ type: sec.type, items });
    }
  }
  sections.sort((a, b) => SECTION_ORDER.indexOf(a.type) - SECTION_ORDER.indexOf(b.type));

  return {
    id,
    notifyId: str(r.notifyId, 64) || id,
    version: str(r.version, MAX_VERSION_LENGTH),
    date: typeof r.date === 'string' && DATE_RE.test(r.date) ? r.date : '',
    published: r.published === true,
    sections,
  };
}

/** Accepts `{ releases: [...] }` (or a bare array). Newest date first; ties keep their stored order. */
export function sanitizeReleases(raw: unknown, keepEmpty = false): UpdateRelease[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { releases?: unknown }).releases)
      ? (raw as { releases: unknown[] }).releases
      : [];

  const out: UpdateRelease[] = [];
  const ids = new Set<string>();
  for (const item of list.slice(0, MAX_RELEASES)) {
    const rel = sanitizeRelease(item, keepEmpty);
    if (!rel || ids.has(rel.id)) continue;
    ids.add(rel.id);
    out.push(rel);
  }
  return out
    .map((rel, index) => ({ rel, index }))
    .sort((a, b) => (b.rel.date || '').localeCompare(a.rel.date || '') || a.index - b.index)
    .map(({ rel }) => rel);
}

export const releaseItemCount = (r: UpdateRelease) => r.sections.reduce((n, s) => n + s.items.length, 0);

/** The release that pops up for users: newest published one that actually has content. */
export function pickLatest(releases: UpdateRelease[]): UpdateRelease | null {
  return releases.find((r) => r.published && r.version.trim() && releaseItemCount(r) > 0) ?? null;
}

export function formatReleaseDate(date: string): string {
  if (!DATE_RE.test(date)) return '';
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ───────── "seen once" tracking (per user, per device) ───────── */

const seenKey = (userId: string) => `nyra_seen_update_${userId}`;

export const getSeenUpdate = (userId: string): string | null => {
  try {
    return localStorage.getItem(seenKey(userId));
  } catch {
    return null;
  }
};

export const markUpdateSeen = (userId: string, notifyId: string) => {
  try {
    localStorage.setItem(seenKey(userId), notifyId);
  } catch {
    /* storage blocked: the popup may show again next visit, which is harmless */
  }
};

export const shouldShowUpdate = (latest: UpdateRelease | null, seenId: string | null) =>
  !!latest && latest.notifyId !== seenId;

/** Starter content so a new admin can see how a release looks. */
export const exampleRelease = (): UpdateRelease => {
  const id = newId();
  return {
    id,
    notifyId: id,
    version: '4.8.0',
    date: '2026-06-06',
    published: false,
    sections: [
      {
        type: 'added',
        items: [
          {
            title: 'Global Spotify Canvas',
            text: 'Introduced a high-performance background video player that seamlessly plays Spotify Canvas visuals behind your music and lyrics.',
          },
          {
            title: 'Lyrics Video Overlay',
            text: 'Added a balanced dark transparency over the Canvas video on the lyrics screen, ensuring text readability while maintaining visual aesthetics.',
          },
        ],
      },
      {
        type: 'changed',
        items: [
          {
            title: 'Canvas Singleton Architecture',
            text: 'Rebuilt the Canvas video player to use a single global instance. This drastically improves memory efficiency, saves battery, and ensures smooth background pausing.',
          },
        ],
      },
    ],
  };
};
