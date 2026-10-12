import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import jarvisAvatar from '@/assets/jarvis-avatar.gif';

interface TutorialStep {
  title: string;
  message: string;
  highlightSelectors?: string[];
  highlightLabels?: string[];
  cardPosition: 'center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right';
  tabToActivate?: string;
  glowActiveTab?: boolean;
}

const steps: TutorialStep[] = [
  {
    title: "🛡️ Welcome, Admin!",
    message: "Hey! I'm JARVIS. Congrats on getting admin access! Let me walk you through the Admin Dashboard so you know how to manage everything. This is your command center — let's dive in!",
    cardPosition: 'center',
  },
  {
    title: "👥 Users Tab — Overview",
    message: "This is the Users tab — your main hub! You can see all registered users with their online status (green dot = online), email verification, location, device info, and VPN detection. Each user card shows everything at a glance.",
    cardPosition: 'bottom-right',
    tabToActivate: 'users',
    glowActiveTab: true,
    highlightLabels: ['👥 Users Tab'],
  },
  {
    title: "🔍 Search & Smart Filters",
    message: "Power up your search! Type any name, email, location, or ISP to instantly find users. Then use the filter chips below — filter by Online/Offline status, device type (Phone, Tablet, Laptop, Desktop), VPN usage, and even by country!",
    cardPosition: 'bottom-right',
    tabToActivate: 'users',
    highlightSelectors: ['input[placeholder*="Search"]'],
    highlightLabels: ['🔍 Search users here'],
  },
  {
    title: "⚡ Admin Actions",
    message: "For each user, you can grant or revoke admin roles, reset their passwords, or even delete accounts. Look for the action buttons on each user card. Only the primary admin can perform destructive actions like deletion.",
    cardPosition: 'bottom-left',
    tabToActivate: 'users',
  },
  {
    title: "🎵 Activity Tab — Listening History",
    message: "This is the Activity tab — see what everyone's been listening to! Track thumbnails, song names, channels, and which user played what — all in real-time. Great for spotting trends!",
    cardPosition: 'top-right',
    tabToActivate: 'activity',
    glowActiveTab: true,
    highlightLabels: ['🎵 Activity Tab'],
  },
  {
    title: "📋 Playlists Tab — User Collections",
    message: "Browse every playlist created by your users! See the playlist name, creator, track count, and even preview the first few tracks. You can copy any playlist to your own account with one click!",
    cardPosition: 'top-right',
    tabToActivate: 'playlists',
    glowActiveTab: true,
    highlightLabels: ['📋 Playlists Tab'],
  },
  {
    title: "🎮 Games Tab — Live Sessions",
    message: "Monitor who's gaming right now! See active game sessions with scores, gems collected, play duration, and what music they're vibing to while playing. The badge shows how many gamers are active.",
    cardPosition: 'top-right',
    tabToActivate: 'games',
    glowActiveTab: true,
    highlightLabels: ['🎮 Games Tab'],
  },
  {
    title: "🔑 API Keys — YouTube Failover",
    message: "This is critical! Manage your YouTube API keys here. Each key gets 10K daily quota. Add keys from different Google Cloud projects for true failover. Toggle keys on/off, see which one is currently active, and monitor their status in real-time.",
    cardPosition: 'bottom-left',
    tabToActivate: 'api-keys',
    glowActiveTab: true,
    highlightLabels: ['🔑 API Keys Tab'],
  },
  {
    title: "🔧 Maintenance Mode",
    message: "Need to do updates? Toggle Maintenance Mode to lock out all regular users instantly. Add specific emails to the whitelist so they can still access the app. Admins always bypass maintenance automatically!",
    cardPosition: 'bottom-left',
    tabToActivate: 'maintenance',
    glowActiveTab: true,
    highlightSelectors: ['button[role="switch"]'],
    highlightLabels: ['🔧 Maintenance Tab', '🔧 Toggle here'],
  },
  {
    title: "⚙️ App Settings — Full Control",
    message: "This is your App Settings tab! Change the app logo, name, tagline, and footer text. You can also control the Featured Today track — switch between auto-rotation or manually pick a specific song to showcase on the home page!",
    cardPosition: 'bottom-left',
    tabToActivate: 'app-settings',
    glowActiveTab: true,
    highlightLabels: ['⚙️ App Settings Tab'],
  },
  {
    title: "🎓 Replay Anytime!",
    message: "See the graduation cap icon (🎓) in the header? You can replay this tutorial anytime by clicking it. Also check Settings for the replay option. Now go manage your platform like a boss! 🚀",
    cardPosition: 'center',
    tabToActivate: 'users',
    highlightSelectors: ['button:has(.lucide-graduation-cap)'],
    highlightLabels: ['🔄 Replay tutorial'],
  },
];

// Pulsing glow ring component that wraps around an element
const GlowRing = ({ targetRect }: { targetRect: DOMRect }) => (
  <div
    className="fixed z-[101] pointer-events-none rounded-lg"
    style={{
      top: targetRect.top - 4,
      left: targetRect.left - 4,
      width: targetRect.width + 8,
      height: targetRect.height + 8,
      boxShadow: '0 0 0 2px hsl(var(--primary) / 0.7), 0 0 20px 4px hsl(var(--primary) / 0.35), inset 0 0 15px hsl(var(--primary) / 0.1)',
      animation: 'admin-tutorial-glow-pulse 2s ease-in-out infinite',
    }}
  />
);

const HighlightArrow = ({ targetRect, label, index }: { targetRect: DOMRect; label: string; index: number }) => {
  const arrowLeft = targetRect.left + targetRect.width / 2;
  const clampedLeft = Math.min(Math.max(arrowLeft, 100), window.innerWidth - 100);
  const showAbove = targetRect.top > 140;

  return (
    <>
      <GlowRing targetRect={targetRect} />
      <div
        className="fixed z-[103] flex flex-col items-center pointer-events-none"
        style={{
          top: showAbove ? targetRect.top - 58 : targetRect.bottom + 6,
          left: clampedLeft,
          transform: 'translateX(-50%)',
          maxWidth: '85vw',
          animation: `admin-tutorial-float 2s ease-in-out infinite ${index * 200}ms`,
        }}
      >
        {showAbove ? (
          <>
            <span className="text-[11px] font-bold text-primary bg-card/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-primary/50 shadow-lg shadow-primary/30 text-center mb-1 whitespace-nowrap">
              {label}
            </span>
            <svg width="18" height="14" viewBox="0 0 18 14" className="text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]">
              <path d="M9 14L1 3h16L9 14z" fill="currentColor" />
            </svg>
          </>
        ) : (
          <>
            <svg width="18" height="14" viewBox="0 0 18 14" className="text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]">
              <path d="M9 0L17 11H1L9 0z" fill="currentColor" />
            </svg>
            <span className="text-[11px] font-bold text-primary bg-card/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-primary/50 shadow-lg shadow-primary/30 text-center mt-1 whitespace-nowrap">
              {label}
            </span>
          </>
        )}
      </div>
    </>
  );
};

const createAudioContext = () => new (window.AudioContext || (window as any).webkitAudioContext)();

const playClickSound = () => {
  try {
    const ctx = createAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } catch {}
};

interface AdminTutorialProps {
  onComplete: () => void;
}

const AdminTutorial = ({ onComplete }: AdminTutorialProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [highlightRects, setHighlightRects] = useState<{ rect: DOMRect; label: string }[]>([]);
  const bgAudioRef = useRef<{ ctx: AudioContext } | null>(null);

  // Inject keyframes for glow animation
  useEffect(() => {
    const styleId = 'admin-tutorial-animations';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes admin-tutorial-glow-pulse {
          0%, 100% { box-shadow: 0 0 0 2px hsl(var(--primary) / 0.7), 0 0 20px 4px hsl(var(--primary) / 0.35), inset 0 0 15px hsl(var(--primary) / 0.1); }
          50% { box-shadow: 0 0 0 3px hsl(var(--primary) / 0.9), 0 0 35px 8px hsl(var(--primary) / 0.5), inset 0 0 20px hsl(var(--primary) / 0.15); }
        }
        @keyframes admin-tutorial-float {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-6px); }
        }
        @keyframes admin-tutorial-card-enter {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes admin-tutorial-card-step {
          0% { opacity: 0; transform: translateX(40px) scale(0.97); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
      `;
      document.head.appendChild(style);
    }
    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, []);

  // Ambient background music
  useEffect(() => {
    try {
      const ctx = createAudioContext();
      const frequencies = [261.63, 329.63, 392.0, 523.25];
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 2);
      masterGain.connect(ctx.destination);

      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        oscGain.gain.setValueAtTime(0.25, ctx.currentTime);
        osc.connect(oscGain);
        oscGain.connect(masterGain);
        osc.start(ctx.currentTime + i * 0.3);
      });

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.15, ctx.currentTime);
      lfoGain.gain.setValueAtTime(0.02, ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(masterGain.gain);
      lfo.start(ctx.currentTime);

      bgAudioRef.current = { ctx };
    } catch {}

    return () => {
      if (bgAudioRef.current) {
        try { bgAudioRef.current.ctx.close(); } catch {}
        bgAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 300);
  }, []);

  // Activate the correct tab for the current step
  useEffect(() => {
    const step = steps[currentStep];
    if (!step.tabToActivate) return;

    const t = setTimeout(() => {
      // Find all tab triggers and click the matching one
      const tabTriggers = document.querySelectorAll('[role="tab"]');
      const tabMap: Record<string, string> = {
        'users': 'Users',
        'activity': 'Activity',
        'playlists': 'Playlists',
        'games': 'Games',
        'api-keys': 'Keys',
        'maintenance': 'Maint',
        'app-settings': 'App',
      };
      const targetText = tabMap[step.tabToActivate!] || step.tabToActivate;
      tabTriggers.forEach((trigger) => {
        if (trigger.textContent?.includes(targetText!)) {
          (trigger as HTMLElement).click();
        }
      });
    }, 50);
    return () => clearTimeout(t);
  }, [currentStep]);

  // Highlight elements with glow + arrows
  useEffect(() => {
    // Clean up previous
    document.querySelectorAll('[data-admin-tutorial-glow]').forEach(el => {
      (el as HTMLElement).style.removeProperty('box-shadow');
      (el as HTMLElement).style.removeProperty('z-index');
      (el as HTMLElement).style.removeProperty('position');
      (el as HTMLElement).removeAttribute('data-admin-tutorial-glow');
    });
    setHighlightRects([]);

    const step = steps[currentStep];
    if (!step.highlightSelectors?.length && !step.glowActiveTab) return;

    // Wait for tab content to render after click
    const timer = setTimeout(() => {
      const rects: { rect: DOMRect; label: string }[] = [];
      let labelIdx = 0;

      // Glow the correct tab button by matching its text
      if (step.glowActiveTab && step.tabToActivate) {
        const tabMap: Record<string, string> = {
          'users': 'Users',
          'activity': 'Activity',
          'playlists': 'Playlists',
          'games': 'Games',
          'api-keys': 'Keys',
          'maintenance': 'Maint',
          'app-settings': 'App',
        };
        const targetText = tabMap[step.tabToActivate] || step.tabToActivate;
        const allTabs = document.querySelectorAll('[role="tab"]');
        let targetTab: HTMLElement | null = null;
        allTabs.forEach((t) => {
          if (t.textContent?.includes(targetText)) targetTab = t as HTMLElement;
        });
        if (targetTab) {
          const rect = (targetTab as HTMLElement).getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            rects.push({ rect, label: step.highlightLabels?.[labelIdx] || '' });
            (targetTab as HTMLElement).setAttribute('data-admin-tutorial-glow', 'true');
            (targetTab as HTMLElement).style.position = 'relative';
            (targetTab as HTMLElement).style.zIndex = '101';
            labelIdx++;
          }
        }
      }

      // Additional highlight selectors
      if (step.highlightSelectors?.length) {
        step.highlightSelectors.forEach((selector, i) => {
          const selectors = selector.split(',').map(s => s.trim());
          let el: HTMLElement | null = null;
          for (const s of selectors) {
            el = document.querySelector(s) as HTMLElement;
            if (el) break;
          }
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              rects.push({ rect, label: step.highlightLabels?.[labelIdx + i] || '' });
              el.setAttribute('data-admin-tutorial-glow', 'true');
              el.style.position = 'relative';
              el.style.zIndex = '101';
            }
          }
        });
      }

      setHighlightRects(rects);
    }, 500);

    return () => {
      clearTimeout(timer);
      document.querySelectorAll('[data-admin-tutorial-glow]').forEach(el => {
        (el as HTMLElement).style.removeProperty('box-shadow');
        (el as HTMLElement).style.removeProperty('z-index');
        (el as HTMLElement).style.removeProperty('position');
        (el as HTMLElement).removeAttribute('data-admin-tutorial-glow');
      });
    };
  }, [currentStep]);

  // Typing effect
  useEffect(() => {
    setTypedText('');
    setIsTyping(true);
    const message = steps[currentStep].message;
    let i = 0;
    const interval = setInterval(() => {
      if (i < message.length) {
        setTypedText(message.slice(0, i + 1));
        i++;
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, 16);
    return () => clearInterval(interval);
  }, [currentStep]);

  const handleNext = () => {
    playClickSound();
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    playClickSound();
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleClose = useCallback(() => {
    playClickSound();
    setIsVisible(false);
    if (bgAudioRef.current) {
      try { bgAudioRef.current.ctx.close(); } catch {}
      bgAudioRef.current = null;
    }
    document.querySelectorAll('[data-admin-tutorial-glow]').forEach(el => {
      (el as HTMLElement).style.removeProperty('box-shadow');
      (el as HTMLElement).style.removeProperty('z-index');
      (el as HTMLElement).style.removeProperty('position');
      (el as HTMLElement).removeAttribute('data-admin-tutorial-glow');
    });
    // Switch back to users tab
    const tabs = document.querySelectorAll('[role="tab"]');
    tabs.forEach((t) => { if (t.textContent?.includes('Users')) (t as HTMLElement).click(); });
    setTimeout(onComplete, 400);
  }, [onComplete]);

  const step = steps[currentStep];

  const getCardPosition = () => {
    switch (step.cardPosition) {
      case 'bottom-right': return 'bottom-6 right-3 sm:bottom-8 sm:right-8';
      case 'bottom-left': return 'bottom-6 left-3 sm:bottom-8 sm:left-8';
      case 'top-center': return 'top-20 inset-x-0 mx-auto';
      case 'top-right': return 'top-20 right-3 sm:right-8';
      // No transforms for centering: the entrance animation sets its own transform and would override them.
      default: return 'inset-0 m-auto h-fit';
    }
  };

  return (
    <div className={`fixed inset-0 z-[100] transition-opacity duration-400 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      {/* Backdrop with subtle vignette */}
      <div
        className="absolute inset-0"
        onClick={handleClose}
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.55) 100%)',
        }}
      />

      {/* Highlight arrows + glow rings */}
      {highlightRects.map((hr, i) => (
        <HighlightArrow key={`${currentStep}-${i}`} targetRect={hr.rect} label={hr.label} index={i} />
      ))}

      {/* JARVIS Card */}
      <div
        key={currentStep}
        className={`fixed ${getCardPosition()} w-[92vw] max-w-md z-[102]`}
        style={{
          animation: isVisible ? 'admin-tutorial-card-step 0.4s ease-out forwards' : undefined,
        }}
      >
        <div className="relative bg-card/95 backdrop-blur-xl border border-primary/30 rounded-2xl shadow-2xl p-5 md:p-6"
          style={{
            boxShadow: '0 0 40px -10px hsl(var(--primary) / 0.25), 0 20px 60px -20px rgba(0,0,0,0.5)',
          }}
        >
          {/* Subtle top glow accent */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

          {/* Close */}
          <button onClick={handleClose} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors z-10">
            <X className="w-4 h-4" />
          </button>

          {/* JARVIS Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full animate-pulse" style={{ boxShadow: '0 0 12px 2px hsl(var(--primary) / 0.4)' }} />
              <img src={jarvisAvatar} alt="JARVIS" className="w-11 h-11 rounded-full object-cover ring-2 ring-primary/60 relative" />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-card" />
            </div>
            <div>
              <span className="text-sm font-bold text-primary">JARVIS</span>
              <p className="text-[10px] text-muted-foreground">Admin Guide</p>
            </div>
            <span className="text-[10px] text-muted-foreground ml-auto bg-secondary/80 px-2.5 py-1 rounded-full font-medium">
              {currentStep + 1}/{steps.length}
            </span>
          </div>

          {/* Title */}
          <h2 className="text-base sm:text-lg font-bold text-foreground mb-2">{step.title}</h2>

          {/* Typed Message */}
          <p className="text-muted-foreground text-[13px] sm:text-sm leading-relaxed min-h-[3rem]">
            {typedText}
            {isTyping && <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse" />}
          </p>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 my-4">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i === currentStep
                    ? 'w-6 h-2 bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]'
                    : i < currentStep
                    ? 'w-2 h-2 bg-primary/50'
                    : 'w-2 h-2 bg-muted'
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="text-muted-foreground text-xs hover:text-foreground"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Back
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClose} className="text-muted-foreground text-xs hover:text-foreground">
              Skip Tour
            </Button>
            <Button
              size="sm"
              onClick={handleNext}
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs shadow-lg shadow-primary/25"
            >
              {currentStep === steps.length - 1 ? "Let's Go! 🛡️" : 'Next'} <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminTutorial;
