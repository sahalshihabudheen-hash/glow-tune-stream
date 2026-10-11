import { useEffect, useRef, type ReactNode, type KeyboardEvent, type PointerEvent } from 'react';
import { cn } from '@/lib/utils';

/*
 * DJ console building blocks.
 *
 * Look: matte hardware mixer. Flat fills, hairline borders, small corners,
 * one accent colour (the app's --primary), mono readouts. No blur, no glow,
 * no gradients.
 *
 *   page   #0c0c0b     well (recessed)  #080807
 *   panel  #131312     line             #2b2a25
 *   text   #e9e7dc     dim text         #8c8a7d
 */

/** Tiny haptic tick for touch devices (silently ignored elsewhere). */
export const buzz = (ms = 8) => {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
  } catch {
    /* not supported */
  }
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/* ───────────────────────── Platter ─────────────────────────
 * Flat record with album art on the label. A single notch on the rim makes the
 * rotation readable, and a thin ring around it fills with the channel level. */
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
  const C = 2 * Math.PI * 47;
  const lvl = clamp(level, 0, 1);
  return (
    <div className="relative aspect-square w-[clamp(112px,30vw,190px)] mx-auto select-none">
      {/* level ring */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r="47" fill="none" stroke="#2b2a25" strokeWidth="1.5" />
        <circle
          cx="50"
          cy="50"
          r="47"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          strokeDasharray={`${lvl * C} ${C}`}
          style={{ transition: 'stroke-dasharray 80ms linear' }}
        />
      </svg>

      {/* record */}
      <div
        className="absolute inset-[6%] rounded-full animate-spin border border-[#2b2a25]"
        style={{
          animationDuration: '2.4s',
          animationPlayState: spinning ? 'running' : 'paused',
          background: 'repeating-radial-gradient(circle at center, #0d0d0c 0, #0d0d0c 2px, #151513 3px, #0d0d0c 4px)',
        }}
      >
        {/* rim notch */}
        <span className="absolute left-1/2 top-[2px] -translate-x-1/2 w-[3px] h-[7%] bg-[#e9e7dc]" />
        {/* label with album art */}
        <div className="absolute inset-[31%] rounded-full overflow-hidden border border-[#3d3b33] bg-[#1b1a17] flex items-center justify-center">
          {art ? <img src={art} alt="" className="w-full h-full object-cover opacity-80" draggable={false} /> : null}
          <span className="absolute inset-0 flex items-center justify-center font-mono text-[clamp(11px,3vw,16px)] font-bold text-primary [text-shadow:0_1px_0_#000]">
            {side}
          </span>
        </div>
        {/* spindle */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#050505] border border-[#55524a]" />
      </div>
    </div>
  );
};

/* ───────────────────────── Level meter ─────────────────────────
 * Flat LED ladder: accent → amber → red, like the real thing. */
export const LevelMeter = ({ level, segments = 14, className }: { level: number; segments?: number; className?: string }) => (
  <div className={cn('flex items-end gap-[2px] h-5', className)} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
    {Array.from({ length: segments }).map((_, i) => {
      const on = level >= (i + 1) / segments;
      const hot = i >= segments - 2;
      const warm = i >= segments - 5;
      return (
        <div
          key={i}
          className={cn(
            'flex-1 rounded-[1px]',
            on ? (hot ? 'bg-[#d9382c]' : warm ? 'bg-[#e8731a]' : 'bg-primary') : 'bg-[#1d1c19]'
          )}
          style={{ height: `${45 + (i / segments) * 55}%` }}
        />
      );
    })}
  </div>
);

/* ───────────────────────── Horizontal fader ─────────────────────────
 * Slot + rectangular cap + tick marks. A real <input type=range> sits on top so
 * keyboard, screen readers and touch all work natively. */
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
  value: number; // manual value (what the cap controls)
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
  // keep the cap inside the slot at both ends (cap is 16px wide)
  const at = (v: number) => `calc(8px + (100% - 16px) * ${v / 100})`;

  return (
    <div className={cn('relative h-12 flex items-center touch-pan-y', disabled && 'opacity-40')}>
      {/* slot */}
      <div className="absolute left-2 right-2 top-1/2 -translate-y-[calc(50%+4px)] h-[6px] rounded-[2px] bg-[#080807] border border-[#2b2a25]">
        <div
          className="absolute top-1/2 -translate-y-1/2 h-[2px] bg-primary"
          style={{ left: `${fillLeft}%`, right: `${fillRight}%`, minWidth: center ? 2 : 0 }}
        />
      </div>
      {/* tick marks */}
      <div className="absolute left-2 right-2 bottom-1 flex justify-between pointer-events-none" aria-hidden>
        {Array.from({ length: 11 }).map((_, i) => (
          <i key={i} className={cn('block w-px bg-[#3d3b33]', i % 5 === 0 ? 'h-2' : 'h-1')} />
        ))}
      </div>
      {/* live (auto-moved) marker */}
      {lp !== undefined && Math.abs(lp - p) > 0.8 && (
        <div
          className="absolute top-[3px] -translate-x-1/2 w-[2px] h-3 bg-[#e9e7dc] pointer-events-none transition-[left] duration-75"
          style={{ left: at(lp) }}
        />
      )}
      {/* cap */}
      <div
        className="absolute top-1/2 -translate-y-[calc(50%+4px)] -translate-x-1/2 w-4 h-7 rounded-[2px] bg-[#34332e] border border-[#55524a] pointer-events-none flex items-center justify-center"
        style={{ left: at(p) }}
      >
        <i className="block w-[2px] h-4 bg-primary" />
      </div>
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

  const marks = [max, max / 2, 0, min / 2, min];

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#8c8a7d]">{label}</span>
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
        className="relative w-16 cursor-ns-resize touch-none outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-[2px]"
        style={{ height }}
      >
        <div ref={trackRef} className="absolute left-1/2 -translate-x-1/2 top-3 bottom-3 w-[6px] rounded-[2px] bg-[#080807] border border-[#2b2a25]">
          {/* fill from the 0 dB line */}
          <div
            className="absolute left-0 right-0"
            style={{
              top: `${100 - Math.max(pct, zero)}%`,
              bottom: `${Math.min(pct, zero)}%`,
              background: value >= 0 ? 'hsl(var(--primary))' : '#d9382c',
            }}
          />
          {/* scale */}
          {marks.map((m, i) => {
            const y = ((m - min) / (max - min)) * 100;
            return (
              <div key={i} className="absolute pointer-events-none" style={{ bottom: `${y}%`, left: 0, right: 0 }}>
                <i className={cn('absolute right-full mr-1.5 top-0 block h-px', m === 0 ? 'w-3 bg-[#8c8a7d]' : 'w-1.5 bg-[#3d3b33]')} />
                <span className="absolute left-full ml-2 -translate-y-1/2 font-mono text-[8px] leading-none text-[#5e5c52]">
                  {m > 0 ? `+${m}` : m}
                </span>
              </div>
            );
          })}
          {/* cap */}
          <div
            className="absolute left-1/2 -translate-x-1/2 translate-y-1/2 w-10 h-5 rounded-[2px] bg-[#34332e] border border-[#55524a] flex items-center justify-center"
            style={{ bottom: `${pct}%` }}
          >
            <i className="block w-6 h-[2px] bg-primary" />
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center leading-none">
        <span className={cn('font-mono text-xs tabular-nums', value > 0 ? 'text-primary' : value < 0 ? 'text-[#e8731a]' : 'text-[#8c8a7d]')}>
          {value > 0 ? '+' : ''}
          {value.toFixed(1)}
        </span>
        <span className={cn('mt-1 font-mono text-[8px] uppercase', auto ? 'text-primary' : 'text-[#5e5c52]')}>
          {auto ? 'auto' : 'dB'}
        </span>
      </div>
    </div>
  );
};

/* ───────────────────────── Toggle button ─────────────────────────
 * Square LED + label, like a switch on a panel. */
export const Chip = ({
  on,
  onClick,
  children,
  disabled,
  className,
}: {
  on?: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  tone?: 'primary' | 'purple'; // kept for older callers; one accent colour now
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
      'min-h-[44px] px-3 rounded-[3px] border text-[11px] font-medium uppercase tracking-[0.1em] transition-colors active:translate-y-px flex items-center justify-center gap-2.5 disabled:opacity-40',
      on
        ? 'bg-[#1f1d14] border-primary/70 text-primary'
        : 'bg-[#131312] border-[#2b2a25] text-[#8c8a7d] hover:text-[#e9e7dc] hover:border-[#3d3b33]',
      className
    )}
  >
    <span className={cn('w-1.5 h-1.5 shrink-0', on ? 'bg-primary' : 'bg-[#3d3b33]')} />
    {children}
  </button>
);

/* ───────────────────────── Panel + section label ───────────────────────── */
export const Panel = ({ className, children }: { className?: string; children: ReactNode }) => (
  <section className={cn('rounded-md border border-[#2b2a25] bg-[#131312] p-4', className)}>{children}</section>
);

export const Label = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#8c8a7d]">{children}</span>
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
    const primary = getComputedStyle(c).getPropertyValue('--primary').trim();
    const bar = primary ? `hsl(${primary})` : '#ffe600';
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
      // faint scope lines
      g.fillStyle = '#1d1c19';
      for (const f of [0.25, 0.5, 0.75]) g.fillRect(0, Math.round(h * f), w, 1);
      const d = active ? getData() : new Uint8Array(24);
      const n = Math.min(d.length, 48);
      const bw = w / n;
      g.fillStyle = bar;
      for (let i = 0; i < n; i++) {
        const v = Math.max(0.03, d[i] / 255);
        const bh = Math.round(v * h);
        g.fillRect(Math.round(i * bw) + 1, h - bh, Math.max(1, Math.round(bw) - 2), bh);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [getData, active]);
  return <canvas ref={ref} className="w-full h-16 rounded-[3px] bg-[#080807] border border-[#2b2a25]" aria-hidden />;
};
