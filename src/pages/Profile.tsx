import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Settings, Heart, BookHeart, LogOut } from "lucide-react";
import { toast } from "sonner";

/**
 * Profile Page Component
 * User profile management with stats and settings
 * Includes logout functionality
 */
const Profile = () => {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    // Fetch user information
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || "");
      }
    };
    fetchUser();
  }, []);

  /**
   * Handle user logout
   */
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast.success("Logged out successfully. See you soon! 💗");
      navigate("/auth");
    } catch (error: any) {
      toast.error(error.message || "Logout failed");
    }
  };

  return (
    <div className="min-h-screen pb-24 pt-8 px-4 bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="max-w-md mx-auto mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-[0_4px_16px_hsl(var(--primary)/0.3)]">
            <User className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Profile</h1>
            <p className="text-sm text-muted-foreground">Manage your account</p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-md mx-auto space-y-4">
        {/* Profile card */}
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 overflow-hidden">
          <div 
            className="h-24 w-full"
            style={{ background: 'var(--gradient-primary)' }}
          />
          <CardContent className="pt-0 -mt-12">
            <div className="flex flex-col items-center">
              <Avatar className="w-24 h-24 border-4 border-card shadow-[0_4px_16px_hsl(var(--primary)/0.3)]">
                <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=user" />
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-2xl">
                  U
                </AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-bold mt-4 text-foreground">Your Name</h2>
              <p className="text-sm text-muted-foreground">{userEmail}</p>
              <Button 
                size="sm" 
                variant="outline" 
                className="mt-3 hover:bg-primary/10 hover:text-primary transition-all duration-300"
              >
                Edit Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
          <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
            <CardHeader className="pb-3">
              <BookHeart className="w-6 h-6 text-primary mb-2" />
              <CardTitle className="text-2xl font-bold">12</CardTitle>
              <p className="text-sm text-muted-foreground">Journal Entries</p>
            </CardHeader>
          </Card>
          
          <Card className="bg-gradient-to-br from-accent/10 to-primary/10 border-accent/20">
            <CardHeader className="pb-3">
              <Heart className="w-6 h-6 text-accent mb-2" />
              <CardTitle className="text-2xl font-bold">5</CardTitle>
              <p className="text-sm text-muted-foreground">Friends</p>
            </CardHeader>
          </Card>
        </div>

        {/* Settings section */}
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="w-5 h-5" />
              Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="ghost" className="w-full justify-start">
              Account Settings
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              Privacy & Security
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              Notifications
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              Help & Support
            </Button>
          </CardContent>
        </Card>

        {/* Logout button */}
        <Button 
          variant="outline"
          className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>

      <BottomNav />
    </div>
  );
};

export default Profile;
