import React from 'react';
import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

const PRESET_ATMOSPHERES: Record<string, { dominant: string; secondary: string; start: string; mid: string; end: string; glow: string }> = {
  cyan: { dominant: '#00f0ff', secondary: '#0284c7', start: '#041d2f', mid: '#020e1a', end: '#06070a', glow: 'rgba(0, 240, 255, 0.4)' },
  blue: { dominant: '#3b82f6', secondary: '#6366f1', start: '#0d1f42', mid: '#070f24', end: '#05070c', glow: 'rgba(59, 130, 246, 0.4)' },
  purple: { dominant: '#a855f7', secondary: '#d946ef', start: '#250f40', mid: '#140626', end: '#07050a', glow: 'rgba(168, 85, 247, 0.4)' },
  pink: { dominant: '#ec4899', secondary: '#f43f5e', start: '#3b0a24', mid: '#210514', end: '#080406', glow: 'rgba(236, 72, 153, 0.4)' },
  red: { dominant: '#ef4444', secondary: '#f97316', start: '#3b0d10', mid: '#1f0608', end: '#090405', glow: 'rgba(239, 68, 68, 0.4)' },
  emerald: { dominant: '#10b981', secondary: '#06b6d4', start: '#062d20', mid: '#031912', end: '#040806', glow: 'rgba(16, 185, 129, 0.4)' },
  amber: { dominant: '#ffd300', secondary: '#f59e0b', start: '#362402', mid: '#1c1200', end: '#080603', glow: 'rgba(255, 211, 0, 0.4)' },
};

function getAtmosphere(colorHint: string | null, seed: string) {
  if (colorHint) {
    const clean = colorHint.replace(/^#/, '').toLowerCase();
    if (clean.length === 6) {
      const r = parseInt(clean.slice(0, 2), 16);
      const g = parseInt(clean.slice(2, 4), 16);
      const b = parseInt(clean.slice(4, 6), 16);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0;
      if (max !== min) {
        const d = max - min;
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        else if (max === g) h = ((b - r) / d + 2) * 60;
        else h = ((r - g) / d + 4) * 60;
      }
      if (h >= 170 && h < 210) return PRESET_ATMOSPHERES.cyan;
      if (h >= 210 && h < 260) return PRESET_ATMOSPHERES.blue;
      if (h >= 260 && h < 315) return PRESET_ATMOSPHERES.purple;
      if (h >= 315 && h < 345) return PRESET_ATMOSPHERES.pink;
      if (h >= 345 || h < 25) return PRESET_ATMOSPHERES.red;
      if (h >= 25 && h < 75) return PRESET_ATMOSPHERES.amber;
      if (h >= 75 && h < 170) return PRESET_ATMOSPHERES.emerald;
    }
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  const keys = Object.keys(PRESET_ATMOSPHERES);
  return PRESET_ATMOSPHERES[keys[Math.abs(hash) % keys.length]];
}

export default async function handler(req: Request) {
  try {
    const url = new URL(req.url);
    const baseUrl = url.origin;

    const rawType = (url.searchParams.get('type') || '').toLowerCase();
    const type = rawType === 'playlist' ? 'playlist' : rawType === 'artist' ? 'artist' : rawType === 'album' ? 'album' : 'song';

    const id = url.searchParams.get('id') || url.searchParams.get('videoId') || '';
    const title = (url.searchParams.get('title') || 'Great Music').substring(0, 48);
    const artist = (url.searchParams.get('artist') || url.searchParams.get('channel') || 'NYRA').substring(0, 40);
    const rawThumb = url.searchParams.get('thumbnail') || url.searchParams.get('artwork') || '';
    const thumbnail = rawThumb || (id && type === 'song' ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : `${baseUrl}/headphones.png`);
    const trackCount = url.searchParams.get('tracks') || '';
    const colorHint = url.searchParams.get('color');

    const atmosphere = getAtmosphere(colorHint, title + artist);

    let categoryTag = 'HIGH FIDELITY AUDIO';
    let typeBadge = 'NOW PLAYING';
    let subtitleText = artist;

    if (type === 'playlist') {
      typeBadge = 'CURATED PLAYLIST';
      subtitleText = `Curated Collection · ${trackCount || '12+'} Tracks`;
      categoryTag = 'PLAYLIST SPOTLIGHT';
    } else if (type === 'artist') {
      typeBadge = 'VERIFIED ARTIST';
      subtitleText = `${artist} · Official Discography`;
      categoryTag = 'ARTIST PROFILE';
    } else if (type === 'album') {
      typeBadge = 'OFFICIAL ALBUM';
      subtitleText = `${artist} · Lossless Album`;
      categoryTag = 'ALBUM SPOTLIGHT';
    }

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            background: `linear-gradient(135deg, ${atmosphere.start} 0%, ${atmosphere.mid} 50%, ${atmosphere.end} 100%)`,
            padding: '40px 60px',
            fontFamily: 'sans-serif',
            position: 'relative',
          }}
        >
          {/* Neon Orb 1 Top Left */}
          <div
            style={{
              position: 'absolute',
              top: '-80px',
              left: '-80px',
              width: '450px',
              height: '450px',
              borderRadius: '50%',
              background: atmosphere.dominant,
              opacity: 0.25,
            }}
          />

          {/* Neon Orb 2 Bottom Right */}
          <div
            style={{
              position: 'absolute',
              bottom: '-80px',
              right: '-80px',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background: atmosphere.secondary,
              opacity: 0.2,
            }}
          />

          {/* Left Column: Artwork Container */}
          <div
            style={{
              display: 'flex',
              position: 'relative',
              width: '360px',
              height: '360px',
              borderRadius: type === 'artist' ? '50%' : '28px',
              overflow: 'hidden',
              border: `2px solid ${atmosphere.dominant}`,
              boxShadow: `0 20px 50px rgba(0,0,0,0.8)`,
              flexShrink: 0,
            }}
          >
            <img
              src={thumbnail}
              alt="Artwork"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>

          {/* Right Column: Metadata */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              marginLeft: '50px',
              flex: 1,
              overflow: 'hidden',
            }}
          >
            {/* Header: NYRA Logo + FEEL THE PULSE Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <span
                style={{
                  fontSize: '26px',
                  fontWeight: 900,
                  color: '#ffffff',
                  letterSpacing: '-0.02em',
                  marginRight: '14px',
                }}
              >
                NYRA
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '5px 14px',
                  borderRadius: '999px',
                  border: `1.5px solid ${atmosphere.dominant}`,
                  background: 'rgba(255, 255, 255, 0.06)',
                }}
              >
                <div
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: atmosphere.dominant,
                    marginRight: '8px',
                  }}
                />
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: atmosphere.dominant,
                    letterSpacing: '0.22em',
                  }}
                >
                  FEEL THE PULSE
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  marginLeft: 'auto',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#e2e8f0',
                    letterSpacing: '0.12em',
                  }}
                >
                  {typeBadge}
                </span>
              </div>
            </div>

            {/* Category Tag */}
            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: atmosphere.dominant,
                letterSpacing: '0.18em',
                marginBottom: '8px',
              }}
            >
              {categoryTag}
            </span>

            {/* Title */}
            <h1
              style={{
                fontSize: '40px',
                fontWeight: 900,
                color: '#ffffff',
                lineHeight: 1.15,
                margin: '0 0 10px 0',
                maxHeight: '96px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {title}
            </h1>

            {/* Subtitle / Artist */}
            <p
              style={{
                fontSize: '22px',
                fontWeight: 600,
                color: '#cbd5e1',
                margin: '0 0 24px 0',
              }}
            >
              {subtitleText}
            </p>

            {/* Bottom Stream Capsule */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 20px',
                borderRadius: '14px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                width: '100%',
              }}
            >
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: atmosphere.dominant,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '12px',
                }}
              >
                <div
                  style={{
                    width: '0',
                    height: '0',
                    borderTop: '4px solid transparent',
                    borderBottom: '4px solid transparent',
                    borderLeft: '7px solid #000000',
                    marginLeft: '2px',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#ffffff',
                  marginRight: '10px',
                }}
              >
                Listen on NYRA
              </span>
              <span
                style={{
                  fontSize: '13px',
                  color: '#94a3b8',
                }}
              >
                · Lossless Stream · 320kbps High Fidelity
              </span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=604800',
        },
      }
    );
  } catch (err) {
    // If anything fails in ImageResponse, fetch and stream the artwork image or fallback image directly
    try {
      const url = new URL(req.url);
      const thumbnail = url.searchParams.get('thumbnail') || url.searchParams.get('artwork') || '';
      if (thumbnail && thumbnail.startsWith('http')) {
        const imgRes = await fetch(thumbnail);
        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer();
          const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
          return new Response(buffer, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400, s-maxage=604800',
            },
          });
        }
      }
    } catch {}

    return new Response('Image generation error', { status: 500 });
  }
}
