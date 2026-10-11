import { useEffect, useRef, type ReactNode, type KeyboardEvent, type PointerEvent } from 'react';
import { cn } from '@/lib/utils';

/** Tiny haptic tick for touch devices (silently ignored elsewhere). */
export const buzz = (ms = 8) => {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
  } catch {
    /* not supported */
  }
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const ACCENT_GRADIENT = 'linear-gradient(90deg, hsl(var(--primary)), #ff8a00)';

/* ───────────────────────── Platter ─────────────────────────
 * Spinning record with album art on the label and a ring around it
 * that fills with the live channel level. */
export const Platter = ({
  side,
  spinning,
  level,
  art,
}: {
  side: 'L' | 'R';
  spinning: boolean;
  level: number;
  art?: string;
}) => {
  const C = 2 * Math.PI * 46;
  const lvl = clamp(level, 0, 1);
  return (
    <div
      className="relative aspect-square w-[clamp(112px,30vw,190px)] mx-auto select-none"
      style={{ filter: `drop-shadow(0 0 ${8 + lvl * 26}px hsl(var(--primary) / ${0.12 + lvl * 0.4}))` }}
    >
      {/* level ring */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="2.5" />
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${lvl * C} ${C}`}
          style={{ transition: 'stroke-dasharray 80ms linear' }}
        />
      </svg>

      {/* record */}
      <div
        className="absolute inset-[7%] rounded-full animate-spin shadow-2xl"
        style={{
          animationDuration: '2.4s',
          animationPlayState: spinning ? 'running' : 'paused',
          background:
            'repeating-radial-gradient(circle at center, #101010 0, #101010 2px, #171717 3px, #101010 4px),' +
            'conic-gradient(from 0deg, rgba(255,255,255,.10), transparent 20%, rgba(255,255,255,.08) 50%, transparent 70%, rgba(255,255,255,.10))',
          backgroundBlendMode: 'screen',
          boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.05), 0 10px 30px rgba(0,0,0,.6)',
        }}
      >
        {/* label with album art */}
        <div className="absolute inset-[31%] rounded-full overflow-hidden border-2 border-primary/60 bg-primary/20 flex items-center justify-center">
          {art ? (
            <img src={art} alt="" className="w-full h-full object-cover opacity-90" draggable={false} />
          ) : null}
          <span className="absolute inset-0 flex items-center justify-center text-[clamp(11px,3vw,18px)] font-black italic text-primary drop-shadow-[0_1px_4px_rgba(0,0,0,.9)]">
            {side}
          </span>
        </div>
        {/* spindle */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-black ring-1 ring-white/30" />
      </div>
    </div>
  );
};

/* ───────────────────────── Level meter ───────────────────────── */
export const LevelMeter = ({ level, segments = 14, className }: { level: number; segments?: number; className?: string }) => (
  <div className={cn('flex items-end gap-[3px] h-5', className)} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
    {Array.from({ length: segments }).map((_, i) => {
      const on = level >= (i + 1) / segments;
      const hot = i >= segments - 2;
      const warm = i >= segments - 5;
      return (
        <div
          key={i}
          className={cn(
            'flex-1 rounded-[3px] transition-colors duration-75',
            on ? (hot ? 'bg-red-500' : warm ? 'bg-orange-400' : 'bg-primary') : 'bg-white/[0.06]'
          )}
          style={{ height: `${45 + (i / segments) * 55}%` }}
        />
      );
    })}
  </div>
);

/* ───────────────────────── Horizontal fader ─────────────────────────
 * Big, thumb-friendly. A real <input type=range> sits on top so keyboard,
 * screen readers and touch all work natively. */
export const HFader = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  live,
  center = false,
  disabled,
  ariaLabel,
}: {
  value: number; // manual value (what the thumb controls)
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  live?: number; // optional "what you actually hear" value (auto-moved)
  center?: boolean; // fill from the middle (crossfader / balance)
  disabled?: boolean;
  ariaLabel: string;
}) => {
  const pct = (v: number) => ((clamp(v, min, max) - min) / (max - min)) * 100;
  const p = pct(value);
  const lp = live !== undefined ? pct(live) : undefined;
  const mid = pct(center ? (min + max) / 2 : min);
  const fillLeft = Math.min(mid, lp ?? p);
  const fillRight = 100 - Math.max(mid, lp ?? p);

  return (
    <div className={cn('relative h-11 flex items-center touch-pan-y', disabled && 'opacity-40')}>
      <div className="relative w-full h-3 rounded-full bg-white/[0.07] overflow-hidden">
        <div
          className="absolute inset-y-0 rounded-full transition-[left,right] duration-75"
          style={{ left: `${fillLeft}%`, right: `${fillRight}%`, background: ACCENT_GRADIENT, minWidth: center ? 4 : 0 }}
        />
      </div>
      {center && <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-5 bg-white/25" />}
      {/* live (auto-moved) marker */}
      {lp !== undefined && Math.abs(lp - p) > 0.8 && (
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-white/90 shadow-[0_0_10px_hsl(var(--primary))] pointer-events-none transition-[left] duration-75"
          style={{ left: `${lp}%` }}
        />
      )}
      {/* manual thumb */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-gradient-to-b from-white to-neutral-300 border-2 border-primary shadow-[0_2px_10px_rgba(0,0,0,.6)] pointer-events-none"
        style={{ left: `clamp(12px, ${p}%, calc(100% - 12px))` }}
      />
      <input
        type="range"
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(+e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
};

/* ───────────────────────── Vertical fader (EQ) ─────────────────────────
 * Pointer-driven so it behaves the same on mouse, touch and pen
 * (native vertical range inputs are unreliable on mobile). Double-tap resets. */
export const VFader = ({
  label,
  value,
  onChange,
  auto,
  min = -12,
  max = 12,
  step = 0.5,
  height = 168,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  auto?: boolean;
  min?: number;
  max?: number;
  step?: number;
  height?: number;
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const pct = ((clamp(value, min, max) - min) / (max - min)) * 100;
  const zero = ((0 - min) / (max - min)) * 100;

  const setFromY = (clientY: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const t = 1 - clamp((clientY - r.top) / r.height, 0, 1);
    const v = Math.round((min + t * (max - min)) / step) * step;
    onChange(clamp(v, min, max));
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromY(e.clientY);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) setFromY(e.clientY);
  };
  const onUp = () => {
    dragging.current = false;
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); onChange(clamp(value + step, min, max)); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); onChange(clamp(value - step, min, max)); }
    else if (e.key === 'Home' || e.key === '0') { e.preventDefault(); onChange(0); }
  };

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <span className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">{label}</span>
      <div
        role="slider"
        tabIndex={0}
        aria-label={`${label} EQ`}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value > 0 ? '+' : ''}${value.toFixed(1)} dB`}
        onKeyDown={onKey}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={() => onChange(0)}
        className="relative w-14 cursor-ns-resize touch-none outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-xl"
        style={{ height }}
      >
        <div ref={trackRef} className="absolute left-1/2 -translate-x-1/2 top-3 bottom-3 w-2.5 rounded-full bg-black/60 border border-white/10">
          {/* fill from the 0 dB line */}
          <div
            className="absolute left-0 right-0 rounded-full transition-[top,bottom] duration-75"
            style={{
              top: `${100 - Math.max(pct, zero)}%`,
              bottom: `${Math.min(pct, zero)}%`,
              background: value >= 0 ? 'linear-gradient(0deg, hsl(var(--primary)), #fff)' : 'linear-gradient(0deg, #f87171, #fb923c)',
              boxShadow: '0 0 14px hsl(var(--primary) / .35)',
            }}
          />
          {/* 0 dB tick */}
          <div className="absolute -left-2 -right-2 h-px bg-white/30" style={{ bottom: `${zero}%` }} />
          {/* knob */}
          <div
            className="absolute left-1/2 -translate-x-1/2 translate-y-1/2 w-12 h-6 rounded-md bg-gradient-to-b from-neutral-600 to-neutral-900 border border-white/15 shadow-[0_4px_14px_rgba(0,0,0,.7)] flex flex-col items-center justify-center gap-[3px]"
            style={{ bottom: `${pct}%` }}
          >
            <i className="block w-6 h-px bg-white/25" />
            <i className="block w-6 h-px bg-primary/70" />
            <i className="block w-6 h-px bg-white/25" />
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center leading-none">
        <span className={cn('text-xs font-black tabular-nums', value > 0 ? 'text-primary' : value < 0 ? 'text-red-400' : 'text-muted-foreground')}>
          {value > 0 ? '+' : ''}
          {value.toFixed(1)}
        </span>
        <span className={cn('mt-1 text-[8px] font-bold uppercase tracking-wider', auto ? 'text-primary animate-pulse' : 'text-muted-foreground/40')}>
          {auto ? 'auto' : 'dB'}
        </span>
      </div>
    </div>
  );
};

/* ───────────────────────── Toggle chip ───────────────────────── */
export const Chip = ({
  on,
  onClick,
  children,
  disabled,
  tone = 'primary',
  className,
}: {
  on?: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  tone?: 'primary' | 'purple';
  className?: string;
}) => (
  <button
    type="button"
    onClick={() => {
      buzz();
      onClick();
    }}
    disabled={disabled}
    aria-pressed={on}
    className={cn(
      'min-h-[44px] px-4 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-40',
      on
        ? tone === 'purple'
          ? 'bg-purple-500/20 border-purple-400/60 text-purple-200 shadow-[0_0_16px_rgba(168,85,247,.3)]'
          : 'bg-primary/15 border-primary/60 text-primary shadow-[0_0_16px_hsl(var(--primary)/0.25)]'
        : 'bg-white/[0.04] border-white/10 text-muted-foreground hover:text-white hover:bg-white/[0.08]',
      className
    )}
  >
    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', on ? 'bg-current shadow-[0_0_8px_currentColor]' : 'bg-white/20')} />
    {children}
  </button>
);

/* ───────────────────────── Panel + section label ───────────────────────── */
export const Panel = ({ className, children }: { className?: string; children: ReactNode }) => (
  <section className={cn('rounded-3xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-4 md:p-5', className)}>{children}</section>
);

export const Label = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-[10px] font-black uppercase tracking-[0.35em] text-muted-foreground">{children}</span>
    {right}
  </div>
);

/* ───────────────────────── Live spectrum ─────────────────────────
 * Own rAF loop + DPR-aware canvas so it stays crisp and never re-renders the page. */
export const Spectrum = ({ getData, active }: { getData: () => Uint8Array; active: boolean }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d');
    if (!g) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const fit = () => {
      c.width = Math.max(1, Math.round(c.clientWidth * dpr));
      c.height = Math.max(1, Math.round(c.clientHeight * dpr));
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(c);

    let raf = 0;
    const draw = () => {
      const w = c.width, h = c.height;
      g.clearRect(0, 0, w, h);
      const d = active ? getData() : new Uint8Array(24);
      const n = Math.min(d.length, 48);
      const bw = w / n;
      const grad = g.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, '#ff8a00');
      grad.addColorStop(1, '#ffe600');
      g.fillStyle = grad;
      for (let i = 0; i < n; i++) {
        const v = Math.max(0.04, d[i] / 255);
        const bh = v * h;
        const r = Math.min(bw / 2 - 1, 4 * dpr);
        g.beginPath();
        g.roundRect?.(i * bw + 1, h - bh, Math.max(1, bw - 2), bh, r);
        if (!g.roundRect) g.rect(i * bw + 1, h - bh, Math.max(1, bw - 2), bh);
        g.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [getData, active]);
  return <canvas ref={ref} className="w-full h-16 rounded-xl bg-black/30" aria-hidden />;
};
