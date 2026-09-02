import { generateDiscordOgHtml, generateOgImageSvg, OgContentData } from '../src/utils/ogGenerator';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  try {
    const url = new URL(req.url);
    const baseUrl = url.origin;

    const rawType = (url.searchParams.get('type') || '').toLowerCase();
    const type: 'song' | 'playlist' | 'artist' | 'album' = 
      rawType === 'playlist' ? 'playlist' :
      rawType === 'artist' ? 'artist' :
      rawType === 'album' ? 'album' : 'song';

    const id = url.searchParams.get('id') || url.searchParams.get('videoId') || '';
    const title = url.searchParams.get('title') || 'Great Music';
    const artist = url.searchParams.get('artist') || url.searchParams.get('channel') || 'NYRA';
    const thumbnail = url.searchParams.get('thumbnail') || url.searchParams.get('artwork') || (id && type === 'song' ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '');
    const trackCount = url.searchParams.get('tracks') ? parseInt(url.searchParams.get('tracks')!, 10) : undefined;
    const creator = url.searchParams.get('creator') || '';
    const colorHint = url.searchParams.get('color') || '';
    const format = url.searchParams.get('format');

    const data: OgContentData = {
      type,
      id,
      title,
      artist,
      thumbnail,
      trackCount,
      creator,
      colorHint,
      baseUrl,
    };

    if (format === 'image' || format === 'svg' || url.pathname.endsWith('.svg') || url.pathname.includes('/image')) {
      const svg = generateOgImageSvg(data);
      return new Response(svg, {
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=86400, s-maxage=604800',
        },
      });
    }

    const html = generateDiscordOgHtml(data);
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    });
  } catch (err: any) {
    return new Response('Redirecting to NYRA...', {
      status: 302,
      headers: {
        Location: '/',
      },
    });
  }
}
