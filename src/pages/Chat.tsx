import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  conversation_id: string;
  sender_role: 'user' | 'ai' | 'system';
  content: string;
  created_at: string;
}

interface AIRole {
  id: string;
  name: string;
  description: string;
  prompt: string;
  model: string;
  avatar_url: string;
}

interface Conversation {
  id: string;
  user_id: string;
  ai_role_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const Chat = () => {
  const { roleId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [aiRole, setAiRole] = useState<AIRole | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const streamingMessageRef = useRef<string>("");
  const currentStreamingIdRef = useRef<string | null>(null);

  // Function to update streaming message in UI
  const updateStreamingMessage = (content: string) => {
    if (!currentStreamingIdRef.current) return;

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === currentStreamingIdRef.current
          ? { ...msg, content }
          : msg
      )
    );
    scrollToBottom();
  };

  useEffect(() => {
    const initializeChat = async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setCurrentUserId(user.id);

      // Fetch AI role
      if (roleId) {
        const { data: role, error: roleError } = await supabase
          .from('ai_roles')
          .select('*')
          .eq('id', roleId)
          .single();

        if (roleError) {
          console.error('Error fetching AI role:', roleError);
          toast({
            title: "Error loading AI role",
            description: roleError.message,
            variant: "destructive",
          });
          navigate("/friends");
          return;
        }
        setAiRole(role);

        // Find or create conversation
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('*')
          .eq('user_id', user.id)
          .eq('ai_role_id', roleId)
          .eq('title', `与${role.name}的对话`)
          .maybeSingle();

        if (existingConv) {
          setConversationId(existingConv.id);
        } else {
          // Create new conversation
          const { data: newConv, error: convError } = await supabase
            .from('conversations')
            .insert({
              user_id: user.id,
              ai_role_id: roleId,
              title: `与${role.name}的对话`,
            })
            .select()
            .single();

          if (convError) {
            console.error('Error creating conversation:', convError);
            toast({
              title: "Error creating conversation",
              description: convError.message,
              variant: "destructive",
            });
          } else {
            setConversationId(newConv.id);
          }
        }
      }
    };

    initializeChat();
  }, [roleId, navigate, toast]);

  useEffect(() => {
    if (!conversationId) return;

    // Fetch messages
    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          const newMsg = payload.new as Message;

          // Only add if it's for this conversation and not already in the list
          if (newMsg.conversation_id === conversationId && !messageIdsRef.current.has(newMsg.id)) {
            messageIdsRef.current.add(newMsg.id);
            setMessages((prev) => [...prev, newMsg]);
            scrollToBottom();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const fetchMessages = async () => {
    if (!conversationId) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      toast({
        title: "Error loading messages",
        description: error.message,
        variant: "destructive",
      });
    } else {
      const messageData = data || [];
      setMessages(messageData);
      messageIdsRef.current = new Set(messageData.map(m => m.id));
      setTimeout(scrollToBottom, 100);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversationId || !aiRole || !currentUserId) return;

    const userMessageContent = newMessage.trim();
    setNewMessage("");
    setIsLoading(true);

    try {
      // Insert user message
      const { data: userMsgData, error: userMsgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_role: 'user',
          content: userMessageContent,
        })
        .select()
        .single();

      if (userMsgError) {
        console.error('Error sending message:', userMsgError);
        toast({
          title: "Error sending message",
          description: userMsgError.message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Add user message to UI immediately
      if (userMsgData) {
        messageIdsRef.current.add(userMsgData.id);
        setMessages((prev) => [...prev, userMsgData]);
        scrollToBottom();
      }

      // Fetch conversation history for context
      const { data: historyData } = await supabase
        .from('messages')
        .select('sender_role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(20);

      const conversationHistory = historyData || [];

      // Prepare messages for AI
      const aiMessages = [
        { role: 'system', content: aiRole.prompt },
        ...conversationHistory.map(msg => ({
          role: msg.sender_role === 'user' ? 'user' : 'assistant',
          content: msg.content
        }))
      ];

      // Call OpenRouter API (SSE streaming)
      try {
        const apiBase = (import.meta as any)?.env?.VITE_API_BASE_URL ?? '';
        const primaryEndpoint = apiBase ? `${apiBase.replace(/\/$/, '')}/api/chat` : '/api/chat';
        const fallbackEndpoint = 'https://soul-bloom-diary.vercel.app/api/chat';

        const makeRequest = async (url: string) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);
          try {
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: aiRole.model,
                messages: aiMessages,
              }),
              signal: controller.signal,
              cache: 'no-store',
            });
            return res;
          } finally {
            clearTimeout(timeoutId);
          }
        };
        // Start request
        let aiRes = await makeRequest(primaryEndpoint);
        if (aiRes.status === 404 && primaryEndpoint !== fallbackEndpoint) {
          aiRes = await makeRequest(fallbackEndpoint);
        }

        if (!aiRes.ok || !aiRes.body) {
          const text = await aiRes.text().catch(() => '');
          throw new Error(`AI API error: ${aiRes.status} ${text}`);
        }

        // Add a temporary streaming AI message to UI
        const tempId = `streaming-${Date.now()}`;
        currentStreamingIdRef.current = tempId;
        streamingMessageRef.current = "";
        setMessages((prev) => [
          ...prev,
          {
            id: tempId,
            conversation_id: conversationId,
            sender_role: 'ai',
            content: "",
            created_at: new Date().toISOString(),
          } as Message,
        ]);
        scrollToBottom();

        const reader = aiRes.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let fullText = '';
        let finished = false;

        const persistFinal = async () => {
          const finalText = fullText;
          if (!finalText) return;
          const { data: aiMsgData, error: aiMsgError } = await supabase
            .from('messages')
            .insert({
              conversation_id: conversationId!,
              sender_role: 'ai',
              content: finalText,
            })
            .select()
            .single();
          if (aiMsgError) {
            console.error('Error saving AI reply:', aiMsgError);
            toast({
              title: 'Error saving AI reply',
              description: aiMsgError.message,
              variant: 'destructive',
            });
          } else if (aiMsgData) {
            messageIdsRef.current.add(aiMsgData.id);
            setMessages((prev) => prev.map(m => m.id === tempId ? aiMsgData : m));
            currentStreamingIdRef.current = null;
            scrollToBottom();
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = buffer.indexOf('\n')) !== -1) {
            const rawLine = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);
            const line = rawLine.replace(/\r$/, '');
            if (!line) continue;
            if (line.startsWith('data:')) {
              const dataStr = line.slice(5); // 保留前导空格
              if (dataStr.trim() === '[DONE]') {
                finished = true;
                await persistFinal();
                break;
              } else {
                // 每个chunk都是纯文本，直接拼接
                fullText += dataStr;
                updateStreamingMessage(fullText);
              }
            }
          }
          if (finished) break;
        }

        // Flush tail if last partial line exists
        const tail = buffer.replace(/\r$/, '');
        if (!finished && tail && tail.startsWith('data:')) {
          const dataStr = tail.slice(5);
          if (dataStr && dataStr.trim() !== '[DONE]') {
            fullText += dataStr;
            updateStreamingMessage(fullText);
          }
          await persistFinal();
        }
      } catch (err: any) {
        console.error('AI chat error:', err);
        toast({
          title: 'AI回复失败',
          description: err?.name === 'AbortError' ? '请求超时，请重试' : err?.message ?? '无法获取AI回复',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error in handleSendMessage:', err);
      toast({
        title: "发送消息失败",
        description: "发生未知错误",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!aiRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/friends")}
          className="hover:bg-primary/10"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Avatar className="w-10 h-10 border-2 border-primary/20">
          <AvatarImage src={aiRole.avatar_url} />
          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
            {aiRole.name.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="font-semibold text-foreground">{aiRole.name}</h1>
          <p className="text-xs text-muted-foreground">{aiRole.description}</p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((message) => {
          const isUser = message.sender_role === 'user';
          return (
            <div
              key={message.id}
              className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <Avatar className="w-8 h-8 flex-shrink-0 mt-1">
                  <AvatarImage src={aiRole.avatar_url} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs">
                    {aiRole.name.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    isUser
                      ? "bg-gradient-to-r from-primary to-accent text-white"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className={`text-xs mt-1 ${isUser ? "text-white/70" : "text-muted-foreground"}`}>
                    {new Date(message.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              {isUser && (
                <Avatar className="w-8 h-8 flex-shrink-0 mt-1">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=user`} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs">
                    U
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSendMessage}
        className="bg-card border-t border-border px-4 py-3 flex items-center gap-2"
      >
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1"
          disabled={isLoading}
        />
        <Button
          type="submit"
          size="icon"
          className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
          disabled={!newMessage.trim() || isLoading}
        >
          <Send className="w-5 h-5" />
        </Button>
      </form>

      {/* 流式内容已直接更新到消息列表中的临时气泡 */}
    </div>
  );
};

export default Chat;
