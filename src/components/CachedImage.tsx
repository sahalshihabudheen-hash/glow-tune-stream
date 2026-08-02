import { useEffect, useState } from 'react';
import { cacheThumb, getCachedThumb } from '@/lib/offlineCache';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
}

/**
 * Renders an image from the offline thumbnail cache when available so artwork
 * appears instantly on poor connections, then keeps the cache warm.
 */
const CachedImage = ({ src, alt, ...rest }: CachedImageProps) => {
  const [resolved, setResolved] = useState<string>(src);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    setResolved(src);

    (async () => {
      const cached = await getCachedThumb(src);
      if (cancelled) return;
      if (cached) {
        objectUrl = URL.createObjectURL(cached);
        setResolved(objectUrl);
        return;
      }
      const fetched = await cacheThumb(src);
      if (cancelled || !fetched) return;
      objectUrl = URL.createObjectURL(fetched);
      setResolved(objectUrl);
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return <img src={resolved} alt={alt} loading="lazy" decoding="async" {...rest} />;
};

export default CachedImage;
