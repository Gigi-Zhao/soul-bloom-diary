import { useEffect, useState, useRef } from "react";
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
  const [aiRole, setAiRole] = useState<AIRole | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [bubbleMessage, setBubbleMessage] = useState<string>("");
  const [loadingBubble, setLoadingBubble] = useState(false);
  const hasInitializedRef = useRef(false); // 防止重复初始化
  const bubbleRetryCountRef = useRef(0); // 气泡消息API重试计数
  const bubbleSuccessRef = useRef(false); // 气泡消息是否成功生成

  // 生成气泡消息 (仅在前端state中，不存入数据库)
  // 只有当用户点击气泡时，才会通过 handleBubbleClick 存入数据库
  // 带重试机制：最多重试3次，成功后不再请求
  const generateBubbleMessage = async (aiRoleName: string, isRetry: boolean = false) => {
    // 如果已经成功生成过，不再重复请求
    if (bubbleSuccessRef.current) {
      console.log('[Bubble] 气泡消息已成功生成，跳过重复请求');
      return;
    }

    // 检查重试次数
    if (isRetry) {
      bubbleRetryCountRef.current += 1;
      if (bubbleRetryCountRef.current > 3) {
        console.log('[Bubble] 已达到最大重试次数(3次)，停止重试');
        setBubbleMessage(`你对${aiRoleName}的热情，真让人期待啊......`);
        setLoadingBubble(false);
        return;
      }
      console.log(`[Bubble] 开始第 ${bubbleRetryCountRef.current} 次重试`);
    } else {
      bubbleRetryCountRef.current = 0;
      console.log('[Bubble] 首次请求气泡消息');
    }

    try {
      setLoadingBubble(true);
      console.log('[Bubble] 开始生成气泡消息（仅前端预览，不存数据库），角色：', aiRoleName);
      // 获取当前用户
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('[Bubble] 获取用户失败:', userError);
        throw userError;
      }
      if (!user) {
        console.warn('[Bubble] 未获取到用户，终止气泡生成');
        return;
      }
      // 获取最新的日记
      const { data: latestJournal, error: journalError } = await supabase
        .from('journal_entries')
        .select('content, mood, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (journalError) {
        console.error('[Bubble] 获取最新日记失败:', journalError);
        throw journalError;
      }
      console.log('[Bubble] 最新日记：', latestJournal);
      if (latestJournal) {
        // 调用API生成气泡消息
        console.log('[Bubble] 调用API参数:', {
          journalContent: latestJournal.content,
          mood: latestJournal.mood,
          aiRoleName: aiRoleName,
        });
        const response = await fetch('/api/generate-bubble-message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            journalContent: latestJournal.content,
            mood: latestJournal.mood,
            aiRoleName: aiRoleName,
          }),
        });
        console.log('[Bubble] API响应状态:', response.status);
        const text = await response.clone().text();
        console.log('[Bubble] API响应原文:', text);
        if (response.ok) {
          const data = await response.json();
          setBubbleMessage(data.message);
          bubbleSuccessRef.current = true; // 标记成功
          console.log('[Bubble] ✅ 生成气泡消息成功:', data.message);
          setLoadingBubble(false);
        } else {
          console.error('[Bubble] API调用失败:', response.status, text);
          throw new Error(`API返回错误: ${response.status}`);
        }
      } else {
        // 如果没有日记，使用默认消息并标记成功
        setBubbleMessage(`嘿！有什么想和我分享的吗？`);
        bubbleSuccessRef.current = true;
        console.log('[Bubble] ✅ 没有找到日记，使用默认气泡');
        setLoadingBubble(false);
      }
    } catch (error) {
      console.error('[Bubble] 生成气泡消息异常:', error);
      setLoadingBubble(false);
      
      // 如果还没达到重试上限，则重试
      if (bubbleRetryCountRef.current < 3) {
        console.log(`[Bubble] ⚠️ 请求失败，将进行重试...`);
        setTimeout(() => {
          generateBubbleMessage(aiRoleName, true);
        }, 1000 * (bubbleRetryCountRef.current + 1)); // 递增延迟：1秒、2秒、3秒
      } else {
        // 达到重试上限，使用默认消息
        setBubbleMessage(`你对${aiRoleName}的热情，真让人期待啊......`);
      }
    }
  };

  useEffect(() => {
    // 防止重复初始化
    if (hasInitializedRef.current) {
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
            // 生成气泡消息
            await generateBubbleMessage(firstRole.name);
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
          // 生成气泡消息
          await generateBubbleMessage(roleData.name);
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
        hasInitializedRef.current = true; // 标记已初始化
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 空依赖数组，只在组件挂载时执行一次 (navigate/toast 稳定，不需要加入依赖)

  const handleChatClick = () => {
    if (aiRole) {
      // Start a new conversation (no conversation ID)
      navigate(`/chat/${aiRole.id}`);
    }
  };

  // When user clicks the floating bubble, create a conversation with
  // an initial AI message (the bubbleMessage) and navigate into it so
  // the AI message appears as sent and waits for the user's reply.
  // 【重要】只有点击气泡时，消息才会被存入数据库
  const handleBubbleClick = async () => {
    if (!aiRole) return;
    try {
      setLoading(true);
      // Ensure bubbleMessage is available; fall back to catchphrase
      const initialContent = bubbleMessage || aiRole.catchphrase || `嘿！有什么想和我分享的吗？`;
      
      console.log('[Bubble Click] 用户点击气泡，开始创建对话并存入消息:', initialContent);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // Create a new conversation record
      const timestamp = new Date().toLocaleString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          ai_role_id: aiRole.id,
          title: `${timestamp} 对话`,
        })
        .select()
        .single();

      if (convError || !newConv) {
        console.error('[Bubble Click] 创建对话失败:', convError);
        toast({ title: '创建对话失败', description: convError?.message || '未知错误', variant: 'destructive' });
        return;
      }

      console.log('[Bubble Click] 对话创建成功，ID:', newConv.id);

      // Insert AI initial message (存入数据库)
      const { data: aiMsg, error: aiMsgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: newConv.id,
          sender_role: 'ai',
          content: initialContent,
        })
        .select()
        .single();

      if (aiMsgError) {
        console.error('[Bubble Click] 插入AI消息失败:', aiMsgError);
        toast({ title: '发送消息失败', description: aiMsgError.message, variant: 'destructive' });
        // Still navigate so user can start a conversation
      } else {
        console.log('[Bubble Click] AI消息已存入数据库，消息ID:', aiMsg?.id);
      }

      // Navigate into the chat with the conversation id so Chat.tsx loads messages
      navigate(`/chat/${aiRole.id}?conversation=${newConv.id}`);
    } catch (error) {
      console.error('handleBubbleClick error:', error);
      toast({ title: '操作失败', description: error instanceof Error ? error.message : '未知错误', variant: 'destructive' });
    } finally {
      setLoading(false);
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
        
        {/* Floating Chat Bubble */}
        <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[85%] max-w-md">
          <div className="relative">
            {/* Main chat bubble (clickable) */}
            <div onClick={handleBubbleClick} role="button" tabIndex={0} className="bg-white/50 backdrop-blur-sm rounded-2xl px-6 py-4 shadow-lg cursor-pointer">
              <p className="text-sm text-gray-800 leading-relaxed">
                {loadingBubble ? (
                  <span className="text-gray-500">...</span>
                ) : (
                  bubbleMessage || aiRole.catchphrase || `你对${aiRole.name}的热情，真让人期待啊......`
                )}
              </p>
            </div>
            {/* Tail circles - bottom left corner at 45° angle */}
            <div className="absolute bottom-0 left-0">
              <div className="w-3 h-3 bg-white/50 backdrop-blur-sm rounded-full absolute -bottom-2 left-3"></div>
              <div className="w-2 h-2 bg-white/50 backdrop-blur-sm rounded-full absolute -bottom-4 left-1"></div>
            </div>
          </div>
        </div>
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
                      {/* 只在用户发起时显示用户头像 */}
                      {isUserInitiated && (
                        <Avatar className="w-6 h-6 ml-2">
                          <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=user`} />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs">
                            我
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>

                    <div className="flex gap-3">
                      {/* 只在 AI 发起时显示 AI 头像 */}
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
                          className="bg-white/50 backdrop-blur-sm rounded-3xl px-6 py-4 shadow-sm hover:shadow-md transition-shadow"
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
