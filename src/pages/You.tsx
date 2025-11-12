import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BottomNav } from "@/components/ui/bottom-nav";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCachedState } from "@/hooks/use-cached-state";

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
  title: string;
  sender_role: 'user' | 'ai';
}

/**
 * You Page Component
 * Main character profile page with conversation history
 */
const You = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [aiRole, setAiRole] = useCachedState<AIRole | null>('you-ai-role', null);
  const [conversations, setConversations] = useCachedState<ConversationSummary[]>('you-conversations', []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Skip fetching if we already have cached data
    if (aiRole && conversations.length > 0) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/auth");
          return;
        }

        // Fetch "小兵" AI role (hardcoded for now)
        const { data: roleData, error: roleError } = await supabase
          .from('ai_roles')
          .select('id, name, avatar_url, catchphrase')
          .eq('name', '小兵')
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
            .select('id, created_at, title')
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
                  title: conv.title || '新对话',
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
  }, [navigate, toast, aiRole, conversations.length, setAiRole, setConversations]);

  const handleChatClick = () => {
    if (aiRole) {
      // Start a new conversation (no conversation ID)
      navigate(`/chat/${aiRole.id}`);
    }
  };

  const handleConversationClick = (conversationId: string) => {
    if (aiRole) {
      // Continue an existing conversation
      navigate(`/chat/${aiRole.id}?conversation=${conversationId}`);
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
    <div className="min-h-screen flex flex-col bg-[#f5e6e8] pb-20">
      {/* Hero Section with Background */}
      <div className="relative h-[40vh] min-h-[280px] overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${aiRole.avatar_url})`,
          }}
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#f5e6e8]/30 to-[#f5e6e8]" />
      </div>

      {/* Character Info Section */}
      <div className="px-6 -mt-8 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {aiRole.name}
        </h1>
        
        {aiRole.catchphrase && (
          <p className="text-sm text-gray-600 italic mb-4">"{aiRole.catchphrase}"</p>
        )}
        
        <Button 
          onClick={handleChatClick}
          className="bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg"
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          开始聊天
        </Button>
      </div>

      {/* Conversation History Section */}
      <ScrollArea className="flex-1 px-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-700">对话回顾</h2>
          </div>

          {conversations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">还没有对话记录</p>
              <Button 
                variant="outline" 
                onClick={handleChatClick}
                className="hover:bg-white/50"
              >
                开始第一次对话
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {conversations.map((conv, index) => {
                const isUserInitiated = conv.sender_role === 'user';
                
                return (
                  <div
                    key={conv.id}
                    onClick={() => handleConversationClick(conv.id)}
                    className="relative animate-in fade-in slide-in-from-bottom-4 duration-700 cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    {/* Timestamp on the right */}
                    <div className="flex justify-end mb-2">
                      <span className="text-xs text-gray-400">
                        {new Date(conv.created_at).toLocaleString('zh-CN', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        }).toUpperCase()}
                      </span>
                      <Avatar className="w-6 h-6 ml-2">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=user`} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs">
                          我
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    <div className="flex gap-3">
                      {!isUserInitiated && (
                        <Avatar className="w-10 h-10 flex-shrink-0 mt-1">
                          <AvatarImage src={aiRole.avatar_url} />
                          <AvatarFallback className="bg-gray-600 text-white text-xs">
                            {aiRole.name.slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      
                      <div className={`flex-1 ${isUserInitiated ? '' : ''}`}>
                        <div
                          // 调整气泡框的背景色和透明度
                          className="bg-white/32 backdrop-blur-sm rounded-3xl px-6 py-4 shadow-sm hover:shadow-md transition-shadow"
                        >
                          {/* Display AI-generated title */}
                          <h3 className="text-base font-semibold text-gray-900 mb-2">
                            {conv.title}
                          </h3>
                          {/* Display first message as preview */}
                          <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
                            {conv.first_message}
                          </p>
                        </div>
                      </div>
                    </div>
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
