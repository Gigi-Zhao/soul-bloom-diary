import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, MessageCircle, Sparkles, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCachedState } from "@/hooks/use-cached-state";

interface AIRole {
  id: string;
  name: string;
  description: string;
  avatar_url: string;
}

/**
 * Friends Page Component
 * Chat with AI companions for support and guidance
 */
const Friends = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [aiRoles, setAiRoles] = useCachedState<AIRole[]>('friends-ai-roles', []);
  const [loading, setLoading] = useState(true);

  // Update loading state when aiRoles changes
  useEffect(() => {
    if (aiRoles.length > 0) {
      setLoading(false);
    }
  }, [aiRoles.length]);

  useEffect(() => {
    const fetchAIRoles = async () => {
      // Always fetch fresh data
      const { data, error } = await supabase
        .from('ai_roles')
        .select('id, name, description, avatar_url')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching AI roles:', error);
        toast({
          title: "加载失败",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setAiRoles(data || []);
      }
      setLoading(false);
    };

    fetchAIRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only fetch once on mount

  return (
    <div className="min-h-screen pb-24 pt-8 px-4 bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="max-w-md mx-auto mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-[0_4px_16px_hsl(var(--primary)/0.3)]">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">AI 伙伴</h1>
            <p className="text-sm text-muted-foreground">与智能伙伴聊天，获得支持与指引</p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-md mx-auto space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">加载中...</p>
          </div>
        ) : (
          <>
            {/* Create new AI friend button */}
            <Card 
              className="transition-all duration-300 hover:shadow-[0_4px_16px_hsl(var(--primary)/0.2)] cursor-pointer bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20"
              onClick={() => navigate('/create-friend')}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center">
                    <Plus className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base font-semibold">创建你的专属AI伙伴</CardTitle>
                    <p className="text-sm text-muted-foreground">点击开始创建</p>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* AI Companions list */}
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              <h2 className="text-lg font-semibold text-foreground">我的 AI 伙伴</h2>
              
              {aiRoles.map((role, index) => (
                <Card 
                  key={role.id}
                  className="transition-all duration-300 hover:shadow-[0_4px_16px_hsl(var(--primary)/0.2)] cursor-pointer"
                  onClick={() => navigate(`/chat/${role.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12 border-2 border-primary/20">
                        <AvatarImage src={role.avatar_url} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                          {role.name.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <CardTitle className="text-base font-semibold">{role.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{role.description}</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="hover:bg-primary/10 hover:text-primary transition-all duration-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/chat/${role.id}`);
                        }}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>

            {/* Info card */}
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
              <Card className="bg-gradient-to-br from-accent/20 to-primary/20 border-accent/30">
                <CardContent className="pt-6">
                  <p className="text-sm text-center text-muted-foreground">
                    与AI伙伴聊天，获得专业的情感支持和生活指导
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Friends;
