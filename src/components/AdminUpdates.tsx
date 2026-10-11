import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, Loader2, Megaphone, Plus, RotateCcw, Save, Send, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import WhatsNewContent from '@/components/WhatsNewContent';
import WhatsNewOverlay from '@/components/WhatsNewOverlay';
import AdminUpdatesAI from '@/components/AdminUpdatesAI';
import { supabase } from '@/integrations/supabase/client';
import { useUpdates } from '@/hooks/useUpdates';
import { cn } from '@/lib/utils';
import {
  MAX_ITEMS_PER_SECTION,
  MAX_ITEM_TEXT,
  MAX_ITEM_TITLE,
  MAX_VERSION_LENGTH,
  SECTION_META,
  SECTION_ORDER,
  exampleRelease,
  formatReleaseDate,
  newId,
  pickLatest,
  releaseItemCount,
  sanitizeReleases,
  todayISO,
  type UpdateItem,
  type UpdateRelease,
  type UpdateSectionType,
} from '@/lib/updates';

const AdminUpdates = () => {
  const { releases: saved, loading, save } = useUpdates();
  const [list, setList] = useState<UpdateRelease[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [popupPreview, setPopupPreview] = useState(false);
  const [aiBusyKey, setAiBusyKey] = useState<string | null>(null);
  const adopted = useRef(false);

  // Take the stored list once it has loaded. After that the editor owns the draft.
  useEffect(() => {
    if (loading || adopted.current) return;
    adopted.current = true;
    setList(saved);
    setSelectedId(saved[0]?.id ?? null);
  }, [loading, saved]);

  const cleaned = useMemo(() => sanitizeReleases({ releases: list }, false), [list]);
  const dirty = useMemo(() => JSON.stringify(cleaned) !== JSON.stringify(saved), [cleaned, saved]);
  const selected = list.find((r) => r.id === selectedId) ?? null;
  const liveLatest = pickLatest(cleaned);

  const patchRelease = (id: string, patch: Partial<UpdateRelease>) =>
    setList((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const setItems = (id: string, type: UpdateSectionType, fn: (items: UpdateItem[]) => UpdateItem[]) =>
    setList((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const items = fn(r.sections.find((s) => s.type === type)?.items ?? []);
        const sections = [...r.sections.filter((s) => s.type !== type), { type, items }].sort(
          (a, b) => SECTION_ORDER.indexOf(a.type) - SECTION_ORDER.indexOf(b.type),
        );
        return { ...r, sections };
      }),
    );

  const addRelease = (release?: UpdateRelease) => {
    const id = newId();
    const next: UpdateRelease = release
      ? { ...release, id, notifyId: id }
      : { id, notifyId: id, version: '', date: todayISO(), published: false, sections: [] };
    setList((prev) => [next, ...prev]);
    setSelectedId(next.id);
  };

  const removeRelease = (id: string) => {
    setList((prev) => {
      const rest = prev.filter((r) => r.id !== id);
      if (selectedId === id) setSelectedId(rest[0]?.id ?? null);
      return rest;
    });
  };

  const discard = () => {
    setList(saved);
    setSelectedId((cur) => (saved.some((r) => r.id === cur) ? cur : saved[0]?.id ?? null));
  };

  /** Asks the AI to rework one item. Replaces its title/text; the admin can still edit or Discard. */
  const aiRewrite = async (type: UpdateSectionType, index: number, action: 'elaborate' | 'shorten') => {
    if (!selected) return;
    const item = selected.sections.find((s) => s.type === type)?.items[index];
    if (!item || (!item.title.trim() && !item.text.trim())) return toast.error('Write something first, then let AI rework it.');
    const key = `${type}:${index}:${action}`;
    setAiBusyKey(key);
    try {
      const { data, error } = await supabase.functions.invoke('admin-updates-ai', {
        body: { mode: 'rewrite', action, title: item.title, text: item.text },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setItems(selected.id, type, (it) => it.map((x, j) => (j === index ? { title: data.title ?? x.title, text: data.text ?? x.text } : x)));
      toast.success(action === 'elaborate' ? 'Elaborated' : 'Shortened');
    } catch (err: any) {
      toast.error(err?.message ? `AI: ${err.message}` : 'AI could not rewrite this');
    } finally {
      setAiBusyKey(null);
    }
  };

  const handleSave = async () => {
    for (const r of cleaned) {
      const name = r.version.trim() ? `Version ${r.version}` : 'A release';
      if (!r.version.trim()) return toast.error('Every release needs a version number.');
      if (!r.date) return toast.error(`${name} needs a date.`);
      if (r.published && releaseItemCount(r) === 0) return toast.error(`${name} is published but has nothing in it. Add an item or turn off Published.`);
    }
    setSaving(true);
    try {
      const next = await save(list);
      setList(next);
      setSelectedId((cur) => (next.some((r) => r.id === cur) ? cur : next[0]?.id ?? null));
      toast.success('Updates saved');
    } catch (err: any) {
      toast.error(err?.message ? `Could not save: ${err.message}` : 'Could not save updates');
    } finally {
      setSaving(false);
    }
  };

  const previewRelease = selected ? sanitizeReleases({ releases: [selected] }, false)[0] : undefined;

  return (
    <Card className="border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <Megaphone className="w-5 h-5 text-primary" />
          <div>
            <CardTitle className="text-base">What&apos;s new</CardTitle>
            <CardDescription>
              Write release notes for users. The newest published release pops up once for every user on their next visit.
              Everyone can also read all published releases on the What&apos;s new page when they turn it on in Settings.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Release list */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" className="gap-2" onClick={() => addRelease()}>
                  <Plus className="w-4 h-4" /> New release
                </Button>
                {list.length === 0 && (
                  <Button size="sm" variant="outline" onClick={() => addRelease(exampleRelease())}>
                    Start from an example
                  </Button>
                )}
              </div>

              {list.length === 0 ? (
                <p className="text-sm text-muted-foreground">No releases yet. Create one to get started.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {list.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      aria-pressed={r.id === selectedId}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-left transition-colors',
                        r.id === selectedId ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary',
                      )}
                    >
                      <span className="block text-sm font-medium">Version {r.version || '—'}</span>
                      <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        {formatReleaseDate(r.date) || 'No date'}
                        <span className={cn('rounded-full px-1.5 py-px font-medium', r.published ? 'bg-emerald-500/15 text-emerald-500' : 'bg-secondary')}>
                          {r.published ? 'Published' : 'Draft'}
                        </span>
                        {liveLatest?.id === r.id && <span className="text-primary font-medium">Popup</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selected && (
              <div className="grid gap-6 xl:grid-cols-2">
                {/* ---- Editor ---- */}
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="up-version">Version</label>
                      <Input
                        id="up-version"
                        value={selected.version}
                        maxLength={MAX_VERSION_LENGTH}
                        placeholder="e.g. 4.9.0"
                        onChange={(e) => patchRelease(selected.id, { version: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="up-date">Date</label>
                      <Input
                        id="up-date"
                        type="date"
                        value={selected.date}
                        onChange={(e) => patchRelease(selected.id, { date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-secondary/30 p-3">
                    <div>
                      <p className="text-sm font-medium">Published</p>
                      <p className="text-xs text-muted-foreground">
                        Drafts stay hidden. Publish when it is ready for users.
                      </p>
                    </div>
                    <Switch checked={selected.published} onCheckedChange={(v) => patchRelease(selected.id, { published: v })} />
                  </div>

                  <AdminUpdatesAI release={selected} />

                  {SECTION_ORDER.map((type) => {
                    const meta = SECTION_META[type];
                    const items = selected.sections.find((s) => s.type === type)?.items ?? [];
                    return (
                      <div key={type} className="space-y-3 rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between">
                          <p className={cn('text-sm font-semibold', meta.heading)}>
                            <span aria-hidden>{meta.emoji}</span> {meta.label}
                            <span className="ml-2 text-xs font-normal text-muted-foreground">{items.length || ''}</span>
                          </p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1"
                            disabled={items.length >= MAX_ITEMS_PER_SECTION}
                            onClick={() => setItems(selected.id, type, (it) => [...it, { title: '', text: '' }])}
                          >
                            <Plus className="w-4 h-4" /> Add item
                          </Button>
                        </div>

                        {items.map((item, i) => (
                          <div key={i} className="space-y-2 rounded-md bg-secondary/30 p-2.5">
                            <Input
                              value={item.title}
                              maxLength={MAX_ITEM_TITLE}
                              placeholder="Feature name (bold)"
                              aria-label={`${meta.label} item ${i + 1} title`}
                              onChange={(e) =>
                                setItems(selected.id, type, (it) => it.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
                              }
                            />
                            <Textarea
                              rows={2}
                              value={item.text}
                              maxLength={MAX_ITEM_TEXT}
                              placeholder="What changed, in a sentence or two"
                              aria-label={`${meta.label} item ${i + 1} description`}
                              onChange={(e) =>
                                setItems(selected.id, type, (it) => it.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
                              }
                            />
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm" variant="ghost" className="mr-auto h-8 gap-1 text-primary"
                                disabled={aiBusyKey !== null}
                                onClick={() => aiRewrite(type, i, 'elaborate')}
                              >
                                {aiBusyKey === `${type}:${i}:elaborate` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                Elaborate
                              </Button>
                              <Button
                                size="sm" variant="ghost" className="h-8 gap-1 text-primary"
                                disabled={aiBusyKey !== null}
                                onClick={() => aiRewrite(type, i, 'shorten')}
                              >
                                {aiBusyKey === `${type}:${i}:shorten` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                Shorten
                              </Button>
                              <Button
                                size="icon" variant="ghost" className="h-8 w-8" aria-label="Move up" disabled={i === 0}
                                onClick={() =>
                                  setItems(selected.id, type, (it) => {
                                    const a = [...it];
                                    [a[i - 1], a[i]] = [a[i], a[i - 1]];
                                    return a;
                                  })
                                }
                              >
                                <ArrowUp className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon" variant="ghost" className="h-8 w-8" aria-label="Move down" disabled={i === items.length - 1}
                                onClick={() =>
                                  setItems(selected.id, type, (it) => {
                                    const a = [...it];
                                    [a[i + 1], a[i]] = [a[i], a[i + 1]];
                                    return a;
                                  })
                                }
                              >
                                <ArrowDown className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Remove item"
                                onClick={() => setItems(selected.id, type, (it) => it.filter((_, j) => j !== i))}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}

                  <div className="flex flex-wrap items-center gap-2">
                    {selected.published && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          patchRelease(selected.id, { notifyId: newId() });
                          toast.info('Everyone will see this popup again once you save.');
                        }}
                      >
                        <Send className="w-4 h-4" /> Show popup to everyone again
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2 text-destructive">
                          <Trash2 className="w-4 h-4" /> Delete release
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete version {selected.version || 'this release'}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            It is removed once you press Save changes. You can still discard before saving.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removeRelease(selected.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {/* ---- Live preview ---- */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Live preview</p>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setPopupPreview(true)} disabled={!previewRelease || releaseItemCount(previewRelease) === 0}>
                      <Eye className="w-4 h-4" /> Preview popup
                    </Button>
                  </div>
                  <div className="mx-auto max-w-[440px] rounded-3xl border border-border bg-background p-3">
                    {previewRelease ? (
                      <WhatsNewContent releases={[previewRelease]} latestId={previewRelease.id} forceOpen />
                    ) : null}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    This is how the card looks on a phone. Plain text only, so nothing can break the page.
                  </p>
                </div>
              </div>
            )}

            {/* ---- Save bar ---- */}
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button onClick={handleSave} disabled={!dirty || saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save changes
              </Button>
              <Button variant="outline" className="gap-2" onClick={discard} disabled={!dirty || saving}>
                <RotateCcw className="w-4 h-4" /> Discard
              </Button>
              {dirty && <span className="text-xs text-primary">Unsaved changes. Save to show them to users.</span>}
              {!dirty && liveLatest && (
                <span className="text-xs text-muted-foreground">
                  Users currently get Version {liveLatest.version} as the popup.
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>

      {popupPreview && previewRelease && (
        <WhatsNewOverlay releases={[previewRelease]} latestId={previewRelease.id} preview onClose={() => setPopupPreview(false)} />
      )}
    </Card>
  );
};

export default AdminUpdates;
