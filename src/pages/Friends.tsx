import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, UserPlus, MessageCircle } from "lucide-react";

/**
 * Friends Page Component
 * Social connection page where users can connect with others
 * Features friend list and connection requests
 */
const Friends = () => {
  const navigate = useNavigate();
  
  // Sample friends data with UUID-format IDs (in production, these would be real user UUIDs from profiles table)
  const friends = [
    { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", name: "Emma Wilson", status: "Feeling grateful today", initials: "EW", online: true },
    { id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22", name: "Alex Chen", status: "Taking time for self-care", initials: "AC", online: true },
    { id: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33", name: "Sarah Johnson", status: "Reflecting on growth", initials: "SJ", online: false },
  ];

  return (
    <div className="min-h-screen pb-24 pt-8 px-4 bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="max-w-md mx-auto mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-[0_4px_16px_hsl(var(--primary)/0.3)]">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Friends</h1>
            <p className="text-sm text-muted-foreground">Connect and support each other</p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-md mx-auto space-y-4">
        {/* Add friend button */}
        <Button 
          className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all duration-300 shadow-[0_4px_16px_hsl(var(--primary)/0.3)] animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Add New Friend
        </Button>

        {/* Friends list */}
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
          <h2 className="text-lg font-semibold text-foreground">Your Friends</h2>
          
          {friends.map((friend, index) => (
            <Card 
              key={index}
              className="transition-all duration-300 hover:shadow-[0_4px_16px_hsl(var(--primary)/0.2)] cursor-pointer"
              onClick={() => navigate(`/chat/${friend.id}`)}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="w-12 h-12 border-2 border-primary/20">
                      <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.name}`} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                        {friend.initials}
                      </AvatarFallback>
                    </Avatar>
                    {friend.online && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
                    )}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base font-semibold">{friend.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{friend.status}</p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    className="hover:bg-primary/10 hover:text-primary transition-all duration-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/chat/${friend.id}`);
                    }}
                  >
                    <MessageCircle className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Suggested friends */}
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <h2 className="text-lg font-semibold text-foreground">Suggested Friends</h2>
          
          <Card className="bg-gradient-to-br from-accent/20 to-primary/20 border-accent/30">
            <CardContent className="pt-6">
              <p className="text-sm text-center text-muted-foreground">
                Connect with people who share similar journeys
              </p>
              <Button variant="secondary" size="sm" className="w-full mt-3">
                Discover People
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Friends;
