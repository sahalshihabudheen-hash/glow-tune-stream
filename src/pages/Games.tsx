import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import MusicPlayer from '@/components/MusicPlayer';
import SnakeGame from '@/components/games/SnakeGame';
import Game2048 from '@/components/games/Game2048';
import MemoryGame from '@/components/games/MemoryGame';
import RollingSkyGame from '@/components/games/RollingSkyGame';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Gamepad2, Grid3X3, Brain, ArrowLeft, Disc } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import SEO from '@/components/SEO';

const Games = () => {
  const [activeTab, setActiveTab] = useState('games');
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO 
        title="Music Games Arcade" 
        canonicalPath="/games"
        description="Play interactive rhythm and casual arcade games like Rolling Sky, 2048, Snake, and Memory Match on NYRA while streaming music."
      />
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="md:ml-64">
        {/* Simple Header */}
        <header className="fixed top-0 left-0 md:left-64 right-0 h-16 md:h-20 bg-background/80 backdrop-blur-xl border-b border-border z-30 flex items-center px-4 md:px-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="mr-4">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold theme-gradient-text">Games Arcade</h1>
        </header>

        <main className="p-4 md:p-8 pb-32 pt-24 md:pt-28">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl md:text-4xl font-bold theme-gradient-text mb-2">
              🎮 Games Arcade
            </h1>
            <p className="text-muted-foreground">
              Play games while enjoying your music!
            </p>
          </div>

          {/* Games Tabs */}
          <Tabs defaultValue="rolling-sky" className="w-full">
            <TabsList className="grid w-full max-w-lg mx-auto grid-cols-4 mb-8">
              <TabsTrigger value="rolling-sky" className="gap-2">
                <Disc className="w-4 h-4" />
                <span className="hidden sm:inline">Rolling Sky</span>
              </TabsTrigger>
              <TabsTrigger value="snake" className="gap-2">
                <Gamepad2 className="w-4 h-4" />
                <span className="hidden sm:inline">Snake</span>
              </TabsTrigger>
              <TabsTrigger value="2048" className="gap-2">
                <Grid3X3 className="w-4 h-4" />
                <span className="hidden sm:inline">2048</span>
              </TabsTrigger>
              <TabsTrigger value="memory" className="gap-2">
                <Brain className="w-4 h-4" />
                <span className="hidden sm:inline">Memory</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex justify-center">
              <div className="glass-premium p-6 rounded-2xl">
                <TabsContent value="rolling-sky" className="mt-0">
                  <RollingSkyGame />
                </TabsContent>

                <TabsContent value="snake" className="mt-0">
                  <SnakeGame />
                </TabsContent>

                <TabsContent value="2048" className="mt-0">
                  <Game2048 />
                </TabsContent>

                <TabsContent value="memory" className="mt-0">
                  <MemoryGame />
                </TabsContent>
              </div>
            </div>
          </Tabs>

          {/* Tip */}
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              💡 Tip: Your music keeps playing while you game! 
              <span className="hidden sm:inline"> Start a playlist from the sidebar and enjoy.</span>
            </p>
          </div>
        </main>
      </div>

      <MusicPlayer
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying(!isPlaying)}
        onNext={() => {}}
        onPrevious={() => {}}
      />
    </div>
  );
};

export default Games;
