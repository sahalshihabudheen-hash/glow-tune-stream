import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { MusicPlayerProvider } from "@/contexts/MusicPlayerContext";
import { DownloadManagerProvider } from "@/contexts/DownloadManagerContext";
import FloatingMiniPlayer from "@/components/FloatingMiniPlayer";

import DownloadQueue from "@/components/DownloadQueue";
import MaintenanceGuard from "@/components/MaintenanceGuard";
import TutorialWrapper from "@/components/TutorialWrapper";
import Index from "./pages/Index";
import SongDetails from "./pages/SongDetails";
import PlaylistView from "./pages/PlaylistView";
import PlaylistsManager from "./pages/PlaylistsManager";
import Auth from "./pages/Auth";
import Settings from "./pages/Settings";
import Artists from "./pages/Artists";
import ArtistProfile from "./pages/ArtistProfile";
import BecomeArtist from "./pages/BecomeArtist";
import Favorites from "./pages/Favorites";
import Admin from "./pages/Admin";
import Games from "./pages/Games";
import AiDj from "./pages/AiDj";
import YouTubeArtistPage from "./pages/YouTubeArtistPage";
import OfflineDownloads from "./pages/OfflineDownloads";
import GetApp from "./pages/GetApp";
import Debug from "./pages/Debug";
import DiscordPresence from "./hooks/useDiscordPresence";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Electron loads the bundle from file:// where history routing cannot work.
const Router = typeof window !== "undefined" && window.location.protocol === "file:" ? HashRouter : BrowserRouter;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Router>
          <MusicPlayerProvider>
            <DownloadManagerProvider>
            <DiscordPresence />
            <MaintenanceGuard>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/song/:id" element={<SongDetails />} />
                <Route path="/playlists" element={<PlaylistsManager />} />
                <Route path="/playlist/:id" element={<PlaylistView />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/artists" element={<Artists />} />
                <Route path="/artist/:id" element={<ArtistProfile />} />
                <Route path="/become-artist" element={<BecomeArtist />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/ai-dj" element={<AiDj />} />
                <Route path="/games" element={<Games />} />
                <Route path="/yt-artist/:channelId" element={<YouTubeArtistPage />} />
                <Route path="/offline" element={<OfflineDownloads />} />
                <Route path="/get-app" element={<GetApp />} />
                <Route path="/debug" element={<Debug />} />
                {/* Aliases so common/legacy links never hit the 404 page */}
                <Route path="/home" element={<Index />} />
                <Route path="/index" element={<Index />} />
                <Route path="/search" element={<Index />} />
                <Route path="/downloads" element={<OfflineDownloads />} />
                <Route path="/offline-downloads" element={<OfflineDownloads />} />
                <Route path="/playlist" element={<PlaylistsManager />} />
                <Route path="/app" element={<GetApp />} />
                <Route path="/download-app" element={<GetApp />} />
                <Route path="/aidj" element={<AiDj />} />
                <Route path="/dj" element={<AiDj />} />
                <Route path="/dj-mode" element={<AiDj />} />

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              <FloatingMiniPlayer />
              <DownloadQueue />
              <TutorialWrapper />
            </MaintenanceGuard>
            </DownloadManagerProvider>
          </MusicPlayerProvider>
        </Router>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
