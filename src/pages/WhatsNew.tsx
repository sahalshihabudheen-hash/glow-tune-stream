import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Megaphone } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import SEO from '@/components/SEO';
import WhatsNewContent from '@/components/WhatsNewContent';
import { WHATS_NEW_GRADIENT } from '@/components/WhatsNewOverlay';
import { useTheme } from '@/contexts/ThemeContext';
import { useUpdates } from '@/hooks/useUpdates';
import { pickLatest } from '@/lib/updates';

/** The full list of published updates. Only available once the user turns it on in Settings. */
const WhatsNew = () => {
  const navigate = useNavigate();
  const { settings, updateSettings } = useTheme();
  const { published, loading } = useUpdates();
  const latest = pickLatest(published);

  return (
    <div className="min-h-screen bg-background">
      <SEO title="What's new — NYRA" canonicalPath="/whats-new" description="See what changed in the latest NYRA updates." />
      <Navbar searchQuery="" onSearchChange={() => {}} onSearch={() => {}} />
      <Sidebar activeTab="whats-new" onTabChange={() => {}} />

      <main className="md:ml-64 pt-20 pb-32 px-4 md:px-8 max-w-3xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="mb-2 flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>

        <h1 className={`mb-6 text-4xl font-semibold tracking-tight md:text-5xl ${WHATS_NEW_GRADIENT}`}>What&apos;s new</h1>

        {!settings.showWhatsNew ? (
          <section className="rounded-2xl border border-border bg-card/70 p-8 text-center">
            <Megaphone className="mx-auto mb-3 h-8 w-8 text-primary" />
            <p className="mb-5 text-muted-foreground">The What&apos;s new page is turned off.</p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <button
                onClick={() => updateSettings({ showWhatsNew: true })}
                className="h-11 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Turn on
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="h-11 rounded-xl border border-border px-6 text-sm font-medium transition-colors hover:bg-secondary"
              >
                Open Settings
              </button>
            </div>
          </section>
        ) : loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : published.length === 0 ? (
          <section className="rounded-2xl border border-border bg-card/70 p-8 text-center text-muted-foreground">
            No updates have been published yet.
          </section>
        ) : (
          <WhatsNewContent releases={published} latestId={latest?.id} />
        )}
      </main>
    </div>
  );
};

export default WhatsNew;
