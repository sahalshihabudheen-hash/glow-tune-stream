import { useEffect, useRef } from 'react';
import { useAppSettings } from '@/hooks/useAppSettings';

const SOUNDWAVE_FRAMES = [
  '▁▃▅▇▅▃',
  '▃▅▇▅▃▁',
  '▅▇▅▃▁▃',
  '▇▅▃▁▃▅',
  '▅▃▁▃▅▇',
  '▃▁▃▅▇▅',
];

function updateFavicon(url: string | undefined) {
  if (!url) return;
  let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  if (link.href !== url) {
    link.href = url;
  }
}

function updateMetaTag(property: string, content: string) {
  let meta = document.querySelector(`meta[property='${property}']`) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('property', property);
    document.head.appendChild(meta);
  }
  if (meta.content !== content) {
    meta.content = content;
  }
}

export function useTabTitle(trackTitle: string | null, isPlaying: boolean) {
  const frameRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { settings } = useAppSettings();

  useEffect(() => {
    // Sync favicon + OG tags
    if (settings.app_logo_url) {
      updateFavicon(settings.app_logo_url);
      updateMetaTag('og:image', settings.app_logo_url);
      const twitterMeta = document.querySelector("meta[name='twitter:image']") as HTMLMetaElement | null;
      if (twitterMeta) twitterMeta.content = settings.app_logo_url;
    }

    const appName = settings.app_name || 'NYRA';

    // Tab title logic
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isPlaying && trackTitle) {
      const update = () => {
        const wave = SOUNDWAVE_FRAMES[frameRef.current % SOUNDWAVE_FRAMES.length];
        document.title = `${wave} ${trackTitle} - ${appName}`;
        frameRef.current++;
      };
      update();
      intervalRef.current = setInterval(update, 500);
    } else if (trackTitle) {
      document.title = `⏸ ${trackTitle} - ${appName}`;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [trackTitle, isPlaying, settings.app_name, settings.app_tagline, settings.app_logo_url]);
}
