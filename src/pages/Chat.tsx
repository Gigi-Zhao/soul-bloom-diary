import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { ArrowLeft, Send, MoreVertical, History, MessageSquarePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatAIText } from "@/lib/utils";

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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [aiRole, setAiRole] = useState<AIRole | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isNewConversation, setIsNewConversation] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const streamingMessageRef = useRef<string>("");
  const currentStreamingIdRef = useRef<string | null>(null);
  const conversationCreatedRef = useRef(false);
  const hasGeneratedTitleRef = useRef(false);
  const hasNewMessagesRef = useRef(false); // 追踪是否有新消息发送
  
  // 从气泡点击传递来的初始AI消息（未持久化）
  const pendingInitialAIMessageRef = useRef<string | null>(null);

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
    // 移除自动滚动，让用户控制滚动行为
  };

  // Function to generate conversation title based on last 5 messages
  const generateConversationTitle = useCallback(async () => {
    console.log('[Title] 🎯 开始生成对话标题');
    console.log('[Title] conversationId:', conversationId);
    console.log('[Title] aiRole:', aiRole?.name);
    console.log('[Title] hasGeneratedTitleRef.current:', hasGeneratedTitleRef.current);
    
    if (!conversationId || !aiRole || hasGeneratedTitleRef.current) {
      console.log('[Title] ⏭️ 跳过标题生成：', {
        noConversationId: !conversationId,
        noAiRole: !aiRole,
        alreadyGenerated: hasGeneratedTitleRef.current
      });
      return;
    }

    try {
      console.log('[Title] 📥 开始获取最近5条消息...');
      // Fetch last 5 messages
      const { data: recentMessages, error: fetchError } = await supabase
        .from('messages')
        .select('sender_role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(5) as { data: Array<{ sender_role: string; content: string }> | null; error: unknown };

      if (fetchError) {
        console.error('[Title] ❌ 获取消息失败:', fetchError);
        return;
      }

      console.log('[Title] 📊 获取到消息数量:', recentMessages?.length || 0);
      
      if (!recentMessages || recentMessages.length === 0) {
        console.log('[Title] ⚠️ 没有消息可以生成标题');
        return;
      }

      // Reverse to get chronological order
      const messagesForSummary = recentMessages.reverse();
      console.log('[Title] 📝 用于生成标题的消息:', messagesForSummary);

      // Create prompt for title generation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conversationContext = (messagesForSummary as any[])
        .map(msg => `${msg.sender_role === 'user' ? '用户' : 'AI'}: ${msg.content}`)
        .join('\n');

      const titlePrompt = `请基于以下对话内容，生成一个简短的对话主题标题（15个字以内，风格拟人、温柔、自然）。只返回标题文本，不要其他内容。

对话内容：
${conversationContext}

标题：`;

      console.log('[Title] 📤 生成标题的prompt长度:', titlePrompt.length);

      // Call AI API to generate title
      const apiBase = (import.meta as { env?: { VITE_API_BASE_URL?: string } })?.env?.VITE_API_BASE_URL ?? '';
      const primaryEndpoint = apiBase ? `${apiBase.replace(/\/$/, '')}/api/generate-title` : '/api/generate-title';
      const fallbackEndpoint = 'https://soul-bloom-diary.vercel.app/api/generate-title';

      console.log('[Title] 🌐 使用端点:', primaryEndpoint);

      const makeRequest = async (url: string) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        try {
          console.log('[Title] 🔄 发送请求到:', url);
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: aiRole.model,
              prompt: titlePrompt,
            }),
            signal: controller.signal,
            cache: 'no-store',
          });
          console.log('[Title] 📨 收到响应，状态码:', res.status);
          return res;
        } catch (err) {
          console.error('[Title] ⚠️ 请求异常:', err);
          throw err;
        } finally {
          clearTimeout(timeoutId);
        }
      };

      let aiRes = await makeRequest(primaryEndpoint);
      if (aiRes.status === 404 && primaryEndpoint !== fallbackEndpoint) {
        console.log('[Title] 🔄 主端点404，尝试备用端点:', fallbackEndpoint);
        aiRes = await makeRequest(fallbackEndpoint);
      }

      if (!aiRes.ok) {
        // 读取错误响应
        const errorText = await aiRes.text().catch(() => 'Unknown error');
        console.error('[Title] ❌ API调用失败, status:', aiRes.status, 'error:', errorText);
        hasGeneratedTitleRef.current = false;
        return;
      }

      console.log('[Title] 📖 开始解析JSON响应...');
      const data = await aiRes.json() as {
        title?: string;
      };

      console.log('[Title] 📋 API返回数据:', data);

      const generatedTitle = data.title?.trim()
        .replace(/^["'「『]|["'」』]$/g, '')
        .substring(0, 30);

      console.log('[Title] 🧹 清理后的标题:', generatedTitle);

      if (!generatedTitle) {
        console.log('[Title] ⚠️ 生成的标题为空，保留默认标题');
        hasGeneratedTitleRef.current = false;
        return;
      }

      // 额外验证：确保标题不包含错误关键词
      if (generatedTitle.toLowerCase().includes('error') || 
          generatedTitle.toLowerCase().includes('upstream') ||
          generatedTitle.includes('{') || 
          generatedTitle.includes('}')) {
        console.error('[Title] ❌ 标题包含错误指示词:', generatedTitle);
        hasGeneratedTitleRef.current = false;
        return;
      }

      console.log('[Title] ✅ 标题验证通过，准备更新数据库');

      // Update conversation title in database
      const { error: updateError } = await (supabase
        .from('conversations')
        // @ts-expect-error Supabase types mismatch
        .update({ title: generatedTitle })
        .eq('id', conversationId) as unknown as Promise<{ error: unknown }>);

      if (updateError) {
        console.error('[Title] ❌ 更新标题失败:', updateError);
      } else {
        console.log('[Title] 🎉 标题更新成功:', generatedTitle);
        hasGeneratedTitleRef.current = true;
      }
    } catch (error) {
      // 捕获所有错误但不显示给用户（标题生成失败不影响主功能）
      console.error('[Title] ❌ 生成标题异常:', error);
      // 如果是网络错误或超时，静默失败
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[Title] ⏱️ 标题生成超时，保留默认标题');
      }
    }
  }, [conversationId, aiRole]);

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

        // Check if conversation ID is passed via URL params
        const conversationIdParam = searchParams.get('conversation');
        
        if (conversationIdParam) {
          // Load existing conversation by ID
          const { data: existingConv, error: convError } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', conversationIdParam)
            .eq('user_id', user.id)
            .eq('ai_role_id', roleId)
            .maybeSingle() as { data: Conversation | null; error: unknown };

          if (convError || !existingConv) {
            console.error('Error fetching conversation:', convError);
            toast({
              title: "无法加载对话",
              description: "对话可能已被删除",
              variant: "destructive",
            });
            navigate(`/you`);
            return;
          }
          
          setConversationId(existingConv.id);
          setIsNewConversation(false);
          conversationCreatedRef.current = true;
        } else {
          // No conversation ID in URL - check if there's an existing conversation with this role
          const { data: existingConversations, error: convError } = await supabase
            .from('conversations')
            .select('*')
            .eq('user_id', user.id)
            .eq('ai_role_id', roleId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle() as { data: Conversation | null; error: unknown };

          if (existingConversations && !convError) {
            // Found existing conversation - load it
            console.log('[Chat Init] 找到现有对话，加载历史记录');
            setConversationId(existingConversations.id);
            setIsNewConversation(false);
            conversationCreatedRef.current = true;
          } else {
            // No existing conversation - prepare for new one
            console.log('[Chat Init] 无现有对话，准备创建新对话');
            setIsNewConversation(true);
            setConversationId(null);
            
            // 检查是否从气泡点击带来了初始AI消息
            const navState = location.state as { initialAIMessage?: string } | null;
            if (navState?.initialAIMessage) {
              console.log('[Chat Init] 检测到初始AI消息（来自气泡点击）:', navState.initialAIMessage);
              pendingInitialAIMessageRef.current = navState.initialAIMessage;
              
              // 在UI中显示临时的AI消息（使用临时ID，conversation_id为空字符串）
              const tempMsg: Message = {
                id: `temp-initial-${Date.now()}`,
                conversation_id: '', // 暂时为空，等创建对话后更新
                sender_role: 'ai',
                content: navState.initialAIMessage,
                created_at: new Date().toISOString(),
              };
              setMessages([tempMsg]);
              setTimeout(scrollToBottom, 100);
            }
          }
        }
      }
    };

    initializeChat();
  }, [roleId, searchParams, navigate, toast, location]);

  // 移除 beforeunload 事件处理：标题现在在 AI 回复后自动生成，无需在页面卸载时处理

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }) as { data: Message[] | null; error: unknown };

    if (error) {
      console.error('Error loading messages:', error);
      toast({
        title: "Error loading messages",
        description: (error as Error)?.message || 'Unknown error',
        variant: "destructive",
      });
    } else {
      const messageData = data || [];
      setMessages(messageData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messageIdsRef.current = new Set((messageData as any[]).map(m => m.id));
      // 首次加载消息时滚动到底部，但之后不再自动滚动
      // 只在用户发送新消息时滚动
      if (messageData.length > 0) {
        setTimeout(() => scrollToBottom(), 100);
      }
    }
  }, [conversationId, toast]);

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
            // 移除实时订阅时的自动滚动，避免干扰用户阅读
            // 只有用户主动发送消息时才滚动
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, fetchMessages]);

  // 滚动到底部，但保持距离底部有若干行的距离（类似Gemini/ChatGPT的效果）
  const scrollToBottom = () => {
    if (!messagesEndRef.current) return;
    
    // 获取消息容器
    const messagesContainer = messagesEndRef.current.parentElement;
    if (!messagesContainer) return;
    
    // 计算滚动位置：滚动到底部，但保留约3-4行的空间（约120px）
    const scrollHeight = messagesContainer.scrollHeight;
    const clientHeight = messagesContainer.clientHeight;
    const offset = 120; // 保留约3-4行的空间
    
    messagesContainer.scrollTo({
      top: scrollHeight - clientHeight - offset,
      behavior: "smooth"
    });
  };

  const handleBackClick = () => {
    // 在后台异步生成标题（不等待完成，不阻塞导航）
    if (conversationId && !hasGeneratedTitleRef.current && hasNewMessagesRef.current) {
      // 使用 Promise 在后台执行，即使导航后也能完成
      generateConversationTitle().catch(err => {
        // 静默处理错误，不影响用户体验
        console.error('Background title generation failed:', err);
      });
    }
    // 立即导航，不等待标题生成完成
    // 检查是否从 You 页面进入（通过 location.state）
    const navState = location.state as { from?: string; initialAIMessage?: string } | null;
    if (navState?.from === '/you') {
      navigate("/you");
    } else {
      navigate("/friends");
    }
  };

  const handleViewHistory = () => {
    navigate(`/conversation-history/${roleId}`);
  };

  const handleNewConversation = () => {
    // 重置状态，开始新对话
    setConversationId(null);
    setMessages([]);
    setIsNewConversation(true);
    conversationCreatedRef.current = false;
    hasGeneratedTitleRef.current = false;
    hasNewMessagesRef.current = false;
    messageIdsRef.current.clear();
    
    toast({
      title: "新对话",
      description: "已开始新的对话",
    });
  };

  const handleDeleteConversation = async () => {
    if (!conversationId) {
      toast({
        title: "错误",
        description: "当前没有对话可删除",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: "删除失败",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "删除成功",
        description: "对话已删除",
      });
      // 导航回朋友页面
      navigate("/friends");
    }

    setDeleteDialogOpen(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !aiRole || !currentUserId) return;

    const userMessageContent = newMessage.trim();
    setNewMessage("");
    setIsLoading(true);

    try {
      let activeConversationId = conversationId;

      // Create conversation if this is the first message
      if (!conversationCreatedRef.current && !conversationId) {
        const timestamp = new Date().toLocaleString('zh-CN', {
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        
        const { data: newConv, error: convError } = (await supabase
          .from('conversations')
          // @ts-expect-error Supabase types mismatch
          .insert({
            user_id: currentUserId,
            ai_role_id: roleId,
            title: `${timestamp} 对话`,
          })
          .select()
          .single()) as { data: Conversation | null; error: unknown };

        if (convError || !newConv) {
          console.error('Error creating conversation:', convError);
          toast({
            title: "创建对话失败",
            description: (convError as Error)?.message || "无法创建对话",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const conv = newConv as any;
        activeConversationId = conv.id;
        setConversationId(conv.id);
        setIsNewConversation(false);
        conversationCreatedRef.current = true;
        
        // 如果有待保存的初始AI消息（来自气泡点击），现在保存到数据库
        if (pendingInitialAIMessageRef.current) {
          console.log('[Chat] 保存初始AI消息到数据库:', pendingInitialAIMessageRef.current);
          const { data: initialAIMsg, error: initialAIError } = (await supabase
            .from('messages')
            .insert({
              conversation_id: activeConversationId,
              sender_role: 'ai',
              content: pendingInitialAIMessageRef.current,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)
            .select()
            .single()) as { data: Message | null; error: unknown };

          if (initialAIError) {
            console.error('[Chat] 保存初始AI消息失败:', initialAIError);
          } else if (initialAIMsg) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const msgId = (initialAIMsg as any).id;
            console.log('[Chat] 初始AI消息已保存，ID:', msgId);
            // 更新UI中的临时消息为真实消息
            messageIdsRef.current.add(msgId);
            setMessages(prev => prev.map(m => 
              m.id.startsWith('temp-initial-') ? initialAIMsg : m
            ));
          }
          
          // 清除待保存标记
          pendingInitialAIMessageRef.current = null;
        }
      }

      if (!activeConversationId) {
        toast({
          title: "错误",
          description: "无法创建对话",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Insert user message
      const { data: userMsgData, error: userMsgError } = (await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversationId,
          sender_role: 'user',
          content: userMessageContent,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .select()
        .single()) as { data: Message | null; error: unknown };

      if (userMsgError) {
        console.error('Error sending message:', userMsgError);
        toast({
          title: "Error sending message",
          description: (userMsgError as Error)?.message || 'Unknown error',
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Add user message to UI immediately
      if (userMsgData) {
        messageIdsRef.current.add(userMsgData.id);
        setMessages((prev) => [...prev, userMsgData]);
        // 用户发送消息后，滚动到底部（保持若干行距离）
        setTimeout(() => scrollToBottom(), 50);
        
        // Mark that new messages have been sent in this session
        hasNewMessagesRef.current = true;
      }

      // Fetch conversation history for context
      // 获取最新的20条消息（先按降序取20条，再反转顺序）
      const { data: historyData } = await supabase
        .from('messages')
        .select('id, sender_role, content, created_at')
        .eq('conversation_id', activeConversationId)
        .order('created_at', { ascending: false })  // 先降序获取最新的
        .limit(20) as { data: Array<{ id: string; sender_role: string; content: string; created_at: string }> | null };

      // 反转顺序，使最旧的在前，最新的在后
      const conversationHistory = (historyData || []).reverse();

      // 调试：打印数据库原始数据
      console.log('🗄️ Raw DB data (latest 20):', conversationHistory);
      console.log('🔢 DB message count:', conversationHistory.length);

      // Prepare messages for AI
      const aiMessages = [
        { role: 'system', content: aiRole.prompt },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(conversationHistory as any[]).map(msg => ({
          role: msg.sender_role === 'user' ? 'user' : 'assistant',
          content: msg.content
        }))
      ];

      // 调试：打印传递给 AI 的消息
      console.log('📤 Sending to AI:', JSON.stringify(aiMessages, null, 2));
      console.log('📊 Message count:', aiMessages.length);
      console.log('📝 Last 5 messages:', aiMessages.slice(-5));

      // Call OpenRouter API (SSE streaming)
      try {
        const apiBase = (import.meta as { env?: { VITE_API_BASE_URL?: string } })?.env?.VITE_API_BASE_URL ?? '';
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
            conversation_id: activeConversationId,
            sender_role: 'ai',
            content: "",
            created_at: new Date().toISOString(),
          } as Message,
        ]);
        // 移除自动滚动，AI生成回复时不自动滚动

        const reader = aiRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const persistFinal = async () => {
          const finalText = streamingMessageRef.current;
          if (!finalText) return;
          // 格式化AI回复文本，去除多余空格
          const formattedText = formatAIText(finalText);
          const { data: aiMsgData, error: aiMsgError } = (await supabase
            .from('messages')
            .insert({
              conversation_id: activeConversationId!,
              sender_role: 'ai',
              content: formattedText,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)
            .select()
            .single()) as { data: Message | null; error: unknown };
          if (aiMsgError) {
            console.error('Error saving AI reply:', aiMsgError);
            toast({
              title: 'Error saving AI reply',
              description: (aiMsgError as Error)?.message || 'Unknown error',
              variant: 'destructive',
            });
          } else if (aiMsgData) {
            messageIdsRef.current.add(aiMsgData.id);
            setMessages((prev) => prev.map(m => m.id === tempId ? aiMsgData : m));
            currentStreamingIdRef.current = null;
            streamingMessageRef.current = "";
            // 移除自动滚动，AI回复完成后不自动滚动
            // 让用户自己控制是否查看完整回复
            
            // 不在这里生成标题，改为用户点击返回时生成
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
                await persistFinal();
                break;
              } else {
                // 尝试解析JSON字符串（为了支持包含换行符的内容），如果失败则作为普通文本
                try {
                  const parsed = JSON.parse(dataStr);
                  if (typeof parsed === 'string') {
                    streamingMessageRef.current += parsed;
                  } else {
                    // 如果解析出来不是字符串（可能是数字等），或者为了兼容旧逻辑，回退到原始字符串
                    // 但通常api/chat.ts发送的都是stringified string
                    streamingMessageRef.current += dataStr;
                  }
                } catch (e) {
                  // 解析失败，说明是普通纯文本（旧格式）
                  streamingMessageRef.current += dataStr;
                }
                
                // 实时格式化显示，但保存时会再次格式化，流式输出时不去除末尾空格以保留换行
                updateStreamingMessage(formatAIText(streamingMessageRef.current, false));
              }
            }
          }
        }

        // Flush tail if last partial line exists
        const tail = buffer.replace(/\r$/, '');
        if (tail && tail.startsWith('data:')) {
          const dataStr = tail.slice(5);
          if (dataStr.trim() === '[DONE]') {
            await persistFinal();
          } else if (dataStr) {
            streamingMessageRef.current += dataStr;
            // 实时格式化显示，但保存时会再次格式化
            updateStreamingMessage(formatAIText(streamingMessageRef.current, false));
            await persistFinal();
          }
        }
      } catch (err: unknown) {
        console.error('AI chat error:', err);
        const error = err instanceof Error ? err : new Error('Unknown error');
        toast({
          title: 'AI回复失败',
          description: error.name === 'AbortError' ? '请求超时，请重试' : error.message ?? '无法获取AI回复',
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
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 flex-shrink-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBackClick}
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
        <div className="flex-1">
          <h1 className="font-semibold text-foreground">{aiRole.name}</h1>
          <p className="text-xs text-muted-foreground">{aiRole.description}</p>
        </div>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-primary/10"
            >
              <MoreVertical className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            alignOffset={-100} 
            sideOffset={2} 
            className="w-48 z-[150]"
            avoidCollisions={false}
            collisionPadding={0}
          >
            <DropdownMenuItem onClick={handleViewHistory}>
              <History className="w-4 h-4 mr-2" />
              查看历史对话
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleNewConversation}>
              <MessageSquarePlus className="w-4 h-4 mr-2" />
              开始新对话
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDeleteDialogOpen(true)}
              className="text-destructive focus:text-destructive"
              disabled={!conversationId}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              删除当前对话
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
        className="bg-card border-t border-border px-4 py-3 flex items-center gap-2 flex-shrink-0"
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除当前对话吗？此操作无法撤销，所有聊天记录将被永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConversation}
              className="bg-destructive hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 流式内容已直接更新到消息列表中的临时气泡 */}
    </div>
  );
};

export default Chat;
