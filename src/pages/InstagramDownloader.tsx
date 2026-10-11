import { useEffect, useState } from 'react';
import { Instagram, ClipboardPaste, Loader2, Music, Video, Film, Download, AlertCircle, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import SEO from '@/components/SEO';
import { cn } from '@/lib/utils';

type Mode = 'audio' | 'video' | 'both';

interface MediaInfo {
  url: string;
  id?: string;
  title: string;
  uploader: string | null;
  duration: number | null;
  thumbnail: string | null;
  hasAudio: boolean;
  hasVideo: boolean;
}

const OPTIONS: { mode: Mode; label: string; sub: string; icon: typeof Music }[] = [
  { mode: 'audio', label: 'Music only', sub: 'MP3 audio', icon: Music },
  { mode: 'video', label: 'Video only', sub: 'MP4, no sound', icon: Video },
  { mode: 'both', label: 'Video + music', sub: 'MP4 with sound', icon: Film },
];

const formatDuration = (s: number | null) => {
  if (s == null) return '';
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};

const InstagramDownloader = () => {
  const [activeTab, setActiveTab] = useState('instagram');
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyMode, setBusyMode] = useState<Mode | null>(null);

  useEffect(() => {
    document.title = 'Instagram Reel & Story Downloader — NYRA';
  }, []);

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setLink(text.trim());
        setInfo(null);
        setError(null);
      }
    } catch {
      toast.error('Clipboard access was blocked. Paste the link manually.');
    }
  };

  const fetchInfo = async () => {
    const value = link.trim();
    if (!value) {
      setError('Paste an Instagram reel, post or story link first.');
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/instagram/info?url=${encodeURIComponent(value)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not load this link.');
      setInfo(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this link.');
    } finally {
      setLoading(false);
    }
  };

  const download = async (mode: Mode) => {
    if (!info || busyMode) return;
    setBusyMode(mode);
    try {
      const qs = new URLSearchParams({ url: info.url, mode, title: info.title });
      const res = await fetch(`/api/instagram/download?${qs.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Download failed.');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const plain = disposition.match(/filename="([^"]+)"/i);
      const fileName = utf8
        ? decodeURIComponent(utf8[1])
        : plain
          ? plain[1]
          : `instagram-${mode}.${mode === 'audio' ? 'mp3' : 'mp4'}`;

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
      toast.success('Download started');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed.');
    } finally {
      setBusyMode(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Instagram Reel & Story Downloader — NYRA"
        canonicalPath="/instagram"
        description="Paste an Instagram reel or story link and download the music only, the video only, or both."
      />
      <Navbar searchQuery="" onSearchChange={() => {}} onSearch={() => {}} />
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="md:ml-64 pt-20 pb-32 px-4 md:px-8 max-w-3xl mx-auto">
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.25em] mb-4">
            <Instagram className="w-3.5 h-3.5" />
            Reels &amp; Stories
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic">Grab the sound</h1>
          <p className="mt-3 text-sm md:text-base text-muted-foreground max-w-xl">
            Paste an Instagram reel or story link, then save the music only, the video only, or both in one go.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:p-6 backdrop-blur-xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchInfo();
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={link}
                onChange={(e) => {
                  setLink(e.target.value);
                  setError(null);
                }}
                placeholder="https://www.instagram.com/reel/..."
                inputMode="url"
                autoComplete="off"
                className="w-full h-12 pl-10 pr-12 rounded-2xl bg-black/30 border border-white/10 text-sm outline-none focus:border-primary/60"
              />
              <button
                type="button"
                onClick={pasteFromClipboard}
                aria-label="Paste from clipboard"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-white/5 active:scale-95"
              >
                <ClipboardPaste className="w-4 h-4" />
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="h-12 px-6 rounded-2xl bg-primary text-primary-foreground font-black uppercase text-xs tracking-widest active:scale-95 transition-transform disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {loading ? 'Checking' : 'Get'}
            </button>
          </form>

          {error && (
            <div className="mt-4 flex gap-2 items-start rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive-foreground">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
              <span>{error}</span>
            </div>
          )}

          {info && (
            <div className="mt-6">
              <div className="flex gap-4 items-center rounded-2xl border border-white/10 bg-black/20 p-3">
                {info.thumbnail ? (
                  <img
                    src={info.thumbnail}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-20 h-28 object-cover rounded-xl bg-white/5 shrink-0"
                  />
                ) : (
                  <div className="w-20 h-28 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                    <Instagram className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold text-sm line-clamp-2">{info.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {[info.uploader && `@${info.uploader}`, formatDuration(info.duration)].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                {OPTIONS.map(({ mode, label, sub, icon: Icon }) => {
                  const unavailable = mode === 'audio' && !info.hasAudio;
                  const busy = busyMode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => download(mode)}
                      disabled={!!busyMode || unavailable}
                      className={cn(
                        'rounded-2xl border p-4 text-left transition-all active:scale-95',
                        'border-white/10 bg-white/[0.03] hover:border-primary/60 hover:bg-primary/10',
                        'disabled:opacity-50 disabled:pointer-events-none',
                      )}
                    >
                      {busy ? (
                        <Loader2 className="w-6 h-6 mb-3 text-primary animate-spin" />
                      ) : (
                        <Icon className="w-6 h-6 mb-3 text-primary" />
                      )}
                      <p className="text-sm font-black uppercase tracking-tight">{label}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {busy ? 'Preparing file…' : unavailable ? 'No audio track' : sub}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <p className="mt-6 text-xs text-muted-foreground leading-relaxed">
          Works with public reels and posts. Stories can only be saved when they are publicly viewable to the server.
          Only download content you own or have permission to use, and respect the creator&apos;s rights.
        </p>
      </main>
    </div>
  );
};

export default InstagramDownloader;
