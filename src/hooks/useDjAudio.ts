import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { djEngine, type DjPatch } from '@/lib/djEngine';

export type { DjState, DjPatch, DjAutoStyle, DjChannelMode } from '@/lib/djEngine';

/**
 * React binding for the shared DJ engine (src/lib/djEngine.ts).
 * All components share ONE engine, so DJ page, equalizer panel and visualizers stay in sync.
 * API is backwards-compatible with the previous stub: state / apply / init / reSync / unlock /
 * getLevels / getBassLevel / getFrequencyData — now actually processing audio.
 */
export function useDjAudio(
  providedAudioRef?: React.MutableRefObject<HTMLAudioElement | null>,
  providedIsPlaying?: boolean
) {
  const state = useSyncExternalStore(djEngine.subscribe, () => djEngine.state, () => djEngine.state);

  const apply = useCallback((next: DjPatch) => djEngine.set(next), []);

  const unlock = useCallback(() => djEngine.unlock(), []);

  /** Power the DJ engine on and route the active <audio> element through it. */
  const init = useCallback((): boolean => {
    djEngine.unlock();
    const ok = djEngine.connect(providedAudioRef?.current);
    if (ok) djEngine.setActive(true);
    return ok;
  }, [providedAudioRef]);

  /** Re-attach after a track/element change (no-op if already attached). */
  const reSync = useCallback((): boolean => {
    const ok = djEngine.connect(providedAudioRef?.current);
    if (ok && djEngine.state.active && !djEngine.running) djEngine.unlock();
    return ok && djEngine.state.active;
  }, [providedAudioRef]);

  const setActive = useCallback((on: boolean) => djEngine.setActive(on), []);
  const reset = useCallback(() => djEngine.reset(), []);
  const getLevels = useCallback(() => djEngine.getLevels(), []);
  const getBassLevel = useCallback(() => djEngine.getBassLevel(), []);
  const getFrequencyData = useCallback(() => djEngine.getFrequencyData(), []);
  const getLive = useCallback(() => djEngine.getLive(), []);
  const getBpm = useCallback(() => djEngine.getBpm(), []);
  const getBeatPhase = useCallback(() => djEngine.getBeatPhase(), []);
  const getAutoOffsets = useCallback(() => djEngine.getAutoOffsets(), []);

  // Keep the engine alive across play/pause + element swaps (browsers suspend idle AudioContexts).
  useEffect(() => {
    if (!djEngine.state.active) return;
    const el = providedAudioRef?.current;
    if (el && !djEngine.isAttached(el)) djEngine.connect(el);
    if (providedIsPlaying && !djEngine.running) djEngine.unlock();
  }, [providedAudioRef, providedIsPlaying]);

  return {
    state, apply, init, reSync, unlock, setActive, reset,
    getLevels, getBassLevel, getFrequencyData, getLive, getBpm, getBeatPhase, getAutoOffsets,
  };
}
