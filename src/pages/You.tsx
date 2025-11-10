import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BottomNav } from "@/components/ui/bottom-nav";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AIRole {
  id: string;
  name: string;
  avatar_url: string;
  catchphrase: string;
}

interface ConversationSummary {
  id: string;
  created_at: string;
  first_message: string;
  sender_role: 'user' | 'ai';
}

/**
 * You Page Component
 * Main character profile page with conversation history
 */
const You = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [aiRole, setAiRole] = useState<AIRole | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/auth");
          return;
        }

        // Fetch "Soldier" AI role (hardcoded for now)
        const { data: roleData, error: roleError } = await supabase
          .from('ai_roles')
          .select('id, name, avatar_url, catchphrase')
          .eq('name', 'Soldier')
          .maybeSingle();

        if (roleError) throw roleError;
        
        if (!roleData) {
          // If no Soldier role, get the first available role
          const { data: firstRole } = await supabase
            .from('ai_roles')
            .select('id, name, avatar_url, catchphrase')
            .limit(1)
            .single();
          
          if (firstRole) {
            setAiRole(firstRole);
          } else {
            toast({
              title: "未找到角色",
              description: "请先创建一个AI角色",
              variant: "destructive",
            });
            navigate("/friends");
            return;
          }
        } else {
          setAiRole(roleData);
        }

        // Fetch conversation summaries
        if (roleData?.id) {
          const { data: convData } = await supabase
            .from('conversations')
            .select('id, created_at')
            .eq('user_id', user.id)
            .eq('ai_role_id', roleData.id)
            .order('created_at', { ascending: false })
            .limit(10);

          if (convData) {
            // Fetch first message for each conversation
            const summaries = await Promise.all(
              convData.map(async (conv) => {
                const { data: msgData } = await supabase
                  .from('messages')
                  .select('content, sender_role, created_at')
                  .eq('conversation_id', conv.id)
                  .order('created_at', { ascending: true })
                  .limit(1)
                  .maybeSingle();

                return {
                  id: conv.id,
                  created_at: conv.created_at,
                  first_message: msgData?.content || '开始新对话',
                  sender_role: (msgData?.sender_role === 'system' ? 'ai' : msgData?.sender_role) || 'user' as 'user' | 'ai',
                };
              })
            );

            setConversations(summaries);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: "加载失败",
          description: error instanceof Error ? error.message : "未知错误",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate, toast]);

  const handleChatClick = () => {
    if (aiRole) {
      navigate(`/chat/${aiRole.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (!aiRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">未找到角色</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background pb-20">
      {/* Hero Section with Background */}
      <div className="relative h-[40vh] min-h-[280px] overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${aiRole.avatar_url})`,
            filter: 'blur(8px) brightness(0.7)',
            transform: 'scale(1.1)',
          }}
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/30 to-background" />
        
        {/* Character Avatar & Info */}
        <div className="absolute bottom-8 left-0 right-0 px-6 flex flex-col items-center">
          <Avatar className="w-24 h-24 border-4 border-background shadow-[0_8px_32px_hsl(var(--primary)/0.4)] mb-4">
            <AvatarImage src={aiRole.avatar_url} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-2xl">
              {aiRole.name.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          
          <h1 className="text-2xl font-bold text-white drop-shadow-lg mb-2">
            {aiRole.name}
          </h1>
          
          {aiRole.catchphrase && (
            <div className="bg-background/80 backdrop-blur-sm rounded-full px-4 py-2 mb-3">
              <p className="text-sm text-foreground italic">"{aiRole.catchphrase}"</p>
            </div>
          )}
          
          <Button 
            onClick={handleChatClick}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            开始聊天
          </Button>
        </div>
      </div>

      {/* Conversation History Section */}
      <ScrollArea className="flex-1 px-4 pt-6">
        <div className="max-w-md mx-auto space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">对话回顾</h2>
          </div>

          {conversations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">还没有对话记录</p>
              <Button 
                variant="outline" 
                onClick={handleChatClick}
                className="hover:bg-primary/10"
              >
                开始第一次对话
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {conversations.map((conv, index) => {
                const isUserInitiated = conv.sender_role === 'user';
                
                return (
                  <div
                    key={conv.id}
                    className={`flex gap-2 animate-in fade-in slide-in-from-bottom-4 duration-700`}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    {!isUserInitiated && (
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src={aiRole.avatar_url} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs">
                          {aiRole.name.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                    <div className={`flex-1 ${isUserInitiated ? 'flex justify-end' : ''}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                          isUserInitiated
                            ? "bg-gradient-to-r from-primary/80 to-accent/80 text-white ml-auto"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        <p className="text-sm line-clamp-2 mb-1">{conv.first_message}</p>
                        <p className={`text-xs ${isUserInitiated ? "text-white/70" : "text-muted-foreground"}`}>
                          {new Date(conv.created_at).toLocaleDateString('zh-CN', {
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>

                    {isUserInitiated && (
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=user`} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs">
                          我
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      <BottomNav />
    </div>
  );
};

export default You;
