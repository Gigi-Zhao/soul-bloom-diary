import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Heart } from "lucide-react";

/**
 * Splash Screen Component
 * Opening page with app branding and smooth fade animation
 * Automatically redirects to auth or main based on login status
 */
const Splash = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check authentication status after animation
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Delay for splash animation (2 seconds)
      setTimeout(() => {
        if (session) {
          navigate("/journals");
        } else {
          navigate("/auth");
        }
      }, 2000);
    };

    checkAuth();
  }, [navigate]);

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{ background: 'var(--gradient-warm)' }}
    >
      {/* App icon with animation */}
      <div className="animate-in fade-in zoom-in duration-700">
        <div className="relative mb-8">
          {/* Pulsing glow effect */}
          <div className="absolute inset-0 bg-primary rounded-full blur-3xl opacity-30 animate-pulse" />
          
          {/* Main icon */}
          <div className="relative w-24 h-24 bg-gradient-to-br from-primary to-accent rounded-3xl flex items-center justify-center shadow-[0_8px_32px_hsl(var(--primary)/0.3)]">
            <Heart className="w-12 h-12 text-white fill-white" />
          </div>
        </div>
        
        {/* App name and slogan */}
        <div className="text-center space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Soul Bloom
          </h1>
          <p className="text-lg text-muted-foreground font-medium">
            Your AI Emotional Companion
          </p>
          <p className="text-sm text-muted-foreground">
            Write, heal, grow together
          </p>
        </div>
      </div>
    </div>
  );
};

export default Splash;
