import React from 'react';
import { toast } from 'sonner';
import { Share2 } from 'lucide-react';

export type ShareContentType = 'song' | 'playlist' | 'artist' | 'album';

export interface ShareOptions {
  type?: ShareContentType;
  id?: string;
  title: string;
  artist?: string;
  channel?: string;
  thumbnail?: string;
  trackCount?: number;
  creator?: string;
  color?: string;
  toastMessage?: string;
}

/**
 * Builds the canonical NYRA share URL with full Discord Open Graph parameters.
 */
export function buildShareUrl(options: ShareOptions): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const type = options.type || 'song';
  const id = options.id || '';
  const title = options.title || 'Great Music';
  const artist = options.artist || options.channel || 'NYRA';
  const thumbnail = options.thumbnail || '';
  
  const isYoutubeSong = type === 'song' && /^[\w-]{11}$/.test(id) && (!thumbnail || /^https:\/\/i\.ytimg\.com\//.test(thumbnail));
  const hasRealTitle = !!options.title && options.title !== 'Great Music';

  // Fallback short link (no title known): the server has to look title/artist up from the id, and that lookup
  // is unreliable from serverless IPs, so only use it when we truly have nothing else.
  if (isYoutubeSong && !hasRealTitle) {
    return `${origin}/api/og?id=${id}`;
  }

  const params = new URLSearchParams();
  params.set('type', type);
  if (id) params.set('id', id);
  if (title) params.set('title', title);
  if (artist) params.set('artist', artist);
  // The server derives YouTube thumbnails from the id, so leave them out to keep the link shorter.
  if (thumbnail && !isYoutubeSong) params.set('thumbnail', thumbnail);
  if (options.trackCount !== undefined) params.set('tracks', String(options.trackCount));
  if (options.creator) params.set('creator', options.creator);
  if (options.color) params.set('color', options.color.replace('#', ''));

  return `${origin}/api/og?${params.toString()}`;
}

const WARM_TIMEOUT_MS = 35000; // the server needs a few seconds to build the playable preview; never wait longer than this

const shareIcon = () => React.createElement(Share2, { className: 'w-4 h-4 text-primary' });

/** Plain clipboard copy (needs a recent click in some browsers, so it can fail when called late). */
async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('[Share] Clipboard API fallback triggered:', err);
  }

  // Fallback for environments where clipboard writeText fails
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textArea);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Shares a link. For songs the link is only handed over once the server has finished preparing the playable
 * preview (a few seconds), with a progress toast meanwhile; everything else is copied straight away.
 */
export async function executeShare(options: ShareOptions): Promise<boolean> {
  const shareUrl = buildShareUrl(options);
  const type = options.type || 'song';

  if (type !== 'song') {
    // Warm the preview in the background so Discord's (impatient) crawler finds it ready.
    try { void fetch(shareUrl, { mode: 'no-cors' }).catch(() => {}); } catch { /* ignore */ }
    const toastMsg = options.toastMessage || (
      type === 'playlist' ? 'Playlist link copied!' :
      type === 'artist' ? 'Artist link copied!' :
      'Album link copied!'
    );
    const ok = await copyText(shareUrl);
    if (ok) toast.success(toastMsg, { icon: shareIcon() });
    else toast.error('Could not copy link to clipboard');
    return ok;
  }

  const toastId = toast.loading('Generating link…');
  const stages: Array<[number, string]> = [
    [1500, 'Refining details…'],
    [5000, 'Preparing the player…'],
    [12000, 'Almost ready…'],
  ];
  const timers = stages.map(([ms, msg]) => setTimeout(() => toast.loading(msg, { id: toastId }), ms));

  // warm=1 makes the server build the playable preview now and answer only when it is done. It never rejects:
  // if it fails or times out we still hand over the link (the preview just falls back to the plain card).
  const ready: Promise<void> = new Promise((resolve) => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => { controller?.abort(); resolve(); }, WARM_TIMEOUT_MS);
    try {
      fetch(`${shareUrl}${shareUrl.includes('?') ? '&' : '?'}warm=1`, { mode: 'no-cors', signal: controller?.signal })
        .then(() => undefined, () => undefined)
        .then(() => { clearTimeout(timer); resolve(); });
    } catch {
      clearTimeout(timer);
      resolve();
    }
  });

  let copied = false;
  try {
    // Hand the clipboard a promise: the copy then completes the moment the link is ready, and still counts as
    // part of the original click (browsers block plain clipboard writes made several seconds after a click).
    if (typeof ClipboardItem !== 'undefined' && typeof navigator !== 'undefined' && navigator.clipboard?.write) {
      const blob = ready.then(() => new Blob([shareUrl], { type: 'text/plain' }));
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
      copied = true;
    }
  } catch (err) {
    console.warn('[Share] Deferred clipboard write failed:', err);
  }
  if (!copied) {
    await ready;
    copied = await copyText(shareUrl);
  }
  timers.forEach(clearTimeout);

  if (copied) {
    toast.success(options.toastMessage || 'Link ready — paste it anywhere!', { id: toastId, icon: shareIcon() });
  } else {
    // The browser refused a late copy: let the person click once more (a fresh click is always allowed).
    toast.error('Link is ready', {
      id: toastId,
      description: 'Your browser blocked the automatic copy.',
      action: {
        label: 'Copy link',
        onClick: () => {
          void copyText(shareUrl).then((ok) => {
            if (ok) toast.success('Link copied!', { icon: shareIcon() });
            else toast.error('Could not copy link to clipboard');
          });
        },
      },
    });
  }
  return copied;
}

/**
 * Helper to share a track
 */
export function shareTrack(track: { id: string; title: string; channel?: string; thumbnail?: string }): Promise<boolean> {
  return executeShare({
    type: 'song',
    id: track.id,
    title: track.title,
    artist: track.channel,
    thumbnail: track.thumbnail,
  });
}

/**
 * Helper to share a playlist
 */
export function sharePlaylist(playlist: { id: string; name: string; thumbnail?: string; creator?: string; trackCount?: number }): Promise<boolean> {
  return executeShare({
    type: 'playlist',
    id: playlist.id,
    title: playlist.name,
    thumbnail: playlist.thumbnail,
    creator: playlist.creator,
    trackCount: playlist.trackCount,
    toastMessage: 'Playlist link copied!',
  });
}

/**
 * Helper to share an artist
 */
export function shareArtist(artist: { id: string; name: string; thumbnail?: string; trackCount?: number }): Promise<boolean> {
  return executeShare({
    type: 'artist',
    id: artist.id,
    title: artist.name,
    artist: artist.name,
    thumbnail: artist.thumbnail,
    trackCount: artist.trackCount,
    toastMessage: 'Artist link copied!',
  });
}

/**
 * Helper to share an album
 */
export function shareAlbum(album: { id: string; name: string; artist?: string; thumbnail?: string; trackCount?: number }): Promise<boolean> {
  return executeShare({
    type: 'album',
    id: album.id,
    title: album.name,
    artist: album.artist,
    thumbnail: album.thumbnail,
    trackCount: album.trackCount,
    toastMessage: 'Album link copied!',
  });
}
