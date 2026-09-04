import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Mail, Lock, ArrowRight, Sparkles, ShieldCheck } from 'lucide-react';
import nyraLogo from '@/assets/nyra-logo.png';
import { useAppSettings } from '@/hooks/useAppSettings';
import { cn } from '@/lib/utils';

const Auth = () => {
  const { settings: appSettings } = useAppSettings();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success('Welcome back!');
        let isAdmin = false;
        if (data.user) {
          const { data: hasAdmin } = await supabase.rpc('has_role', {
            _user_id: data.user.id,
            _role: 'admin',
          });
          isAdmin = !!hasAdmin;
        }
        if (isAdmin) {
          navigate('/admin');
        } else {
          navigate('/');
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        if (data.user && !data.session) {
          toast.success('🎉 Check your email to verify your account!', { duration: 8000 });
          setIsLogin(true);
          return;
        }
        toast.success('Account created! Welcome to NYRA');
        navigate('/');
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center p-4 overflow-hidden bg-[#050505]">
      {/* Subtle Background Glow */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
      </div>

      <div className={cn(
        "relative z-20 w-full max-w-md transition-all duration-1000 transform",
        mounted ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
      )}>
        <Card className="glass-premium border-white/5 shadow-2xl overflow-hidden backdrop-blur-3xl rounded-[2rem]">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-30" />
          
          <div className="p-8 md:p-10">
            {/* Header */}
            <div className="flex flex-col items-center mb-10 text-center">
              <div className="relative mb-6">
                <div className="absolute -inset-4 bg-primary/20 rounded-full blur-xl animate-pulse" />
                <img 
                  src={appSettings.app_logo_url || nyraLogo} 
                  alt={appSettings.app_name} 
                  className="relative w-16 h-16 rounded-2xl object-cover shadow-lg float"
                />
              </div>
              
              <h1 className="text-4xl font-extrabold tracking-tighter mb-1">
                <span className="neon-text uppercase italic">{appSettings.app_name}</span>
              </h1>
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-primary" />
                {appSettings.app_tagline || "Feel the Pulse"}
              </p>
            </div>

            {/* Email Form */}
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-3">
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 pl-12 bg-white/5 border-white/10 focus:border-primary/50 focus:ring-primary/20 rounded-xl transition-all"
                  />
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-12 pl-12 bg-white/5 border-white/10 focus:border-primary/50 focus:ring-primary/20 rounded-xl transition-all"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-bold text-base transition-all duration-300 shadow-lg neon-glow flex items-center justify-center gap-2 group overflow-hidden mt-6"
                disabled={loading}
              >
                {loading ? (
                   <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{isLogin ? 'Sign In' : 'Sign Up'}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>

            {/* Switch Mode */}
            <div className="mt-8 pt-6 border-t border-white/5 text-center space-y-4">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-all"
              >
                {isLogin ? "New to Nyra? Create account" : 'Already have an account? Sign in'}
              </button>
              
              <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground/30 font-bold uppercase tracking-widest">
                <ShieldCheck className="w-3 h-3" />
                Secured Authentication
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Auth;

