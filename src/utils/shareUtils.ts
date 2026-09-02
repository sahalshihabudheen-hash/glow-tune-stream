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
  
  const params = new URLSearchParams();
  params.set('type', type);
  if (id) params.set('id', id);
  if (title) params.set('title', title);
  if (artist) params.set('artist', artist);
  if (thumbnail) params.set('thumbnail', thumbnail);
  if (options.trackCount !== undefined) params.set('tracks', String(options.trackCount));
  if (options.creator) params.set('creator', options.creator);
  if (options.color) params.set('color', options.color.replace('#', ''));

  return `${origin}/api/og?${params.toString()}`;
}

/**
 * Executes copy to clipboard and presents a premium toast notification.
 */
export async function executeShare(options: ShareOptions): Promise<boolean> {
  const shareUrl = buildShareUrl(options);
  const toastMsg = options.toastMessage || (
    options.type === 'playlist' ? 'Playlist link copied!' :
    options.type === 'artist' ? 'Artist link copied!' :
    options.type === 'album' ? 'Album link copied!' :
    'Share link copied!'
  );

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(toastMsg, {
        icon: React.createElement(Share2, { className: 'w-4 h-4 text-primary' }),
      });
      return true;
    }
  } catch (err) {
    console.warn('[Share] Clipboard API fallback triggered:', err);
  }

  // Fallback for environments where clipboard writeText fails
  try {
    const textArea = document.createElement('textarea');
    textArea.value = shareUrl;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    toast.success(toastMsg, {
      icon: React.createElement(Share2, { className: 'w-4 h-4 text-primary' }),
    });
    return true;
  } catch {
    toast.error('Could not copy link to clipboard');
    return false;
  }
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
