import { useState, useEffect } from 'react';
import { Play, Sparkles, TrendingUp, Disc3, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { famousSongs } from '@/data/famousSongs';
import { getFunctionAuthHeaders } from '@/lib/functionAuth';
import { motion, AnimatePresence, type Variants } from 'motion/react';

interface Track {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
}

interface HeroSectionProps {
  onPlayTrack?: (track: Track) => void;
  featuredTrack?: Track | null;
}

const HeroSection = ({ onPlayTrack, featuredTrack: propFeaturedTrack }: HeroSectionProps) => {
  const { gradient } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const [spotlightSongs, setSpotlightSongs] = useState<Track[]>(famousSongs.slice(0, 8));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState(1); // 1 for next (right to left), -1 for prev (left to right)

  useEffect(() => {
    setIsVisible(true);
    fetchSpotlight();
  }, [propFeaturedTrack]);

  // Auto-advance carousel every 5 seconds with standard right-to-left slide
  useEffect(() => {
    if (spotlightSongs.length <= 1) return;
    const interval = setInterval(() => {
      setDirection(1);
      setCurrentIndex(prev => (prev + 1) % spotlightSongs.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [spotlightSongs.length]);

  const fetchSpotlight = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-featured`,
        {
          headers: await getFunctionAuthHeaders(),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data && data.id) {
          setSpotlightSongs(prev => {
            if (prev.some(t => t.id === data.id)) return prev;
            return [data, ...prev].slice(0, 8);
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch featured track for spotlight:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayActive = (trackToPlay?: Track) => {
    const targetTrack = trackToPlay || spotlightSongs[currentIndex];
    if (targetTrack && onPlayTrack) {
      onPlayTrack(targetTrack);
    }
  };

  const handleNext = () => {
    setDirection(1);
    setCurrentIndex(prev => (prev + 1) % spotlightSongs.length);
  };

  const handlePrev = () => {
    setDirection(-1);
    setCurrentIndex(prev => (prev - 1 + spotlightSongs.length) % spotlightSongs.length);
  };

  const activeTrack = spotlightSongs[currentIndex];

  // Motion Variants for smooth right-to-left sliding animation
  const slideVariants: Variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.98,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: 'spring', stiffness: 350, damping: 32 },
        opacity: { duration: 0.25 },
        scale: { duration: 0.25 },
      },
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -300 : 300,
      opacity: 0,
      scale: 0.98,
      transition: {
        x: { type: 'spring', stiffness: 350, damping: 32 },
        opacity: { duration: 0.2 },
        scale: { duration: 0.2 },
      },
    }),
  };

  return (
    <section className="relative overflow-hidden rounded-3xl mb-8">
      {/* Dynamic Animated background */}
      <div className="absolute inset-0 gradient-animated opacity-30 transition-all duration-1000" />
      
      {/* Decorative Glow orbs */}
      <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-primary/25 blur-3xl float" />
      <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-primary/10 blur-3xl float" style={{ animationDelay: '2s' }} />
      
      {/* Main Container */}
      <div className={cn(
        "relative z-10 glass-premium rounded-3xl p-5 md:p-8 transition-all duration-700 overflow-hidden",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      )}>
        <div className="relative w-full min-h-[180px] md:min-h-[220px]">
          
          {/* Navigation Arrows for the slider */}
          <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 z-20 flex justify-between pointer-events-none px-1">
            <button
              onClick={handlePrev}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/55 border border-white/5 hover:bg-black/75 hover:scale-105 flex items-center justify-center text-foreground pointer-events-auto active:scale-90 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground hover:text-foreground" />
            </button>
            <button
              onClick={handleNext}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/55 border border-white/5 hover:bg-black/75 hover:scale-105 flex items-center justify-center text-foreground pointer-events-auto active:scale-90 transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground hover:text-foreground" />
            </button>
          </div>

          <AnimatePresence initial={false} custom={direction} mode="wait">
            {activeTrack && (
              <motion.div
                key={activeTrack.id}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="w-full flex flex-col md:flex-row items-center gap-6 md:gap-10 px-8 md:px-12"
              >
                {/* Featured Album Art */}
                <div className="relative group shrink-0">
                  <div className="absolute -inset-2 rounded-2xl bg-primary/20 blur-xl glow-pulse opacity-60 pointer-events-none" />
                  <div className="relative w-36 h-36 md:w-44 md:h-44 rounded-2xl overflow-hidden shadow-2xl border border-white/5">
                    <img
                      src={activeTrack.thumbnail}
                      alt={activeTrack.title}
                      className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
                    />
                    {/* Play overlay on hover */}
                    <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => handlePlayActive()}
                        className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center transform scale-75 group-hover:scale-100 transition-all shadow-lg hover:scale-105"
                      >
                        <Play className="w-5 h-5 ml-1" fill="currentColor" />
                      </button>
                    </div>
                  </div>
                  {/* Spinning accent ring */}
                  <div className="absolute -inset-3 border border-primary/10 rounded-3xl rotate-glow pointer-events-none hidden md:block" />
                </div>

                {/* Hero Details */}
                <div className="flex-1 text-center md:text-left flex flex-col justify-center min-w-0">
                  <div className="flex items-center justify-center md:justify-start gap-1.5 mb-2.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                    <span className="text-primary text-[10px] md:text-xs font-semibold uppercase tracking-wider">
                      Spotlight Pulse
                    </span>
                  </div>
                  
                  <h1 className="text-lg md:text-2xl lg:text-3xl font-extrabold text-foreground mb-1.5 leading-tight tracking-tight">
                    <span className="theme-gradient-text block truncate w-full pr-2">
                      {activeTrack.title}
                    </span>
                  </h1>
                  
                  <p className="text-muted-foreground text-[11px] md:text-sm mb-4 font-medium truncate max-w-[280px] md:max-w-none">
                    {activeTrack.channel}
                  </p>

                  {/* Play & Info Section */}
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <button
                      onClick={() => handlePlayActive()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-xs md:text-sm transition-all active:scale-95 touch-manipulation bg-primary text-primary-foreground hover:shadow-[0_0_20px_rgba(var(--primary),0.4)] cursor-pointer"
                      style={gradient.enabled ? { background: 'var(--theme-gradient)' } : { backgroundColor: 'hsl(var(--primary))' }}
                    >
                      <Play className="w-3.5 h-3.5" fill="currentColor" />
                      Play Now
                    </button>
                    
                    <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-secondary/50 text-muted-foreground text-[10px] md:text-xs font-semibold">
                      <TrendingUp className="w-3 h-3 text-primary" />
                      <span>On Fire</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Carousel Dots Indicators */}
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {spotlightSongs.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setDirection(idx > currentIndex ? 1 : -1);
                setCurrentIndex(idx);
              }}
              className={cn(
                "h-1 rounded-full transition-all duration-300 focus:outline-none cursor-pointer",
                idx === currentIndex ? "w-5 bg-primary shadow-sm" : "w-1 bg-muted-foreground/30 hover:bg-muted-foreground/60"
              )}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

      </div>
    </section>
  );
};

export default HeroSection;
