import { createContext, useContext, useState, useEffect, ReactNode, useRef, useMemo, useCallback } from 'react';
import type { SoundwaveShape } from '@/components/SoundwaveVisualizer';

export type ThemeName = 'yellow' | 'blue' | 'green' | 'purple' | 'red' | 'custom';

interface ThemeConfig {
  name: ThemeName;
  primary: string;
  background: string;
  backgroundImage: string;
}

export const themes: Record<ThemeName, ThemeConfig> = {
  yellow: {
    name: 'yellow',
    primary: '50 100% 50%',
    background: '0 0% 4%',
    backgroundImage: '',
  },
  blue: {
    name: 'blue',
    primary: '210 100% 50%',
    background: '210 30% 8%',
    backgroundImage: 'https://i.postimg.cc/Twk9wNQW/BLUE.jpg',
  },
  green: {
    name: 'green',
    primary: '142 76% 45%',
    background: '142 30% 6%',
    backgroundImage: 'https://i.postimg.cc/44SPRMmr/GREEN.jpg',
  },
  purple: {
    name: 'purple',
    primary: '280 100% 60%',
    background: '280 30% 8%',
    backgroundImage: 'https://i.postimg.cc/25GdcXp6/PURPLE.jpg',
  },
  red: {
    name: 'red',
    primary: '0 100% 50%',
    background: '0 30% 8%',
    backgroundImage: 'https://i.postimg.cc/13Zp9Zsf/RED.jpg',
  },
  custom: {
    name: 'custom',
    primary: '50 100% 50%',
    background: '0 0% 4%',
    backgroundImage: '',
  },
};

export interface GradientConfig {
  enabled: boolean;
  startColor: string;
  endColor: string;
  angle: number;
}

export interface RgbConfig {
  enabled: boolean;
  isGradient: boolean;
  speed: number; // 0.1 to 5
}

export type ProgressBarStyle = 'classic' | 'wavy' | 'dots' | 'thin' | 'rounded';

interface AppSettings {
  soundwaveEnabled: boolean;
  autoPlayNext: boolean;
  miniPlayerMode: boolean;
  autoMiniPlayer: boolean;
  soundwaveShape: SoundwaveShape;
  progressBarStyle: ProgressBarStyle;
  rgbConfig: RgbConfig;
  mobileNavItems?: string[];
  downloadPreference?: 'ask' | 'device' | 'app';
  backgroundVideoBrightness: number;
  lightMode: boolean;
  smartTransitions: boolean;
  transitionDuration: number; // seconds, 0-12
}

interface ThemeContextType {
  currentTheme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
  customColor: string;
  setCustomColor: (color: string) => void;
  gradient: GradientConfig;
  setGradient: (gradient: Partial<GradientConfig>) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

// Helper to convert hex to HSL
const hexToHsl = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '50 100% 50%';
  
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>(() => {
    const saved = localStorage.getItem('nyra-theme');
    return (saved as ThemeName) || 'yellow';
  });

  const [customColor, setCustomColorState] = useState<string>(() => {
    return localStorage.getItem('nyra-custom-color') || '#ffd300';
  });

  const [gradient, setGradientState] = useState<GradientConfig>(() => {
    const saved = localStorage.getItem('nyra-gradient');
    if (!saved) {
      return {
        enabled: false,
        startColor: '#ffd300',
        endColor: '#ff6b00',
        angle: 135,
      };
    }
    try {
      return JSON.parse(saved);
    } catch {
      return {
        enabled: false,
        startColor: '#ffd300',
        endColor: '#ff6b00',
        angle: 135,
      };
    }
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const defaults = {
      soundwaveEnabled: true,
      autoPlayNext: true,
      miniPlayerMode: false,
      autoMiniPlayer: true,
      soundwaveShape: 'bars' as SoundwaveShape,
      progressBarStyle: 'classic' as ProgressBarStyle,
      rgbConfig: {
        enabled: false,
        isGradient: true,
        speed: 1,
      },
      downloadPreference: 'ask' as 'ask' | 'device' | 'app',
      backgroundVideoBrightness: 30,
      lightMode: false,
    };
    const saved = localStorage.getItem('nyra-settings');
    if (!saved) return defaults;
    try {
      const parsed = JSON.parse(saved);
      return { 
        ...defaults, 
        ...parsed,
        rgbConfig: { ...defaults.rgbConfig, ...(parsed.rgbConfig || {}) }
      };
    } catch {
      return defaults;
    }
  });

  // Apply / remove .light class on <html> whenever lightMode changes
  useEffect(() => {
    if (settings.lightMode) {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [settings.lightMode]);

  // Use refs for RGB values to avoid re-rendering the whole app 60 times a second
  // since these only update CSS variables directly
  const rgbHueRef = useRef(0);
  const rgbSatRef = useRef(100);
  const rgbLightRef = useRef(50);
  const rgbOffsetRef = useRef(60);

  // RGB Animation Loop
  useEffect(() => {
    if (!settings.rgbConfig.enabled) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (time: number) => {
      const deltaTime = time - lastTime;
      lastTime = time;

      const speedFactor = settings.rgbConfig.speed * deltaTime;

      rgbHueRef.current = (rgbHueRef.current + speedFactor / 50) % 360;
      
      // Cycle saturation
      const satDelta = (Math.sin(time / 2000) * speedFactor / 100);
      rgbSatRef.current = Math.max(0, Math.min(100, rgbSatRef.current + satDelta));

      // Lightness pulse
      rgbLightRef.current = 50 + Math.sin(time / 1000) * 15;

      // Gradient offset pulse
      rgbOffsetRef.current = 60 + Math.sin(time / 3000) * 60;

      // Apply variables directly to DOM
      const h = Math.round(rgbHueRef.current);
      const s = Math.round(rgbSatRef.current);
      const l = Math.round(rgbLightRef.current);
      const o = Math.round(rgbOffsetRef.current);
      
      const primaryHsl = `${h} ${s}% ${l}%`;
      const hslStr = `hsl(${primaryHsl})`;

      document.documentElement.style.setProperty('--primary', primaryHsl);
      document.documentElement.style.setProperty('--accent', primaryHsl);
      document.documentElement.style.setProperty('--ring', primaryHsl);
      document.documentElement.style.setProperty('--sidebar-primary', primaryHsl);
      document.documentElement.style.setProperty('--sidebar-ring', primaryHsl);
      document.documentElement.style.setProperty('--neon', primaryHsl);
      
      document.documentElement.style.setProperty(
        '--neon-glow',
        `0 0 20px ${hslStr.replace(')', ' / 0.5)')}, 0 0 40px ${hslStr.replace(')', ' / 0.3)')}`
      );
      document.documentElement.style.setProperty(
        '--neon-glow-strong',
        `0 0 30px ${hslStr.replace(')', ' / 0.6)')}, 0 0 60px ${hslStr.replace(')', ' / 0.4)')}, 0 0 100px ${hslStr.replace(')', ' / 0.2)')}`
      );

      if (settings.rgbConfig.isGradient) {
        const secondaryHue = (h + o) % 360;
        const secondarySat = o < 10 ? s : (100 - s);
        document.documentElement.style.setProperty(
          '--theme-gradient',
          `linear-gradient(135deg, hsl(${h}, ${s}%, ${l}%), hsl(${secondaryHue}, ${secondarySat}%, ${l}%))`
        );
      } else {
        document.documentElement.style.removeProperty('--theme-gradient');
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [settings.rgbConfig.enabled, settings.rgbConfig.speed, settings.rgbConfig.isGradient]);

  useEffect(() => {
    localStorage.setItem('nyra-theme', currentTheme);
    localStorage.setItem('nyra-custom-color', customColor);
    localStorage.setItem('nyra-gradient', JSON.stringify(gradient));
    
    // Only apply static variables if RGB is disabled
    if (!settings.rgbConfig.enabled) {
      let primaryHsl: string;
      if (gradient.enabled) {
        primaryHsl = hexToHsl(gradient.startColor);
      } else if (currentTheme === 'custom') {
        primaryHsl = hexToHsl(customColor);
      } else {
        primaryHsl = themes[currentTheme].primary;
      }
      
      document.documentElement.style.setProperty('--primary', primaryHsl);
      document.documentElement.style.setProperty('--accent', primaryHsl);
      document.documentElement.style.setProperty('--ring', primaryHsl);
      document.documentElement.style.setProperty('--sidebar-primary', primaryHsl);
      document.documentElement.style.setProperty('--sidebar-ring', primaryHsl);
      document.documentElement.style.setProperty('--neon', primaryHsl);
      
      const hsl = `hsl(${primaryHsl})`;
      document.documentElement.style.setProperty(
        '--neon-glow',
        `0 0 20px ${hsl.replace(')', ' / 0.5)')}, 0 0 40px ${hsl.replace(')', ' / 0.3)')}`
      );
      document.documentElement.style.setProperty(
        '--neon-glow-strong',
        `0 0 30px ${hsl.replace(')', ' / 0.6)')}, 0 0 60px ${hsl.replace(')', ' / 0.4)')}, 0 0 100px ${hsl.replace(')', ' / 0.2)')}`
      );

      if (gradient.enabled) {
        document.documentElement.style.setProperty(
          '--theme-gradient',
          `linear-gradient(${gradient.angle}deg, ${gradient.startColor}, ${gradient.endColor})`
        );
      } else {
        document.documentElement.style.removeProperty('--theme-gradient');
      }

      const theme = themes[currentTheme];
      if (theme.backgroundImage) {
        document.body.style.backgroundImage = `url(${theme.backgroundImage})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundAttachment = 'fixed';
      } else {
        document.body.style.backgroundImage = '';
      }
    } else {
      // Clear background image in RGB mode
      document.body.style.backgroundImage = '';
    }
  }, [currentTheme, customColor, gradient, settings.rgbConfig.enabled]);

  useEffect(() => {
    localStorage.setItem('nyra-settings', JSON.stringify(settings));
  }, [settings]);

  const setTheme = useCallback((theme: ThemeName) => {
    setCurrentTheme(theme);
  }, []);

  const setCustomColor = useCallback((color: string) => {
    setCustomColorState(color);
    setCurrentTheme('custom');
  }, []);

  const setGradient = useCallback((newGradient: Partial<GradientConfig>) => {
    setGradientState(prev => ({ ...prev, ...newGradient }));
  }, []);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...newSettings };
      if (newSettings.backgroundVideoBrightness !== undefined) {
        const value = Number(newSettings.backgroundVideoBrightness);
        next.backgroundVideoBrightness = Number.isFinite(value)
          ? Math.max(0, Math.min(100, Math.round(value)))
          : prev.backgroundVideoBrightness;
      }
      return next;
    });
  }, []);

  const contextValue = useMemo(() => ({
    currentTheme, 
    setTheme, 
    settings, 
    updateSettings,
    customColor,
    setCustomColor,
    gradient,
    setGradient,
  }), [currentTheme, setTheme, settings, updateSettings, customColor, setCustomColor, gradient, setGradient]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};
