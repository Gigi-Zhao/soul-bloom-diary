import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, History, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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

// 消息角色类型
type MessageRole = 'narrator' | 'npc' | 'user';

// 消息结构
interface DreamMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

// 用户设定
interface DreamSetup {
  oneSentence: string;   // 一句话故事
  identity: string;      // 身份
  dailyLife: string;     // 日常
  person: string;        // 想遇到的人
  tone: string;          // 基调
}

// AI返回的JSON结构
interface AIResponse {
  narrator?: string;       // 旁白文本
  npc_say?: string;        // NPC对话
  options: string[];       // 3个建议选项
}

// 状态类型
type DreamStatus = 'idle' | 'loading' | 'typing';

// 梦境记录接口
interface DaydreamRecord {
  id: string;
  title: string;
  setup: DreamSetup;
  messages: DreamMessage[];
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

const Daydream = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // 默认示例内容
  const defaultExamples = {
    oneSentence: '想要逃离枯燥的现实，去往一个充满魔法的世界',
    identity: '一名普通的银行职员',
    dailyLife: '每天对着电脑处理枯燥的报表',
    person: '一位神秘的陌生人',
    tone: '温暖治愈'
  };
  
  // 状态管理
  const [phase, setPhase] = useState<'setup' | 'story'>('setup');
  const [setup, setSetup] = useState<DreamSetup>({
    oneSentence: '',
    identity: '',
    dailyLife: '',
    person: '',
    tone: ''
  });
  const [messages, setMessages] = useState<DreamMessage[]>([]);
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);
  const [status, setStatus] = useState<DreamStatus>('idle');
  const [userInput, setUserInput] = useState('');
  
  // 历史记录相关状态
  const [showHistory, setShowHistory] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<DaydreamRecord[]>([]);
  const [currentDreamId, setCurrentDreamId] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // 打字机效果状态
  const [typingText, setTypingText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingQueueRef = useRef<DreamMessage[]>([]);
  
  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages, typingText]);
  
  // 打字机效果
  const typeMessage = async (message: DreamMessage) => {
    return new Promise<void>((resolve) => {
      setIsTyping(true);
      setTypingText('');
      
      let currentIndex = 0;
      const text = message.content;
      const speed = 30; // 打字速度（毫秒）
      
      const timer = setInterval(() => {
        if (currentIndex < text.length) {
          setTypingText(text.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          clearInterval(timer);
          setIsTyping(false);
          setTypingText('');
          setMessages(prev => [...prev, message]);
          console.log('[Daydream] 📝 消息已添加到历史记录');
          resolve();
        }
      }, speed);
      
      typingTimeoutRef.current = timer;
    });
  };
  
  // 处理打字队列
  useEffect(() => {
    // 减少日志输出，仅在队列非空或状态变化关键时刻输出
    if (typingQueueRef.current.length > 0 || status === 'typing') {
      // console.log('[Daydream] 🔍 检查打字队列:', { queueLength: typingQueueRef.current.length, isTyping, status });
    }
    
    // 如果队列为空且不在打字中，确保状态为idle
    if (typingQueueRef.current.length === 0 && !isTyping && status === 'typing') {
      console.log('[Daydream] 📭 队列已空，重置状态为idle');
      setStatus('idle');
      return;
    }
    
    // 如果有消息待处理且当前不在打字中
    if (typingQueueRef.current.length > 0 && !isTyping) {
      const nextMessage = typingQueueRef.current.shift();
      if (nextMessage) {
        console.log('[Daydream] ⌨️ 开始打字:', nextMessage.role);
        setStatus('typing');
        typeMessage(nextMessage).then(() => {
          // 打字完成后，触发重新检查队列（通过改变状态触发useEffect）
          if (typingQueueRef.current.length === 0) {
            console.log('[Daydream] 📭 没有更多消息，设置为idle');
            setStatus('idle');
          }
        });
      }
    }
  }, [isTyping, status]);
  
  // 添加消息到打字队列
  const addMessageWithTyping = (message: DreamMessage) => {
    typingQueueRef.current.push(message);
  };
  
  // 调用AI API
  const callDaydreamAPI = async (isInitial: boolean = false, currentMessages: DreamMessage[] = messages) => {
    console.log('[Daydream] 🚀 开始调用API');
    console.log('[Daydream] isInitial:', isInitial);
    console.log('[Daydream] setup:', setup);
    console.log('[Daydream] messages history (count):', currentMessages.length);
    
    setStatus('loading');
    setCurrentOptions([]);
    
    // 创建AbortController
    abortControllerRef.current = new AbortController();
    
    try {
      console.log('[Daydream] 📡 准备发送请求到 /api/daydream');
      const requestBody = {
        setup: setup,
        history: currentMessages.map(m => ({
          role: m.role,
          content: m.content
        })),
        isInitial: isInitial
      };
      
      console.log('[Daydream] 📤 请求体:', requestBody);
      
      // 使用与Chat相同的endpoint逻辑
      const apiBase = (import.meta as { env?: { VITE_API_BASE_URL?: string } })?.env?.VITE_API_BASE_URL ?? '';
      const primaryEndpoint = apiBase ? `${apiBase.replace(/\/$/, '')}/api/daydream` : '/api/daydream';
      const fallbackEndpoint = 'https://soul-bloom-diary.vercel.app/api/daydream';
      
      console.log('[Daydream] 🎯 主端点:', primaryEndpoint);
      console.log('[Daydream] 🔄 备用端点:', fallbackEndpoint);
      
      const makeRequest = async (url: string) => {
        console.log('[Daydream] 📞 尝试请求:', url);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
            cache: 'no-store',
          });
          return res;
        } finally {
          clearTimeout(timeoutId);
        }
      };
      
      // 先尝试主端点
      let response = await makeRequest(primaryEndpoint);
      
      // 如果404且有备用端点，尝试备用
      if (response.status === 404 && primaryEndpoint !== fallbackEndpoint) {
        console.log('[Daydream] ⚠️ 主端点404，尝试备用端点');
        response = await makeRequest(fallbackEndpoint);
      }
      
      console.log('[Daydream] 📥 收到响应:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Daydream] ❌ API请求失败:', response.status, errorText);
        throw new Error(`API请求失败: ${response.status} ${errorText}`);
      }
      
      const rawData: AIResponse = await response.json();
      console.log('[Daydream] 📦 原始数据:', rawData);
      
      // 客户端二次解析逻辑（以防后端使用的是旧版并未能正确解析复杂文本）
      const data = { ...rawData };
      
      // 使用正则检查是否包含未解析的标记（更宽松的匹配）
      const hasUnparsedMarkers = data.narrator && (
        /(?:旁白|Narrator|对话|NPC|Say|选项|Options)\s*[:：]/.test(data.narrator)
      );

      if (hasUnparsedMarkers) {
        console.log('[Daydream] ⚠️ 检测到未解析的结构化文本，尝试客户端修复...');
        console.log('[Daydream] 📝 原始内容片段:', data.narrator?.substring(0, 50));
        
        try {
            const cleanContent = data.narrator
                .replace(/```json\s*/g, '')
                .replace(/```\s*/g, '')
                .replace(/\*\*/g, '')
                .trim();
                
            const narratorMatch = cleanContent.match(/(?:旁白|Narrator)(?:\s*[：:]|\s+)\s*([\s\S]*?)(?=(?:对话|NPC|Say|选项|Options)(?:\s*[：:]|\s+)|$)/i);
            const npcMatch = cleanContent.match(/(?:对话|NPC|Say)(?:\s*[：:]|\s+)\s*([\s\S]*?)(?=(?:选项|Options)(?:\s*[：:]|\s+)|$)/i);
            const optionsMatch = cleanContent.match(/(?:选项|Options)(?:\s*[：:]|\s+)\s*([\s\S]*?)$/i);
            
            if (narratorMatch || npcMatch || optionsMatch) {
                 if (narratorMatch) {
                     data.narrator = narratorMatch[1].trim();
                 } else if (!npcMatch && !optionsMatch) {
                     // 只有文本，去掉可能的"旁白："前缀
                     data.narrator = cleanContent.replace(/^(?:旁白|Narrator)(?:\s*[：:]|\s+)/i, '').trim();
                 } else {
                    // 有其他部分，尝试作为第一部分
                    const parts = cleanContent.split(/(?:对话|NPC|Say|选项|Options)(?:\s*[：:]|\s+)/i);
                    if (parts.length > 0) {
                        data.narrator = parts[0].trim().replace(/^(?:旁白|Narrator)(?:\s*[：:]|\s+)/i, '');
                    }
                 }
                 
                 if (npcMatch) {
                     data.npc_say = npcMatch[1].trim();
                 }
                 
                 const optionsText = optionsMatch ? optionsMatch[1].trim() : "";
                 if (optionsText) {
                    let parsedOptions: string[] = [];
                    // 尝试解析JSON
                    if (optionsText.startsWith('[')) {
                        try {
                            parsedOptions = JSON.parse(optionsText);
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                    // 尝试解析列表
                    if (parsedOptions.length === 0) {
                         parsedOptions = optionsText.split(/(?:\d+[.、)]|[ABC][.、)])\s*/).filter(s => s.trim()).map(s => s.trim());
                    }
                    // 尝试按行
                    if (parsedOptions.length === 0) {
                         parsedOptions = optionsText.split(/[\n;；]/).filter(s => s.trim().length > 2)
                            .map(s => s.replace(/^[-*•"'`\s\d.、)）]+/, '').replace(/["'`]\s*$/, '').trim());
                    }
                    
                    if (parsedOptions.length > 0) {
                        data.options = parsedOptions.slice(0, 3);
                    }
                 }
                 console.log('[Daydream] ✅ 客户端修复完成:', data);
            }
        } catch (e) {
            console.warn('[Daydream] ⚠️ 客户端修复失败:', e);
        }
      }
      
      console.log('[Daydream] 📦 最终使用数据:', data);

      // 处理旁白
      if (data.narrator) {
        console.log('[Daydream] 📖 添加旁白消息');
        addMessageWithTyping({
          id: `narrator-${Date.now()}`,
          role: 'narrator',
          content: data.narrator,
          timestamp: Date.now()
        });
      }
      
      // 处理NPC对话
      if (data.npc_say) {
        console.log('[Daydream] 💬 添加NPC对话');
        addMessageWithTyping({
          id: `npc-${Date.now()}`,
          role: 'npc',
          content: data.npc_say,
          timestamp: Date.now()
        });
      }
      
      // 设置选项（稍后显示，等打字完成）
      const estimatedTypingTime = ((data.narrator?.length || 0) + (data.npc_say?.length || 0)) * 30 + 500;
      console.log('[Daydream] ⏱️ 预计打字时间:', estimatedTypingTime, 'ms');
      
      setTimeout(() => {
        console.log('[Daydream] 🎯 设置选项:', data.options);
        setCurrentOptions(data.options || []);
      }, estimatedTypingTime);
      
      // 重置状态，让打字效果可以开始
      console.log('[Daydream] 🔄 重置状态为idle');
      setStatus('idle');
      console.log('[Daydream] ✅ API调用完成');
      
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[Daydream] ⏹️ 请求被取消');
      } else {
        console.error('[Daydream] ❌ API调用失败:', error);
        if (error instanceof Error) {
          console.error('[Daydream] 错误消息:', error.message);
          console.error('[Daydream] 错误堆栈:', error.stack);
        }
        toast({
          title: "出错了",
          description: error instanceof Error ? error.message : "无法生成故事内容，请重试",
          variant: "destructive"
        });
        setStatus('idle');
      }
    }
  };
  
  // 开始白日梦
  const handleStartDream = () => {
    console.log('[Daydream] 🌟 用户点击开始做梦');
    if (!setup.oneSentence || !setup.identity || !setup.dailyLife || !setup.person || !setup.tone) {
      console.warn('[Daydream] ⚠️ 设定信息不完整');
      toast({
        title: "请填写完整",
        description: "请填写所有必填项后再开始",
        variant: "destructive"
      });
      return;
    }
    
    console.log('[Daydream] ✨ 进入故事模式');
    setPhase('story');
    callDaydreamAPI(true);
  };
  
  // 处理用户选择/输入
  const handleUserChoice = (choice: string) => {
    console.log('[Daydream] 👆 用户选择:', choice);
    if (status !== 'idle') {
      console.warn('[Daydream] ⚠️ 当前状态不是idle，跳过:', status);
      return;
    }
    
    // 添加用户消息
    const userMessage: DreamMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: choice,
      timestamp: Date.now()
    };
    
    console.log('[Daydream] 💭 添加用户消息到历史:', choice);
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setUserInput('');
    
    // 调用API，传入最新的消息历史
    callDaydreamAPI(false, newMessages);
  };
  
  // 处理发送按钮
  const handleSend = () => {
    if (userInput.trim() && status === 'idle') {
      handleUserChoice(userInput.trim());
    }
  };
  
  // 处理Tab键补全
  const handleTabComplete = (e: React.KeyboardEvent<HTMLInputElement>, field: keyof typeof setup) => {
    if (e.key === 'Tab' && !setup[field]) {
      e.preventDefault();
      setSetup(prev => ({ ...prev, [field]: defaultExamples[field] }));
    }
  };
    // 加载历史记录
  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('daydreams')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setHistoryRecords(data || []);
    } catch (error) {
      console.error('加载历史记录失败:', error);
      toast({
        title: "加载失败",
        description: "无法加载历史记录",
        variant: "destructive"
      });
    } finally {
      setIsLoadingHistory(false);
    }
  };
  
  // 保存当前梦境
  const saveDream = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "请先登录",
          description: "需要登录后才能保存梦境",
          variant: "destructive"
        });
        return;
      }
      
      // 生成标题：使用setup.oneSentence的前20个字符
      const title = setup.oneSentence.length > 20 
        ? setup.oneSentence.substring(0, 20) + '...'
        : setup.oneSentence;
      
      const dreamData = {
        user_id: user.id,
        title,
        setup,
        messages,
        is_completed: false
      };
      
      if (currentDreamId) {
        // 更新现有梦境
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('daydreams')
          .update(dreamData)
          .eq('id', currentDreamId);
        
        if (error) throw error;
      } else {
        // 创建新梦境
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('daydreams')
          .insert([dreamData])
          .select()
          .single();
        
        if (error) throw error;
        if (data) {
          setCurrentDreamId(data.id);
        }
      }
      
      setHasUnsavedChanges(false);
      toast({
        title: "保存成功",
        description: "梦境已保存",
      });
    } catch (error) {
      console.error('保存梦境失败:', error);
      toast({
        title: "保存失败",
        description: "无法保存梦境",
        variant: "destructive"
      });
    }
  };
  
  // 加载历史梦境
  const loadDream = async (record: DaydreamRecord) => {
    setCurrentDreamId(record.id);
    setSetup(record.setup);
    setMessages(record.messages);
    setPhase('story');
    setShowHistory(false);
    setHasUnsavedChanges(false);
    
    toast({
      title: "梦境已加载",
      description: "可以继续这场梦了",
    });
  };
  
  // 删除梦境
  const deleteDream = async (id: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('daydreams')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setHistoryRecords(prev => prev.filter(r => r.id !== id));
      toast({
        title: "删除成功",
        description: "梦境已删除",
      });
    } catch (error) {
      console.error('删除梦境失败:', error);
      toast({
        title: "删除失败",
        description: "无法删除梦境",
        variant: "destructive"
      });
    }
  };
  
  // 处理返回按钮
  const handleBack = () => {
    if (phase === 'story' && messages.length > 0 && !currentDreamId) {
      setShowSaveDialog(true);
    } else {
      navigate(-1);
    }
  };
  
  // 确认保存并离开
  const handleSaveAndLeave = async () => {
    await saveDream();
    navigate(-1);
  };
  
  // 放弃并离开
  const handleDiscardAndLeave = () => {
    navigate(-1);
  };
  
  // 监听消息变化，标记为有未保存的更改
  useEffect(() => {
    if (phase === 'story' && messages.length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [messages, phase]);
    // 清理函数
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearInterval(typingTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  
  // 渲染设置页面
  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-purple-50 relative overflow-hidden">
        {/* 动态背景效果 */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-20 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
          <div className="absolute top-40 right-20 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-20 left-40 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
        </div>
        
        <div className="relative z-10 container mx-auto px-5 py-8 max-w-2xl">
          <div className="flex items-center justify-between mb-8 mt-10">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-[#4A4A4A] hover:bg-white/50"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </div>
          
          <div className="bg-white/40 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/50">
            <h1 className="text-3xl font-semibold text-center mb-8 text-[#4A4A4A] animate-fade-in">
              我想做一场白日梦...
            </h1>
            
            <div className="mb-8 animate-fade-in flex flex-col items-center">
              <input
                type="text"
                placeholder="在这输入你想做的一场什么样的梦..."
                value={setup.oneSentence}
                onChange={(e) => setSetup(prev => ({ ...prev, oneSentence: e.target.value }))}
                className="w-full max-w-lg text-center bg-transparent border-b-2 border-[#9D85BE]/50 focus:border-[#9D85BE] outline-none px-2 py-2 text-lg text-[#4A4A4A] placeholder:text-[#999/60] transition-colors"
              />
              <p className="text-xs text-[#999] mt-2">
                💡 提示：按 Tab 键可快速填写所有示例内容
              </p>
            </div>
            
            <div className="space-y-6 animate-fade-in-up">
              <div className="space-y-2">
                <label className="text-base font-medium text-[#666]">我现在的身份是</label>
                <Input
                  placeholder="例如：一名普通的银行职员 (按Tab补全)"
                  value={setup.identity}
                  onChange={(e) => setSetup(prev => ({ ...prev, identity: e.target.value }))}
                  onKeyDown={(e) => handleTabComplete(e, 'identity')}
                  className="bg-white/60 border-white/80 text-[#4A4A4A] placeholder:text-[#999] focus:bg-white/80"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-base font-medium text-[#666]">我的平淡日常是</label>
                <Input
                  placeholder="例如：每天对着电脑处理枯燥的报表 (按Tab补全)"
                  value={setup.dailyLife}
                  onChange={(e) => setSetup(prev => ({ ...prev, dailyLife: e.target.value }))}
                  onKeyDown={(e) => handleTabComplete(e, 'dailyLife')}
                  className="bg-white/60 border-white/80 text-[#4A4A4A] placeholder:text-[#999] focus:bg-white/80"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-base font-medium text-[#666]">我想遇到的人是</label>
                <Input
                  placeholder="例如：一位神秘的陌生人 (按Tab补全)"
                  value={setup.person}
                  onChange={(e) => setSetup(prev => ({ ...prev, person: e.target.value }))}
                  onKeyDown={(e) => handleTabComplete(e, 'person')}
                  className="bg-white/60 border-white/80 text-[#4A4A4A] placeholder:text-[#999] focus:bg-white/80"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-base font-medium text-[#666]">故事的基调是</label>
                <Input
                  placeholder="例如：温暖治愈 / 悬疑刺激 / 浪漫甜蜜 (按Tab补全)"
                  value={setup.tone}
                  onChange={(e) => setSetup(prev => ({ ...prev, tone: e.target.value }))}
                  onKeyDown={(e) => handleTabComplete(e, 'tone')}
                  className="bg-white/60 border-white/80 text-[#4A4A4A] placeholder:text-[#999] focus:bg-white/80"
                />
              </div>
            </div>
            
            <div className="flex justify-center mt-8">
              <Button
                size="lg"
                onClick={handleStartDream}
                className="bg-gradient-to-r from-[#9D85BE] to-[#C5A3D9] hover:from-[#8B75A8] hover:to-[#B593C8] text-white px-8 py-6 text-lg rounded-full shadow-lg"
              >
                <Sparkles className="mr-2 h-5 w-5" />
                开始做梦
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // 渲染故事页面
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-purple-50 flex flex-col">
      {/* 顶部进度条 */}
      <div className="sticky top-0 z-10 bg-white/50 backdrop-blur-md px-5 py-4 border-b border-white/50">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="text-[#4A4A4A] hover:bg-white/50"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-white/60 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#9D85BE] to-[#C5A3D9] transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.round((messages.filter(m => m.role === 'user').length / 40) * 100))}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-[#4A4A4A] min-w-[50px] text-right">
                  {Math.min(100, Math.round((messages.filter(m => m.role === 'user').length / 40) * 100))}%
                </span>
              </div>
            </div>
            
            {/* 历史记录胶囊按钮 */}
            <Button
              variant="ghost"
              onClick={() => {
                setShowHistory(true);
                loadHistory();
              }}
              className="text-[#4A4A4A] hover:bg-white/50 flex items-center gap-2 rounded-full px-4 py-2 bg-white/30 backdrop-blur-sm border border-white/50 hover:bg-white/60 transition-all"
            >
              <History className="h-4 w-4" />
              <span className="text-sm font-medium">梦境记录</span>
            </Button>
          </div>
        </div>
      </div>
      
      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="container mx-auto max-w-3xl space-y-6">
          {messages.map((message) => (
            <div key={message.id} className="animate-fade-in-up">
              {message.role === 'narrator' && (
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/80 shadow-sm">
                  <p className="text-[#666] text-base leading-relaxed italic">
                    {message.content}
                  </p>
                </div>
              )}
              
              {message.role === 'npc' && (
                <div className="bg-gradient-to-br from-[#F3E8FF]/60 to-[#E9D5FF]/60 backdrop-blur-sm rounded-2xl p-6 border border-purple-200/60 shadow-sm">
                  <p className="text-[#4A4A4A] text-base leading-relaxed">
                    {message.content}
                  </p>
                </div>
              )}
              
              {message.role === 'user' && (
                <div className="flex justify-end">
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 max-w-md border border-white/80 shadow-sm">
                    <p className="text-[#4A4A4A]">
                      {message.content}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {/* 正在打字的消息 */}
          {isTyping && typingText && (
            <div className="animate-fade-in-up">
              {typingQueueRef.current[0]?.role === 'narrator' && (
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/80 shadow-sm">
                  <p className="text-[#666] text-base leading-relaxed italic">
                    {typingText}
                    <span className="animate-pulse">|</span>
                  </p>
                </div>
              )}
              
              {typingQueueRef.current[0]?.role === 'npc' && (
                <div className="bg-gradient-to-br from-[#F3E8FF]/60 to-[#E9D5FF]/60 backdrop-blur-sm rounded-2xl p-6 border border-purple-200/60 shadow-sm">
                  <p className="text-[#4A4A4A] text-base leading-relaxed">
                    {typingText}
                    <span className="animate-pulse">|</span>
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* Loading状态 */}
          {status === 'loading' && (
            <div className="flex justify-center">
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl px-6 py-3 border border-white/80 shadow-sm">
                <p className="text-[#666] text-sm flex items-center gap-2">
                  <span className="animate-spin">✨</span>
                  正在构思情节...
                </p>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* 底部输入区域 */}
      <div className="sticky bottom-0 bg-white/60 backdrop-blur-md border-t border-white/50 px-5 py-4">
        <div className="container mx-auto max-w-3xl">
          {/* 智能选项 */}
          {currentOptions.length > 0 && status === 'idle' && (
            <div className="mb-3 space-y-2">
              {currentOptions.map((option, index) => (
                <button
                  key={index}
                  onClick={() => {
                    console.log('[Daydream] 🖱️ 按钮被点击');
                    console.log('[Daydream] 选项内容:', option);
                    console.log('[Daydream] 当前status:', status);
                    handleUserChoice(option);
                  }}
                  className="w-full text-left bg-white/70 hover:bg-white/90 border border-white/80 rounded-2xl px-4 py-3 text-[#4A4A4A] transition-all hover:scale-[1.01] shadow-sm cursor-pointer"
                >
                  {option}
                </button>
              ))}
            </div>
          )}
          
          {/* 调试信息 */}
          {currentOptions.length > 0 && status !== 'idle' && (
            <div className="mb-3 p-3 bg-yellow-100 rounded text-xs text-gray-600">
              ⚠️ 选项已隐藏 - 当前状态: {status}
            </div>
          )}
          
          {/* 输入框 */}
          <div className="flex gap-2">
            <Input
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder={status === 'idle' ? "输入你的选择..." : "请等待..."}
              disabled={status !== 'idle'}
              className="bg-white/70 border-white/80 text-[#4A4A4A] placeholder:text-[#999] disabled:opacity-50 rounded-full"
            />
            <Button
              onClick={handleSend}
              disabled={status !== 'idle' || !userInput.trim()}
              className="bg-gradient-to-r from-[#9D85BE] to-[#C5A3D9] hover:from-[#8B75A8] hover:to-[#B593C8] disabled:opacity-50 rounded-full px-6"
            >
              发送
            </Button>
          </div>
        </div>
      </div>
      
      {/* 历史记录弹窗 */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-semibold text-[#4A4A4A]">梦境记录</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowHistory(false)}
                className="text-[#4A4A4A] hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            {/* 历史记录列表 */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-[#999]">加载中...</div>
                </div>
              ) : historyRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <History className="h-16 w-16 text-[#999] mb-4" />
                  <p className="text-[#999]">还没有梦境记录</p>
                  <p className="text-sm text-[#999] mt-2">开始做梦后保存即可查看历史记录</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {historyRecords.map((record) => (
                    <div
                      key={record.id}
                      className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-5 border border-purple-100 hover:shadow-md transition-all cursor-pointer group"
                      onClick={() => loadDream(record)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-[#4A4A4A] mb-1 group-hover:text-[#9D85BE] transition-colors">
                            {record.title}
                          </h3>
                          <p className="text-sm text-[#999]">
                            {new Date(record.created_at).toLocaleDateString('zh-CN', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDream(record.id);
                          }}
                          className="text-[#999] hover:text-red-500 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-[#999]">消息数量:</span>
                          <span className="font-medium text-[#4A4A4A]">{record.messages.length}</span>
                        </div>
                        {record.is_completed && (
                          <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            <Sparkles className="h-3 w-3" />
                            已完成
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* 保存对话框 */}
      <AlertDialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>是否保存这场梦？</AlertDialogTitle>
            <AlertDialogDescription>
              你可以选择保存这场梦以便之后继续，或者放弃这场梦的记录。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardAndLeave} className="rounded-full">
              放弃
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveAndLeave} className="rounded-full bg-gradient-to-r from-[#9D85BE] to-[#C5A3D9] hover:from-[#8B75A8] hover:to-[#B593C8]">
              保存
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* CSS动画 */}
      <style>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        
        .animate-fade-in-up {
          animation: fade-in-up 0.4s ease-out;
        }
        
        kbd {
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          border: 1px solid rgba(0,0,0,0.1);
        }
      `}</style>
    </div>
  );
};

export default Daydream;
