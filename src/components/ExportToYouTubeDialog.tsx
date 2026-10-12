import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, ExternalLink, Globe, Link2, Loader2, Lock, X, Youtube } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  clearExportRecord,
  exportPlaylistToYouTube,
  friendlyYouTubeError,
  getExportRecord,
  googleClientId,
  isYouTubeVideoId,
  prepareCoverImage,
  requestYouTubeToken,
  youtubePlaylistUrl,
  type ExportProgress,
  type ExportRecord,
  type ExportResult,
  type YouTubePrivacy,
} from '@/lib/youtubeExport';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Stable id of the NYRA playlist; used to remember what was already uploaded. */
  playlistKey: string;
  playlistName: string;
  playlistDescription?: string;
  tracks: { id: string; title: string }[];
}

const PRIVACY: { id: YouTubePrivacy; label: string; hint: string; Icon: typeof Lock }[] = [
  { id: 'private', label: 'Private', hint: 'Only you', Icon: Lock },
  { id: 'unlisted', label: 'Unlisted', hint: 'Anyone with the link', Icon: Link2 },
  { id: 'public', label: 'Public', hint: 'Everyone', Icon: Globe },
];

type Phase = 'idle' | 'signing' | 'uploading' | 'done';

const ExportToYouTubeDialog = ({ open, onOpenChange, playlistKey, playlistName, playlistDescription, tracks }: Props) => {
  const [title, setTitle] = useState(playlistName);
  const [privacy, setPrivacy] = useState<YouTubePrivacy>('private');
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<ExportProgress>({ done: 0, total: 0, skipped: 0 });
  const [result, setResult] = useState<ExportResult | null>(null);
  const [record, setRecord] = useState<ExportRecord | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [cover, setCover] = useState<Blob | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const configured = !!googleClientId();

  // Reset every time the dialog opens, and pick up an earlier upload of this playlist.
  useEffect(() => {
    if (!open) return;
    setTitle(playlistName);
    setPhase('idle');
    setResult(null);
    setProgress({ done: 0, total: 0, skipped: 0 });
    setRecord(getExportRecord(playlistKey));
    setCover(null);
  }, [open, playlistKey, playlistName]);

  // Preview URL for the chosen cover; freed when it changes.
  useEffect(() => {
    if (!cover) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(cover);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  const pickCover = async (file?: File) => {
    if (!file) return;
    try {
      setCover(await prepareCoverImage(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't use that picture.");
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const { videoIds, notYouTube } = useMemo(() => {
    const ids = Array.from(new Set(tracks.map((t) => t.id).filter(isYouTubeVideoId)));
    return { videoIds: ids, notYouTube: tracks.filter((t) => !isYouTubeVideoId(t.id)).length };
  }, [tracks]);

  const alreadyUploaded = useMemo(() => new Set([...(record?.addedIds ?? []), ...(record?.skippedIds ?? [])]), [record]);
  const unavailable = record?.skippedIds?.length ?? 0;
  const newSongs = videoIds.filter((id) => !alreadyUploaded.has(id)).length;
  const busy = phase === 'signing' || phase === 'uploading';

  const close = (next: boolean) => {
    if (!next) abortRef.current?.abort(); // closing mid-upload stops it; progress so far is kept
    onOpenChange(next);
  };

  const start = async () => {
    setResult(null);
    setPhase('signing');
    let token: string;
    try {
      token = await requestYouTubeToken();
    } catch (e) {
      setPhase('idle');
      toast.error(friendlyYouTubeError(e));
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ done: 0, total: newSongs, skipped: 0 });
    setPhase('uploading');

    const res = await exportPlaylistToYouTube({
      token,
      playlistKey,
      title: title.trim() || playlistName,
      description: [playlistDescription, 'Created with NYRA'].filter(Boolean).join('\n\n'),
      privacy,
      videoIds,
      cover,
      onProgress: setProgress,
      signal: controller.signal,
    });

    abortRef.current = null;
    setRecord(getExportRecord(playlistKey));
    setResult(res);
    setPhase('done');
    if (!res.stopped && !res.cancelled) toast.success(`Uploaded ${res.added} songs to YouTube`);
  };

  const startOver = () => {
    clearExportRecord(playlistKey);
    setRecord(null);
  };

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const uploadedBefore = !!record && record.addedIds.length > 0;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Youtube className="h-5 w-5 shrink-0 text-red-500" /> Upload to YouTube
          </DialogTitle>
          <DialogDescription>
            Creates a playlist in your own YouTube account with these songs. You sign in with Google; NYRA never sees your password.
          </DialogDescription>
        </DialogHeader>

        {!configured ? (
          <div className="rounded-xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
            YouTube upload isn't switched on for this app yet. The site owner needs to add a Google client ID
            (<code className="text-foreground">VITE_GOOGLE_CLIENT_ID</code>) first.
          </div>
        ) : phase === 'done' && result ? (
          <div className="space-y-4">
            <div
              className={cn(
                'rounded-xl border p-4 text-sm',
                result.stopped ? 'border-destructive/40 bg-destructive/10' : 'border-primary/30 bg-primary/10',
              )}
            >
              <p className="font-semibold text-foreground">
                {result.cancelled ? 'Upload stopped' : result.stopped ? 'Upload stopped early' : 'Done!'}
              </p>
              <p className="mt-1 text-muted-foreground">
                {result.added} song{result.added === 1 ? '' : 's'} added
                {result.skipped > 0 && `, ${result.skipped} skipped (unavailable on YouTube)`}.
              </p>
              {!!result.stopped && <p className="mt-2 text-foreground">{friendlyYouTubeError(result.stopped)}</p>}
              {!!result.coverError && <p className="mt-2 text-muted-foreground">Cover picture not set: {result.coverError}</p>}
              {(!!result.stopped || result.cancelled) && result.playlistId && (
                <p className="mt-2 text-muted-foreground">Open this window again later to add the remaining songs to the same YouTube playlist.</p>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {result.playlistId && (
                <Button asChild className="flex-1 gap-2">
                  <a href={youtubePlaylistUrl(result.playlistId)} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" /> Open on YouTube
                  </a>
                </Button>
              )}
              <Button variant="outline" className="flex-1" onClick={() => close(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : busy ? (
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {phase === 'signing' ? 'Waiting for Google sign-in…' : 'Adding songs to YouTube…'}
                </span>
                {phase === 'uploading' && (
                  <span className="tabular-nums text-muted-foreground">
                    {progress.done} / {progress.total}
                  </span>
                )}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${phase === 'signing' ? 0 : pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Keep this window open until it finishes.</p>
            </div>
            {phase === 'uploading' && (
              <Button variant="outline" className="w-full" onClick={() => abortRef.current?.abort()}>
                Stop
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="yt-title" className="text-sm font-medium">
                Playlist name on YouTube
              </label>
              <Input id="yt-title" value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} disabled={uploadedBefore} />
            </div>

            {!record?.coverSet && (
              <div className="space-y-2">
                <span className="text-sm font-medium">Cover picture (optional)</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => pickCover(e.target.files?.[0])}
                />
                {coverPreview ? (
                  <div className="flex items-center gap-3">
                    <img src={coverPreview} alt="Playlist cover preview" className="h-16 w-16 rounded-lg border border-border object-cover" />
                    <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setCover(null)}>
                      <X className="h-4 w-4" /> Remove
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                      Change
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" className="w-full gap-2" onClick={() => fileRef.current?.click()}>
                    <ImagePlus className="h-4 w-4" /> Choose a picture
                  </Button>
                )}
                <p className="text-[11px] leading-tight text-muted-foreground">It's cropped to a square automatically, like on YouTube.</p>
              </div>
            )}

            {!uploadedBefore && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Who can see it</legend>
                <div className="grid grid-cols-3 gap-2">
                  {PRIVACY.map(({ id, label, hint, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPrivacy(id)}
                      aria-pressed={privacy === id}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-colors',
                        privacy === id ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-secondary/40 text-muted-foreground hover:bg-secondary/70',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-sm font-semibold">{label}</span>
                      <span className="text-[10px] leading-tight opacity-70">{hint}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            <div className="rounded-xl border border-border bg-secondary/40 p-3 text-sm">
              {uploadedBefore ? (
                <>
                  <p className="text-foreground">You already uploaded this playlist ({record!.addedIds.length} songs).</p>
                  <p className="mt-1 text-muted-foreground">
                    {newSongs > 0 ? `${newSongs} new song${newSongs === 1 ? '' : 's'} will be added to the same YouTube playlist.` : "It's up to date, so there is nothing new to add."}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    <a href={youtubePlaylistUrl(record!.youtubePlaylistId)} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
                      Open it on YouTube
                    </a>
                    <button type="button" onClick={startOver} className="text-muted-foreground underline-offset-2 hover:underline">
                      Make a new YouTube playlist instead
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-foreground">
                  {videoIds.length} song{videoIds.length === 1 ? '' : 's'} will be uploaded.
                </p>
              )}
              {uploadedBefore && unavailable > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {unavailable} song{unavailable === 1 ? ' is' : 's are'} unavailable on YouTube, so {unavailable === 1 ? 'it was' : 'they were'} left out.
                </p>
              )}
              {notYouTube > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {notYouTube} song{notYouTube === 1 ? '' : 's'} can't be uploaded because {notYouTube === 1 ? 'it isn' : 'they aren'}'t from YouTube.
                </p>
              )}
            </div>

            <Button className="w-full gap-2" onClick={start} disabled={videoIds.length === 0 || (uploadedBefore && newSongs === 0)}>
              <Youtube className="h-4 w-4" />
              {uploadedBefore ? (newSongs > 0 ? `Add ${newSongs} new song${newSongs === 1 ? '' : 's'}` : 'Up to date') : 'Sign in with Google & upload'}
            </Button>
            {videoIds.length === 0 && <p className="text-center text-xs text-muted-foreground">This playlist has no YouTube songs to upload.</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ExportToYouTubeDialog;
