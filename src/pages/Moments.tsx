import { BottomNav } from "@/components/ui/bottom-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sparkles, Heart, MessageCircle, Share2 } from "lucide-react";

/**
 * Moments Page Component
 * Social feed where users can view and share inspirational moments
 * Features posts, interactions, and community support
 */
const Moments = () => {
  // Sample moments data
  const moments = [
    {
      user: "Emma Wilson",
      initials: "EW",
      time: "2 hours ago",
      content: "Just finished my morning meditation. Feeling so grateful for this peaceful moment. 🌸",
      likes: 12,
      comments: 3,
    },
    {
      user: "Alex Chen",
      initials: "AC",
      time: "5 hours ago",
      content: "Today I chose to be kind to myself. Small steps lead to big changes! 💪",
      likes: 24,
      comments: 8,
    },
    {
      user: "Sarah Johnson",
      initials: "SJ",
      time: "1 day ago",
      content: "Reflecting on how far I've come. Every challenge was worth it. 🌟",
      likes: 18,
      comments: 5,
    },
  ];

  return (
    <div className="min-h-screen pb-24 pt-8 px-4 bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="max-w-md mx-auto mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-[0_4px_16px_hsl(var(--primary)/0.3)]">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Moments</h1>
            <p className="text-sm text-muted-foreground">Share your journey</p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-md mx-auto space-y-4">
        {/* Create moment card */}
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="w-10 h-10 border-2 border-primary/20">
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm">
                  You
                </AvatarFallback>
              </Avatar>
              <p className="text-sm text-muted-foreground flex-1">
                Share a moment from your journey...
              </p>
            </div>
            <Button 
              size="sm" 
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all duration-300"
            >
              Create Moment
            </Button>
          </CardContent>
        </Card>

        {/* Moments feed */}
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
          {moments.map((moment, index) => (
            <Card 
              key={index}
              className="transition-all duration-300 hover:shadow-[0_4px_16px_hsl(var(--primary)/0.2)]"
            >
              <CardHeader>
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10 border-2 border-primary/20">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${moment.user}`} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm">
                      {moment.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-base font-semibold">{moment.user}</CardTitle>
                    <p className="text-xs text-muted-foreground">{moment.time}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground mb-4 leading-relaxed">
                  {moment.content}
                </p>
                
                {/* Interaction buttons */}
                <div className="flex items-center gap-4 pt-3 border-t border-border">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="flex-1 hover:bg-primary/10 hover:text-primary transition-all duration-300"
                  >
                    <Heart className="w-4 h-4 mr-2" />
                    <span className="text-xs">{moment.likes}</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="flex-1 hover:bg-primary/10 hover:text-primary transition-all duration-300"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    <span className="text-xs">{moment.comments}</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="flex-1 hover:bg-primary/10 hover:text-primary transition-all duration-300"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    <span className="text-xs">Share</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Moments;
