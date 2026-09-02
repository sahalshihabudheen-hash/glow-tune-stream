/**
 * NYRA Music - Artwork Dominant Color Extractor & Dynamic Palette Generator
 * Extracts vibrant dominant colors and builds atmosphere gradients for Discord Open Graph sharing.
 */

export interface ArtworkPalette {
  dominant: string;       // Primary vibrant hex, e.g. "#3b82f6"
  secondary: string;      // Complementary vibrant hex, e.g. "#8b5cf6"
  accent: string;         // Bright accent hex, e.g. "#00f0ff"
  themeColor: string;     // Hex for Discord theme-color
  gradientStart: string;  // Deep atmosphere start hex
  gradientEnd: string;    // Deep atmosphere end hex
  glow: string;           // Rgba string for neon glow
  textColor: string;      // Readable text color (#ffffff or #f8fafc)
}

// Pre-defined fallback palettes for NYRA neon theme
const DEFAULT_PALETTES: ArtworkPalette[] = [
  {
    dominant: '#00f0ff',
    secondary: '#a855f7',
    accent: '#ffd300',
    themeColor: '#00f0ff',
    gradientStart: '#081c2e',
    gradientEnd: '#040914',
    glow: 'rgba(0, 240, 255, 0.45)',
    textColor: '#ffffff',
  },
  {
    dominant: '#a855f7',
    secondary: '#ec4899',
    accent: '#00f0ff',
    themeColor: '#a855f7',
    gradientStart: '#200e35',
    gradientEnd: '#0a0514',
    glow: 'rgba(168, 85, 247, 0.45)',
    textColor: '#ffffff',
  },
  {
    dominant: '#3b82f6',
    secondary: '#06b6d4',
    accent: '#a855f7',
    themeColor: '#3b82f6',
    gradientStart: '#0d1f3f',
    gradientEnd: '#040914',
    glow: 'rgba(59, 130, 246, 0.45)',
    textColor: '#ffffff',
  },
  {
    dominant: '#ef4444',
    secondary: '#f97316',
    accent: '#ffd300',
    themeColor: '#ef4444',
    gradientStart: '#300e12',
    gradientEnd: '#0d0406',
    glow: 'rgba(239, 68, 68, 0.45)',
    textColor: '#ffffff',
  },
];

export function getDefaultPalette(seed?: string): ArtworkPalette {
  if (!seed) return DEFAULT_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % DEFAULT_PALETTES.length;
  return DEFAULT_PALETTES[index];
}

/**
 * Fast RGB to HSL conversion
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
}

/**
 * HSL to Hex color string
 */
function hslToHex(h: number, s: number, l: number): string {
  l = Math.max(0, Math.min(1, l));
  s = Math.max(0, Math.min(1, s));
  h = (h % 360 + 360) % 360;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Build rich atmosphere palette from dominant RGB or seed
 */
export function buildPaletteFromHsl(hue: number, sat = 0.85, light = 0.55): ArtworkPalette {
  const dominant = hslToHex(hue, Math.max(0.7, sat), Math.min(0.65, Math.max(0.45, light)));
  const secondary = hslToHex((hue + 45) % 360, Math.max(0.75, sat), 0.52);
  const accent = hslToHex((hue + 180) % 360, 0.9, 0.6);
  const gradientStart = hslToHex(hue, 0.6, 0.12);
  const gradientEnd = hslToHex((hue + 30) % 360, 0.7, 0.04);
  const themeColor = dominant;

  const rgb = hexToRgb(dominant) || { r: 0, g: 240, b: 255 };
  const glow = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`;

  return {
    dominant,
    secondary,
    accent,
    themeColor,
    gradientStart,
    gradientEnd,
    glow,
    textColor: '#ffffff',
  };
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const sanitized = hex.replace(/^#/, '');
  if (sanitized.length === 3) {
    return {
      r: parseInt(sanitized[0] + sanitized[0], 16),
      g: parseInt(sanitized[1] + sanitized[1], 16),
      b: parseInt(sanitized[2] + sanitized[2], 16),
    };
  }
  if (sanitized.length === 6) {
    return {
      r: parseInt(sanitized.slice(0, 2), 16),
      g: parseInt(sanitized.slice(2, 4), 16),
      b: parseInt(sanitized.slice(4, 6), 16),
    };
  }
  return null;
}

/**
 * Extracts dominant color from an image in browser using Canvas
 */
export async function extractColorFromImage(imageUrl: string): Promise<ArtworkPalette> {
  if (typeof window === 'undefined' || !imageUrl) {
    return getDefaultPalette();
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      
      const timeout = setTimeout(() => {
        resolve(getDefaultPalette(imageUrl));
      }, 2500);

      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(getDefaultPalette(imageUrl));
          }

          // Sample down to small dimensions for fast calculation
          const size = 32;
          canvas.width = size;
          canvas.height = size;
          ctx.drawImage(img, 0, 0, size, size);

          const imageData = ctx.getImageData(0, 0, size, size).data;
          let bestHue = 190; // Default cyan
          let maxVibrancy = -1;

          for (let i = 0; i < imageData.length; i += 16) {
            const r = imageData[i];
            const g = imageData[i + 1];
            const b = imageData[i + 2];
            const [h, s, l] = rgbToHsl(r, g, b);

            // Favor vibrant, colorful pixels over dark black or washed-out white
            if (s > 0.25 && l > 0.2 && l < 0.85) {
              const vibrancy = s * (1 - Math.abs(l - 0.5) * 1.5);
              if (vibrancy > maxVibrancy) {
                maxVibrancy = vibrancy;
                bestHue = h;
              }
            }
          }

          if (maxVibrancy > 0) {
            resolve(buildPaletteFromHsl(bestHue, 0.85, 0.55));
          } else {
            resolve(getDefaultPalette(imageUrl));
          }
        } catch {
          resolve(getDefaultPalette(imageUrl));
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        resolve(getDefaultPalette(imageUrl));
      };

      img.src = imageUrl;
    } catch {
      resolve(getDefaultPalette(imageUrl));
    }
  });
}
