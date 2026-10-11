# DJ Mode — handoff notes (for the next AI / dev)

Goal: real DJ Mode in NYRA using JioSaavn as the processable audio source.

## Findings (verified in code)
- `src/hooks/useDjAudio.ts` was an EMPTY STUB (nothing real happened). `src/pages/DjMode.tsx` (1100 lines) already has a full console UI built on its API:
  `{state{balance,leftGain,rightGain,low,mid,high,active}, apply, init, reSync, unlock, getLevels, getBassLevel, getFrequencyData}`.
- Playback = two `<audio>` elements in `MusicPlayerContext` (primary/secondary, `audioRef` points at the active one).
  Web Audio only works if the element is CORS-enabled (`crossOrigin='anonymous'`), otherwise output is SILENT.
- JioSaavn: `supabase/functions/saavn-audio` returns direct CORS-open 320kbps CDN URLs. Until now only used by `DownloadManagerContext`.
- YouTube proxy (`get-audio-url`) is often blocked; Saavn is reliable.

## Plan / status
- [x] 0. Inspect codebase, write this note
- [x] 1. `src/lib/saavnSource.ts` + use Saavn FIRST in DJ-mode playback (MusicPlayerContext), keep CORS on both audio elements
- [x] 2. `src/lib/djEngine.ts` real Web Audio engine (L/R gain, balance, 3-band EQ, bass boost, master, analyser meters) + rewrite `useDjAudio` to use it
- [x] 3. Auto DJ engine: Chill / Club / Insane styles, smooth LFO-based moves (no random jumps), instant manual takeover
- [x] 4. UI: bass boost, master volume, per-effect ON/OFF, L-only/R-only, Auto DJ style picker in DjMode page
- [x] 5a. `vite build` passes
- [ ] 5b. REAL-DEVICE TEST (cannot be done in sandbox — no audio output): see checklist below

## Rules
- Do NOT break YouTube playback, downloads, playlists, auth. Only prefer Saavn when `useBackgroundAudioOnlyRef.current` (DJ mode) is true.
- Never commit secrets. Note: `.env` is currently tracked in this repo (owner was told to rotate keys).

## Progress log
- Engine done: `src/lib/djEngine.ts` (singleton) + `src/hooks/useDjAudio.ts` (useSyncExternalStore binding). Verified with a mocked AudioContext
  (L/R gains, balance, left-only/right-only, FX toggles, power-off=flat, Auto DJ smoothness for chill/club/insane, manual takeover).
- Auto DJ = smooth beat-aware OFFSETS on top of manual values (never overwrites them). BPM from low-band onset detection.
- Known limitation: `createMediaElementSource` is irreversible per element. After DJ mode attaches an element, a NON-CORS raw fallback
  stream (playAudioUrl(url, null)) would be silent on that element. Normal playback uses CORS proxy/blob so it's fine.
- Step 4 DONE (src/pages/DjMode.tsx): old random-interval Auto DJ removed -> engine Auto DJ. Added Chill/Club/Insane picker, Master + Bass Boost sliders,
  Left-only/Stereo/Right-only, FX ON/OFF chips (L/R+Balance, 3-band EQ, Bass), Auto-move chips (Pan/Bass/Filter/Pump), "Take manual control", live spectrum, BPM,
  Reset-everything. Deck gain sliders capped at 100%. Crossfader shows live (auto-moved) balance; slider keeps manual value.
- Track search/playlist import "DJ-ready" check (`src/lib/djStream.ts`) is now JioSaavn-first (YouTube proxy probe is only a fallback).

## Device test checklist (do this next, with headphones, in Chrome + Android/iOS)
1. DJ page -> Tracks -> search a song -> play. Should say "DJ Engine Ready"; hear audio normally.
2. Left only / Right only -> sound must come from only that ear. Deck gain L=50% R=70% audible difference.
3. Bass Boost to ~80% -> fuller bass, no crackle. 3-band faders audibly change tone.
4. Auto DJ: try Chill (slow gentle drift), Club (wider pan + pump), Insane (fast). "Take manual control" must glide back instantly.
5. Leave DJ page, play a normal YouTube/offline track -> must still play & downloads still work.
If a track is silent after enabling: that element is not CORS-enabled (check `[DJ] element is not CORS-enabled` in console).
