import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import WhatsNewContent from '@/components/WhatsNewContent';
import type { UpdateRelease } from '@/lib/updates';

export const WHATS_NEW_GRADIENT = 'bg-gradient-to-r from-orange-400 to-rose-400 bg-clip-text text-transparent';

/**
 * Full-screen "What's new" shown once after an update.
 * Closing it (button, X or Esc) is what marks the update as seen.
 */
const WhatsNewOverlay = ({
  releases,
  latestId,
  onClose,
  preview = false,
}: {
  releases: UpdateRelease[];
  latestId?: string;
  onClose: () => void;
  preview?: boolean;
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="What's new"
      className="fixed inset-0 z-[200] overflow-y-auto bg-background"
    >
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 pb-8 pt-5 md:px-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary"
          >
            <X className="h-6 w-6" />
          </button>
          {preview && (
            <span className="rounded-full border border-border px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Preview
            </span>
          )}
        </div>

        <h1 className={`mt-4 mb-6 text-4xl font-semibold tracking-tight md:text-5xl ${WHATS_NEW_GRADIENT}`}>
          What&apos;s new
        </h1>

        <WhatsNewContent releases={releases} latestId={latestId} />

        <div className="sticky bottom-0 mt-6 bg-gradient-to-t from-background via-background to-transparent pb-2 pt-6">
          <button
            type="button"
            onClick={onClose}
            className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80"
          >
            {preview ? 'Close preview' : 'Got it'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default WhatsNewOverlay;
