// NYRA DJ engine — a real Web Audio processing chain (not visual-only).
//
//  <audio> ─▶ MediaElementSource ─▶ input(stereo upmix) ─▶ lowShelf ─▶ midPeak ─▶ highShelf
//        ─▶ bassShelf ─▶ bassPeak ─▶ splitter ─▶ gainL / gainR ─▶ merger ─▶ master ─▶ limiter ─▶ out
//                                                         └─▶ meters (L/R) + spectrum analyser
//
// Requirements / safety:
//  * Web Audio only gets samples from CORS-enabled media. Elements playing a non-CORS URL would go
//    SILENT once routed through the graph, so we refuse to attach those (connect() returns false).
//  * createMediaElementSource() is irreversible per element, so the graph stays connected and we
//    simply go "neutral" (flat EQ, unity gains) when DJ mode is switched off.
//  * Every parameter change is smoothed (setTargetAtTime) to avoid clicks/zipper noise, and a
//    limiter sits at the end so bass boost can never clip/distort.
//  * Auto DJ never overwrites the user's manual settings. It adds smooth, beat-aware OFFSETS on top
//    of them, so switching back to manual is instant and lossless.

export type DjChannelMode = 'stereo' | 'left' | 'right';
export type DjAutoStyle = 'chill' | 'club' | 'insane';

export interface DjState {
  active: boolean;
  balance: number; // -1 (L) .. 1 (R)
  leftGain: number; // 0..1.5
  rightGain: number; // 0..1.5
  low: number; // dB  -12..12
  mid: number;
  high: number;
  bassBoost: number; // 0..1
  master: number; // 0..1.5
  channelMode: DjChannelMode;
  fx: { channels: boolean; eq: boolean; bass: boolean };
  auto: { enabled: boolean; style: DjAutoStyle; pan: boolean; bass: boolean; filter: boolean; pump: boolean };
}

export const DEFAULT_DJ_STATE: DjState = {
  active: false,
  balance: 0,
  leftGain: 1,
  rightGain: 1,
  low: 0,
  mid: 0,
  high: 0,
  bassBoost: 0,
  master: 1,
  channelMode: 'stereo',
  fx: { channels: true, eq: true, bass: true },
  auto: { enabled: false, style: 'club', pan: true, bass: true, filter: true, pump: true },
};

interface AutoOffsets {
  pan: number; // added to balance
  gL: number; // multiplier on left
  gR: number; // multiplier on right
  bass: number; // added to bassBoost (0..1)
  low: number; // dB
  mid: number; // dB
  high: number; // dB
  pump: number; // multiplier on master
}

const NEUTRAL: AutoOffsets = { pan: 0, gL: 1, gR: 1, bass: 0, low: 0, mid: 0, high: 0, pump: 1 };

interface StyleCfg {
  panDepth: number; // peak auto-pan amount (0..1)
  panBeats: number; // beats per full L→R→L sweep
  minChannel: number; // floor for channel gain multiplier (keeps it comfortable)
  bassAdd: number; // extra bass boost at peak
  eqSweepDb: number; // filter/EQ movement
  pumpDepth: number; // sidechain-style duck depth
  slew: number; // max change per second for pan (units/s)
  sceneBeats: number; // beats per "scene"
}

const STYLES: Record<DjAutoStyle, StyleCfg> = {
  chill: { panDepth: 0.35, panBeats: 32, minChannel: 0.7, bassAdd: 0.15, eqSweepDb: 2.5, pumpDepth: 0, slew: 0.35, sceneBeats: 32 },
  club: { panDepth: 0.65, panBeats: 16, minChannel: 0.45, bassAdd: 0.3, eqSweepDb: 5, pumpDepth: 0.16, slew: 1.1, sceneBeats: 16 },
  insane: { panDepth: 1, panBeats: 4, minChannel: 0.2, bassAdd: 0.45, eqSweepDb: 8, pumpDepth: 0.3, slew: 3.2, sceneBeats: 8 },
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const dbToGain = (db: number) => Math.pow(10, db / 20);

type Listener = () => void;

class DjEngine {
  state: DjState = JSON.parse(JSON.stringify(DEFAULT_DJ_STATE));
  private listeners = new Set<Listener>();

  private ctx: AudioContext | null = null;
  private sources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
  private attached = new WeakSet<HTMLMediaElement>();
  private lastElement: HTMLMediaElement | null = null;

  private input!: GainNode;
  private lowShelf!: BiquadFilterNode;
  private midPeak!: BiquadFilterNode;
  private highShelf!: BiquadFilterNode;
  private bassShelf!: BiquadFilterNode;
  private bassPeak!: BiquadFilterNode;
  private gainL!: GainNode;
  private gainR!: GainNode;
  private master!: GainNode;
  private limiter!: DynamicsCompressorNode;
  private anaL!: AnalyserNode;
  private anaR!: AnalyserNode;
  private anaMix!: AnalyserNode;
  private bufL = new Float32Array(256);
  private bufR = new Float32Array(256);
  private freq = new Uint8Array(512);
  private freqOut = new Uint8Array(16);

  // ── Auto DJ runtime ──
  private autoTimer: number | null = null;
  private off: AutoOffsets = { ...NEUTRAL };
  private tgt: AutoOffsets = { ...NEUTRAL };
  private lastTick = 0;
  private bpm = 120;
  private beatOrigin = 0; // ctx time at which a beat occurred
  private onsets: number[] = [];
  private lastEnergy = 0;
  private lastOnset = 0;
  private scene = 0;
  private sceneIdx = -1;

  /* ───────────── subscription (for React) ───────────── */
  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };
  private emit() { this.listeners.forEach(l => l()); }

  /* ───────────── context + graph ───────────── */
  private ensureGraph(): boolean {
    if (this.ctx) return true;
    const Ctor: typeof AudioContext | undefined = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return false;
    try {
      const ctx = new Ctor({ latencyHint: 'playback' });
      this.ctx = ctx;

      // stereo upmix so MONO sources feed both channels (otherwise right channel would be silent)
      this.input = ctx.createGain();
      this.input.channelCount = 2;
      this.input.channelCountMode = 'explicit';
      this.input.channelInterpretation = 'speakers';

      this.lowShelf = ctx.createBiquadFilter();
      this.lowShelf.type = 'lowshelf';
      this.lowShelf.frequency.value = 160;
      this.midPeak = ctx.createBiquadFilter();
      this.midPeak.type = 'peaking';
      this.midPeak.frequency.value = 1000;
      this.midPeak.Q.value = 0.8;
      this.highShelf = ctx.createBiquadFilter();
      this.highShelf.type = 'highshelf';
      this.highShelf.frequency.value = 6000;

      // dedicated bass boost: smooth shelf + gentle peak around the kick/sub region
      this.bassShelf = ctx.createBiquadFilter();
      this.bassShelf.type = 'lowshelf';
      this.bassShelf.frequency.value = 90;
      this.bassPeak = ctx.createBiquadFilter();
      this.bassPeak.type = 'peaking';
      this.bassPeak.frequency.value = 62;
      this.bassPeak.Q.value = 0.9;

      const splitter = ctx.createChannelSplitter(2);
      const merger = ctx.createChannelMerger(2);
      this.gainL = ctx.createGain();
      this.gainR = ctx.createGain();
      this.master = ctx.createGain();

      // transparent limiter: stops distortion when boosting
      this.limiter = ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -4;
      this.limiter.knee.value = 6;
      this.limiter.ratio.value = 12;
      this.limiter.attack.value = 0.004;
      this.limiter.release.value = 0.16;

      this.anaL = ctx.createAnalyser();
      this.anaL.fftSize = 256;
      this.anaR = ctx.createAnalyser();
      this.anaR.fftSize = 256;
      this.anaMix = ctx.createAnalyser();
      this.anaMix.fftSize = 1024;
      this.anaMix.smoothingTimeConstant = 0.75;
      this.freq = new Uint8Array(this.anaMix.frequencyBinCount);

      this.input.connect(this.lowShelf);
      this.lowShelf.connect(this.midPeak);
      this.midPeak.connect(this.highShelf);
      this.highShelf.connect(this.bassShelf);
      this.bassShelf.connect(this.bassPeak);
      this.bassPeak.connect(splitter);
      splitter.connect(this.gainL, 0);
      splitter.connect(this.gainR, 1);
      this.gainL.connect(merger, 0, 0);
      this.gainR.connect(merger, 0, 1);
      merger.connect(this.master);
      this.master.connect(this.limiter);
      this.limiter.connect(ctx.destination);

      // meters + spectrum read post-channel (so they reflect what the user hears)
      const metSplit = ctx.createChannelSplitter(2);
      this.master.connect(metSplit);
      metSplit.connect(this.anaL, 0);
      metSplit.connect(this.anaR, 1);
      this.master.connect(this.anaMix);

      ctx.addEventListener('statechange', () => this.emit());
      this.applyParams(true);
      return true;
    } catch (e) {
      console.warn('[DJ] could not build audio graph', e);
      this.ctx = null;
      return false;
    }
  }

  /** Must be called from a user gesture (tap) at least once on iOS/Safari/Chrome. */
  unlock() {
    if (!this.ensureGraph()) return;
    if (this.ctx!.state !== 'running') this.ctx!.resume().catch(() => {});
  }

  private isCorsSafe(el: HTMLMediaElement) {
    const src = el.currentSrc || el.src || '';
    if (!src) return true; // nothing loaded yet; caller keeps CORS on before loading
    if (src.startsWith('blob:') || src.startsWith('data:')) return true; // same-origin
    try {
      if (new URL(src, location.href).origin === location.origin) return true;
    } catch { /* ignore */ }
    return el.crossOrigin === 'anonymous' || el.crossOrigin === 'use-credentials';
  }

  /** Route an <audio> element through the DJ chain. Returns false if unsafe/unsupported. */
  connect(el: HTMLMediaElement | null | undefined): boolean {
    if (!el) return false;
    if (!this.ensureGraph()) return false;
    this.lastElement = el;
    if (this.attached.has(el)) return true;
    if (!this.isCorsSafe(el)) {
      console.warn('[DJ] element is not CORS-enabled; refusing to attach (would be silent)');
      return false;
    }
    try {
      const node = this.ctx!.createMediaElementSource(el);
      node.connect(this.input);
      this.sources.set(el, node);
      this.attached.add(el);
      return true;
    } catch (e) {
      console.warn('[DJ] createMediaElementSource failed', e);
      return false;
    }
  }

  isAttached(el: HTMLMediaElement | null | undefined) { return !!el && this.attached.has(el); }
  get running() { return this.ctx?.state === 'running'; }

  /* ───────────── parameters ───────────── */
  private setParam(p: AudioParam, v: number, tc = 0.03, immediate = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    p.cancelScheduledValues(t);
    if (immediate) p.setValueAtTime(v, t);
    else p.setTargetAtTime(v, t, tc);
  }

  /** effective values = manual state (+ auto offsets) */
  getLive() {
    const s = this.state;
    const o = s.auto.enabled && s.active ? this.off : NEUTRAL;
    const neutral = !s.active;

    const chOn = s.fx.channels && !neutral;
    const balance = chOn ? clamp(s.balance + o.pan, -1, 1) : 0;
    let gl = chOn ? s.leftGain : 1;
    let gr = chOn ? s.rightGain : 1;
    gl *= (balance <= 0 ? 1 : 1 - balance) * (neutral ? 1 : o.gL);
    gr *= (balance >= 0 ? 1 : 1 + balance) * (neutral ? 1 : o.gR);
    if (!neutral && s.channelMode === 'left') gr = 0;
    if (!neutral && s.channelMode === 'right') gl = 0;

    const eqOn = s.fx.eq && !neutral;
    const bassOn = s.fx.bass && !neutral;
    const bass = bassOn ? clamp(s.bassBoost + o.bass, 0, 1) : 0;
    return {
      gainL: gl,
      gainR: gr,
      low: eqOn ? clamp(s.low + o.low, -12, 12) : 0,
      mid: eqOn ? clamp(s.mid + o.mid, -12, 12) : 0,
      high: eqOn ? clamp(s.high + o.high, -12, 12) : 0,
      bass,
      master: neutral ? 1 : s.master * o.pump,
    };
  }

  private applyParams(immediate = false) {
    if (!this.ctx) return;
    const v = this.getLive();
    const tc = 0.035;
    this.setParam(this.gainL.gain, v.gainL, tc, immediate);
    this.setParam(this.gainR.gain, v.gainR, tc, immediate);
    this.setParam(this.lowShelf.gain, v.low, tc, immediate);
    this.setParam(this.midPeak.gain, v.mid, tc, immediate);
    this.setParam(this.highShelf.gain, v.high, tc, immediate);
    // bass boost: up to +11 dB shelf and +5 dB peak (smooth, headroom-compensated)
    this.setParam(this.bassShelf.gain, v.bass * 11, 0.05, immediate);
    this.setParam(this.bassPeak.gain, v.bass * 5, 0.05, immediate);
    // headroom: pull the input down as boost rises so the limiter rarely has to work
    const boostDb = Math.max(0, v.low) + v.bass * 11;
    this.setParam(this.input.gain, dbToGain(-boostDb * 0.45), 0.08, immediate);
    this.setParam(this.master.gain, v.master, 0.02, immediate);
  }

  set(patch: Partial<DjState>) {
    const prev = this.state;
    this.state = {
      ...prev,
      ...patch,
      fx: { ...prev.fx, ...(patch.fx || {}) },
      auto: { ...prev.auto, ...(patch.auto || {}) },
    };
    const s = this.state;
    s.balance = clamp(s.balance, -1, 1);
    s.leftGain = clamp(s.leftGain, 0, 1.5);
    s.rightGain = clamp(s.rightGain, 0, 1.5);
    s.low = clamp(s.low, -12, 12);
    s.mid = clamp(s.mid, -12, 12);
    s.high = clamp(s.high, -12, 12);
    s.bassBoost = clamp(s.bassBoost, 0, 1);
    s.master = clamp(s.master, 0, 1.5);
    this.applyParams();
    this.syncAutoLoop();
    this.emit();
  }

  /** Switch DJ processing on/off (graph stays connected, goes neutral when off). */
  setActive(on: boolean) {
    this.set({ active: on });
  }

  /** Back to flat/neutral; keeps power + auto-enabled state. */
  reset() {
    const { active, auto } = this.state;
    this.off = { ...NEUTRAL };
    this.tgt = { ...NEUTRAL };
    this.set({
      ...JSON.parse(JSON.stringify(DEFAULT_DJ_STATE)),
      active,
      auto: { ...DEFAULT_DJ_STATE.auto, enabled: false, style: auto.style },
    });
  }

  /* ───────────── analysis ───────────── */
  getLevels() {
    if (!this.ctx || !this.state.active) return { left: 0, right: 0 };
    this.anaL.getFloatTimeDomainData(this.bufL);
    this.anaR.getFloatTimeDomainData(this.bufR);
    const rms = (b: Float32Array) => {
      let s = 0;
      for (let i = 0; i < b.length; i++) s += b[i] * b[i];
      return Math.sqrt(s / b.length);
    };
    return { left: clamp(rms(this.bufL) * 3.2, 0, 1), right: clamp(rms(this.bufR) * 3.2, 0, 1) };
  }

  private readSpectrum() {
    if (!this.ctx) return;
    this.anaMix.getByteFrequencyData(this.freq);
  }

  getBassLevel() {
    if (!this.ctx) return 0;
    this.readSpectrum();
    // bins 1..4 ≈ 43–215 Hz at 44.1k/1024
    let s = 0;
    for (let i = 1; i <= 4; i++) s += this.freq[i];
    return clamp(s / (4 * 255), 0, 1);
  }

  getFrequencyData() {
    if (!this.ctx) return this.freqOut.fill(0);
    this.readSpectrum();
    const n = this.freq.length;
    // 16 log-spaced bands (low → high)
    for (let b = 0; b < 16; b++) {
      const a = Math.floor(Math.pow(n, b / 16));
      const z = Math.max(a + 1, Math.floor(Math.pow(n, (b + 1) / 16)));
      let sum = 0;
      for (let i = a; i < z && i < n; i++) sum += this.freq[i];
      this.freqOut[b] = Math.round(sum / Math.max(1, z - a));
    }
    return this.freqOut;
  }

  getBpm() { return Math.round(this.bpm); }

  /** Current position inside the beat, 0..1 (for UI pulse). */
  getBeatPhase() {
    if (!this.ctx) return 0;
    const beatLen = 60 / this.bpm;
    return (((this.ctx.currentTime - this.beatOrigin) / beatLen) % 1 + 1) % 1;
  }

  getAutoOffsets() { return this.off; }

  /* ───────────── Auto DJ ───────────── */
  private syncAutoLoop() {
    const want = this.state.auto.enabled && this.state.active && !!this.ctx;
    if (want && this.autoTimer == null) {
      this.lastTick = performance.now();
      if (this.ctx) this.beatOrigin = this.ctx.currentTime;
      this.autoTimer = window.setInterval(() => this.autoTick(), 30);
    } else if (!want && this.autoTimer != null) {
      window.clearInterval(this.autoTimer);
      this.autoTimer = null;
      // glide back to the user's manual settings (no jump)
      this.tgt = { ...NEUTRAL };
      this.glideOut();
    }
  }

  private glideOut() {
    // ease offsets to neutral over ~0.5s, then stop updating
    let n = 0;
    const id = window.setInterval(() => {
      n++;
      (Object.keys(NEUTRAL) as (keyof AutoOffsets)[]).forEach(k => {
        this.off[k] += (NEUTRAL[k] - this.off[k]) * 0.35;
      });
      this.applyParams();
      if (n > 14 || this.autoTimer != null) {
        window.clearInterval(id);
        if (this.autoTimer == null) this.off = { ...NEUTRAL };
        this.applyParams();
      }
    }, 35);
  }

  /** onset detection on the low band → rolling BPM estimate + phase lock */
  private detectBeat(now: number) {
    this.readSpectrum();
    let e = 0;
    for (let i = 1; i <= 5; i++) e += this.freq[i];
    e /= 5 * 255;
    const rising = e - this.lastEnergy;
    if (rising > 0.09 && e > 0.35 && now - this.lastOnset > 0.27) {
      const gap = now - this.lastOnset;
      this.lastOnset = now;
      if (gap < 2) this.onsets.push(gap);
      if (this.onsets.length > 24) this.onsets.shift();

      // phase lock: nudge beat grid toward this onset
      const beatLen = 60 / this.bpm;
      const phase = (((now - this.beatOrigin) / beatLen) % 1 + 1) % 1;
      const err = phase < 0.5 ? -phase : 1 - phase; // fraction of a beat
      if (Math.abs(err) < 0.3) this.beatOrigin += err * beatLen * 0.25;

      if (this.onsets.length >= 6) {
        // median interval folded into 70–180 BPM
        const sorted = [...this.onsets].sort((a, b) => a - b);
        let iv = sorted[Math.floor(sorted.length / 2)];
        let bpm = 60 / iv;
        while (bpm < 70) bpm *= 2;
        while (bpm > 180) bpm /= 2;
        this.bpm += (bpm - this.bpm) * 0.15; // slow, stable correction
      }
    }
    this.lastEnergy = e * 0.5 + this.lastEnergy * 0.5;
  }

  private autoTick() {
    if (!this.ctx || !this.state.auto.enabled || !this.state.active) return;
    const nowMs = performance.now();
    const dt = Math.min(0.1, (nowMs - this.lastTick) / 1000);
    this.lastTick = nowMs;
    const now = this.ctx.currentTime;
    const a = this.state.auto;
    const cfg = STYLES[a.style];

    this.detectBeat(now);

    const beatLen = 60 / this.bpm;
    const beats = (now - this.beatOrigin) / beatLen; // continuous beat position
    const beatFrac = ((beats % 1) + 1) % 1;

    // scene changes on musical boundaries (bars/phrases) → varied but never jarring
    const idx = Math.floor(beats / cfg.sceneBeats);
    if (idx !== this.sceneIdx) {
      this.sceneIdx = idx;
      this.scene = (this.scene + 1 + Math.floor(Math.random() * 2)) % 4;
    }

    const t: AutoOffsets = { ...NEUTRAL };

    // 1) auto-pan: sine sweep locked to the beat grid
    if (a.pan) {
      const sceneDepth = [1, 0.6, 1, 0.8][this.scene];
      const ph = (beats / cfg.panBeats) * Math.PI * 2;
      let pan = Math.sin(ph) * cfg.panDepth * sceneDepth;
      if (a.style === 'insane' && this.scene === 2) pan = Math.sign(Math.sin(ph * 2)) * 0.85 * Math.abs(Math.sin(ph * 2)) ** 0.35;
      t.pan = pan;
      // keep both ears comfortable: floor on the quieter side
      const floor = cfg.minChannel;
      t.gL = pan > 0 ? Math.max(floor, 1 - pan * 0.5) : 1;
      t.gR = pan < 0 ? Math.max(floor, 1 + pan * 0.5) : 1;
    }

    // 2) bass: swell on scene phrase, extra thump on the downbeat
    if (a.bass) {
      const swell = (Math.sin((beats / (cfg.sceneBeats / 2)) * Math.PI * 2 - Math.PI / 2) + 1) / 2; // 0..1
      const thump = a.style === 'chill' ? 0 : Math.exp(-beatFrac * 6) * 0.35;
      t.bass = cfg.bassAdd * (0.35 + 0.65 * swell) * (this.scene === 1 ? 0.5 : 1) + thump * cfg.bassAdd;
      t.low = (swell - 0.4) * cfg.eqSweepDb * 0.6;
    }

    // 3) filter-style movement: slow high/mid sweeps (rise → release)
    if (a.filter) {
      const sweep = (Math.sin((beats / cfg.sceneBeats) * Math.PI * 2) + 1) / 2;
      t.high = (sweep - 0.5) * cfg.eqSweepDb * 1.4;
      t.mid = (0.5 - sweep) * cfg.eqSweepDb * 0.5;
      if (this.scene === 3 && a.style !== 'chill') t.low -= cfg.eqSweepDb * 0.5 * sweep; // "breakdown" thinning
    }

    // 4) sidechain-style pump on the beat (club/insane)
    if (a.pump && cfg.pumpDepth > 0) {
      t.pump = 1 - cfg.pumpDepth * Math.exp(-beatFrac * 5.5);
    }

    // slew-limit toward targets → smooth, musical, never abrupt
    const slew = (cur: number, to: number, rate: number) => {
      const d = to - cur;
      const step = rate * dt;
      return Math.abs(d) <= step ? to : cur + Math.sign(d) * step;
    };
    const o = this.off;
    o.pan = slew(o.pan, t.pan, cfg.slew);
    o.gL = slew(o.gL, t.gL, cfg.slew * 0.8);
    o.gR = slew(o.gR, t.gR, cfg.slew * 0.8);
    o.bass = slew(o.bass, t.bass, 0.9);
    o.low = slew(o.low, t.low, 14);
    o.mid = slew(o.mid, t.mid, 14);
    o.high = slew(o.high, t.high, 14);
    o.pump = slew(o.pump, t.pump, 9); // fast enough to feel rhythmic, slow enough to avoid clicks

    this.applyParams();
  }
}

export const djEngine = new DjEngine();
