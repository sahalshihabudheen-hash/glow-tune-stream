import { useEffect, useState } from "react";
import { useMusicPlayer } from "@/contexts/MusicPlayerContext";
import { isNative } from "@/lib/nyraMediaBridge";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

const YT_STATES: Record<number, string> = {
  [-1]: "unstarted",
  0: "ended",
  1: "playing",
  2: "paused",
  3: "buffering",
  5: "cued",
};

interface Snapshot {
  playbackState: string;
  videoId: string;
  source: string;
  audioState: string;
  audioSrc: string;
  position: string;
  duration: string;
  hidden: string;
  online: string;
  native: string;
  nativeService: string;
  backgroundOnly: string;
  mediaSession: string;
}

const Debug = () => {
  const { currentTrack, isPlaying, activeSource, useBackgroundAudioMode, ytPlayerRef, audioRef, useBackgroundAudioOnly } =
    useMusicPlayer();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const read = (): Snapshot => {
      const yt = ytPlayerRef?.current as any;
      const audio = audioRef?.current as HTMLAudioElement | null;

      let ytState = "n/a";
      let videoId = currentTrack?.id || "none";
      try {
        if (yt?.getPlayerState) ytState = YT_STATES[yt.getPlayerState()] ?? String(yt.getPlayerState());
        const data = yt?.getVideoData?.();
        if (data?.video_id) videoId = data.video_id;
      } catch {
        ytState = "unavailable";
      }

      let audioState = "n/a";
      if (audio) {
        if (!audio.src) audioState = "no source";
        else if (audio.readyState < 3) audioState = "buffering";
        else if (audio.paused) audioState = "paused";
        else audioState = "playing";
      }

      const effective =
        activeSource === "background"
          ? audioState
          : activeSource === "youtube"
            ? ytState
            : isPlaying
              ? "playing"
              : "paused";

      const pos = activeSource === "background" ? audio?.currentTime ?? 0 : (() => { try { return yt?.getCurrentTime?.() ?? 0; } catch { return 0; } })();
      const dur = activeSource === "background" ? audio?.duration ?? 0 : (() => { try { return yt?.getDuration?.() ?? 0; } catch { return 0; } })();

      const cap = (window as any).Capacitor;
      const nativeActive = isNative();
      const hasMediaPlugin = !!cap?.Plugins?.NyraMedia || !!cap?.registerPlugin;

      return {
        playbackState: effective,
        videoId,
        source: activeSource ?? "none",
        audioState,
        audioSrc: audio?.src ? `${audio.src.slice(0, 70)}…` : "none",
        position: `${pos.toFixed(1)}s`,
        duration: Number.isFinite(dur) && dur > 0 ? `${dur.toFixed(1)}s` : "unknown",
        hidden: document.visibilityState,
        online: navigator.onLine ? "online" : "offline",
        native: nativeActive ? "yes (Capacitor)" : "no (browser)",
        nativeService: nativeActive
          ? hasMediaPlugin
            ? "active (NyraMedia media session bound)"
            : "plugin not registered"
          : "not applicable in browser",
        backgroundOnly: useBackgroundAudioOnly ? "forced" : useBackgroundAudioMode ? "auto (background)" : "iframe preferred",
        mediaSession: "mediaSession" in navigator ? navigator.mediaSession.playbackState || "none" : "unsupported",
      };
    };

    setSnap(read());
    const id = setInterval(() => setSnap(read()), 500);
    return () => clearInterval(id);
  }, [currentTrack, isPlaying, activeSource, useBackgroundAudioMode, useBackgroundAudioOnly, ytPlayerRef, audioRef, tick]);

  const rows: [string, string][] = snap
    ? [
        ["Playback state", snap.playbackState],
        ["Current YouTube videoId", snap.videoId],
        ["Track title", currentTrack?.title || "none"],
        ["Active source", snap.source],
        ["Context isPlaying flag", isPlaying ? "true" : "false"],
        ["Native shell", snap.native],
        ["Native background service", snap.nativeService],
        ["Audio element state", snap.audioState],
        ["Audio stream URL", snap.audioSrc],
        ["Position", snap.position],
        ["Duration", snap.duration],
        ["Playback mode", snap.backgroundOnly],
        ["Media Session state", snap.mediaSession],
        ["Page visibility", snap.hidden],
        ["Network", snap.online],
      ]
    : [];

  const stateTone = (s: string) =>
    s === "playing" ? "bg-primary/20 text-primary" : s === "buffering" ? "bg-yellow-500/20 text-yellow-500" : "bg-muted text-muted-foreground";

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Playback Debug</h1>
          <p className="text-sm text-muted-foreground">Live diagnostics, refreshed twice per second.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setTick((t) => t + 1)}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className={stateTone(snap?.playbackState || "")}>{snap?.playbackState || "idle"}</Badge>
          <Badge variant="outline">source: {snap?.source}</Badge>
          <Badge variant="outline">videoId: {snap?.videoId}</Badge>
        </div>
      </Card>

      <Card className="divide-y divide-border p-0">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 px-5 py-3 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="break-all text-right font-mono">{value}</span>
          </div>
        ))}
      </Card>
    </div>
  );
};

export default Debug;
