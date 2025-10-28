import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookHeart, Plus, Calendar, Sparkles } from "lucide-react";

/**
 * Journals Page Component
 * Main journal entries page with AI companion integration
 * Users can view, create, and manage their journal entries
 */
const Journals = () => {
  return (
    <div className="min-h-screen pb-24 pt-8 px-4 bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="max-w-md mx-auto mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-[0_4px_16px_hsl(var(--primary)/0.3)]">
            <BookHeart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Journals</h1>
            <p className="text-sm text-muted-foreground">Express your thoughts freely</p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-md mx-auto space-y-4">
        {/* Create new journal button */}
        <Button 
          className="w-full h-16 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all duration-300 shadow-[0_4px_16px_hsl(var(--primary)/0.3)] animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100"
        >
          <Plus className="w-5 h-5 mr-2" />
          Write New Entry
        </Button>

        {/* AI companion card */}
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 bg-gradient-to-br from-accent/20 to-primary/20 border-accent/30 shadow-[0_4px_16px_hsl(var(--accent)/0.2)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="w-5 h-5 text-accent" />
              Your AI Companion
            </CardTitle>
            <CardDescription>
              I'm here to listen and support you on your journey
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              "How are you feeling today? I'm here to help you reflect and grow."
            </p>
            <Button variant="secondary" size="sm" className="w-full">
              Chat with AI Companion
            </Button>
          </CardContent>
        </Card>

        {/* Recent entries section */}
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Recent Entries
          </h2>
          
          {/* Sample journal entry cards */}
          {[
            { date: "Today", mood: "Peaceful", preview: "Had a wonderful day reflecting on my growth..." },
            { date: "Yesterday", mood: "Hopeful", preview: "Started my morning with gratitude practice..." },
            { date: "2 days ago", mood: "Reflective", preview: "Thinking about the challenges I've overcome..." },
          ].map((entry, index) => (
            <Card 
              key={index}
              className="transition-all duration-300 hover:shadow-[0_4px_16px_hsl(var(--primary)/0.2)] cursor-pointer"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">{entry.date}</CardTitle>
                  <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                    {entry.mood}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {entry.preview}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Journals;
