/**
 * NYRA Music - Premium Discord Open Graph Image & Metadata Generator
 * Generates dynamic, artwork-themed 1200x630 previews for Songs, Playlists, Artists, and Albums.
 */

export interface OgContentData {
  type: 'song' | 'playlist' | 'artist' | 'album';
  id?: string;
  title: string;
  artist?: string;
  thumbnail?: string;
  trackCount?: number;
  creator?: string;
  colorHint?: string;
  baseUrl: string;
}

export interface ColorAtmosphere {
  dominant: string;       // Hex e.g. "#3b82f6"
  secondary: string;      // Hex e.g. "#8b5cf6"
  accent: string;         // Hex e.g. "#00f0ff"
  glow: string;           // Rgba string
  gradientStart: string;  // Deep atmosphere dark hex
  gradientMid: string;    // Deep mid hex
  gradientEnd: string;    // Obsidian hex
  themeColor: string;     // Hex for Discord theme-color
}

// Preset color atmosphere mappings based on seed/hue
const PRESET_ATMOSPHERES: Record<string, ColorAtmosphere> = {
  cyan: {
    dominant: '#00f0ff',
    secondary: '#0284c7',
    accent: '#38bdf8',
    glow: 'rgba(0, 240, 255, 0.45)',
    gradientStart: '#041d2f',
    gradientMid: '#020e1a',
    gradientEnd: '#06070a',
    themeColor: '#00f0ff',
  },
  blue: {
    dominant: '#3b82f6',
    secondary: '#6366f1',
    accent: '#60a5fa',
    glow: 'rgba(59, 130, 246, 0.45)',
    gradientStart: '#0d1f42',
    gradientMid: '#070f24',
    gradientEnd: '#05070c',
    themeColor: '#3b82f6',
  },
  purple: {
    dominant: '#a855f7',
    secondary: '#d946ef',
    accent: '#c084fc',
    glow: 'rgba(168, 85, 247, 0.45)',
    gradientStart: '#250f40',
    gradientMid: '#140626',
    gradientEnd: '#07050a',
    themeColor: '#a855f7',
  },
  pink: {
    dominant: '#ec4899',
    secondary: '#f43f5e',
    accent: '#f472b6',
    glow: 'rgba(236, 72, 153, 0.45)',
    gradientStart: '#3b0a24',
    gradientMid: '#210514',
    gradientEnd: '#080406',
    themeColor: '#ec4899',
  },
  red: {
    dominant: '#ef4444',
    secondary: '#f97316',
    accent: '#f87171',
    glow: 'rgba(239, 68, 68, 0.45)',
    gradientStart: '#3b0d10',
    gradientMid: '#1f0608',
    gradientEnd: '#090405',
    themeColor: '#ef4444',
  },
  emerald: {
    dominant: '#10b981',
    secondary: '#06b6d4',
    accent: '#34d399',
    glow: 'rgba(16, 185, 129, 0.45)',
    gradientStart: '#062d20',
    gradientMid: '#031912',
    gradientEnd: '#040806',
    themeColor: '#10b981',
  },
  amber: {
    dominant: '#ffd300',
    secondary: '#f59e0b',
    accent: '#fde047',
    glow: 'rgba(255, 211, 0, 0.45)',
    gradientStart: '#362402',
    gradientMid: '#1c1200',
    gradientEnd: '#080603',
    themeColor: '#ffd300',
  },
};

/**
 * Derives color atmosphere from color hint or text seed
 */
export function getColorAtmosphere(colorHint?: string, seed?: string): ColorAtmosphere {
  if (colorHint) {
    const cleanHex = colorHint.replace(/^#/, '').toLowerCase();
    if (cleanHex.length === 6) {
      const r = parseInt(cleanHex.slice(0, 2), 16);
      const g = parseInt(cleanHex.slice(2, 4), 16);
      const b = parseInt(cleanHex.slice(4, 6), 16);
      
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

  // Use seed hash
  const str = seed || 'nyra';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const keys = Object.keys(PRESET_ATMOSPHERES);
  const selectedKey = keys[Math.abs(hash) % keys.length];
  return PRESET_ATMOSPHERES[selectedKey];
}

/**
 * Escapes XML/HTML text safely
 */
export function escapeXml(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Truncates text cleanly for vector rendering
 */
export function truncateText(str: string, maxLength: number): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 1) + '…';
}

/**
 * Generates an SVG fallback image for missing artwork
 */
function getFallbackArtworkSvg(color: ColorAtmosphere): string {
  return `
    <rect width="100%" height="100%" fill="${color.gradientMid}" rx="20"/>
    <circle cx="50%" cy="50%" r="90" fill="${color.gradientStart}" stroke="${color.dominant}" stroke-width="2" stroke-opacity="0.4"/>
    <circle cx="50%" cy="50%" r="35" fill="${color.dominant}" fill-opacity="0.2"/>
    <path d="M 50% 35% L 50% 65%" stroke="${color.dominant}" stroke-width="4" stroke-linecap="round"/>
    <!-- Headphone Icon in SVG -->
    <path d="M 140 180 C 140 120, 220 120, 220 180 L 220 210 C 220 225, 205 235, 190 235 L 180 235 C 170 235, 160 225, 160 215 L 160 195 C 160 185, 170 175, 180 175 L 190 175 C 190 145, 170 145, 170 145 C 170 145, 150 145, 150 175 L 160 175 C 170 175, 180 185, 180 195 L 180 215 C 180 225, 170 235, 160 235 L 150 235 C 135 235, 120 225, 120 210 Z" fill="${color.dominant}" transform="translate(45, 25) scale(0.8)"/>
  `;
}

/**
 * Generates dynamic soundwave visualizer bars
 */
function generateSoundwaveBars(color: ColorAtmosphere, count = 28): string {
  const bars: string[] = [];
  const startX = 470;
  const baseY = 405;
  const barWidth = 6;
  const gap = 8;

  // Preset harmonic heights
  const heights = [22, 38, 54, 42, 68, 85, 52, 34, 76, 92, 60, 44, 70, 88, 56, 36, 62, 80, 48, 30, 58, 72, 46, 28, 50, 64, 38, 24];

  for (let i = 0; i < count; i++) {
    const x = startX + i * (barWidth + gap);
    const h = heights[i % heights.length];
    const y = baseY - h / 2;
    const opacity = 0.5 + 0.5 * Math.sin((i / count) * Math.PI);
    bars.push(
      `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="3" fill="url(#soundwaveGrad)" opacity="${opacity.toFixed(2)}"/>`
    );
  }
  return bars.join('\n');
}

/**
 * Builds the 1200x630 Discord Open Graph Vector Image (SVG)
 */
export function generateOgImageSvg(data: OgContentData): string {
  const color = getColorAtmosphere(data.colorHint, data.title + (data.artist || ''));
  const safeTitle = escapeXml(truncateText(data.title, 42));
  const safeArtist = escapeXml(truncateText(data.artist || 'NYRA', 36));
  const safeCreator = escapeXml(truncateText(data.creator || 'NYRA Community', 32));
  const trackCount = data.trackCount || 12;

  // Determine artwork image source
  const artworkHref = data.thumbnail && data.thumbnail.startsWith('http')
    ? escapeXml(data.thumbnail)
    : '';

  // Content type specific subtitle & badge
  let typeBadge = 'NOW PLAYING';
  let subText = safeArtist;
  let categoryTag = 'HIGH FIDELITY AUDIO';

  if (data.type === 'playlist') {
    typeBadge = 'FEATURED PLAYLIST';
    subText = `Curated by ${safeCreator}`;
    categoryTag = `${trackCount} TRACKS · FULL PLAYLIST`;
  } else if (data.type === 'artist') {
    typeBadge = 'VERIFIED ARTIST';
    subText = `${safeArtist} · Official Discography`;
    categoryTag = 'ARTIST SPOTLIGHT';
  } else if (data.type === 'album') {
    typeBadge = 'OFFICIAL ALBUM';
    subText = `${safeArtist} · ${trackCount} Tracks`;
    categoryTag = 'LOSSLESS ALBUM';
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <!-- Atmosphere Gradients -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color.gradientStart}"/>
      <stop offset="50%" stop-color="${color.gradientMid}"/>
      <stop offset="100%" stop-color="${color.gradientEnd}"/>
    </linearGradient>

    <radialGradient id="auraGlowTopLeft" cx="15%" cy="20%" r="55%">
      <stop offset="0%" stop-color="${color.dominant}" stop-opacity="0.35"/>
      <stop offset="60%" stop-color="${color.dominant}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="${color.dominant}" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="auraGlowCenter" cx="45%" cy="50%" r="65%">
      <stop offset="0%" stop-color="${color.secondary}" stop-opacity="0.25"/>
      <stop offset="70%" stop-color="${color.secondary}" stop-opacity="0.03"/>
      <stop offset="100%" stop-color="${color.secondary}" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="auraGlowBottomRight" cx="85%" cy="80%" r="50%">
      <stop offset="0%" stop-color="${color.accent}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${color.accent}" stop-opacity="0"/>
    </radialGradient>

    <linearGradient id="primaryTextGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f1f5f9"/>
    </linearGradient>

    <linearGradient id="neonTextGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${color.dominant}"/>
      <stop offset="100%" stop-color="${color.accent}"/>
    </linearGradient>

    <linearGradient id="soundwaveGrad" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="${color.dominant}"/>
      <stop offset="50%" stop-color="${color.secondary}"/>
      <stop offset="100%" stop-color="${color.accent}"/>
    </linearGradient>

    <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color.dominant}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${color.secondary}" stop-opacity="0.05"/>
    </linearGradient>

    <filter id="artworkShadow" x="-20%" y="-20%" width="150%" height="150%">
      <feDropShadow dx="0" dy="16" stdDeviation="28" flood-color="${color.dominant}" flood-opacity="0.4"/>
      <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#000000" flood-opacity="0.8"/>
    </filter>

    <filter id="neonGlowFilter" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Clip path for rounded artwork -->
    <clipPath id="artworkClip">
      <rect x="75" y="135" width="350" height="350" rx="24" ry="24"/>
    </clipPath>

    <!-- Clip path for circular artist avatar -->
    <clipPath id="artistAvatarClip">
      <circle cx="250" cy="310" r="165"/>
    </clipPath>

    <!-- Clip path for playlist collage 1 -->
    <clipPath id="playlistClip1">
      <rect x="75" y="155" width="230" height="230" rx="20"/>
    </clipPath>
    <!-- Clip path for playlist collage 2 -->
    <clipPath id="playlistClip2">
      <rect x="215" y="215" width="220" height="220" rx="20"/>
    </clipPath>
  </defs>

  <style>
    .font-sans { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
    .font-display { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-weight: 900; }
    .neon-pulse { letter-spacing: 0.28em; font-weight: 800; font-size: 11px; }
  </style>

  <!-- Base Dark Canvas -->
  <rect width="1200" height="630" fill="url(#bgGrad)"/>
  
  <!-- Atmospheric Neon Auras -->
  <rect width="1200" height="630" fill="url(#auraGlowTopLeft)"/>
  <rect width="1200" height="630" fill="url(#auraGlowCenter)"/>
  <rect width="1200" height="630" fill="url(#auraGlowBottomRight)"/>

  <!-- Subtle Futuristic Grid Lines -->
  <g opacity="0.07" stroke="#ffffff" stroke-width="1">
    <line x1="0" y1="90" x2="1200" y2="90"/>
    <line x1="0" y1="540" x2="1200" y2="540"/>
    <line x1="450" y1="90" x2="450" y2="540"/>
  </g>

  <!-- ================= TOP HEADER BAR ================= -->
  <g transform="translate(75, 45)">
    <!-- NYRA Logo Wordmark -->
    <text x="0" y="24" class="font-display font-sans" font-size="28" font-weight="900" fill="#ffffff" letter-spacing="-0.03em">NYRA</text>
    
    <!-- Neon Pulsing Badge: FEEL THE PULSE -->
    <g transform="translate(95, 2)">
      <rect x="0" y="0" width="165" height="26" rx="13" fill="url(#badgeGrad)" stroke="${color.dominant}" stroke-width="1.2" stroke-opacity="0.6"/>
      <circle cx="14" cy="13" r="4" fill="${color.dominant}" filter="url(#neonGlowFilter)"/>
      <text x="26" y="17" class="font-sans neon-pulse" fill="${color.dominant}">FEEL THE PULSE</text>
    </g>

    <!-- Top Right Status Badges -->
    <g transform="translate(850, 2)">
      <!-- Type Badge -->
      <rect x="0" y="0" width="180" height="26" rx="6" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.15" stroke-width="1"/>
      <text x="90" y="17" class="font-sans" font-size="11" font-weight="700" fill="#e2e8f0" text-anchor="middle" letter-spacing="0.12em">${typeBadge}</text>
    </g>
  </g>

  <!-- ================= MAIN CONTENT BODY ================= -->
  ${data.type === 'artist' ? `
    <!-- ARTIST LAYOUT: Circular Glowing Avatar -->
    <g>
      <!-- Double Neon Halo Rings -->
      <circle cx="250" cy="310" r="182" fill="none" stroke="${color.dominant}" stroke-width="2.5" stroke-opacity="0.8" stroke-dasharray="8 6" filter="url(#neonGlowFilter)"/>
      <circle cx="250" cy="310" r="172" fill="none" stroke="${color.secondary}" stroke-width="1.5" stroke-opacity="0.5"/>
      
      <!-- Artist Image or Fallback -->
      ${artworkHref ? `
        <image href="${artworkHref}" x="85" y="145" width="330" height="330" preserveAspectRatio="xMidYMid slice" clip-path="url(#artistAvatarClip)"/>
      ` : `
        <g clip-path="url(#artistAvatarClip)">
          ${getFallbackArtworkSvg(color)}
        </g>
      `}
      <circle cx="250" cy="310" r="165" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>
      
      <!-- Verified Badge Icon Overlay -->
      <g transform="translate(205, 445)">
        <rect x="0" y="0" width="90" height="24" rx="12" fill="${color.dominant}" filter="url(#neonGlowFilter)"/>
        <text x="45" y="16" class="font-sans" font-size="11" font-weight="900" fill="#000000" text-anchor="middle" letter-spacing="0.08em">VERIFIED</text>
      </g>
    </g>
  ` : data.type === 'playlist' ? `
    <!-- PLAYLIST LAYOUT: Multi-Cover Collage / Stacked Cards -->
    <g>
      <!-- Layer 1 Back Card -->
      <g transform="rotate(-6 190 270)" opacity="0.75" filter="url(#artworkShadow)">
        <rect x="65" y="145" width="250" height="250" rx="20" fill="${color.gradientMid}" stroke="rgba(255,255,255,0.15)"/>
        ${artworkHref ? `
          <image href="${artworkHref}" x="65" y="145" width="250" height="250" preserveAspectRatio="xMidYMid slice" rx="20" opacity="0.6"/>
        ` : ''}
      </g>

      <!-- Layer 2 Front Card -->
      <g filter="url(#artworkShadow)">
        <rect x="150" y="180" width="270" height="270" rx="22" fill="${color.gradientMid}" stroke="${color.dominant}" stroke-width="1.5" stroke-opacity="0.5"/>
        ${artworkHref ? `
          <image href="${artworkHref}" x="150" y="180" width="270" height="270" preserveAspectRatio="xMidYMid slice" clip-path="url(#playlistClip2)"/>
        ` : `
          <g clip-path="url(#playlistClip2)">
            ${getFallbackArtworkSvg(color)}
          </g>
        `}
        <rect x="150" y="180" width="270" height="270" rx="22" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
      </g>

      <!-- Playlist Track Count Badge -->
      <g transform="translate(165, 410)">
        <rect x="0" y="0" width="130" height="28" rx="8" fill="#000000" fill-opacity="0.75" stroke="${color.dominant}" stroke-width="1"/>
        <text x="65" y="18" class="font-sans" font-size="12" font-weight="800" fill="${color.dominant}" text-anchor="middle">💿 ${trackCount} TRACKS</text>
      </g>
    </g>
  ` : `
    <!-- SONG / ALBUM LAYOUT: Square Artwork with Vinyl disc peak -->
    <g>
      <!-- Vinyl Disc Emerging Behind Artwork -->
      <g transform="translate(190, 145)" opacity="0.85">
        <circle cx="165" cy="165" r="155" fill="#111218" stroke="#252836" stroke-width="3"/>
        <circle cx="165" cy="165" r="140" fill="none" stroke="#1f2230" stroke-width="1.5"/>
        <circle cx="165" cy="165" r="120" fill="none" stroke="#1f2230" stroke-width="1.5"/>
        <circle cx="165" cy="165" r="100" fill="none" stroke="#1f2230" stroke-width="1.5"/>
        <circle cx="165" cy="165" r="80" fill="none" stroke="#1f2230" stroke-width="1.5"/>
        <circle cx="165" cy="165" r="55" fill="${color.dominant}" fill-opacity="0.3" stroke="${color.dominant}" stroke-width="2"/>
        <circle cx="165" cy="165" r="14" fill="#090a10"/>
      </g>

      <!-- Main Artwork with Shadow & Glass Border -->
      <g filter="url(#artworkShadow)">
        <rect x="75" y="135" width="350" height="350" rx="24" fill="${color.gradientMid}"/>
        ${artworkHref ? `
          <image href="${artworkHref}" x="75" y="135" width="350" height="350" preserveAspectRatio="xMidYMid slice" clip-path="url(#artworkClip)"/>
        ` : `
          <g clip-path="url(#artworkClip)">
            ${getFallbackArtworkSvg(color)}
          </g>
        `}
        <!-- Glass shine & border -->
        <rect x="75" y="135" width="350" height="350" rx="24" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
      </g>
    </g>
  `}

  <!-- ================= RIGHT COLUMN: METADATA & SOUNDWAVES ================= -->
  <g transform="translate(470, 140)">
    <!-- Category / Vibe Tag -->
    <g transform="translate(0, 0)">
      <text x="0" y="18" class="font-sans" font-size="12" font-weight="800" fill="${color.dominant}" letter-spacing="0.2em">
        ${categoryTag}
      </text>
    </g>

    <!-- Main Title (Large, Bold typography) -->
    <g transform="translate(0, 55)">
      <text x="0" y="30" class="font-display font-sans" font-size="38" font-weight="900" fill="url(#primaryTextGrad)" letter-spacing="-0.02em">
        ${safeTitle}
      </text>
    </g>

    <!-- Subtitle (Artist / Creator) -->
    <g transform="translate(0, 115)">
      <text x="0" y="22" class="font-sans" font-size="22" font-weight="600" fill="#cbd5e1">
        ${subText}
      </text>
    </g>

    <!-- Dynamic Soundwave Visualizer Bars -->
    <g transform="translate(0, 150)">
      ${generateSoundwaveBars(color, 24)}
    </g>

    <!-- Bottom Audio Quality & Stream Call to Action Capsule -->
    <g transform="translate(0, 275)">
      <rect x="0" y="0" width="655" height="52" rx="14" fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1"/>
      
      <!-- Audio wave indicator icon -->
      <g transform="translate(18, 16)">
        <circle cx="10" cy="10" r="9" fill="${color.dominant}" fill-opacity="0.2"/>
        <polygon points="8,6 14,10 8,14" fill="${color.dominant}"/>
      </g>
      
      <text x="48" y="31" class="font-sans" font-size="14" font-weight="700" fill="#ffffff">
        Listen on NYRA
      </text>
      
      <text x="165" y="31" class="font-sans" font-size="13" font-weight="500" fill="#94a3b8">
        · Lossless Stream · 320kbps High Fidelity
      </text>

      <!-- Neon Accent Pill at Right -->
      <g transform="translate(540, 14)">
        <rect x="0" y="0" width="95" height="24" rx="12" fill="${color.dominant}" fill-opacity="0.2" stroke="${color.dominant}" stroke-width="1"/>
        <text x="47" y="16" class="font-sans" font-size="11" font-weight="800" fill="${color.dominant}" text-anchor="middle">STREAM</text>
      </g>
    </g>
  </g>
</svg>`;
}

/**
 * Builds the complete HTML with Open Graph, Twitter Cards, Discord dynamic theme-color, and SPA redirection.
 */
export function generateDiscordOgHtml(data: OgContentData): string {
  const color = getColorAtmosphere(data.colorHint, data.title + (data.artist || ''));
  const safeTitle = escapeXml(data.title || 'Great Music');
  const safeArtist = escapeXml(data.artist || 'NYRA');
  const safeAppName = 'NYRA';
  const trackId = data.id || '';

  // Canonical OG image URL pointing to our dynamic 1200x630 vector image renderer
  const imageParams = new URLSearchParams();
  imageParams.set('type', data.type || 'song');
  if (data.id) imageParams.set('id', data.id);
  imageParams.set('title', data.title);
  if (data.artist) imageParams.set('artist', data.artist);
  if (data.thumbnail) imageParams.set('thumbnail', data.thumbnail);
  if (data.trackCount) imageParams.set('tracks', String(data.trackCount));
  if (data.creator) imageParams.set('creator', data.creator);
  if (color.dominant) imageParams.set('color', color.dominant.replace('#', ''));

  const ogImageUrl = `${data.baseUrl}/api/og-image?${imageParams.toString()}`;

  // Build target client redirect URL based on content type
  let redirectUrl = `${data.baseUrl}/`;
  let ogType = 'music.song';
  let description = `✨ ${safeArtist} · NYRA PREMIUM • FEEL THE PULSE`;

  if (data.type === 'playlist') {
    redirectUrl = `${data.baseUrl}/playlist/${trackId}`;
    ogType = 'music.playlist';
    description = `💿 ${data.title} (${data.trackCount || 'Collection'} tracks) · Curated on NYRA`;
  } else if (data.type === 'artist') {
    redirectUrl = `${data.baseUrl}/artist/${trackId}`;
    ogType = 'profile';
    description = `🎤 ${safeArtist} · Listen to official discography and tracks on NYRA`;
  } else if (data.type === 'album') {
    redirectUrl = `${data.baseUrl}/?search=${encodeURIComponent(data.title)}`;
    ogType = 'music.album';
    description = `🎵 ${data.title} by ${safeArtist} · Lossless streaming on NYRA`;
  } else {
    // Default song
    redirectUrl = `${data.baseUrl}/?play=${encodeURIComponent(trackId)}&title=${encodeURIComponent(data.title)}&channel=${encodeURIComponent(data.artist || 'NYRA')}&thumbnail=${encodeURIComponent(data.thumbnail || '')}`;
    ogType = 'music.song';
    description = `✨ ${safeArtist} · NYRA PREMIUM • FEEL THE PULSE`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🎧 ${safeTitle} - ${safeArtist} | NYRA</title>
  
  <!-- Primary Meta Tags -->
  <meta name="title" content="🎧 ${safeTitle} - ${safeArtist}">
  <meta name="description" content="${description}">

  <!-- Open Graph / Discord Embed Metadata -->
  <meta property="og:site_name" content="NYRA • FEEL THE PULSE">
  <meta property="og:type" content="${ogType}">
  <meta property="og:title" content="🎧 ${safeTitle}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/svg+xml">
  <meta property="og:url" content="${redirectUrl}">

  <!-- Twitter Card Metadata -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="🎧 ${safeTitle}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${ogImageUrl}">

  <!-- Discord Dynamic Border Theme Color (Extracted from Artwork) -->
  <meta name="theme-color" content="${color.themeColor}">
  
  <!-- Instant Redirection for Humans Visiting Link -->
  <meta http-equiv="refresh" content="0;url=${redirectUrl}">
  <script>
    if (typeof window !== 'undefined' && !navigator.userAgent.match(/(Discordbot|Twitterbot|facebookexternalhit|Slackbot|TelegramBot|WhatsApp)/i)) {
      window.location.replace(${JSON.stringify(redirectUrl)});
    }
  </script>
</head>
<body style="margin: 0; background: #08090e; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh;">
  <div style="text-align: center; max-width: 480px; padding: 32px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; box-shadow: 0 30px 60px rgba(0,0,0,0.6);">
    ${data.thumbnail ? `<img src="${escapeXml(data.thumbnail)}" alt="Artwork" style="width: 180px; height: 180px; border-radius: 20px; object-fit: cover; margin-bottom: 20px; box-shadow: 0 12px 30px ${color.glow};">` : ''}
    <div style="font-size: 11px; font-weight: 800; color: ${color.dominant}; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 8px;">NYRA • FEEL THE PULSE</div>
    <h1 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 800;">${safeTitle}</h1>
    <p style="margin: 0 0 24px 0; color: #94a3b8; font-size: 15px;">${safeArtist}</p>
    <a href="${redirectUrl}" style="display: inline-block; background: ${color.dominant}; color: #000000; font-weight: 800; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 999px; box-shadow: 0 4px 20px ${color.glow};">
      Open in ${safeAppName}
    </a>
  </div>
</body>
</html>`;
}
