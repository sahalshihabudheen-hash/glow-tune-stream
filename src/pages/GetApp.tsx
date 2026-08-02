import { useEffect, useState } from 'react';
import { Smartphone, Monitor, Download, Apple, Terminal, CheckCircle2, Music4 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { cn } from '@/lib/utils';

const platforms = [
  {
    id: 'android',
    label: 'Android',
    icon: Smartphone,
    tagline: 'Native app with background playback & car controls',
    steps: [
      'Download the NYRA .apk from your Downloads section or the link below.',
      'Allow "Install unknown apps" for your browser when prompted.',
      'Open the file and tap Install — NYRA appears on your home screen.',
    ],
  },
  {
    id: 'windows',
    label: 'Windows',
    icon: Monitor,
    tagline: 'Desktop app with rich Discord presence',
    steps: [
      'Download the NYRA desktop package (.zip).',
      'Extract it anywhere, then run NYRA.exe.',
      'Discord shows what you are listening to automatically.',
    ],
  },
  {
    id: 'macos',
    label: 'macOS',
    icon: Apple,
    tagline: 'Universal desktop build',
    steps: [
      'Download the macOS .zip build.',
      'Unzip and drag NYRA.app into Applications.',
      'Right-click → Open the first time to bypass Gatekeeper.',
    ],
  },
  {
    id: 'linux',
    label: 'Linux',
    icon: Terminal,
    tagline: 'Portable tarball build',
    steps: [
      'Download the linux-x64 tarball.',
      'tar xzf NYRA-linux-x64.tar.gz',
      './NYRA-linux-x64/NYRA',
    ],
  },
];

const GetApp = () => {
  const [activeTab, setActiveTab] = useState('get-app');
  const [selected, setSelected] = useState('android');
  const [apkUrl, setApkUrl] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Get the NYRA App — Mobile & Desktop Downloads';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        'content',
        'Download NYRA for Android, Windows, macOS and Linux. Offline playlists, background playback and Discord Rich Presence.',
      );
    }
  }, []);

  useEffect(() => {
    // The Android build is published through the admin APK manager.
    setApkUrl('/downloads/nyra-latest.apk');
  }, []);

  const active = platforms.find(p => p.id === selected)!;
  const ActiveIcon = active.icon;

  return (
    <div className="min-h-screen bg-background">
      <Navbar searchQuery="" onSearchChange={() => {}} onSearch={() => {}} />
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="md:ml-64 pt-20 pb-32 px-4 md:px-8 max-w-5xl mx-auto">
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.25em] mb-4">
            <Music4 className="w-3.5 h-3.5" />
            Native builds
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic">
            Get NYRA everywhere
          </h1>
          <p className="mt-3 text-sm md:text-base text-muted-foreground max-w-2xl">
            Install NYRA as a real app. Phones get background audio and offline playlists.
            Desktop adds a beautiful Discord presence showing the track, artwork and a live progress bar.
          </p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {platforms.map(platform => {
            const Icon = platform.icon;
            const isActive = platform.id === selected;
            return (
              <button
                key={platform.id}
                onClick={() => setSelected(platform.id)}
                className={cn(
                  'rounded-2xl border p-4 text-left transition-all active:scale-95',
                  isActive
                    ? 'border-primary bg-primary/10 shadow-[0_0_30px_hsl(var(--primary)/0.25)]'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/20',
                )}
              >
                <Icon className={cn('w-6 h-6 mb-3', isActive ? 'text-primary' : 'text-muted-foreground')} />
                <p className="text-sm font-black uppercase tracking-tight">{platform.label}</p>
                <p className="text-[10px] text-muted-foreground leading-snug mt-1">{platform.tagline}</p>
              </button>
            );
          })}
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-primary/10 text-primary">
              <ActiveIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{active.label}</h2>
              <p className="text-xs text-muted-foreground">{active.tagline}</p>
            </div>
          </div>

          <ol className="space-y-3 mb-8">
            {active.steps.map((step, index) => (
              <li key={index} className="flex gap-3 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <span>{step}</span>
              </li>
            ))}
          </ol>

          {selected === 'android' ? (
            <a
              href={apkUrl || '#'}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-black uppercase text-xs tracking-widest active:scale-95 transition-transform"
            >
              <Download className="w-4 h-4" />
              Download APK
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">
              Desktop builds are produced from the repository with{' '}
              <code className="px-1.5 py-0.5 rounded bg-white/10">npm run desktop:package</code>. The
              packaged app opens NYRA in its own window with Discord Rich Presence enabled.
            </p>
          )}
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
          <h2 className="text-lg font-black uppercase tracking-tight mb-3">What the desktop app adds</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Discord Rich Presence with cover art, song title, artist and a live progress bar.</li>
            <li>• Its own window, media keys, and no browser chrome.</li>
            <li>• Playlists and artwork cached locally so everything loads instantly.</li>
          </ul>
        </section>
      </main>
    </div>
  );
};

export default GetApp;
