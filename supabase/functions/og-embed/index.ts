import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const rawType = (url.searchParams.get('type') || '').toLowerCase();
    const type = rawType === 'playlist' ? 'playlist' : rawType === 'artist' ? 'artist' : rawType === 'album' ? 'album' : 'song';

    const trackId = url.searchParams.get('id') || url.searchParams.get('videoId') || '';
    const trackTitle = url.searchParams.get('title') || 'Great Music';
    const trackChannel = url.searchParams.get('channel') || url.searchParams.get('artist') || 'NYRA';
    const trackThumbnail = url.searchParams.get('thumbnail') || url.searchParams.get('artwork') || '';
    const trackCount = url.searchParams.get('tracks') || '';
    const creator = url.searchParams.get('creator') || '';
    const colorParam = url.searchParams.get('color') || '';

    // Fetch app settings for branding
    let appName = 'NYRA';
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceKey) {
        const supabase = createClient(supabaseUrl, serviceKey);
        const { data } = await supabase
          .from('app_settings')
          .select('key, value')
          .in('key', ['app_name']);
        
        data?.forEach((row: any) => {
          if (row.key === 'app_name' && typeof row.value === 'string') appName = row.value;
        });
      }
    } catch {}

    const esc = (s: string) =>
      String(s || '')
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const safeTrackId = /^[A-Za-z0-9_-]{1,64}$/.test(trackId || "") ? trackId : "";
    const rawThumbnail = trackThumbnail || (safeTrackId && type === 'song' ? `https://img.youtube.com/vi/${safeTrackId}/hqdefault.jpg` : "");
    const safeThumbnail = /^https?:\/\//i.test(rawThumbnail) ? esc(rawThumbnail) : "";
    const safeTitle = esc(trackTitle);
    const safeChannel = esc(trackChannel);
    const safeAppName = esc(appName);
    const redirectBase = url.origin.replace("/functions/v1/og-embed", "");

    // Dynamic dominant theme color determination
    let themeColor = '#00f0ff';
    if (colorParam) {
      themeColor = colorParam.startsWith('#') ? colorParam : `#${colorParam}`;
    } else {
      let hash = 0;
      const str = trackTitle + trackChannel;
      for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
      const colors = ['#00f0ff', '#3b82f6', '#a855f7', '#ec4899', '#ef4444', '#10b981', '#ffd300'];
      themeColor = colors[Math.abs(hash) % colors.length];
    }

    let ogType = 'music.song';
    let description = `✨ ${safeChannel} · ${safeAppName} PREMIUM • FEEL THE PULSE`;
    let targetUrl = `${redirectBase}/?play=${esc(safeTrackId)}&title=${encodeURIComponent(trackTitle)}&channel=${encodeURIComponent(trackChannel)}&thumbnail=${encodeURIComponent(rawThumbnail)}`;

    if (type === 'playlist') {
      ogType = 'music.playlist';
      description = `💿 ${safeTitle} (${trackCount || 'Collection'} tracks) · Curated on ${safeAppName}`;
      targetUrl = `${redirectBase}/playlist/${esc(safeTrackId)}`;
    } else if (type === 'artist') {
      ogType = 'profile';
      description = `🎤 ${safeChannel} · Official Discography on ${safeAppName}`;
      targetUrl = `${redirectBase}/artist/${esc(safeTrackId)}`;
    } else if (type === 'album') {
      ogType = 'music.album';
      description = `🎵 ${safeTitle} by ${safeChannel} · Stream on ${safeAppName}`;
      targetUrl = `${redirectBase}/?search=${encodeURIComponent(trackTitle)}`;
    }

    const ogImageUrl = safeThumbnail || `${redirectBase}/api/og-image?title=${encodeURIComponent(trackTitle)}&artist=${encodeURIComponent(trackChannel)}&type=${type}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>🎧 ${safeTitle} - ${safeChannel} | ${safeAppName}</title>
  
  <meta property="og:title" content="🎧 ${safeTitle}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:type" content="${ogType}" />
  <meta property="og:site_name" content="${safeAppName} • FEEL THE PULSE" />
  <meta property="og:url" content="${esc(targetUrl)}" />
  
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="🎧 ${safeTitle}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${ogImageUrl}" />
  
  <meta name="theme-color" content="${themeColor}" />
  <meta http-equiv="refresh" content="0;url=${esc(targetUrl)}" />
</head>
<body style="background: #090a10; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
  <p>Redirecting to ${safeAppName}...</p>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch {
    return new Response('Redirecting to NYRA...', {
      status: 302,
      headers: { Location: '/' },
    });
  }
});
