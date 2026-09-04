import { useState, useCallback } from 'react';

interface DjState {
  balance: number;
  leftGain: number;
  rightGain: number;
  low: number;
  mid: number;
  high: number;
  active: boolean;
}

export function useDjAudio(
  _providedAudioRef?: React.MutableRefObject<HTMLAudioElement | null>,
  _providedIsPlaying?: boolean
) {
  const [state, setState] = useState<DjState>({
    balance: 0, leftGain: 1, rightGain: 1,
    low: 0, mid: 0, high: 0, active: false,
  });

  const apply = useCallback((next: DjState) => {
    setState({ ...next, active: false });
  }, []);

  const init = useCallback(() => false, []);
  const reSync = useCallback(() => false, []);
  const unlock = useCallback(() => {}, []);
  const getLevels = useCallback(() => ({ left: 0, right: 0 }), []);
  const getBassLevel = useCallback(() => 0, []);
  const getFrequencyData = useCallback(() => new Uint8Array(16), []);

  return { state, apply, init, reSync, getLevels, getBassLevel, getFrequencyData, unlock };
}
