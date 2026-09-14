import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import CreatorDashboard from '@/components/CreatorDashboard';
import SEO from '@/components/SEO';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { ArrowLeft } from 'lucide-react';

const CreatorPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('creator');
  const [searchQuery, setSearchQuery] = useState('');
  const { handlePlayTrack } = useMusicPlayer();

  const personStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Sahal Shihabudheen',
    jobTitle: 'Founder & Lead Architect',
    description: 'Creator and Lead Developer of NYRA Music — High-Fidelity Music Streaming Platform with beat-reactive visualizers, AI DJ, and built-in Spotify playlists.',
    url: 'https://nyra-music-player.vercel.app/creator',
    sameAs: [
      'https://github.com/sahalshihabudheen-hash/glow-tune-stream',
      'https://github.com/sahalshihabudheen-hash'
    ],
    worksFor: {
      '@type': 'Organization',
      name: 'NYRA Music',
      url: 'https://nyra-music-player.vercel.app/'
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SEO
        title="Sahal Shihabudheen - Founder & Creator of NYRA Music"
        description="Meet Sahal Shihabudheen, Founder and Lead Developer of NYRA Music. Discover the high-fidelity audio engine, 3D visualizers, built-in Spotify playlists, and Sahal's signature soundtrack."
        canonicalPath="/creator"
        keywords="Sahal Shihabudheen, sahal shihabudheen, sahal shihabudheen nyra, made by sahal shihabudheen, sahal shihabudheen developer, NYRA music creator, founder of NYRA"
        ogType="profile"
        structuredData={personStructuredData}
      />
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearch={() => navigate(`/?q=${encodeURIComponent(searchQuery)}`)}
      />

      <main className="flex-1 md:ml-64 pt-24 pb-32 px-4 md:px-8 max-w-6xl mx-auto w-full">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-bold text-sm uppercase tracking-widest">Back to Home</span>
        </button>

        <CreatorDashboard onPlayTrack={handlePlayTrack} />
      </main>
    </div>
  );
};

export default CreatorPage;
