export const config = {
  runtime: 'edge',
};

function escapeHtml(str: string = ''): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

export default async function handler(req: Request) {
  try {
    const url = new URL(req.url);
    const baseUrl = url.origin;

    const rawType = (url.searchParams.get('type') || '').toLowerCase();
    const type: 'song' | 'playlist' | 'artist' | 'album' = 
      rawType === 'playlist' ? 'playlist' :
      rawType === 'artist' ? 'artist' :
      rawType === 'album' ? 'album' : 'song';

    const trackId = url.searchParams.get('id') || url.searchParams.get('videoId') || '';
    const trackTitle = url.searchParams.get('title') || 'Great Music';
    const trackArtist = url.searchParams.get('artist') || url.searchParams.get('channel') || 'NYRA';
    const rawThumbnail = url.searchParams.get('thumbnail') || url.searchParams.get('artwork') || '';
    
    // Choose best thumbnail: provided URL > YouTube HQ > App Fallback
    const trackThumbnail = rawThumbnail || (trackId && type === 'song' ? `https://i.ytimg.com/vi/${trackId}/hqdefault.jpg` : `${baseUrl}/headphones.png`);
    const trackCount = url.searchParams.get('tracks') || '';
    const creator = url.searchParams.get('creator') || '';
    const colorHint = url.searchParams.get('color') || '';

    const appName = "NYRA";
    const themeColor = extractThemeColor(colorHint, trackTitle + trackArtist);

    const safeTitle = escapeHtml(trackTitle);
    const safeArtist = escapeHtml(trackArtist);
    const safeThumbnail = escapeHtml(trackThumbnail);
    const imageType = trackThumbnail.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';

    let description = `✨ ${safeArtist} · ${appName} PREMIUM • FEEL THE PULSE`;
    let redirectUrl = `${baseUrl}/?play=${encodeURIComponent(trackId)}&title=${encodeURIComponent(trackTitle)}&channel=${encodeURIComponent(trackArtist)}&thumbnail=${encodeURIComponent(trackThumbnail)}`;
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
  <meta property="og:image" content="${safeThumbnail}">
  <meta property="og:image:secure_url" content="${safeThumbnail}">
  <meta property="og:image:type" content="${imageType}">
  <meta property="og:image:width" content="1280">
  <meta property="og:image:height" content="720">
  <meta property="og:url" content="${escapeHtml(redirectUrl)}">

  <!-- Twitter / Discord Summary Large Image Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="🎧 ${safeTitle}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${safeThumbnail}">

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
        'cache-control': 'public, max-age=3600, s-maxage=86400',
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
