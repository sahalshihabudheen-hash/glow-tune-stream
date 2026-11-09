function escapeHtml(str: string = ''): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const decodeEntities = (s: string): string =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Short links (/api/og?id=VIDEOID) carry no title, so look it up on YouTube's public oEmbed endpoint. */
async function fetchYoutubeMeta(id: string): Promise<{ title: string; artist: string; thumbnail: string } | null> {
  const watchUrl = encodeURIComponent(`https://www.youtube.com/watch?v=${id}`);
  // YouTube's oEmbed is flaky from serverless IPs, so ask it and noembed.com at the same time and take the first
  // good answer. Discord's crawler gives up after a few seconds, so the whole lookup stays under 2s.
  const ask = async (endpoint: string) => {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) throw new Error(`oembed ${res.status}`);
    const d = await res.json();
    if (typeof d?.title !== 'string' || !d.title) throw new Error('no title');
    return { title: d.title as string, artist: String(d.author_name || ''), thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
  };
  try {
    return await Promise.any([
      ask(`https://www.youtube.com/oembed?url=${watchUrl}&format=json`),
      ask(`https://noembed.com/embed?url=${watchUrl}`),
    ]);
  } catch {
    return null;
  }
}

const PRESET_COLORS = ['#ffd300', '#00f0ff', '#3b82f6', '#a855f7', '#ec4899', '#ef4444', '#10b981'];

function extractThemeColor(colorHint: string | null, seed: string): string {
  if (colorHint) {
    const clean = colorHint.trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{6}$/.test(clean) || /^[0-9a-fA-F]{3}$/.test(clean)) {
      return `#${clean}`;
    }
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PRESET_COLORS[Math.abs(hash) % PRESET_COLORS.length];
}

async function handler(req: Request) {
  try {
    const url = new URL(req.url);
    const baseUrl = url.origin;

    const rawType = (url.searchParams.get('type') || '').toLowerCase();
    const type: 'song' | 'playlist' | 'artist' | 'album' = 
      rawType === 'playlist' ? 'playlist' :
      rawType === 'artist' ? 'artist' :
      rawType === 'album' ? 'album' : 'song';

    const trackId = url.searchParams.get('id') || url.searchParams.get('videoId') || '';
    let trackTitle = decodeEntities(url.searchParams.get('title') || 'Great Music');
    let trackArtist = decodeEntities(url.searchParams.get('artist') || url.searchParams.get('channel') || 'NYRA');
    let rawThumbnail = url.searchParams.get('thumbnail') || url.searchParams.get('artwork') || '';
    
    // Short link: only an id was given, so fill in the details ourselves.
    let metaLookupFailed = false;
    if (type === 'song' && !url.searchParams.get('title') && /^[\w-]{11}$/.test(trackId)) {
      const meta = await fetchYoutubeMeta(trackId);
      if (meta) {
        trackTitle = decodeEntities(meta.title);
        trackArtist = decodeEntities(meta.artist) || trackArtist;
        rawThumbnail = rawThumbnail || meta.thumbnail;
      } else {
        metaLookupFailed = true;
      }
    }

    // Choose best thumbnail: provided URL > YouTube HQ > App Fallback
    const trackThumbnail = rawThumbnail || (trackId && type === 'song' ? `https://i.ytimg.com/vi/${trackId}/hqdefault.jpg` : `${baseUrl}/headphones.png`);
    const trackCount = url.searchParams.get('tracks') || '';
    const creator = url.searchParams.get('creator') || '';
    const colorHint = url.searchParams.get('color') || '';

    const appName = "NYRA";
    const themeColor = extractThemeColor(colorHint, trackTitle + trackArtist);

    // Branded 1200x630 card (artwork + title + waveform) instead of the raw video thumbnail.
    const cardParams = new URLSearchParams({ type, title: trackTitle, artist: trackArtist, color: themeColor.replace('#', '') });
    if (trackId) cardParams.set('id', trackId);
    if (rawThumbnail) cardParams.set('thumbnail', rawThumbnail);
    if (trackCount) cardParams.set('tracks', trackCount);
    if (creator) cardParams.set('creator', creator);
    const cardUrl = `${baseUrl}/api/og-image?${cardParams.toString()}`;

    const safeTitle = escapeHtml(trackTitle);
    const safeArtist = escapeHtml(trackArtist);
    const safeThumbnail = escapeHtml(trackThumbnail);
    const safeCard = escapeHtml(cardUrl);

    let description = `✨ ${safeArtist} · ${appName} PREMIUM • FEEL THE PULSE`;
    const isYoutubeTrack = type === 'song' && /^[\w-]{11}$/.test(trackId);
    let redirectUrl = isYoutubeTrack
      ? `https://music.youtube.com/watch?v=${encodeURIComponent(trackId)}`
      : `${baseUrl}/?play=${encodeURIComponent(trackId)}&title=${encodeURIComponent(trackTitle)}&channel=${encodeURIComponent(trackArtist)}&thumbnail=${encodeURIComponent(trackThumbnail)}`;
    let ogType = 'music.song';

    if (type === 'playlist') {
      ogType = 'music.playlist';
      description = `💿 ${safeTitle} (${trackCount || 'Collection'} tracks) · Curated by ${escapeHtml(creator || 'NYRA')}`;
      redirectUrl = `${baseUrl}/playlist/${encodeURIComponent(trackId)}`;
    } else if (type === 'artist') {
      ogType = 'profile';
      description = `🎤 ${safeArtist} · Official Discography & Tracks on ${appName}`;
      redirectUrl = `${baseUrl}/artist/${encodeURIComponent(trackId)}`;
    } else if (type === 'album') {
      ogType = 'music.album';
      description = `🎵 ${safeTitle} by ${safeArtist} · Stream lossless on ${appName}`;
      redirectUrl = `${baseUrl}/?search=${encodeURIComponent(trackTitle)}`;
    }

    // Call to action under every preview: send listeners to the app's home page.
    description += `\n🎶 Listen to more music — visit ${appName}: ${escapeHtml(baseUrl)}`;

    // Keep song previews as image cards. The actual track link always points to YouTube Music.
    let videoTags = '';
    let twitterCard = 'summary_large_image';
    let cacheControl = 'public, max-age=3600, s-maxage=86400';
    if (metaLookupFailed) cacheControl = 'public, max-age=30, s-maxage=30';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>🎧 ${safeTitle} - ${safeArtist} | ${appName}</title>
  
  <!-- Primary Meta Tags -->
  <meta name="title" content="🎧 ${safeTitle} - ${safeArtist}">
  <meta name="description" content="${description}">

  <!-- Open Graph Meta Tags for Discord & Social Embeds -->
  <meta property="og:site_name" content="${appName} • FEEL THE PULSE">
  <meta property="og:type" content="${ogType}">
  <meta property="og:title" content="🎧 ${safeTitle}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${safeCard}">
  <meta property="og:image:secure_url" content="${safeCard}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${safeTitle} by ${safeArtist} on ${appName}">
  <meta property="og:url" content="${escapeHtml(redirectUrl)}">${videoTags}

  <!-- Twitter / Discord Summary Large Image Card -->
  <meta name="twitter:card" content="${twitterCard}">
  <meta name="twitter:title" content="🎧 ${safeTitle}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${safeCard}">

  <!-- Dynamic Theme Color based on Artwork -->
  <meta name="theme-color" content="${themeColor}">
  
  <!-- Instant Redirection for Humans Visiting Link -->
  <meta http-equiv="refresh" content="0;url=${redirectUrl}">
  <script>
    if (typeof window !== 'undefined' && !navigator.userAgent.match(/(Discordbot|Twitterbot|facebookexternalhit|Slackbot|TelegramBot|WhatsApp)/i)) {
      window.location.replace(${JSON.stringify(redirectUrl)});
    }
  </script>
</head>
<body style="background: #090a10; color: white; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0;">
  <div style="text-align: center; max-width: 480px; padding: 32px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; box-shadow: 0 30px 60px rgba(0,0,0,0.6);">
    <img src="${safeThumbnail}" alt="Artwork" style="width: 180px; height: 180px; border-radius: 20px; object-fit: cover; margin-bottom: 20px; box-shadow: 0 12px 30px rgba(0,0,0,0.5);">
    <div style="font-size: 11px; font-weight: 800; color: ${themeColor}; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 8px;">${appName} • FEEL THE PULSE</div>
    <h1 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 800;">${safeTitle}</h1>
    <p style="margin: 0 0 24px 0; color: #94a3b8; font-size: 15px;">${safeArtist}</p>
    <a href="${redirectUrl}" style="display: inline-block; background: ${themeColor}; color: #000000; font-weight: 800; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 999px; box-shadow: 0 4px 20px rgba(0,0,0,0.4);">
      Open in ${appName}
    </a>
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=UTF-8',
        'cache-control': cacheControl,
      },
    });
  } catch (err) {
    return new Response('Redirecting to NYRA...', {
      status: 302,
      headers: {
        Location: '/',
      },
    });
  }
}

// Node.js runtime web handler (the Edge runtime rejects these modules at deploy time).
export default { fetch: handler };
