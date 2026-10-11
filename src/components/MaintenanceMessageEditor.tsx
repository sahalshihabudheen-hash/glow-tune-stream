import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlignCenter, AlignLeft, AlignRight, Bold, Eye, Italic, Loader2, MessageSquareText, Monitor, RotateCcw, Save, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import MaintenancePage from '@/pages/MaintenancePage';
import {
  DEFAULT_MESSAGE_CONFIG,
  DEFAULT_TITLE,
  MAX_MESSAGE_LENGTH,
  MAX_TITLE_LENGTH,
  MESSAGE_SIZE_RANGE,
  MaintenanceMessageConfig,
  MessageAlign,
  MessageFont,
  TITLE_SIZE_RANGE,
  isSameConfig,
  sanitizeMessageConfig,
} from '@/lib/maintenanceMessage';
import { cn } from '@/lib/utils';

interface Props {
  /** Saved message (from the database). */
  value?: MaintenanceMessageConfig;
  onSave: (config: MaintenanceMessageConfig) => Promise<void>;
}

const SWATCHES = ['#ffffff', '#ffd300', '#ff9f1c', '#ff4d4f', '#22c55e', '#22d3ee', '#a78bfa', '#f472b6'];

const FONTS: { id: MessageFont; label: string; sample: string }[] = [
  { id: 'sans', label: 'Sans', sample: 'inherit' },
  { id: 'serif', label: 'Serif', sample: 'Georgia, serif' },
  { id: 'mono', label: 'Mono', sample: 'ui-monospace, Menlo, monospace' },
];

const ALIGNS: { id: MessageAlign; icon: typeof AlignLeft; label: string }[] = [
  { id: 'left', icon: AlignLeft, label: 'Align left' },
  { id: 'center', icon: AlignCenter, label: 'Align center' },
  { id: 'right', icon: AlignRight, label: 'Align right' },
];

const ColorPicker = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="space-y-2">
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <div className="flex items-center gap-2 flex-wrap">
      <input
        type="color"
        aria-label={label}
        value={value || '#ffffff'}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
      />
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Use ${c}`}
          onClick={() => onChange(c)}
          className={cn(
            'h-6 w-6 rounded-full border transition-transform hover:scale-110',
            value.toLowerCase() === c ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'border-border',
          )}
          style={{ backgroundColor: c }}
        />
      ))}
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onChange('')} disabled={!value}>
        Default
      </Button>
    </div>
  </div>
);

/** Renders the real maintenance page inside a fixed virtual screen, scaled to fit. */
const ScaledPreview = ({ config, device }: { config: MaintenanceMessageConfig; device: 'desktop' | 'phone' }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const screen = device === 'desktop' ? { w: 1000, h: 560 } : { w: 390, h: 720 };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = width ? Math.min(1, width / screen.w) : 0.4;
  return (
    <div ref={wrapRef} className="w-full">
      <div
        className="mx-auto overflow-hidden rounded-xl border border-border shadow-inner"
        style={{ width: screen.w * scale, height: screen.h * scale }}
      >
        <div style={{ width: screen.w, height: screen.h, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <MaintenancePage config={config} embedded />
        </div>
      </div>
    </div>
  );
};

const MaintenanceMessageEditor = ({ value, onSave }: Props) => {
  const saved = useMemo(() => sanitizeMessageConfig(value), [value]);
  const [draft, setDraft] = useState<MaintenanceMessageConfig>(saved);
  const [saving, setSaving] = useState(false);
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop');
  const [fullscreen, setFullscreen] = useState(false);

  // Adopt a newly loaded/saved value, but never overwrite edits that are in progress.
  const prevSaved = useRef(saved);
  useEffect(() => {
    // Capture the previous value first: the state updater below runs later, after the ref has moved on.
    const previous = prevSaved.current;
    prevSaved.current = saved;
    setDraft((d) => (isSameConfig(d, previous) ? saved : d));
  }, [saved]);

  // Esc closes the full-screen preview
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFullscreen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const dirty = !isSameConfig(draft, saved);
  const patch = (p: Partial<MaintenanceMessageConfig>) => setDraft((d) => ({ ...d, ...p }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(sanitizeMessageConfig(draft));
      toast.success('Maintenance message saved');
    } catch (err: any) {
      toast.error(err?.message ? `Could not save: ${err.message}` : 'Could not save the message');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <MessageSquareText className="w-5 h-5 text-primary" />
          <div>
            <CardTitle className="text-base">Custom Maintenance Message</CardTitle>
            <CardDescription>
              Shown to users on the maintenance screen. Leave the message empty to keep the default text.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-6 xl:grid-cols-2">
          {/* ---- Editor ---- */}
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium" htmlFor="mm-title">Title</label>
                <span className="text-[11px] text-muted-foreground">{draft.title.length}/{MAX_TITLE_LENGTH}</span>
              </div>
              <Input
                id="mm-title"
                value={draft.title}
                maxLength={MAX_TITLE_LENGTH}
                placeholder={DEFAULT_TITLE}
                onChange={(e) => patch({ title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium" htmlFor="mm-message">Message</label>
                <span className="text-[11px] text-muted-foreground">{draft.message.length}/{MAX_MESSAGE_LENGTH}</span>
              </div>
              <Textarea
                id="mm-message"
                rows={4}
                value={draft.message}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder="e.g. We're back at 6 PM IST. Thanks for your patience! 💛"
                onChange={(e) => patch({ message: e.target.value })}
              />
            </div>

            {/* Text style toolbar */}
            <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-md border border-border overflow-hidden">
                  {ALIGNS.map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      type="button"
                      aria-label={label}
                      title={label}
                      onClick={() => patch({ align: id })}
                      className={cn('p-2 transition-colors', draft.align === id ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary')}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  aria-label="Bold message"
                  title="Bold message"
                  aria-pressed={draft.bold}
                  onClick={() => patch({ bold: !draft.bold })}
                  className={cn('p-2 rounded-md border border-border transition-colors', draft.bold ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary')}
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Italic"
                  title="Italic"
                  aria-pressed={draft.italic}
                  onClick={() => patch({ italic: !draft.italic })}
                  className={cn('p-2 rounded-md border border-border transition-colors', draft.italic ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary')}
                >
                  <Italic className="w-4 h-4" />
                </button>
                <div className="flex rounded-md border border-border overflow-hidden">
                  {FONTS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => patch({ font: f.id })}
                      className={cn('px-3 py-1.5 text-sm transition-colors', draft.font === f.id ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary')}
                      style={{ fontFamily: f.sample }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">Title size</span>
                  <span className="tabular-nums">{draft.titleSize}px</span>
                </div>
                <Slider
                  min={TITLE_SIZE_RANGE.min}
                  max={TITLE_SIZE_RANGE.max}
                  step={1}
                  value={[draft.titleSize]}
                  onValueChange={([v]) => patch({ titleSize: v })}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">Message size</span>
                  <span className="tabular-nums">{draft.messageSize}px</span>
                </div>
                <Slider
                  min={MESSAGE_SIZE_RANGE.min}
                  max={MESSAGE_SIZE_RANGE.max}
                  step={1}
                  value={[draft.messageSize]}
                  onValueChange={([v]) => patch({ messageSize: v })}
                />
              </div>

              <ColorPicker label="Title color" value={draft.titleColor} onChange={(v) => patch({ titleColor: v })} />
              <ColorPicker label="Message color" value={draft.messageColor} onChange={(v) => patch({ messageColor: v })} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleSave} disabled={!dirty || saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save message
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setDraft(DEFAULT_MESSAGE_CONFIG)}
                disabled={isSameConfig(draft, DEFAULT_MESSAGE_CONFIG)}
              >
                <RotateCcw className="w-4 h-4" />
                Reset to default
              </Button>
              {dirty && <span className="text-xs text-primary">Unsaved changes. Save to show this to users.</span>}
            </div>
          </div>

          {/* ---- Live preview ---- */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Live preview</p>
              <div className="flex items-center gap-2">
                <div className="flex rounded-md border border-border overflow-hidden">
                  <button
                    type="button"
                    aria-label="Desktop preview"
                    onClick={() => setDevice('desktop')}
                    className={cn('p-2 transition-colors', device === 'desktop' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary')}
                  >
                    <Monitor className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Phone preview"
                    onClick={() => setDevice('phone')}
                    className={cn('p-2 transition-colors', device === 'phone' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary')}
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setFullscreen(true)}>
                  <Eye className="w-4 h-4" />
                  Full screen
                </Button>
              </div>
            </div>
            <ScaledPreview config={draft} device={device} />
            <p className="text-[11px] text-muted-foreground">
              This is the real maintenance screen, so what you see here is what users get. Users who already have the
              page open pick up changes within about 30 seconds.
            </p>
          </div>
        </div>
      </CardContent>

      {fullscreen &&
        createPortal(
          <MaintenancePage config={draft} preview onClosePreview={() => setFullscreen(false)} />,
          document.body,
        )}
    </Card>
  );
};

export default MaintenanceMessageEditor;
