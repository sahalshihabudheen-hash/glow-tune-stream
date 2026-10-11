import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SECTION_META, formatReleaseDate, type UpdateRelease } from '@/lib/updates';

/** One version card: title, date, LATEST badge, collapsible list of changes. */
const ReleaseCard = ({
  release,
  isLatest,
  defaultOpen,
  forceOpen,
}: {
  release: UpdateRelease;
  isLatest: boolean;
  defaultOpen: boolean;
  forceOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const expanded = forceOpen || open;
  const date = formatReleaseDate(release.date);

  return (
    <article className="rounded-2xl border border-border bg-card/70 p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold leading-tight text-foreground">
            Version {release.version || '—'}
          </h2>
          {date && <p className="mt-1 text-sm text-muted-foreground">{date}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {isLatest && (
            <span className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
              Latest
            </span>
          )}
          {!forceOpen && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={expanded}
              aria-label={expanded ? `Collapse version ${release.version}` : `Expand version ${release.version}`}
              className="flex h-8 w-8 items-center justify-center rounded-full text-fuchsia-400 transition-colors hover:bg-fuchsia-400/10"
            >
              {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          )}
        </div>
      </header>

      {expanded && (
        <div className="mt-5 space-y-7">
          {release.sections.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing listed for this release yet.</p>
          )}
          {release.sections.map((section) => {
            const meta = SECTION_META[section.type];
            return (
              <section key={section.type}>
                <h3 className={cn('flex items-center gap-2 text-xl font-semibold', meta.heading)}>
                  <span aria-hidden>{meta.emoji}</span>
                  {meta.label}
                </h3>
                <ul className="mt-3 space-y-4">
                  {section.items.map((item, i) => (
                    <li key={i} className="flex gap-3">
                      <span className={cn('mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} aria-hidden />
                      <p className="min-w-0 break-words text-[15px] leading-relaxed text-muted-foreground">
                        {item.title && <strong className="font-semibold text-foreground">{item.title}</strong>}
                        {item.title && item.text && ': '}
                        {item.text}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </article>
  );
};

/** A stack of version cards. The newest is open and tagged LATEST, older ones are collapsed. */
const WhatsNewContent = ({
  releases,
  latestId,
  forceOpen,
  className,
}: {
  releases: UpdateRelease[];
  latestId?: string;
  forceOpen?: boolean;
  className?: string;
}) => (
  <div className={cn('space-y-4', className)}>
    {releases.map((release, i) => (
      <ReleaseCard
        key={release.id}
        release={release}
        isLatest={latestId ? release.id === latestId : i === 0}
        defaultOpen={i === 0}
        forceOpen={forceOpen}
      />
    ))}
  </div>
);

export default WhatsNewContent;
