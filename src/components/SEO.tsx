import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export interface SEOProps {
  title?: string;
  description?: string;
  canonicalPath?: string;
  ogType?: 'website' | 'music.song' | 'music.playlist' | 'music.album' | 'profile' | 'article';
  ogImage?: string;
  keywords?: string;
  noindex?: boolean;
  structuredData?: Record<string, any>;
}

const DOMAIN = 'https://nyra-music-player.vercel.app';
const DEFAULT_TITLE = 'NYRA - Feel the Pulse | Free Music Streaming, Visualizers & AI DJ';
const DEFAULT_DESCRIPTION = 'Stream millions of songs for free on NYRA. Discover high-fidelity audio, beat-reactive neon visualizers, AI Mood DJ, synchronized lyrics, custom playlists, and seamless offline playback.';
const DEFAULT_IMAGE = `${DOMAIN}/og-image.png`;

function setMetaTag(attribute: 'name' | 'property', name: string, content: string) {
  let element = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setCanonical(url: string) {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

export const SEO: React.FC<SEOProps> = ({
  title,
  description = DEFAULT_DESCRIPTION,
  canonicalPath,
  ogType = 'website',
  ogImage = DEFAULT_IMAGE,
  keywords,
  noindex = false,
  structuredData,
}) => {
  const location = useLocation();

  useEffect(() => {
    // 1. Page Title
    const formattedTitle = title 
      ? `${title} | NYRA - Feel the Pulse`
      : DEFAULT_TITLE;
    document.title = formattedTitle;

    // 2. Canonical URL
    const cleanPath = canonicalPath !== undefined ? canonicalPath : location.pathname;
    const canonicalUrl = `${DOMAIN}${cleanPath === '/' ? '' : cleanPath}`;
    setCanonical(canonicalUrl);

    // 3. Meta Description & Keywords
    setMetaTag('name', 'description', description);
    if (keywords) {
      setMetaTag('name', 'keywords', keywords);
    }

    // 4. Robots Directives
    if (noindex) {
      setMetaTag('name', 'robots', 'noindex, nofollow');
      setMetaTag('name', 'googlebot', 'noindex, nofollow');
    } else {
      setMetaTag('name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
      setMetaTag('name', 'googlebot', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    }

    // 5. Open Graph Meta Tags
    const fullImageUrl = ogImage.startsWith('http') ? ogImage : `${DOMAIN}${ogImage.startsWith('/') ? '' : '/'}${ogImage}`;
    setMetaTag('property', 'og:site_name', 'NYRA - Feel the Pulse');
    setMetaTag('property', 'og:title', formattedTitle);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:url', canonicalUrl);
    setMetaTag('property', 'og:type', ogType);
    setMetaTag('property', 'og:image', fullImageUrl);
    setMetaTag('property', 'og:image:secure_url', fullImageUrl);

    // 6. Twitter Card Meta Tags
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', formattedTitle);
    setMetaTag('name', 'twitter:description', description);
    setMetaTag('name', 'twitter:image', fullImageUrl);
    setMetaTag('name', 'twitter:url', canonicalUrl);

    // 7. Structured Data (JSON-LD)
    let jsonLdScript = document.getElementById('route-jsonld') as HTMLScriptElement | null;
    if (structuredData) {
      if (!jsonLdScript) {
        jsonLdScript = document.createElement('script');
        jsonLdScript.id = 'route-jsonld';
        jsonLdScript.type = 'application/ld+json';
        document.head.appendChild(jsonLdScript);
      }
      jsonLdScript.textContent = JSON.stringify(structuredData);
    } else if (jsonLdScript) {
      jsonLdScript.remove();
    }

    return () => {
      // Cleanup custom route jsonld when navigating away
      const scriptToRemove = document.getElementById('route-jsonld');
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [title, description, canonicalPath, location.pathname, ogType, ogImage, keywords, noindex, structuredData]);

  return null;
};

export default SEO;
